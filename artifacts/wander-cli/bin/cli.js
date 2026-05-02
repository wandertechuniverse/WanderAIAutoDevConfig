#!/usr/bin/env node
import 'dotenv/config';
import {
  intro,
  outro,
  select,
  text,
  spinner,
  note,
  cancel,
  isCancel,
  log,
} from '@clack/prompts';
import pc from 'picocolors';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { Command } from 'commander';
import OpenAI from 'openai';

// ─── CLI flags ────────────────────────────────────────────────────────────────

const program = new Command();
program
  .name('wander-ai')
  .description('Wander AI Auto Dev Config — IDE agent CLI')
  .version('1.0.0')
  .option('-d, --data <path>', 'path to your data directory', 'data')
  .option('-m, --model <model>', 'OpenAI model to use', 'gpt-4o')
  .option('--no-stream', 'disable streaming (wait for full response)')
  .parse(process.argv);

const opts = program.opts();
const DATA_DIR = resolve(process.cwd(), opts.data);
const MODEL = opts.model;
const STREAM = opts.stream;

// ─── Banner ───────────────────────────────────────────────────────────────────

function printBanner() {
  console.clear();
  const bar = pc.cyan('━'.repeat(48));
  console.log('');
  console.log('  ' + bar);
  console.log(
    '  ' +
    pc.bold(pc.cyan('  ⚡  WANDER AI')) +
    '  ' +
    pc.dim('Auto Dev Config'),
  );
  console.log(
    '  ' + pc.dim('  IDE Agent CLI  ·  v1.0.0  ·  model: ' + MODEL),
  );
  console.log('  ' + bar);
  console.log('');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadAgents() {
  const configPath = join(DATA_DIR, 'agents_config.json');
  if (!existsSync(configPath)) {
    note(
      pc.dim('Expected: ') + configPath + '\n' +
      pc.dim('Run from your project root, or pass ') + pc.cyan('--data <path>'),
      pc.yellow('agents_config.json not found'),
    );
    cancel('Cannot continue without agent configuration.');
    process.exit(1);
  }
  return JSON.parse(readFileSync(configPath, 'utf8'));
}

function loadSystemPrompt(agentId) {
  const personaPath = join(DATA_DIR, 'agents', `${agentId}.agent.md`);
  if (existsSync(personaPath)) {
    return readFileSync(personaPath, 'utf8');
  }
  return 'You are a helpful AI assistant specializing in software development. Be concise, precise, and technical.';
}

function buildSelectOptions(agents) {
  const leaders = agents.filter(a => a.agent_type === 'leader');
  const workers = agents.filter(a => a.agent_type === 'worker');

  return [
    // Leaders group
    ...leaders.map((a, i) => ({
      value: a.id,
      label:
        (i === 0 ? pc.dim('Leaders  ') : '         ') +
        pc.cyan(a.name),
      hint: a.role,
    })),
    // Workers group
    ...workers.map((a, i) => ({
      value: a.id,
      label:
        (i === 0 ? pc.dim('Workers  ') : '         ') +
        pc.white(a.name),
      hint: a.role,
    })),
  ];
}

// ─── Streaming response ───────────────────────────────────────────────────────

async function streamResponse(openai, messages) {
  const divider = pc.dim('─'.repeat(60));
  console.log('\n' + divider);
  console.log('');

  if (STREAM) {
    const stream = openai.chat.completions.stream({
      model: MODEL,
      messages,
      max_tokens: 8192,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) process.stdout.write(pc.white(delta));
    }

    await stream.finalChatCompletion();
  } else {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
      max_tokens: 8192,
    });
    process.stdout.write(pc.white(completion.choices[0]?.message?.content ?? ''));
  }

  console.log('\n');
  console.log(divider + '\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  printBanner();

  // ── API key check
  if (!process.env.OPENAI_API_KEY) {
    note(
      pc.dim('Add to your ') + pc.cyan('.env') + pc.dim(' file:\n') +
      pc.cyan('OPENAI_API_KEY=sk-...'),
      pc.yellow('OPENAI_API_KEY not set'),
    );
    cancel('Cannot connect without an API key.');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const agents = loadAgents();

  intro(pc.cyan('  Wander AI') + pc.dim('  —  select an agent to begin'));

  // ── Agent selection
  const agentId = await select({
    message: 'Which agent do you need?',
    options: buildSelectOptions(agents),
  });

  if (isCancel(agentId)) {
    cancel('Session cancelled.');
    process.exit(0);
  }

  const agent = agents.find(a => a.id === agentId);
  const systemPrompt = loadSystemPrompt(agentId);
  const messages = [{ role: 'system', content: systemPrompt }];

  log.success(
    pc.cyan(agent.name) + pc.dim('  ·  ') + pc.dim(agent.role),
  );

  // ── Conversation loop
  while (true) {
    const task = await text({
      message: pc.dim('You'),
      placeholder: 'Describe your task, paste code, or ask a question…  (Ctrl+C to exit)',
      validate: v => (v.trim() === '' ? 'Please enter a message.' : undefined),
    });

    if (isCancel(task)) {
      outro(pc.cyan('Session ended.') + pc.dim('  Run ') + pc.white('wander-ai') + pc.dim(' to start a new one.'));
      process.exit(0);
    }

    messages.push({ role: 'user', content: task.trim() });

    const s = spinner();
    s.start(pc.dim(`${agent.name} is thinking…`));

    let assistantReply = '';

    try {
      if (STREAM) {
        const stream = openai.chat.completions.stream({
          model: MODEL,
          messages,
          max_tokens: 8192,
        });

        s.stop(pc.cyan(agent.name) + pc.dim(':'));
        console.log('');

        const divider = pc.dim('─'.repeat(60));
        console.log(divider);

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            process.stdout.write(pc.white(delta));
            assistantReply += delta;
          }
        }

        console.log('\n' + divider + '\n');
        await stream.finalChatCompletion();
      } else {
        const completion = await openai.chat.completions.create({
          model: MODEL,
          messages,
          max_tokens: 8192,
        });
        assistantReply = completion.choices[0]?.message?.content ?? '';
        s.stop(pc.cyan(agent.name) + pc.dim(':'));
        console.log('');
        const divider = pc.dim('─'.repeat(60));
        console.log(divider);
        console.log(pc.white(assistantReply));
        console.log(divider + '\n');
      }

      // Keep conversation history
      messages.push({ role: 'assistant', content: assistantReply });
    } catch (err) {
      s.stop(pc.red('Request failed.'));
      note(err.message ?? String(err), pc.red('OpenAI Error'));
      // Don't exit — let the user try again
      messages.pop(); // remove the user message that failed
    }
  }
}

main().catch(err => {
  console.error(pc.red('\nUnexpected error:'), err.message ?? err);
  process.exit(1);
});
