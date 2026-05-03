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
    ai_rules: [
      "No console.log in server code — use req.log in route handlers and the singleton logger elsewhere.",
      "Follow existing route file naming conventions — one file per route group in src/routes/, registered in index.ts.",
      "Use Zod for all schema requirements — validate every request body and config file at the boundary.",
      "Adhere to the synthesizer degradation contract — POST /synthesize must always return 200, never throw.",
      "Respect MCP stdout constraints — all logging in the MCP server must go to stderr only; stdout is the protocol wire.",
      "Maintain strict CLI layer separation — bin/cli.js is UI-only; all business logic lives in src/ modules.",
      "Always use pnpm — use pnpm --filter <package> for targeted installs; never run pnpm dev at the workspace root.",
      "Respect the defined provider priority order — OPENROUTER_API_KEY → OPENAI_API_KEY → GEMINI_API_KEY.",
    ],
    last_updated: new Date().toISOString(),
  });
});

export default router;
