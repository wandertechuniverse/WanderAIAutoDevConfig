import { z } from 'zod';
import { logger } from '../utils/logger.js';

// ─── Agent schema ─────────────────────────────────────────────────────────────

const AgentSchema = z.object({
  id:         z.string().min(1, 'Agent id must not be empty'),
  name:       z.string().min(1, 'Agent name must not be empty'),
  role:       z.string().min(1, 'Agent role must not be empty'),
  agent_type: z.enum(['leader', 'worker', 'subagent'], {
    errorMap: () => ({ message: 'agent_type must be "leader", "worker", or "subagent"' }),
  }),
});

// agents_config.json may be a flat array OR wrapped in { agents: [...] }
const AgentsConfigSchema = z.union([
  z.array(AgentSchema),
  z.object({ agents: z.array(AgentSchema) }).transform(o => o.agents),
]);

// ─── Environment schema ───────────────────────────────────────────────────────

const EnvSchema = z
  .object({
    OPENAI_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (!env.OPENAI_API_KEY && !env.GEMINI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'At least one API key must be set: OPENAI_API_KEY (sk-...) or GEMINI_API_KEY (AIza...)',
      });
    }
  });

// ─── Validators ───────────────────────────────────────────────────────────────

/**
 * Validates process.env for required API keys.
 * Exits with a human-readable error — no stack traces.
 */
export function validateEnv() {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    logger.blank();
    logger.error('Environment configuration invalid:');
    for (const issue of result.error.issues) {
      logger.error('  ' + issue.message);
    }
    logger.blank();
    logger.dim('  Set OPENAI_API_KEY or GEMINI_API_KEY in your .env file or shell profile.');
    logger.dim('  Example:  export OPENAI_API_KEY="sk-..."');
    logger.blank();
    process.exit(1);
  }
  return result.data;
}

/**
 * Validates a parsed agents_config.json object.
 * Exits with a human-readable per-field error — no stack traces.
 */
export function validateAgentsConfig(raw) {
  const result = AgentsConfigSchema.safeParse(raw);
  if (!result.success) {
    logger.blank();
    logger.error('agents_config.json failed validation:');
    for (const issue of result.error.issues) {
      const path = issue.path.length ? `[${issue.path.join('.')}] ` : '';
      logger.error('  ' + path + issue.message);
    }
    logger.blank();
    logger.dim('  Check that every agent object has: id, name, role, agent_type.');
    logger.blank();
    process.exit(1);
  }
  return result.data;
}
