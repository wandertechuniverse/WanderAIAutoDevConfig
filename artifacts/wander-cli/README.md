# Wander AI CLI

A beautiful terminal CLI for interacting with your Wander AI IDE agents directly inside VSCode, Cursor, Windsurf, or any terminal.

---

## Requirements

- Node.js 18+
- An OpenAI API key

---

## Setup — run from this repo

```bash
# From the repo root
cd artifacts/wander-cli

# Install dependencies
npm install

# Copy and fill in your API key
cp .env.example .env
```

Edit `.env`:
```
OPENAI_API_KEY=sk-...
```

Run it:
```bash
# From the repo root, pointing at the shared data directory
node bin/cli.js --data ../api-server/data
```

---

## Setup — install globally

```bash
# From the wander-cli directory
npm install -g .
```

Then copy your project's `data/` folder (with `agents_config.json` and `agents/*.agent.md`) into any project root and run:

```bash
# From your project root (must contain data/)
wander-ai
```

Or point at a custom data path:
```bash
wander-ai --data /path/to/data
```

---

## Usage

```
Usage: wander-ai [options]

Options:
  -V, --version        output the version number
  -d, --data <path>    path to your data directory (default: "data")
  -m, --model <model>  OpenAI model to use (default: "gpt-4o")
  --no-stream          disable streaming (wait for full response)
  -h, --help           display help for command
```

### Examples

```bash
# Default — reads ./data/, streams with gpt-4o
wander-ai

# Use a specific model
wander-ai --model gpt-4-turbo

# Custom data directory
wander-ai --data ~/projects/myapp/data

# No streaming (waits for full response before printing)
wander-ai --no-stream
```

---

## Project structure expected

```
your-project/
├── .env                          ← OPENAI_API_KEY goes here
└── data/
    ├── agents_config.json        ← array of agent definitions
    └── agents/
        ├── engineering_manager.agent.md
        ├── frontend_dev.agent.md
        └── ...
```

### `agents_config.json` format

```json
[
  {
    "id": "engineering_manager",
    "name": "Engineering Manager",
    "role": "Orchestrates the entire development team",
    "agent_type": "leader"
  },
  {
    "id": "frontend_dev",
    "name": "Frontend Developer",
    "role": "Builds UI components using React and TypeScript",
    "agent_type": "worker"
  }
]
```

---

## Features

- Arrow-key agent selection with role hints
- Leaders and Workers grouped in the list
- Full conversation history — each session remembers prior messages
- Real-time streaming output (like ChatGPT)
- Graceful error handling — errors don't end your session
- Works inside any IDE terminal (VSCode, Cursor, Windsurf, JetBrains)
