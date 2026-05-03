#!/usr/bin/env node
import 'dotenv/config';
import {
  intro,
  outro,
  select,
  text,
  cancel,
  isCancel,
  log,
} from '@clack/prompts';
import chalk from 'chalk';
import ora   from 'ora';
import { Command } from 'commander';

// ─── src/ modules (business logic, fully decoupled from UI) ──────────────────
import { logger }          from '../src/utils/logger.js';
import { validateEnv }     from '../src/config/validator.js';
import { loadAgents, loadSystemPrompt, buildSelectOptions } from '../src/core/agents.js';
import {
  makeOpenAIClient,
  makeGeminiClient,
  resolveProvider,
  shouldFallback,
  callOpenAI,
  callGemini,
} from '../src/core/providers.js';

// ─── CLI flags ────────────────────────────────────────────────────────────────

const program = new Command();
program
  .name('wanderai')
  .description('WanderAI Auto Dev Config — IDE agent CLI')
  .version('1.0.0')
  .option('-d, --data <path>',     'path to a custom data directory',                        'data')
  .option('-m, --model <model>',   'OpenAI model override',                                   'gpt-4o')
  .option('--gemini-model <model>','Gemini model override',                                   'gemini-1.5-pro')
  .option('-p, --provider <name>', 'AI provider: openai | gemini | auto',                    'auto')
  .option('--no-stream',           'disable streaming (wait for full response before printing)')
  .parse(process.argv);

const opts = program.opts();

// ─── Banner ───────────────────────────────────────────────────────────────────

function printBanner(provider) {
  console.clear();
  const bar = chalk.cyan('━'.repeat(48));
  const providerTag = provider === 'gemini'
    ? chalk.yellow('gemini') + chalk.dim('  ·  model: ' + opts.geminiModel)
    : chalk.green('openai') + chalk.dim('  ·  model: ' + opts.model);

  console.log('');
  console.log('  ' + bar);
  console.log('  ' + chalk.bold(chalk.cyan('  ⚡  WANDERAI')) + '  ' + chalk.dim('Auto Dev Config'));
  console.log('  ' + chalk.dim('  IDE Agent CLI  ·  v1.0.0  ·  provider: ') + providerTag);
  console.log('  ' + bar);
  console.log('');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Validate env — exits cleanly with a readable message if keys are missing
  validateEnv();

  // 2. Resolve active provider
  const provider    = resolveProvider(opts.provider);
  const canFallback = provider === 'openai' && !!process.env.GEMINI_API_KEY;

  // 3. Initialise only the clients whose keys are present
  const openaiClient = process.env.OPENAI_API_KEY ? makeOpenAIClient(process.env.OPENAI_API_KEY) : null;
  const genAIClient  = process.env.GEMINI_API_KEY ? makeGeminiClient(process.env.GEMINI_API_KEY) : null;

  printBanner(provider);

  // 4. Load + validate agent registry (Zod-validated, exits cleanly on error)
  const dataDir = opts.data;
  const agents  = loadAgents(dataDir);

  intro(chalk.cyan('  WanderAI') + chalk.dim('  —  select an agent to begin'));

  // 5. Agent selection
  const agentId = await select({
    message: 'Which agent do you need?',
    options: buildSelectOptions(agents),
  });

  if (isCancel(agentId)) {
    cancel('Session cancelled.');
    process.exit(0);
  }

  const agent       = agents.find(a => a.id === agentId);
  const systemPrompt = loadSystemPrompt(agentId, dataDir);

  // messages is always in OpenAI format; callGemini() converts on the fly
  const messages = [{ role: 'system', content: systemPrompt }];

  log.success(chalk.cyan(agent.name) + chalk.dim('  ·  ') + chalk.dim(agent.role));

  // ── Conversation loop ────────────────────────────────────────────────────────
  while (true) {
    const task = await text({
      message:     chalk.dim('You'),
      placeholder: 'Describe your task, paste code, or ask a question…  (Ctrl+C to exit)',
      validate:    v => (v.trim() === '' ? 'Please enter a message.' : undefined),
    });

    if (isCancel(task)) {
      outro(
        chalk.cyan('Session ended.') +
        chalk.dim('  Run ') + chalk.white('wanderai') + chalk.dim(' to start a new one.'),
      );
      process.exit(0);
    }

    messages.push({ role: 'user', content: task.trim() });

    // ora spinner while routing/loading
    const spinner = ora({
      text:  chalk.dim(`${agent.name} is thinking…`),
      color: 'cyan',
    }).start();

    let assistantReply = '';
    let usedProvider   = provider;

    try {
      if (provider === 'openai') {
        spinner.stop();
        console.log(chalk.cyan(agent.name) + chalk.dim(':'));
        console.log('');
        assistantReply = await callOpenAI(openaiClient, opts.model, messages, opts.stream);
      } else {
        spinner.stop();
        console.log(chalk.cyan(agent.name) + chalk.dim(':'));
        console.log('');
        assistantReply = await callGemini(genAIClient, opts.geminiModel, systemPrompt, messages, opts.stream);
        usedProvider = 'gemini';
      }
    } catch (primaryErr) {
      // ── Auto fallback: OpenAI → Gemini on rate-limit or safety block ──────
      if (shouldFallback(primaryErr) && canFallback) {
        const reason = primaryErr.status === 429 ? 'rate limited' : 'safety block';
        spinner.fail(
          chalk.yellow('OpenAI') + chalk.dim(`: ${reason} — falling back to `) + chalk.yellow('Gemini'),
        );
        console.log('');
        try {
          assistantReply = await callGemini(genAIClient, opts.geminiModel, systemPrompt, messages, opts.stream);
          usedProvider   = 'gemini';
          logger.info('Response delivered via Gemini fallback.');
        } catch (fallbackErr) {
          logger.error('Gemini fallback also failed: ' + (fallbackErr.message ?? String(fallbackErr)));
          messages.pop();
          continue;
        }
      } else {
        spinner.fail(chalk.red('Request failed.'));
        logger.error(
          (usedProvider === 'gemini' ? 'Gemini' : 'OpenAI') +
          ' error: ' + (primaryErr.message ?? String(primaryErr)),
        );
        messages.pop();
        continue;
      }
    }

    messages.push({ role: 'assistant', content: assistantReply });
  }
}

main().catch(err => {
  logger.error('Unexpected error: ' + (err.message ?? String(err)));
  process.exit(1);
});
