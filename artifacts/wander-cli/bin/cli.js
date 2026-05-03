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
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ─── ESM __dirname shim ───────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── CLI flags ────────────────────────────────────────────────────────────────

const program = new Command();
program
  .name('wanderai')
  .description('WanderAI Auto Dev Config — IDE agent CLI')
  .version('1.0.0')
  .option('-d, --data <path>', 'path to your data directory', 'data')
  .option('-m, --model <model>', 'OpenAI model to use', 'gpt-4o')
  .option('--gemini-model <model>', 'Gemini model to use', 'gemini-1.5-pro')
  .option(
    '-p, --provider <provider>',
    'AI provider: openai | gemini | auto (auto = OpenAI if key present, else Gemini)',
    'auto',
  )
  .option('--no-stream', 'disable streaming (wait for full response)')
  .parse(process.argv);

const opts = program.opts();
const DATA_DIR     = resolve(process.cwd(), opts.data);
const MODEL        = opts.model;
const GEMINI_MODEL = opts.geminiModel;
const STREAM       = opts.stream;
const PROVIDER_FLAG = opts.provider; // 'openai' | 'gemini' | 'auto'

// ─── Provider resolution ──────────────────────────────────────────────────────

/**
 * Resolves which provider to use as primary based on flag + available keys.
 * Returns 'openai' | 'gemini'.
 * Exits with a helpful message if the required key is missing.
 */
function resolveProvider() {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;

  if (PROVIDER_FLAG === 'openai') {
    if (!hasOpenAI) {
      console.error(pc.red('\n❌  OPENAI_API_KEY is not set.\n') +
        pc.dim('    Add it to your .env file or shell profile and try again.\n'));
      process.exit(1);
    }
    return 'openai';
  }

  if (PROVIDER_FLAG === 'gemini') {
    if (!hasGemini) {
      console.error(pc.red('\n❌  GEMINI_API_KEY is not set.\n') +
        pc.dim('    Add it to your .env file or shell profile and try again.\n'));
      process.exit(1);
    }
    return 'gemini';
  }

  // auto — prefer OpenAI, fall back to Gemini
  if (hasOpenAI) return 'openai';
  if (hasGemini) return 'gemini';

  // Neither key available
  console.error(
    pc.red('\n❌  No API key found.\n') +
    pc.dim('    Set OPENAI_API_KEY or GEMINI_API_KEY in your .env file or shell profile.\n') +
    pc.dim('    Example:\n') +
    pc.cyan('      OPENAI_API_KEY=sk-...\n') +
    pc.cyan('      GEMINI_API_KEY=AIza...\n'),
  );
  process.exit(1);
}

// ─── Banner ───────────────────────────────────────────────────────────────────

function printBanner(provider) {
  console.clear();
  const bar = pc.cyan('━'.repeat(48));
  const providerLabel = provider === 'gemini'
    ? pc.yellow('gemini  ') + pc.dim('·  model: ' + GEMINI_MODEL)
    : pc.green('openai  ') + pc.dim('·  model: ' + MODEL);
  console.log('');
  console.log('  ' + bar);
  console.log(
    '  ' +
    pc.bold(pc.cyan('  ⚡  WANDERAI')) +
    '  ' +
    pc.dim('Auto Dev Config'),
  );
  console.log('  ' + pc.dim('  IDE Agent CLI  ·  v1.0.0  ·  provider: ') + providerLabel);
  console.log('  ' + bar);
  console.log('');
}

// ─── Path / config helpers ────────────────────────────────────────────────────

function resolveConfigPath() {
  const possiblePaths = [
    resolve(__dirname, '../../api-server/data/agents_config.json'),
    resolve(__dirname, '../../../api-server/data/agents_config.json'),
    resolve(process.cwd(), 'artifacts/api-server/data/agents_config.json'),
    join(DATA_DIR, 'agents_config.json'),
  ];

  for (const configPath of possiblePaths) {
    if (existsSync(configPath)) return configPath;
  }

  console.error('\n❌ WANDER AI CLI ERROR: Cannot find agents_config.json.');
  console.error('Ensure you are running from the project root or the monorepo is intact.\n');
  process.exit(1);
}

function loadAgents() {
  const configPath = resolveConfigPath();
  const rawConfig = JSON.parse(readFileSync(configPath, 'utf8'));
  return Array.isArray(rawConfig) ? rawConfig : rawConfig.agents;
}

function loadSystemPrompt(agentId) {
  const configPath = resolveConfigPath();
  const dataDir = dirname(configPath);
  const personaPath = join(dataDir, 'agents', `${agentId}.agent.md`);
  if (existsSync(personaPath)) {
    return readFileSync(personaPath, 'utf8');
  }
  return 'You are a helpful AI assistant specializing in software development. Be concise, precise, and technical.';
}

function buildSelectOptions(agents) {
  const leaders   = agents.filter(a => a.agent_type === 'leader');
  const workers   = agents.filter(a => a.agent_type === 'worker');
  const subagents = agents.filter(a => a.agent_type === 'subagent');

  return [
    ...leaders.map((a, i) => ({
      value: a.id,
      label: (i === 0 ? pc.dim('Leaders   ') : '          ') + pc.cyan(a.name),
      hint: a.role,
    })),
    ...workers.map((a, i) => ({
      value: a.id,
      label: (i === 0 ? pc.dim('Workers   ') : '          ') + pc.white(a.name),
      hint: a.role,
    })),
    ...subagents.map((a, i) => ({
      value: a.id,
      label: (i === 0 ? pc.dim('Subagents ') : '          ') + pc.magenta(a.name),
      hint: a.role,
    })),
  ];
}

// ─── OpenAI response handler ──────────────────────────────────────────────────

/**
 * Calls the OpenAI API and streams/returns the assistant reply.
 * Returns the full reply string.
 */
async function callOpenAI(openaiClient, messages, agentName) {
  const divider = pc.dim('─'.repeat(60));
  let reply = '';

  if (STREAM) {
    const stream = await openaiClient.chat.completions.create({
      model: MODEL,
      messages,
      max_tokens: 8192,
      stream: true,
    });

    console.log(divider);
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        process.stdout.write(pc.white(delta));
        reply += delta;
      }
    }
    console.log('\n' + divider + '\n');
  } else {
    const completion = await openaiClient.chat.completions.create({
      model: MODEL,
      messages,
      max_tokens: 8192,
    });
    reply = completion.choices[0]?.message?.content ?? '';
    console.log(divider);
    console.log(pc.white(reply));
    console.log(divider + '\n');
  }

  return reply;
}

// ─── Gemini response handler ──────────────────────────────────────────────────

/**
 * Converts an OpenAI-format messages array (with system role) into the
 * Gemini startChat history + final user message.
 */
function toGeminiParts(messages) {
  const nonSystem = messages.filter(m => m.role !== 'system');
  // history = everything except the last user message
  const history = nonSystem.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const lastMsg = nonSystem[nonSystem.length - 1]?.content ?? '';
  return { history, lastMsg };
}

/**
 * Calls the Gemini API and streams/returns the assistant reply.
 * Returns the full reply string.
 */
async function callGemini(genAIClient, systemPrompt, messages) {
  const divider = pc.dim('─'.repeat(60));
  let reply = '';

  const model = genAIClient.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemPrompt,
  });

  const { history, lastMsg } = toGeminiParts(messages);
  const chat = model.startChat({ history });

  if (STREAM) {
    const result = await chat.sendMessageStream(lastMsg);
    console.log(divider);
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        process.stdout.write(pc.white(text));
        reply += text;
      }
    }
    console.log('\n' + divider + '\n');
  } else {
    const result = await chat.sendMessage(lastMsg);
    reply = result.response.text();
    console.log(divider);
    console.log(pc.white(reply));
    console.log(divider + '\n');
  }

  return reply;
}

// ─── Fallback detection ───────────────────────────────────────────────────────

/**
 * Returns true when an OpenAI error should trigger a Gemini fallback:
 *   - HTTP 429 rate limit
 *   - Content policy / safety block
 */
function shouldFallback(err) {
  if (err?.status === 429) return true;
  const msg = (err?.message ?? String(err)).toLowerCase();
  return msg.includes('safety') || msg.includes('content_policy') || msg.includes('content policy');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const provider = resolveProvider();
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;

  // Initialise clients for whichever keys are present
  const openaiClient = hasOpenAI
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;
  const genAIClient = hasGemini
    ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    : null;

  // Whether automatic fallback from OpenAI → Gemini is available
  const canFallback = provider === 'openai' && !!genAIClient;

  printBanner(provider);

  const agents = loadAgents();
  intro(pc.cyan('  WanderAI') + pc.dim('  —  select an agent to begin'));

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
  // messages holds the full conversation in OpenAI format; callGemini converts on the fly
  const messages = [{ role: 'system', content: systemPrompt }];

  log.success(pc.cyan(agent.name) + pc.dim('  ·  ') + pc.dim(agent.role));

  // ── Conversation loop
  while (true) {
    const task = await text({
      message: pc.dim('You'),
      placeholder: 'Describe your task, paste code, or ask a question…  (Ctrl+C to exit)',
      validate: v => (v.trim() === '' ? 'Please enter a message.' : undefined),
    });

    if (isCancel(task)) {
      outro(
        pc.cyan('Session ended.') +
        pc.dim('  Run ') +
        pc.white('wanderai') +
        pc.dim(' to start a new one.'),
      );
      process.exit(0);
    }

    messages.push({ role: 'user', content: task.trim() });

    const s = spinner();
    s.start(pc.dim(`${agent.name} is thinking…`));

    let assistantReply = '';
    let usedProvider = provider;

    try {
      if (provider === 'openai') {
        s.stop(pc.cyan(agent.name) + pc.dim(':'));
        console.log('');
        assistantReply = await callOpenAI(openaiClient, messages, agent.name);
      } else {
        s.stop(pc.cyan(agent.name) + pc.dim(':'));
        console.log('');
        assistantReply = await callGemini(genAIClient, systemPrompt, messages);
        usedProvider = 'gemini';
      }
    } catch (primaryErr) {
      // ── Automatic fallback: OpenAI → Gemini on rate-limit or safety block
      if (shouldFallback(primaryErr) && canFallback) {
        s.stop(
          pc.yellow('⚡ OpenAI') +
          pc.dim(`: ${primaryErr.status === 429 ? 'rate limited' : 'safety block'} — falling back to `) +
          pc.yellow('Gemini'),
        );
        console.log('');
        try {
          assistantReply = await callGemini(genAIClient, systemPrompt, messages);
          usedProvider = 'gemini';
          log.info(pc.dim('Response delivered via Gemini fallback.'));
        } catch (fallbackErr) {
          note(fallbackErr.message ?? String(fallbackErr), pc.red('Gemini fallback also failed'));
          messages.pop();
          continue;
        }
      } else {
        s.stop(pc.red('Request failed.'));
        note(
          primaryErr.message ?? String(primaryErr),
          pc.red(usedProvider === 'gemini' ? 'Gemini Error' : 'OpenAI Error'),
        );
        messages.pop();
        continue;
      }
    }

    messages.push({ role: 'assistant', content: assistantReply });
  }
}

main().catch(err => {
  console.error(pc.red('\nUnexpected error:'), err.message ?? err);
  process.exit(1);
});
