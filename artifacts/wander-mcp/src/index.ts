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

// ─── Config ───────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));

// Data directory: check env override, then look relative to this file (dist/../data),
// then fall back to process.cwd()/data so it works from any project root.
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
  if (!existsSync(personaPath)) {
    // Graceful fallback — generic engineering assistant
    return (
      `You are a highly skilled software engineer specializing in ${agentId.replace(/_/g, " ")}. ` +
      `You write clean, production-ready code with clear explanations.`
    );
  }
  return readFile(personaPath, "utf8");
}

// ─── Orchestrator logic ───────────────────────────────────────────────────────

async function routeToAgent(
  openai: OpenAI,
  agents: AgentConfig[],
  userQuery: string,
  fileContext: string,
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
- For UI / React / CSS → prefer frontend_dev or ui_ux_designer
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
        content: `Task: ${userQuery}${fileContext ? `\n\nFile context:\n${fileContext}` : ""}`,
      },
    ],
    max_tokens: 32,
    temperature: 0,
  });

  const rawId = routing.choices[0]?.message?.content?.trim().toLowerCase() ?? "";
  // Sanitise — strip quotes, dots, whitespace the model might add
  const agentId = rawId.replace(/[^a-z0-9_]/g, "");

  const matched = agents.find((a) => a.id === agentId);
  if (matched) return matched;

  // Fallback: use the first leader (engineering_manager)
  const fallback = agents.find((a) => a.agent_type === "leader") ?? agents[0];
  return fallback;
}

async function executeTask(
  openai: OpenAI,
  agent: AgentConfig,
  systemPrompt: string,
  userQuery: string,
  fileContext: string,
): Promise<string> {
  const userMessage = fileContext
    ? `${userQuery}\n\n---\nCurrent file context:\n\`\`\`\n${fileContext}\n\`\`\``
    : userQuery;

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

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: "wander-ai-orchestrator", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

// List tools
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
          user_query: {
            type: "string",
            description:
              "The task, question, or instruction. Be as specific as possible.",
          },
          current_file_context: {
            type: "string",
            description:
              "(Optional) Paste the current file content or a code snippet " +
              "so the agent has full context.",
          },
        },
        required: ["user_query"],
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
          user_query: {
            type: "string",
            description: "The task or question for this agent.",
          },
          current_file_context: {
            type: "string",
            description: "(Optional) Current file content or code snippet.",
          },
        },
        required: ["agent_id", "user_query"],
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!process.env.OPENAI_API_KEY) {
    throw new McpError(
      ErrorCode.InternalError,
      "OPENAI_API_KEY is not set. Add it to your MCP server environment config.",
    );
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // ── list_wander_agents ────────────────────────────────────────────────────
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

  // ── ask_specific_agent ────────────────────────────────────────────────────
  if (name === "ask_specific_agent") {
    const agentId = String(args?.agent_id ?? "").trim();
    const userQuery = String(args?.user_query ?? "").trim();
    const fileContext = String(args?.current_file_context ?? "").trim();

    if (!agentId || !userQuery) {
      throw new McpError(ErrorCode.InvalidParams, "agent_id and user_query are required.");
    }

    const agents = await loadAgents();
    const agent = agents.find((a) => a.id === agentId);

    if (!agent) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Agent "${agentId}" not found. Call list_wander_agents to see available IDs.`,
      );
    }

    const systemPrompt = await loadPersona(agent.id);
    const response = await executeTask(openai, agent, systemPrompt, userQuery, fileContext);

    return {
      content: [
        {
          type: "text",
          text: `[Wander AI: ${agent.name} — Direct]\n\n${response}`,
        },
      ],
    };
  }

  // ── delegate_to_wander_ai ─────────────────────────────────────────────────
  if (name === "delegate_to_wander_ai") {
    const userQuery = String(args?.user_query ?? "").trim();
    const fileContext = String(args?.current_file_context ?? "").trim();

    if (!userQuery) {
      throw new McpError(ErrorCode.InvalidParams, "user_query is required.");
    }

    const agents = await loadAgents();

    // Step 1: route
    const agent = await routeToAgent(openai, agents, userQuery, fileContext);

    // Step 2: load persona
    const systemPrompt = await loadPersona(agent.id);

    // Step 3: execute
    const response = await executeTask(openai, agent, systemPrompt, userQuery, fileContext);

    // Step 4: return with brand tag
    return {
      content: [
        {
          type: "text",
          text: `[Wander AI: ${agent.name} Executing Task]\n\n${response}`,
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
  // MCP servers must not write to stdout (it's the protocol channel).
  // Log startup info to stderr only.
  process.stderr.write("[wander-ai-mcp] Server started. Listening via stdio.\n");
}

main().catch((err) => {
  process.stderr.write(`[wander-ai-mcp] Fatal error: ${err}\n`);
  process.exit(1);
});
