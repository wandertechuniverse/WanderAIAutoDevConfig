# Wander AI MCP Server

An MCP (Model Context Protocol) server that exposes your 15 Wander AI specialist agents as native tools inside **Cursor**, **Claude Desktop**, **Windsurf**, and any MCP-compatible IDE.

When you call the `delegate_to_wander_ai` tool, the Orchestrator automatically routes your request to the best-suited agent (Frontend Dev, Tech Lead, QA Engineer, etc.) using a lightweight routing LLM call, then executes the task using that agent's persona file as the system prompt.

---

## Tools exposed

| Tool | Description |
|---|---|
| `delegate_to_wander_ai` | Auto-routes your task to the best agent and returns the response |
| `list_wander_agents` | Returns all 15 agents with IDs, names, and roles |
| `ask_specific_agent` | Bypass routing and talk directly to a named agent |

---

## Setup

### 1. Build the server

```bash
cd artifacts/wander-mcp
npm install
npm run build
```

This compiles `src/index.ts` → `dist/index.js`.

### 2. Note the absolute path to `dist/index.js`

```bash
# macOS / Linux
pwd
# e.g. /Users/you/projects/wander-ai/artifacts/wander-mcp
# → full path: /Users/you/projects/wander-ai/artifacts/wander-mcp/dist/index.js
```

### 3. Prepare your data directory

The server reads agents from a `data/` folder. You can either:

**Option A — point at the existing repo data (recommended while developing):**
Set `WANDER_DATA_DIR` in the env config below.

**Option B — copy data to the package:**
```bash
cp -r ../api-server/data ./data
```

---

## Connect to Cursor

Edit (or create) `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "wander-ai": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/artifacts/wander-mcp/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "WANDER_DATA_DIR": "/ABSOLUTE/PATH/TO/artifacts/api-server/data",
        "WANDER_ROUTER_MODEL": "gpt-4o-mini",
        "WANDER_WORKER_MODEL": "gpt-4o"
      }
    }
  }
}
```

Then restart Cursor. The tools appear under **MCP** in the chat sidebar.

---

## Connect to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "wander-ai": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/artifacts/wander-mcp/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "WANDER_DATA_DIR": "/ABSOLUTE/PATH/TO/artifacts/api-server/data",
        "WANDER_ROUTER_MODEL": "gpt-4o-mini",
        "WANDER_WORKER_MODEL": "gpt-4o"
      }
    }
  }
}
```

Restart Claude Desktop. The tools will appear automatically.

---

## Connect to Windsurf

Edit `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "wander-ai": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/artifacts/wander-mcp/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "WANDER_DATA_DIR": "/ABSOLUTE/PATH/TO/artifacts/api-server/data"
      }
    }
  }
}
```

---

## Connect via npx (no build step)

If you publish to npm you can use `npx` instead of an absolute path:

```json
{
  "mcpServers": {
    "wander-ai": {
      "command": "npx",
      "args": ["wander-ai-mcp"],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "WANDER_DATA_DIR": "/path/to/data"
      }
    }
  }
}
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | **Required.** Your OpenAI API key |
| `WANDER_DATA_DIR` | auto-detected | Absolute path to your `data/` directory |
| `WANDER_ROUTER_MODEL` | `gpt-4o-mini` | Model used for fast agent routing |
| `WANDER_WORKER_MODEL` | `gpt-4o` | Model used for the actual task execution |

---

## Using the tools in Cursor / Claude

```
# Auto-routing (recommended)
@wander-ai delegate_to_wander_ai
  user_query: "Refactor this React component to use the Context API"
  current_file_context: [paste your file]

# Direct agent access
@wander-ai ask_specific_agent
  agent_id: "qa_engineer"
  user_query: "Write Vitest unit tests for this utility function"

# Discover agents
@wander-ai list_wander_agents
```

---

## How the orchestrator works

```
User query
    │
    ▼
Router LLM call (gpt-4o-mini, ~50ms)
  "Which agent best suits this task?"
    │
    ▼
  agent_id resolved
    │
    ▼
Load data/agents/{agent_id}.agent.md  ← persona / system prompt
    │
    ▼
Worker LLM call (gpt-4o)
  system: persona file
  user:   original query + file context
    │
    ▼
[Wander AI: {Agent Name} Executing Task]
{response returned to IDE}
```

---

## Data directory structure

```
data/
├── agents_config.json         ← agent list (id, name, role, agent_type)
└── agents/
    ├── engineering_manager.agent.md
    ├── frontend_dev.agent.md
    ├── backend_dev.agent.md
    └── ...  (15 agents total)
```
