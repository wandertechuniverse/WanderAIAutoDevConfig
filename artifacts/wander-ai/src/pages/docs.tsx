import { useState } from "react";
import { Link } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useIdeSelection, IDE_OPTIONS, type IdeId } from "@/hooks/use-ide-selection";
import {
  Sparkles,
  Menu,
  X,
  BookOpen,
  Terminal,
  Plug,
  Rocket,
  Bot,
  ChevronRight,
  MessageSquare,
  Copy,
  Check,
  Monitor,
} from "lucide-react";

// ─── Nav sections ────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "overview",    label: "Overview",        icon: BookOpen },
  { id: "agents",      label: "The 16 Agents",   icon: Bot },
  { id: "cli",         label: "CLI Tool",         icon: Terminal },
  { id: "mcp",         label: "MCP Integration",  icon: Plug },
  { id: "deployment",  label: "Deployment",       icon: Rocket },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

// ─── Copy button ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute top-3 right-3 p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors z-10"
      aria-label="Copy code"
    >
      {copied ? <Check size={13} className="text-cyan-400" /> : <Copy size={13} />}
    </button>
  );
}

// ─── Code block ──────────────────────────────────────────────────────────────

function Code({ language, children }: { language: string; children: string }) {
  return (
    <div className="relative group mt-4 mb-2 w-full max-w-full">
      <CopyButton text={children.trim()} />
      {/* Scrollable shell — prevents wide content from overflowing the page on mobile */}
      <div className="overflow-x-auto w-full max-w-full rounded-xl border border-white/10 bg-[#080d14]">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          PreTag="div"
          className="!rounded-xl !border-0 !bg-transparent !text-xs md:!text-sm !my-0 !p-4"
          customStyle={{ margin: 0, background: "transparent", minWidth: "max-content" }}
        >
          {children.trim()}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

// ─── Section heading ─────────────────────────────────────────────────────────

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-xl font-bold text-foreground mt-12 mb-4 flex items-center gap-2 scroll-mt-20"
    >
      {children}
    </h2>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-semibold text-foreground/90 mt-8 mb-3">{children}</h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground leading-relaxed mb-3">{children}</p>;
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-white/10 text-cyan-300 px-1.5 py-0.5 rounded text-[13px] font-mono">
      {children}
    </code>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 px-4 py-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 text-sm text-cyan-200/80 leading-relaxed">
      {children}
    </div>
  );
}

// ─── Content sections ─────────────────────────────────────────────────────────

function SectionOverview() {
  return (
    <div>
      <SectionHeading id="overview">
        <BookOpen size={20} className="text-cyan-400" /> Overview
      </SectionHeading>

      <P>
        <strong className="text-foreground">WanderAI Auto Dev Config</strong> is an
        orchestrated multi-agent AI ecosystem built for IDE-first development workflows.
        It routes any engineering task — from architecture reviews to Flutter screens — to
        the most qualified specialist agent automatically.
      </P>

      <P>
        The ecosystem ships as three complementary tools that all share the same agent
        personas and configuration:
      </P>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-6">
        {[
          {
            icon: MessageSquare,
            title: "Web Chat UI",
            desc: "Browser-based interface for direct conversation with any of the 16 agents.",
          },
          {
            icon: Terminal,
            title: "CLI Tool",
            desc: "wanderai — a Node.js CLI for terminal-first workflows with streaming output.",
          },
          {
            icon: Plug,
            title: "MCP Server",
            desc: "wanderai-mcp — a native IDE integration for Cursor, Claude Desktop, and any MCP-compatible host.",
          },
        ].map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 backdrop-blur-sm"
          >
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3">
              <Icon size={16} />
            </div>
            <div className="text-sm font-semibold text-foreground mb-1">{title}</div>
            <div className="text-xs text-muted-foreground leading-relaxed">{desc}</div>
          </div>
        ))}
      </div>

      <SubHeading>How routing works</SubHeading>
      <P>
        Every request passes through a two-step pipeline. First, a fast router model
        (<InlineCode>gpt-4o-mini</InlineCode>) reads your task and the agent registry to
        select the best-suited specialist. Then a more capable worker model
        (<InlineCode>gpt-4o</InlineCode>) executes the task using that agent's
        full persona from its <InlineCode>.agent.md</InlineCode> file.
      </P>

      <Code language="text">{`
User task description
        │
        ▼
┌───────────────────┐
│  Router (gpt-4o-mini) │  ← reads agents_config.json
│  Selects best agent    │
└────────┬──────────┘
         │  agent_id
         ▼
┌───────────────────────────┐
│  Worker (gpt-4o)          │  ← reads {agentId}.agent.md
│  Executes with full persona│
└───────────────────────────┘
      `}</Code>

      <SubHeading>Repository layout</SubHeading>
      <Code language="text">{`
.
├── artifacts/
│   ├── api-server/          # Express REST API + streaming chat
│   │   └── data/
│   │       ├── agents_config.json     # Agent registry
│   │       └── agents/*.agent.md      # Agent personas
│   ├── wander-ai/           # React + Vite web UI (this app)
│   ├── wander-cli/          # Node.js terminal CLI
│   └── wander-mcp/          # MCP server for IDE integration
└── .github/
    └── copilot-instructions.md  # Fallback orchestrator persona
      `}</Code>
    </div>
  );
}

function SectionAgents() {
  const leaders = [
    { id: "engineering_manager", name: "Engineering Manager", role: "Team leadership, sprint planning, delivery" },
    { id: "product_manager",     name: "Product Manager",     role: "Requirements, prioritisation, roadmaps" },
    { id: "tech_lead",           name: "Tech Lead",           role: "Architecture, code standards, technical decisions" },
  ];
  const workers = [
    { id: "frontend_dev",        name: "Frontend Developer",  role: "React, TypeScript, Tailwind CSS" },
    { id: "mobile_dev",          name: "Mobile Developer",    role: "Flutter, Dart, Riverpod" },
    { id: "backend_dev",         name: "Backend Developer",   role: "Node.js, Express, REST APIs" },
    { id: "database_engineer",   name: "Database Engineer",   role: "PostgreSQL, migrations, query optimisation" },
    { id: "devops_engineer",     name: "DevOps Engineer",     role: "CI/CD, Docker, cloud infrastructure" },
    { id: "qa_engineer",         name: "QA Engineer",         role: "Testing, bug triage, coverage" },
    { id: "security_engineer",   name: "Security Engineer",   role: "Auth, CVEs, secure architecture" },
    { id: "ui_ux_designer",      name: "UI/UX Designer",      role: "Design systems, accessibility, Figma" },
    { id: "data_scientist",      name: "Data Scientist",      role: "ML pipelines, analytics, Python" },
    { id: "technical_writer",    name: "Technical Writer",    role: "Docs, READMEs, API references" },
    { id: "code_reviewer",       name: "Code Reviewer",       role: "Pull request reviews, standards" },
    { id: "api_designer",        name: "API Designer",        role: "OpenAPI, REST/GraphQL contracts" },
    { id: "performance_engineer",name: "Performance Engineer",role: "Profiling, bundle size, latency" },
  ];

  return (
    <div>
      <SectionHeading id="agents">
        <Bot size={20} className="text-cyan-400" /> The 16 Agents
      </SectionHeading>

      <P>
        Agents are defined in <InlineCode>data/agents_config.json</InlineCode> and each
        has a corresponding <InlineCode>data/agents/{"{agentId}"}.agent.md</InlineCode>{" "}
        persona file loaded at runtime. Leaders coordinate and plan; Workers implement
        and ship.
      </P>

      <SubHeading>Leaders (3)</SubHeading>
      <div className="space-y-1.5 mb-6">
        {leaders.map(a => (
          <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
            <div>
              <span className="text-sm font-medium text-foreground">{a.name}</span>
              <span className="ml-2 text-[10px] font-mono text-muted-foreground/50">{a.id}</span>
              <p className="text-xs text-muted-foreground/60 mt-0.5">{a.role}</p>
            </div>
          </div>
        ))}
      </div>

      <SubHeading>Workers (13)</SubHeading>
      <div className="space-y-1.5">
        {workers.map(a => (
          <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
            <div>
              <span className="text-sm font-medium text-foreground">{a.name}</span>
              <span className="ml-2 text-[10px] font-mono text-muted-foreground/50">{a.id}</span>
              <p className="text-xs text-muted-foreground/60 mt-0.5">{a.role}</p>
            </div>
          </div>
        ))}
      </div>

      <SubHeading>Adding a custom agent</SubHeading>
      <P>
        1. Add an entry to <InlineCode>data/agents_config.json</InlineCode>:
      </P>
      <Code language="json">{`
{
  "id": "my_agent",
  "name": "My Custom Agent",
  "role": "Does the thing",
  "agent_type": "worker"
}
      `}</Code>
      <P>
        2. Create <InlineCode>data/agents/my_agent.agent.md</InlineCode> with the agent's
        system prompt. The file is loaded verbatim as the <InlineCode>system</InlineCode>{" "}
        message sent to the LLM.
      </P>
      <P>
        3. Add a routing rule to the router prompt in{" "}
        <InlineCode>artifacts/wander-mcp/src/index.ts</InlineCode> and rebuild:
        <InlineCode>pnpm --filter @workspace/wander-mcp run build</InlineCode>.
      </P>
    </div>
  );
}

function SectionCli() {
  return (
    <div>
      <SectionHeading id="cli">
        <Terminal size={20} className="text-cyan-400" /> CLI Tool
      </SectionHeading>

      <P>
        The <InlineCode>wanderai</InlineCode> CLI is a standalone Node.js tool that
        gives you streaming agent responses directly in your terminal — no browser
        required.
      </P>

      <SubHeading>Global install</SubHeading>
      <Code language="bash">{`
# From the repo root — links the binary globally
cd artifacts/wander-cli
npm install -g .

# Verify
wanderai --version
      `}</Code>

      <Callout>
        The CLI reads your <InlineCode>OPENAI_API_KEY</InlineCode> from a{" "}
        <InlineCode>.env</InlineCode> file in the directory where you run it, or from
        your shell environment. It does <strong>not</strong> use the Replit AI
        integration proxy.
      </Callout>

      <SubHeading>Usage</SubHeading>
      <Code language="bash">{`
# Interactive REPL — auto-routes every message to the best agent
wanderai

# Point at a custom data directory
wanderai --data /path/to/your/data

# Override the worker model
wanderai --model gpt-4-turbo

# Disable streaming (waits for full response)
wanderai --no-stream

# Help
wanderai --help
      `}</Code>

      <SubHeading>Session flow</SubHeading>
      <Code language="text">{`
$ wanderai

 ╔═════════════════════════════════╗
 ║     ⚡ WANDERAI                 ║
 ║     IDE Agent Orchestrator      ║
 ╚═════════════════════════════════╝

 Type your task. The router picks the right agent automatically.
 Commands: /agents  /exit

You › write a Riverpod state notifier for a shopping cart

[Routing...] → mobile_dev
[Mobile Developer]

 Here is a Riverpod StateNotifier for a shopping cart...
      `}</Code>

      <SubHeading>CLI commands</SubHeading>
      <div className="overflow-x-auto mt-4 mb-2">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs text-muted-foreground/60 uppercase tracking-wider">
              <th className="pb-2 pr-6 font-medium">Command</th>
              <th className="pb-2 font-medium">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {[
              ["/agents", "List all available agents with their IDs and roles"],
              ["/exit", "Quit the session"],
              ["Ctrl+C", "Force quit"],
            ].map(([cmd, desc]) => (
              <tr key={cmd}>
                <td className="py-2.5 pr-6">
                  <InlineCode>{cmd}</InlineCode>
                </td>
                <td className="py-2.5 text-muted-foreground text-xs">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SubHeading>Environment variables</SubHeading>
      <Code language="bash">{`
# Required
OPENAI_API_KEY=sk-...

# Optional overrides
WANDER_ROUTER_MODEL=gpt-4o-mini   # default
WANDER_WORKER_MODEL=gpt-4o        # default
WANDER_DATA_DIR=/custom/path/to/data
      `}</Code>
    </div>
  );
}

// ─── IDE-specific MCP config data ────────────────────────────────────────────

const IDE_MCP_CONFIG: Record<
  IdeId,
  {
    configPath: string;
    configFormat: "mcpServers" | "servers";
    restartNote: string;
    invokeNote: string;
    extraNote?: string;
  }
> = {
  cursor: {
    configPath: "~/.cursor/mcp.json",
    configFormat: "mcpServers",
    restartNote: "Restart Cursor after saving.",
    invokeNote: "Type @wanderai in any Cursor chat or Cmd+K prompt.",
  },
  vscode: {
    configPath: ".vscode/mcp.json",
    configFormat: "servers",
    restartNote: "Reload the VS Code window (Cmd+Shift+P → Developer: Reload Window).",
    invokeNote: "Open GitHub Copilot Chat and type @wanderai, or press Cmd+I.",
    extraNote:
      "Requires VS Code ≥ 1.99 and GitHub Copilot with agent mode enabled. The config file lives inside your project — commit it to share with your team.",
  },
  windsurf: {
    configPath: "~/.codeium/windsurf/mcp_config.json",
    configFormat: "mcpServers",
    restartNote: "Restart Windsurf (or reload the MCP panel from Settings → MCP).",
    invokeNote: "Type @wanderai in the Cascade chat panel.",
  },
  antigravity: {
    configPath: "~/.antigravity/config/mcp.json",
    configFormat: "mcpServers",
    restartNote: "Restart Antigravity or run Reload MCP from the command palette.",
    invokeNote: "Type @wanderai in the Agent panel.",
  },
};

function buildConfigSnippet(ide: IdeId): string {
  const meta = IDE_MCP_CONFIG[ide];
  if (meta.configFormat === "servers") {
    return JSON.stringify(
      {
        servers: {
          wanderai: {
            type: "stdio",
            command: "node",
            args: ["/absolute/path/to/artifacts/wander-mcp/dist/index.js"],
            env: {
              OPENAI_API_KEY: "sk-...",
              WANDER_DATA_DIR: "/absolute/path/to/artifacts/api-server/data",
            },
          },
        },
      },
      null,
      2,
    );
  }
  return JSON.stringify(
    {
      mcpServers: {
        wanderai: {
          command: "node",
          args: ["/absolute/path/to/artifacts/wander-mcp/dist/index.js"],
          env: {
            OPENAI_API_KEY: "sk-...",
            WANDER_DATA_DIR: "/absolute/path/to/artifacts/api-server/data",
          },
        },
      },
    },
    null,
    2,
  );
}

function SectionMcp() {
  const { selectedIde, selectIde } = useIdeSelection();
  // Default to cursor if nothing selected yet (user arrived at docs directly)
  const activeIde: IdeId = selectedIde ?? "cursor";
  const meta = IDE_MCP_CONFIG[activeIde];
  const configSnippet = buildConfigSnippet(activeIde);
  const ideLabel = IDE_OPTIONS.find(o => o.id === activeIde)?.label ?? activeIde;

  return (
    <div>
      <SectionHeading id="mcp">
        <Plug size={20} className="text-cyan-400" /> MCP Integration
      </SectionHeading>

      <P>
        The WanderAI MCP server exposes three tools that any MCP-compatible IDE can call.
        The server communicates over <strong>stdio</strong> — the IDE spawns it as a child
        process. Select your IDE below to see the exact setup instructions.
      </P>

      {/* IDE switcher */}
      <div className="my-6">
        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest font-mono mb-3 flex items-center gap-1.5">
          <Monitor size={11} /> Your IDE
        </p>
        <div className="flex flex-wrap gap-2">
          {IDE_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => selectIde(id)}
              className={[
                "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                activeIde === id
                  ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-300"
                  : "bg-slate-900/50 border-slate-700/50 text-muted-foreground hover:text-foreground hover:border-slate-600",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
        {!selectedIde && (
          <p className="text-[11px] text-amber-400/60 font-mono mt-2">
            Tip: select your IDE on the home screen to persist this choice.
          </p>
        )}
      </div>

      {/* Step 1: Build */}
      <SubHeading>Step 1 — Build the server</SubHeading>
      <Code language="bash">{`cd artifacts/wander-mcp
pnpm install
pnpm run build
# Output: dist/index.js`}</Code>

      {/* Step 2: IDE-specific config */}
      <SubHeading>Step 2 — Add to {ideLabel}</SubHeading>

      {meta.extraNote && <Callout>{meta.extraNote}</Callout>}

      <P>
        Open <InlineCode>{meta.configPath}</InlineCode> (create it if it does not exist)
        and add the entry below. Replace the paths with absolute paths on your machine.
      </P>

      <Code language="json">{configSnippet}</Code>

      <P>{meta.restartNote}</P>

      {/* Step 3: Invoke */}
      <SubHeading>Step 3 — Invoke WanderAI</SubHeading>
      <P>{meta.invokeNote}</P>
      <Code language="text">{`# ${ideLabel} example

"Use wanderai to review the security of my auth middleware"
→ Routes to: security_engineer

"Use wanderai to write a Flutter screen for a checkout form"
→ Routes to: mobile_dev

"Ask wanderai tech_lead to design the database schema for a SaaS billing system"
→ Bypasses router, uses tech_lead directly`}</Code>

      {/* Tools reference */}
      <SubHeading>Available tools</SubHeading>

      <div className="space-y-4 mt-4">
        {[
          {
            name: "delegate_to_wander_ai",
            badge: "auto-routes",
            badgeColor: "cyan",
            desc: "The primary tool. Automatically routes your task to the best-suited agent.",
            params: [
              { name: "task_description",    req: true,  desc: "The task, question, or instruction." },
              { name: "current_code_context", req: false, desc: "Optional — paste the current file or snippet." },
            ],
          },
          {
            name: "list_wander_agents",
            badge: "discovery",
            badgeColor: "slate",
            desc: "Returns all 16 agents with their IDs, names, roles, and types.",
            params: [],
          },
          {
            name: "ask_specific_agent",
            badge: "direct",
            badgeColor: "amber",
            desc: "Bypass the router and send your task directly to a named agent.",
            params: [
              { name: "agent_id",             req: true,  desc: "e.g. 'frontend_dev', 'qa_engineer'" },
              { name: "task_description",     req: true,  desc: "The task or question." },
              { name: "current_code_context", req: false, desc: "Optional code context." },
            ],
          },
        ].map(tool => (
          <div key={tool.name} className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
              <span className="text-sm font-mono font-semibold text-foreground">{tool.name}</span>
              <span className={[
                "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider",
                tool.badgeColor === "cyan"  ? "bg-cyan-500/10  text-cyan-400  border border-cyan-500/20" :
                tool.badgeColor === "amber" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                                              "bg-slate-500/10 text-slate-400 border border-slate-500/20",
              ].join(" ")}>{tool.badge}</span>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground mb-3">{tool.desc}</p>
              {tool.params.length > 0 && (
                <table className="w-full text-xs border-collapse">
                  <tbody className="divide-y divide-slate-800/50">
                    {tool.params.map(p => (
                      <tr key={p.name}>
                        <td className="py-2 pr-4 font-mono text-cyan-300/80 whitespace-nowrap">
                          {p.name}
                          {p.req && <span className="ml-1 text-[9px] text-red-400/60 align-super">*</span>}
                        </td>
                        <td className="py-2 text-muted-foreground/70">{p.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionDeployment() {
  return (
    <div>
      <SectionHeading id="deployment">
        <Rocket size={20} className="text-cyan-400" /> Deployment
      </SectionHeading>

      <P>
        The web UI is a Vite-built React app. The API server is Express. Both can be
        deployed independently. For production, you need at minimum an API server
        that serves <InlineCode>/api</InlineCode> and a static host for the frontend.
      </P>

      <SubHeading>Environment variables</SubHeading>
      <P>
        The API server uses the Replit AI Integration proxy — no{" "}
        <InlineCode>OPENAI_API_KEY</InlineCode> is needed on the server. The CLI and
        MCP server require their own key.
      </P>
      <Code language="bash">{`
# API server (.env or deployment platform secrets)
SESSION_SECRET=your-random-secret-here
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# CLI and MCP server (.env in their respective directories)
OPENAI_API_KEY=sk-...
WANDER_ROUTER_MODEL=gpt-4o-mini   # optional
WANDER_WORKER_MODEL=gpt-4o        # optional
WANDER_DATA_DIR=/path/to/data     # optional
      `}</Code>

      <SubHeading>Deploy to Replit (recommended)</SubHeading>
      <P>
        The entire monorepo is already configured for Replit deployment. Click{" "}
        <strong className="text-foreground">Publish</strong> in the Replit header to
        deploy to a <InlineCode>.replit.app</InlineCode> domain. The proxy and workflow
        configuration are handled automatically.
      </P>

      <SubHeading>Deploy to Vercel (web UI only)</SubHeading>
      <Code language="bash">{`
# 1. Build the frontend
cd artifacts/wander-ai
pnpm run build
# Output: dist/

# 2. Push to GitHub
git add .
git commit -m "chore: production build"
git push origin main

# 3. Import the repo in Vercel
#    Build command:   pnpm --filter @workspace/wander-ai run build
#    Output dir:      artifacts/wander-ai/dist
#    Root dir:        (leave blank — monorepo root)
      `}</Code>

      <Callout>
        The web UI makes API calls to <InlineCode>/api</InlineCode>. When deploying the
        frontend separately (Vercel), you must also deploy the API server and configure
        a rewrite rule to proxy <InlineCode>/api/*</InlineCode> to the API server's URL.
      </Callout>

      <SubHeading>Deploy API to Railway / Fly.io / VPS</SubHeading>
      <Code language="bash">{`
# Build the API server
pnpm --filter @workspace/api-server run build

# The server binds to the PORT env var
# Railway and Fly.io inject PORT automatically

# Dockerfile example
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server run build
EXPOSE 8080
CMD ["node", "artifacts/api-server/dist/index.js"]
      `}</Code>

      <SubHeading>MCP server distribution</SubHeading>
      <P>
        The MCP server runs locally on the developer's machine — it is not deployed
        to the cloud. Share it via npm or a direct GitHub link:
      </P>
      <Code language="bash">{`
# Publish to npm
cd artifacts/wander-mcp
npm publish --access public

# Users install and configure it:
npm install -g wanderai-mcp

# In their Cursor / Claude Desktop config:
{
  "command": "wanderai-mcp",
  "env": { "OPENAI_API_KEY": "sk-..." }
}
      `}</Code>
    </div>
  );
}

// ─── Docs sidebar nav ────────────────────────────────────────────────────────

function DocsSidebarNav({
  active,
  onSelect,
  onClose,
  isOpen,
}: {
  active: SectionId;
  onSelect: (id: SectionId) => void;
  onClose: () => void;
  isOpen: boolean;
}) {
  return (
    <aside
      className={[
        "w-64 bg-slate-950 border-r border-slate-800 flex flex-col h-full shrink-0",
        "fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full",
        "md:relative md:translate-x-0 md:z-auto",
      ].join(" ")}
    >
      {/* Sidebar header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
        <Link href="/" className="flex items-center gap-3 min-w-0 group">
          <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
            <Sparkles size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-foreground text-sm tracking-wide truncate group-hover:text-cyan-400 transition-colors">
              WanderAI
            </h1>
            <p className="text-[11px] text-muted-foreground/40 font-mono truncate">
              Documentation
            </p>
          </div>
        </Link>
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors shrink-0 ml-2"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { onSelect(id); onClose(); }}
            className={[
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left",
              active === id
                ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent",
            ].join(" ")}
          >
            <Icon size={15} className="shrink-0" />
            <span className="text-sm font-medium">{label}</span>
            {active === id && <ChevronRight size={13} className="ml-auto opacity-50" />}
          </button>
        ))}

        <div className="pt-4 px-3">
          <div className="border-t border-slate-800/80 pt-4">
            <Link
              href="/"
              className="flex items-center gap-3 px-0 py-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              <MessageSquare size={15} className="shrink-0" />
              Open Chat
            </Link>
          </div>
        </div>
      </nav>

      <div className="p-3 border-t border-slate-800 shrink-0">
        <p className="text-[10px] text-muted-foreground/30 font-mono text-center">
          wanderai-mcp v1.0.0
        </p>
      </div>
    </aside>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function DocsPage() {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSelect = (id: SectionId) => {
    setActiveSection(id);
    // Scroll content to top on section change
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 h-13 shrink-0 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-20">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          aria-label="Open docs menu"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/20 text-primary flex items-center justify-center">
            <Sparkles size={12} />
          </div>
          <span className="font-semibold text-sm text-foreground tracking-wide">
            {SECTIONS.find(s => s.id === activeSection)?.label ?? "Docs"}
          </span>
        </div>
        <Link
          href="/"
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          aria-label="Open chat"
        >
          <MessageSquare size={18} />
        </Link>
      </header>

      <div className="flex flex-1 min-h-0 relative">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Left nav */}
        <DocsSidebarNav
          active={activeSection}
          onSelect={handleSelect}
          onClose={() => setSidebarOpen(false)}
          isOpen={sidebarOpen}
        />

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0">
          <main className="max-w-3xl mx-auto px-5 md:px-10 py-8 pb-20">
            {/* Desktop page header */}
            <div className="hidden md:flex items-center justify-between mb-2 pb-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h1 className="text-base font-bold text-foreground tracking-tight">
                    WanderAI Documentation
                  </h1>
                  <p className="text-xs text-muted-foreground/50 font-mono">
                    IDE Agent Orchestrator · v1.0.0
                  </p>
                </div>
              </div>
              <Link
                href="/"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 border border-slate-800 transition-all"
              >
                <MessageSquare size={14} />
                Open Chat
              </Link>
            </div>

            {activeSection === "overview"   && <SectionOverview />}
            {activeSection === "agents"     && <SectionAgents />}
            {activeSection === "cli"        && <SectionCli />}
            {activeSection === "mcp"        && <SectionMcp />}
            {activeSection === "deployment" && <SectionDeployment />}

            {/* Pagination */}
            <div className="flex items-center justify-between mt-16 pt-6 border-t border-slate-800">
              {(() => {
                const idx = SECTIONS.findIndex(s => s.id === activeSection);
                const prev = SECTIONS[idx - 1];
                const next = SECTIONS[idx + 1];
                return (
                  <>
                    <div>
                      {prev && (
                        <button
                          onClick={() => handleSelect(prev.id)}
                          className="flex flex-col items-start gap-0.5 text-left group"
                        >
                          <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-mono">
                            Previous
                          </span>
                          <span className="text-sm text-muted-foreground group-hover:text-cyan-400 transition-colors">
                            ← {prev.label}
                          </span>
                        </button>
                      )}
                    </div>
                    <div>
                      {next && (
                        <button
                          onClick={() => handleSelect(next.id)}
                          className="flex flex-col items-end gap-0.5 text-right group"
                        >
                          <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-mono">
                            Next
                          </span>
                          <span className="text-sm text-muted-foreground group-hover:text-cyan-400 transition-colors">
                            {next.label} →
                          </span>
                        </button>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </main>
        </ScrollArea>
      </div>
    </div>
  );
}
