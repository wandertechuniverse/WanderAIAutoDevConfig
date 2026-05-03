import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/config", (req, res) => {
  req.log.info("KIRO config requested");

  res.json({
    default_build_command: "pnpm run build",
    project_context:
      "WanderAI Auto Dev Config — a local-first, multi-agent AI development system. " +
      "Comprises a React+Vite web chat hub, an Express orchestration API, a Node.js MCP server " +
      "(Cursor/Windsurf/Claude Desktop), a Node.js CLI (wanderai), and a Python FastAPI synthesis " +
      "microservice. Routes developer tasks to 17 specialist AI agents (Frontend Dev, Backend Dev, " +
      "Security Engineer, etc.) using a router model + worker model pipeline. " +
      "The Python synthesizer merges multi-agent outputs into a single production-ready artifact.",
    ai_rules:
      "1. Never use console.log in server code — use req.log in route handlers and the singleton logger elsewhere. " +
      "2. All new API routes go in artifacts/api-server/src/routes/ as individual files and must be registered in routes/index.ts. " +
      "3. The agents_config.json schema is Zod-validated: every entry requires id (snake_case), name, role, and agent_type (leader|worker|subagent). " +
      "4. The Python synthesizer at localhost:8000 must always return 200 — degrade to local-fallback-v1, never throw. " +
      "5. MCP server stdout is the protocol wire — all logging must go to stderr only. " +
      "6. CLI src/ modules (logger, validator, agents, providers) are the source of truth; bin/cli.js is UI-only. " +
      "7. Use pnpm --filter <package> for targeted installs; never run pnpm dev at the workspace root. " +
      "8. Provider priority: OPENROUTER_API_KEY → OPENAI_API_KEY → GEMINI_API_KEY.",
    last_updated: new Date().toISOString(),
  });
});

export default router;
