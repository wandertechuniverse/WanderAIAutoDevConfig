#!/usr/bin/env node
import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

import { synthesizeCode } from "./router/synthesizer.js";

// ─── Config ───────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveDataDir(): string {
  if (process.env.WANDER_DATA_DIR) {
    return resolve(process.env.WANDER_DATA_DIR);
  }
  const relativeToBundle = join(__dirname, "..", "data");
  if (existsSync(relativeToBundle)) return relativeToBundle;
  return join(process.cwd(), "data");
}

const DATA_DIR = resolveDataDir();
const ROUTER_MODEL = process.env.WANDER_ROUTER_MODEL ?? "gpt-4o-mini";
const WORKER_MODEL = process.env.WANDER_WORKER_MODEL ?? "gpt-4o";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentConfig {
  id: string;
  name: string;
  role: string;
  agent_type: "leader" | "worker";
}

// ─── File helpers ─────────────────────────────────────────────────────────────

async function loadAgents(): Promise<AgentConfig[]> {
  const configPath = join(DATA_DIR, "agents_config.json");
  try {
    const raw = await readFile(configPath, "utf8");
    return JSON.parse(raw) as AgentConfig[];
  } catch {
    throw new McpError(
      ErrorCode.InternalError,
      `Cannot read agents_config.json at ${configPath}. ` +
        `Set WANDER_DATA_DIR env var to point at your data directory.`,
    );
  }
}

async function loadPersona(agentId: string): Promise<string> {
  const personaPath = join(DATA_DIR, "agents", `${agentId}.agent.md`);
  if (existsSync(personaPath)) {
    return readFile(personaPath, "utf8");
  }
  const copilotFallback = join(process.cwd(), ".github", "copilot-instructions.md");
  if (existsSync(copilotFallback)) {
    return readFile(copilotFallback, "utf8");
  }
  return (
    `You are a highly skilled software engineer. ` +
    `You write clean, production-ready code with clear explanations.`
  );
}

// ─── Orchestrator logic ───────────────────────────────────────────────────────

async function routeToAgent(
  openai: OpenAI,
  agents: AgentConfig[],
  taskDescription: string,
  codeContext: string,
): Promise<AgentConfig> {
  const agentList = agents
    .map((a) => `- id: "${a.id}"  |  name: ${a.name}  |  role: ${a.role}`)
    .join("\n");

  const routerSystemPrompt = `You are a routing agent for a multi-agent dev system.
Given a task description, return ONLY the agent ID (no explanation, no quotes, no punctuation)
that best matches the task. Choose from this list:

${agentList}

Rules:
- For architecture / high-level decisions → prefer tech_lead or engineering_manager
- For UI / React / CSS / web frontend → prefer frontend_dev or ui_ux_designer
- For Flutter / Dart / iOS / Android / mobile → prefer mobile_dev
- For APIs / server logic → prefer backend_dev or api_designer
- For databases / migrations → prefer database_engineer
- For CI/CD / infra → prefer devops_engineer
- For tests / bugs → prefer qa_engineer
- For security → prefer security_engineer
- For docs / READMEs → prefer technical_writer
- For data / ML → prefer data_scientist
- For code review → prefer code_reviewer
- For perf → prefer performance_engineer

Respond with ONLY the agent id, nothing else.`;

  const routing = await openai.chat.completions.create({
    model: ROUTER_MODEL,
    messages: [
      { role: "system", content: routerSystemPrompt },
      {
        role: "user",
        content: `Task: ${taskDescription}${codeContext ? `\n\nCode context:\n${codeContext}` : ""}`,
      },
    ],
    max_tokens: 32,
    temperature: 0,
  });

  const rawId = routing.choices[0]?.message?.content?.trim().toLowerCase() ?? "";
  const agentId = rawId.replace(/[^a-z0-9_]/g, "");

  const matched = agents.find((a) => a.id === agentId);
  if (matched) return matched;

  const fallback = agents.find((a) => a.agent_type === "leader") ?? agents[0];
  return fallback;
}

async function executeTask(
  openai: OpenAI,
  agent: AgentConfig,
  systemPrompt: string,
  taskDescription: string,
  codeContext: string,
): Promise<string> {
  const userMessage = codeContext
    ? `${taskDescription}\n\n---\nCurrent code context:\n\`\`\`\n${codeContext}\n\`\`\``
    : taskDescription;

  const completion = await openai.chat.completions.create({
    model: WORKER_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: 8192,
    temperature: 0.2,
  });

  return completion.choices[0]?.message?.content ?? "(no response)";
}

// ─── Mock agent fragments for synthesis demo ──────────────────────────────────

function buildMockFragments(taskDescription: string): [string, string] {
  const dbFragment = `// [Database Agent] Schema suggestion for: "${taskDescription}"
// Generated by: database_engineer

CREATE TABLE IF NOT EXISTS wander_tasks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT        NOT NULL,
  status      VARCHAR(32) NOT NULL DEFAULT 'pending',
  agent_id    VARCHAR(64),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wander_tasks_status  ON wander_tasks(status);
CREATE INDEX idx_wander_tasks_agent   ON wander_tasks(agent_id);`;

  const uiFragment = `// [UI Agent] React component for: "${taskDescription}"
// Generated by: frontend_dev

import { useState } from "react";

interface Task {
  id: string;
  description: string;
  status: "pending" | "running" | "done" | "error";
  agentId?: string;
}

export function TaskCard({ task }: { task: Task }) {
  const [expanded, setExpanded] = useState(false);

  const statusColor: Record<Task["status"], string> = {
    pending: "text-yellow-400",
    running: "text-cyan-400 animate-pulse",
    done:    "text-green-400",
    error:   "text-red-400",
  };

  return (
    <div
      className="rounded-xl border border-white/10 bg-white/5 p-4 cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-white truncate">
          {task.description}
        </span>
        <span className={\`text-xs font-mono \${statusColor[task.status]}\`}>
          {task.status}
        </span>
      </div>
      {expanded && task.agentId && (
        <p className="mt-2 text-xs text-white/40">Agent: {task.agentId}</p>
      )}
    </div>
  );
}`;

  return [dbFragment, uiFragment];
}

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: "wanderai-orchestrator", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

// ── List tools ────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "delegate_to_wander_ai",
      description:
        "Routes your task to the best-suited Wander AI specialist agent " +
        "(Frontend Dev, Backend Dev, Tech Lead, QA Engineer, etc.) and returns " +
        "a production-ready response. Describe what you need and optionally " +
        "paste the current file for context.",
      inputSchema: {
        type: "object",
        properties: {
          task_description: {
            type: "string",
            description: "The task, question, or instruction. Be as specific as possible.",
          },
          current_code_context: {
            type: "string",
            description:
              "(Optional) Paste the current file content or a code snippet " +
              "so the agent has full context.",
          },
        },
        required: ["task_description"],
      },
    },
    {
      name: "list_wander_agents",
      description:
        "Returns the full list of available Wander AI agents with their IDs, " +
        "names, roles, and types. Useful for discovery.",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "ask_specific_agent",
      description:
        "Bypass the orchestrator and send your task directly to a specific " +
        "Wander AI agent by ID (e.g. 'frontend_dev', 'qa_engineer'). " +
        "Use list_wander_agents first to find the right ID.",
      inputSchema: {
        type: "object",
        properties: {
          agent_id: {
            type: "string",
            description: "The agent ID to use (e.g. 'tech_lead', 'backend_dev').",
          },
          task_description: {
            type: "string",
            description: "The task or question for this agent.",
          },
          current_code_context: {
            type: "string",
            description: "(Optional) Current file content or code snippet.",
          },
        },
        required: ["agent_id", "task_description"],
      },
    },
    {
      name: "synthesize_multi_agent",
      description:
        "Demonstrates the full Node→Python synthesis pipeline. Simulates a " +
        "multi-agent workflow by running a Database Agent and a UI Agent in " +
        "parallel, then routes their combined outputs to the Python Synthesizer " +
        "microservice for merging. Returns a single unified code artifact. " +
        "Degrades gracefully if the synthesizer is offline.",
      inputSchema: {
        type: "object",
        properties: {
          task_description: {
            type: "string",
            description:
              "Describe the feature you want both agents to tackle " +
              "(e.g. 'user authentication flow', 'dashboard with metrics').",
          },
        },
        required: ["task_description"],
      },
    },
  ],
}));

// ── Handle tool calls ─────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // ── list_wander_agents ──────────────────────────────────────────────────────
  if (name === "list_wander_agents") {
    const agents = await loadAgents();
    const leaders = agents.filter((a) => a.agent_type === "leader");
    const workers = agents.filter((a) => a.agent_type === "worker");

    const fmt = (list: AgentConfig[]) =>
      list.map((a) => `• **${a.name}** (\`${a.id}\`) — ${a.role}`).join("\n");

    return {
      content: [
        {
          type: "text",
          text:
            `## Wander AI Agents (${agents.length} total)\n\n` +
            `### Leaders\n${fmt(leaders)}\n\n` +
            `### Workers\n${fmt(workers)}`,
        },
      ],
    };
  }

  // ── ask_specific_agent ──────────────────────────────────────────────────────
  if (name === "ask_specific_agent") {
    const agentId = String(args?.agent_id ?? "").trim();
    const taskDescription = String(args?.task_description ?? "").trim();
    const codeContext = String(args?.current_code_context ?? "").trim();

    if (!agentId || !taskDescription) {
      throw new McpError(ErrorCode.InvalidParams, "agent_id and task_description are required.");
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new McpError(
        ErrorCode.InternalError,
        "OPENAI_API_KEY is not set. Add it to your MCP server environment config.",
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const agents = await loadAgents();
    const agent = agents.find((a) => a.id === agentId);

    if (!agent) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Agent "${agentId}" not found. Call list_wander_agents to see available IDs.`,
      );
    }

    const systemPrompt = await loadPersona(agent.id);
    const response = await executeTask(openai, agent, systemPrompt, taskDescription, codeContext);

    return {
      content: [{ type: "text", text: `[Wander AI: ${agent.name} — Direct]\n\n${response}` }],
    };
  }

  // ── delegate_to_wander_ai ───────────────────────────────────────────────────
  if (name === "delegate_to_wander_ai") {
    const taskDescription = String(args?.task_description ?? "").trim();
    const codeContext = String(args?.current_code_context ?? "").trim();

    if (!taskDescription) {
      throw new McpError(ErrorCode.InvalidParams, "task_description is required.");
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new McpError(
        ErrorCode.InternalError,
        "OPENAI_API_KEY is not set. Add it to your MCP server environment config.",
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const agents = await loadAgents();

    const agent = await routeToAgent(openai, agents, taskDescription, codeContext);
    const systemPrompt = await loadPersona(agent.id);
    const response = await executeTask(openai, agent, systemPrompt, taskDescription, codeContext);

    return {
      content: [
        {
          type: "text",
          text: `[Wander AI: ${agent.name} Executing Task]\n\n${response}`,
        },
      ],
    };
  }

  // ── synthesize_multi_agent ──────────────────────────────────────────────────
  if (name === "synthesize_multi_agent") {
    const taskDescription = String(args?.task_description ?? "multi-agent synthesis demo").trim();

    // Step 1: generate mock fragments from two specialist agents
    const [dbFragment, uiFragment] = buildMockFragments(taskDescription);

    process.stderr.write(
      `[wanderai-mcp] synthesize_multi_agent: routing 2 fragments to synthesizer\n`,
    );

    // Step 2: send to Python synthesizer — degrades gracefully if offline
    const synthesized = await synthesizeCode([dbFragment, uiFragment]);

    // Step 3: return unified artifact to the IDE
    return {
      content: [
        {
          type: "text",
          text:
            `[Wander AI: Multi-Agent Synthesis Pipeline]\n\n` +
            `**Task:** ${taskDescription}\n` +
            `**Agents:** Database Engineer + Frontend Dev\n` +
            `**Synthesizer:** Python FastAPI @ localhost:8000\n\n` +
            `---\n\n` +
            `\`\`\`\n${synthesized}\n\`\`\``,
        },
      ],
    };
  }

  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[wanderai-mcp] Server started. Listening via stdio.\n");
}

main().catch((err) => {
  process.stderr.write(`[wanderai-mcp] Fatal error: ${err}\n`);
  process.exit(1);
});
