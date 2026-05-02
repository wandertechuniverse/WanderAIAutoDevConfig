# Wander AI Auto Dev Config

## Overview

A dark-mode internal tool where users select from 15 specialized AI agents in a sidebar and chat with them. Each agent has a unique markdown persona file that is injected as the system prompt before calling the LLM.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/wander-ai), served at `/`
- **Backend**: Express 5 (artifacts/api-server), served at `/api`
- **AI**: OpenAI via Replit AI Integrations (gpt-5.4, streaming SSE)
- **Database**: PostgreSQL + Drizzle ORM (conversations + messages schema)
- **Validation**: Zod (zod/v4), drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Features

- 15 specialized AI agents with full persona markdown files
- Agents grouped by type: Leaders (3) and Workers (12)
- Real-time SSE streaming chat responses
- Markdown rendering with syntax highlighting in assistant messages
- Dark mode UI with deep space blue / indigo theme
- Switching agents clears the chat history

## Agent Data

- `artifacts/api-server/data/agents_config.json` — agent metadata (id, name, role, agent_type)
- `artifacts/api-server/data/agents/*.agent.md` — persona files for each agent

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## API Routes

- `GET /api/agents` — returns all agents from agents_config.json
- `POST /api/chat` — accepts { agentId, messages }, streams SSE response from OpenAI with the agent's markdown as system prompt

## Adding Agents

1. Add an entry to `artifacts/api-server/data/agents_config.json`
2. Create a markdown file at `artifacts/api-server/data/agents/{agent_id}.agent.md`

## Environment Variables

- `AI_INTEGRATIONS_OPENAI_BASE_URL` — auto-set by Replit AI Integrations
- `AI_INTEGRATIONS_OPENAI_API_KEY` — auto-set by Replit AI Integrations
- `DATABASE_URL` / `PG*` — auto-set by Replit managed PostgreSQL

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
