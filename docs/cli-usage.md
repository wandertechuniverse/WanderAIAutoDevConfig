# Wander AI CLI — User Guide

The `wanderai` CLI is the terminal control surface for the 17-agent Wander AI registry. It gives you the full power of the orchestrator — intelligent task routing, streaming responses, multi-provider support, and Zod-validated configuration — directly from your shell, with no browser required.

The CLI runs in two complementary modes:

| Mode | How to invoke | When to use |
|---|---|---|
| **Interactive terminal session** | `wanderai` | Conversational tasks, scripting, CI pipelines |
| **MCP server (IDE-integrated)** | `node dist/index.js` (separate binary) | Cursor, Windsurf, Claude Desktop — IDE-native tool calls |

Both modes share the same agent registry, the same Zod-validated configuration layer, and the same Python synthesis pipeline described in [Architecture Behaviors](#architecture-behaviors).

---

## Installation

```bash
# From the monorepo root
cd artifacts/wander-cli
npm install -g .

# Verify
wanderai --version
```

After global install, the `wanderai` command is available in any directory. The underlying entry point is `artifacts/wander-cli/bin/cli.js`.

---

## Commands & Flags

### Synopsis

```
wanderai [options]
```

Running `wanderai` with no flags drops you into the interactive agent-selection prompt. All flags are optional overrides.

---

### `--help` / `-h`

Print the full help menu and exit.

```bash
wanderai --help
```

```
Usage: wanderai [options]

WanderAI Auto Dev Config — IDE agent CLI

Options:
  -V, --version            output the version number
  -d, --data <path>        path to a custom data directory (default: "data")
  -m, --model <model>      OpenAI model override (default: "gpt-4o")
  --gemini-model <model>   Gemini model override (default: "gemini-1.5-pro")
  -p, --provider <name>    AI provider: openai | gemini | auto (default: "auto")
  --no-stream              disable streaming (wait for full response before printing)
  -h, --help               display help for command
```

---

### `--provider` / `-p`

Select which LLM provider backs the agent session.

```bash
wanderai --provider openai     # Force OpenAI  — requires OPENAI_API_KEY
wanderai --provider gemini     # Force Gemini  — requires GEMINI_API_KEY
wanderai --provider auto       # Default: OpenAI if available, Gemini as fallback
```

**Auto-fallback behaviour:** when `--provider auto` is active (or omitted) and an OpenAI call fails with a rate-limit (`HTTP 429`) or a content-safety block, the CLI automatically retries the same request via Gemini — without interrupting your session. The fallback is logged to the terminal with a clear yellow warning so you always know which provider actually served the response.

---

### `--model` / `-m`

Override the OpenAI model used for agent execution.

```bash
wanderai --model gpt-4o-mini          # Faster, cheaper — good for routine tasks
wanderai --model gpt-4o               # Default — best quality
wanderai --model o1-preview           # Extended reasoning for architecture tasks
```

---

### `--gemini-model`

Override the Gemini model used when `--provider gemini` is active or during auto-fallback.

```bash
wanderai --gemini-model gemini-1.5-pro     # Default
wanderai --gemini-model gemini-2.0-flash   # Faster responses
```

---

### `--data` / `-d`

Point the CLI to a custom data directory containing your `agents_config.json` and `agents/` persona folder. Useful for project-specific registries or monorepo setups where the CLI is installed globally but the agent definitions live inside the project.

```bash
wanderai --data ./my-project/agents-data
wanderai --data /absolute/path/to/data
```

**Default resolution order** (first path that exists wins):

```
1. <cli-install-dir>/src/core/ → ../../../api-server/data/agents_config.json
2. <cli-install-dir>/src/core/ → ../../../../api-server/data/agents_config.json
3. <cwd>/artifacts/api-server/data/agents_config.json
4. <--data flag value>/agents_config.json
```

If none of the candidates exist, the CLI exits with a human-readable error listing every path it tried.

---

### `--no-stream`

Disable token streaming. The CLI waits for the full response before printing it. Useful in non-TTY environments (CI pipelines, shell scripts that capture output).

```bash
wanderai --no-stream
```

---

### MCP server mode

The MCP server is a separate binary in `artifacts/wander-mcp/`. It exposes the same agent registry to MCP-compatible IDEs (Cursor, Windsurf, Claude Desktop) over stdio — no HTTP, no port, no configuration file beyond your IDE's `mcp.json`.

```bash
# Build once
cd artifacts/wander-mcp
pnpm install && pnpm run build

# The IDE launches this automatically via mcp.json:
node /path/to/artifacts/wander-mcp/dist/index.js
```

Available MCP tools:

| Tool | Description |
|---|---|
| `delegate_to_wander_ai` | Auto-routes your task to the best specialist |
| `ask_specific_agent` | Direct call to a named agent by ID |
| `list_wander_agents` | Lists all agents with IDs and roles |
| `synthesize_multi_agent` | Runs Database Engineer + Frontend Dev, pipes output through the Python synthesizer |

See the root [README.md](../README.md#installation--boot-sequence) for full `mcp.json` configuration examples.

---

## Agent Registry Schema

The agent registry is defined in `agents_config.json`. Every entry is validated at startup by a Zod schema — invalid entries cause the CLI to exit cleanly with a per-field error message rather than a silent runtime crash.

### Required fields

```json
[
  {
    "id":         "frontend_dev",
    "name":       "Frontend Developer",
    "role":       "React, TypeScript, Vite, Tailwind CSS — UI components and web interfaces",
    "agent_type": "worker"
  },
  {
    "id":         "database_engineer",
    "name":       "Database Engineer",
    "role":       "Schema design, ORM migrations, query optimisation",
    "agent_type": "worker"
  },
  {
    "id":         "engineering_manager",
    "name":       "Engineering Manager",
    "role":       "Orchestrates the development team and coordinates all specialist agents",
    "agent_type": "leader"
  }
]
```

### Field reference

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | `string` | Non-empty. No spaces — use `snake_case`. | Unique identifier used for routing and persona file lookup |
| `name` | `string` | Non-empty | Human-readable display name shown in the agent picker |
| `role` | `string` | Non-empty | One-line description of the agent's specialisation — used in routing prompts |
| `agent_type` | `"leader"` \| `"worker"` \| `"subagent"` | Exactly one of the three | Controls display grouping and routing priority |

### `agent_type` semantics

- **`leader`** — high-level orchestrators (Engineering Manager, Tech Lead, Product Manager). The router defaults to a leader agent when no specialist matches the task.
- **`worker`** — domain specialists (Frontend Dev, Backend Dev, Security Engineer, etc.). The majority of agents are workers.
- **`subagent`** — focused helpers that typically operate as part of a chain rather than independently (Technical Writer, Database Architect).

### Persona files

For each agent `id`, the CLI looks for a matching persona file at:

```
<data-dir>/agents/<id>.agent.md
```

If the file exists, its full content becomes the system prompt for that agent's session. If it is missing, the CLI logs a warning and falls back to a generic software engineer prompt — the session still runs.

### Validation errors

When `agents_config.json` fails Zod validation, the CLI exits with a structured per-field error:

```
✖  agents_config.json failed validation:
✖    [2.agent_type] agent_type must be "leader", "worker", or "subagent"
✖    [5.id] Agent id must not be empty

     Check that every agent object has: id, name, role, agent_type.
```

The number prefix (e.g. `[2.agent_type]`) is the zero-indexed position of the failing entry in the array.

### Accepted formats

The schema accepts both a flat array (default) and a wrapped object:

```json
// Flat array — default format used by this project
[ { "id": "...", ... }, { "id": "...", ... } ]

// Wrapped format — also accepted, automatically unwrapped
{ "agents": [ { "id": "...", ... } ] }
```

---

## Architecture Behaviors

### The Python Bridge

When the MCP tool `synthesize_multi_agent` is called, the Node.js router simulates a parallel multi-agent workflow:

1. A **Database Engineer** fragment is generated (SQL schema scoped to the task description).
2. A **Frontend Developer** fragment is generated (React component scoped to the task description).
3. Both fragments are passed as an array to `src/router/synthesizer.ts` — the Node→Python bridge client.
4. The client sends a `POST` request to the Python FastAPI synthesizer:

```
POST http://localhost:8000/synthesize
Content-Type: application/json

{
  "fragments": [
    "// [Database Agent]\nCREATE TABLE wander_tasks (...);",
    "// [UI Agent]\nexport function TaskCard() { ... }"
  ]
}
```

5. The Python service merges the fragments, attaches provenance headers, and returns a `SynthesizeResponse`:

```json
{
  "synthesized": "// ✦  WanderAI Synthesized Output  —  2 fragment(s)\n...",
  "fragment_count": 2,
  "synthesized_at": "2026-05-03T14:24:55Z",
  "strategy": "mock-concatenate-v1"
}
```

6. The merged string is returned to the IDE as the tool result — a single, labelled, unified artifact.

The `strategy` field in the response is the extension point. Replace `_mock_synthesize` in `synthesizer/main.py` with an LLM-merge, AST-aware merge, or semantic diff and the field updates automatically. The Node bridge requires no changes.

> **Boot the synthesizer before using MCP synthesis tools:**
> ```bash
> cd synthesizer && uvicorn main:app --host 0.0.0.0 --port 8000 --reload
> ```
> Use `GET /healthz` to confirm it is live before running a session.

---

### Graceful Degradation — Local Concatenation Mode

The Python synthesizer is an enhancement layer, not a hard dependency. The Node bridge (`src/router/synthesizer.ts`) wraps every outbound request in a strict try/catch and handles three failure cases without ever throwing to the caller:

| Failure | Detection | Behaviour |
|---|---|---|
| Synthesizer offline | `ECONNREFUSED`, `ENOTFOUND`, `fetch failed` | Warns to `stderr`, activates local fallback |
| Request timeout | `TimeoutError` / `AbortError` (10 s hard limit) | Warns to `stderr`, activates local fallback |
| HTTP error response | Non-2xx status code | Logs status + body to `stderr`, activates local fallback |
| Unexpected error | Any other `Error` | Error-level log to `stderr`, activates local fallback |

**Local fallback output** — when the Python service is unreachable, the bridge concatenates the fragments locally with a clear warning header embedded in the output:

```
// ⚠  WanderAI Synthesizer unavailable — local fallback active
// Reason: synthesizer offline — start with: cd synthesizer && python main.py
// ────────────────────────────────────────────────────────────────────────
// ── Fragment 1 of 2 ──────────────────────────────────────────────────────
// [Database Agent]
CREATE TABLE wander_tasks (...);

// ── Fragment 2 of 2 ──────────────────────────────────────────────────────
// [UI Agent]
export function TaskCard() { ... }

// ────────────────────────────────────────────────────────────────────────
// ⚠  End of local fallback output
```

The MCP tool call always succeeds and the IDE always receives a usable result. The embedded restart hint tells the developer exactly what to run to restore full synthesis capability.

All failure logs go exclusively to `stderr` — never `stdout`. In the MCP server, `stdout` is the protocol wire between Node and the IDE. Writing to it outside the MCP message format corrupts the session. Every log in `synthesizer.ts` uses `process.stderr.write()` directly, with an ISO timestamp and severity prefix:

```
[wanderai-mcp:synthesizer] [WARN] 2026-05-03T14:24:55Z Synthesizer offline (http://localhost:8000/synthesize) — using local fallback.
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | One of these two | — | OpenAI provider key (`sk-...`) |
| `GEMINI_API_KEY` | One of these two | — | Google Gemini provider key (`AIza...`) |
| `WANDERAI_PROVIDER` | No | `auto` | Force a provider: `openai`, `gemini`, or `auto` |
| `WANDER_SYNTHESIZER_URL` | No | `http://localhost:8000/synthesize` | Override the Python synthesizer endpoint |
| `WANDER_ROUTER_MODEL` | No | `gpt-4o-mini` | Model used for task routing (MCP only) |
| `WANDER_WORKER_MODEL` | No | `gpt-4o` | Model used for agent execution (MCP only) |
| `WANDER_DATA_DIR` | No | Auto-resolved | Absolute path to the `data/` directory |

Place these in a `.env` file inside `artifacts/wander-cli/` or export them from your shell profile for global availability:

```bash
# ~/.bashrc or ~/.zshrc
export OPENAI_API_KEY="sk-..."
export GEMINI_API_KEY="AIza..."
```

---

## Complete Usage Example

```bash
# 1. Boot the Python synthesizer (separate terminal)
cd synthesizer && uvicorn main:app --port 8000 --reload

# 2. Start an interactive session with the default provider (auto)
wanderai

# 3. Force Gemini, use a faster model, point to a project-local registry
wanderai --provider gemini --gemini-model gemini-2.0-flash --data ./my-project/data

# 4. Disable streaming for script capture
wanderai --no-stream > session-output.txt

# 5. Use the MCP server in your IDE (Cursor / Windsurf mcp.json)
#    — no CLI flags needed, IDE launches it automatically via:
node /path/to/artifacts/wander-mcp/dist/index.js
```

---

## Related Documentation

- [README.md](../README.md) — full architecture overview, MCP setup, environment variables
- [synthesizer/main.py](../synthesizer/main.py) — Python FastAPI synthesis microservice
- [artifacts/wander-cli/src/config/validator.js](../artifacts/wander-cli/src/config/validator.js) — Zod schemas for env and agent registry
- [artifacts/wander-mcp/src/router/synthesizer.ts](../artifacts/wander-mcp/src/router/synthesizer.ts) — Node→Python bridge client with graceful degradation
