import { Agent } from "@workspace/api-client-react/src/generated/api.schemas";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BrainCircuit, BookOpen, Cpu, Sparkles, X } from "lucide-react";
import { Link } from "wouter";

interface ChatSidebarProps {
  agents: Agent[];
  isLoading: boolean;
  activeAgentId: string | null;
  onSelectAgent: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function ChatSidebar({
  agents,
  isLoading,
  activeAgentId,
  onSelectAgent,
  isOpen,
  onClose,
}: ChatSidebarProps) {
  const leaders = agents.filter(a => a.agent_type === "leader");
  const workers = agents.filter(a => a.agent_type === "worker");

  return (
    <aside
      className={[
        // Base styles
        "w-72 bg-slate-950 border-r border-slate-800 flex flex-col h-full shrink-0",
        // Mobile: fixed off-canvas, slide in from left
        "fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full",
        // Desktop: static in flow, always visible
        "md:relative md:translate-x-0 md:z-auto",
      ].join(" ")}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
            <Sparkles size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-foreground text-sm tracking-wide truncate">Wander AI</h1>
            <p className="text-[11px] text-muted-foreground/40 font-mono truncate">IDE Agent Config</p>
          </div>
        </div>

        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors shrink-0 ml-2"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        {isLoading ? (
          <div className="space-y-5 px-2">
            <div className="h-3 bg-white/5 rounded w-1/3 animate-pulse" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-11 bg-white/5 rounded-lg w-full animate-pulse" />
            ))}
            <div className="h-3 bg-white/5 rounded w-1/4 animate-pulse mt-4" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-11 bg-white/5 rounded-lg w-full animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {leaders.length > 0 && (
              <div>
                <h2 className="px-2 text-[10px] font-semibold text-muted-foreground/40 tracking-widest uppercase mb-2 flex items-center gap-1.5">
                  <BrainCircuit size={11} /> Leaders
                </h2>
                <div className="space-y-0.5">
                  {leaders.map(agent => (
                    <AgentItem
                      key={agent.id}
                      agent={agent}
                      isActive={activeAgentId === agent.id}
                      onClick={() => onSelectAgent(agent.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {workers.length > 0 && (
              <div>
                <h2 className="px-2 text-[10px] font-semibold text-muted-foreground/40 tracking-widest uppercase mb-2 flex items-center gap-1.5">
                  <Cpu size={11} /> Workers
                </h2>
                <div className="space-y-0.5">
                  {workers.map(agent => (
                    <AgentItem
                      key={agent.id}
                      agent={agent}
                      isActive={activeAgentId === agent.id}
                      onClick={() => onSelectAgent(agent.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-slate-800 shrink-0 space-y-2">
        <Link
          href="/docs"
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent transition-all"
        >
          <BookOpen size={13} />
          Documentation
        </Link>
        <p className="text-[10px] text-muted-foreground/30 font-mono text-center">
          {agents.length > 0 ? `${agents.length} agents loaded` : "loading agents\u2026"}
        </p>
      </div>
    </aside>
  );
}

function AgentItem({
  agent,
  isActive,
  onClick,
}: {
  agent: Agent;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all text-left group",
        isActive
          ? "bg-cyan-500/10 border border-cyan-500/20"
          : "text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent",
      ].join(" ")}
    >
      <div
        className={[
          "mt-1 w-1.5 h-1.5 rounded-full shrink-0 transition-all",
          isActive
            ? "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]"
            : "bg-muted-foreground/20 group-hover:bg-muted-foreground/40",
        ].join(" ")}
      />
      <div className="min-w-0 flex-1">
        <div
          className={[
            "text-sm font-medium truncate transition-colors",
            isActive ? "text-cyan-400" : "text-foreground",
          ].join(" ")}
        >
          {agent.name}
        </div>
        <div
          className={[
            "text-[11px] truncate transition-colors",
            isActive ? "text-cyan-400/60" : "text-muted-foreground/40",
          ].join(" ")}
        >
          {agent.role}
        </div>
      </div>
    </button>
  );
}
