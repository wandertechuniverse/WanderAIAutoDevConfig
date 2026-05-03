import { readFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { validateAgentsConfig } from '../config/validator.js';

// ─── ESM __dirname shim ───────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename); // → .../artifacts/wander-cli/src/core

// ─── Path resolution ──────────────────────────────────────────────────────────

/**
 * Locates agents_config.json across four possible locations so the CLI works
 * from any working directory after global install.
 *
 *   1. Running from src/core/ inside the monorepo (dev / npm link)
 *   2. Running from a compiled dist/core/ directory
 *   3. User invokes wanderai from the monorepo root
 *   4. Explicit --data flag override
 */
export function resolveConfigPath(dataDir) {
  const candidates = [
    resolve(__dirname, '../../../api-server/data/agents_config.json'),
    resolve(__dirname, '../../../../api-server/data/agents_config.json'),
    resolve(process.cwd(), 'artifacts/api-server/data/agents_config.json'),
    join(dataDir, 'agents_config.json'),
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  logger.blank();
  logger.error('Cannot find agents_config.json.');
  logger.dim('  Tried:');
  for (const p of candidates) logger.dim('    ' + p);
  logger.blank();
  logger.dim('  Fix: re-run  npm install -g .  from artifacts/wander-cli/ or invoke');
  logger.dim('       wanderai from the monorepo root.');
  logger.blank();
  process.exit(1);
}

// ─── Loaders ──────────────────────────────────────────────────────────────────

/**
 * Reads, parses, and Zod-validates agents_config.json.
 * Returns a typed array of agent objects.
 */
export function loadAgents(dataDir) {
  const configPath = resolveConfigPath(dataDir);
  let raw;
  try {
    raw = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (err) {
    logger.error(`Failed to parse agents_config.json: ${err.message}`);
    process.exit(1);
  }
  return validateAgentsConfig(raw);
}

/**
 * Loads the .agent.md persona file for a given agent id.
 * Falls back to a generic prompt with a warning if the file is missing.
 */
export function loadSystemPrompt(agentId, dataDir) {
  const configPath = resolveConfigPath(dataDir);
  const agentsDir  = join(dirname(configPath), 'agents');
  const personaPath = join(agentsDir, `${agentId}.agent.md`);

  if (existsSync(personaPath)) {
    return readFileSync(personaPath, 'utf8');
  }

  logger.warn(`No persona file found for "${agentId}" — using generic system prompt.`);
  return 'You are a helpful AI assistant specialising in software development. Be concise, precise, and technical.';
}

// ─── Select-menu builder ──────────────────────────────────────────────────────

import chalk from 'chalk';

export function buildSelectOptions(agents) {
  const leaders   = agents.filter(a => a.agent_type === 'leader');
  const workers   = agents.filter(a => a.agent_type === 'worker');
  const subagents = agents.filter(a => a.agent_type === 'subagent');

  return [
    ...leaders.map((a, i) => ({
      value: a.id,
      label: (i === 0 ? chalk.dim('Leaders   ') : '          ') + chalk.cyan(a.name),
      hint:  a.role,
    })),
    ...workers.map((a, i) => ({
      value: a.id,
      label: (i === 0 ? chalk.dim('Workers   ') : '          ') + chalk.white(a.name),
      hint:  a.role,
    })),
    ...subagents.map((a, i) => ({
      value: a.id,
      label: (i === 0 ? chalk.dim('Subagents ') : '          ') + chalk.magenta(a.name),
      hint:  a.role,
    })),
  ];
}
