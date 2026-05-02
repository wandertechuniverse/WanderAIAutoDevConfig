import { Agent } from "@workspace/api-client-react/src/generated/api.schemas";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BrainCircuit, Cpu, Sparkles } from "lucide-react";

interface ChatSidebarProps {
  agents: Agent[];
  isLoading: boolean;
  activeAgentId: string | null;
  onSelectAgent: (id: string) => void;
}

export function ChatSidebar({ agents, isLoading, activeAgentId, onSelectAgent }: ChatSidebarProps) {
  const leaders = agents.filter(a => a.agent_type === "leader");
  const workers = agents.filter(a => a.agent_type === "worker");

  return (
    <div className="w-72 bg-sidebar border-r border-sidebar-border flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
          <Sparkles size={16} />
        </div>
        <div className="min-w-0">
          <h1 className="font-semibold text-sidebar-foreground text-sm tracking-wide truncate">Wander AI</h1>
          <p className="text-[11px] text-sidebar-foreground/40 font-mono truncate">IDE Agent Config</p>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        {isLoading ? (
          <div className="space-y-5 px-2">
            <div className="h-3 bg-white/5 rounded w-1/3 animate-pulse"></div>
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-11 bg-white/5 rounded-lg w-full animate-pulse"></div>
              ))}
            </div>
            <div className="h-3 bg-white/5 rounded w-1/4 animate-pulse mt-4"></div>
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-11 bg-white/5 rounded-lg w-full animate-pulse"></div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {leaders.length > 0 && (
              <div>
                <h2 className="px-2 text-[10px] font-semibold text-sidebar-foreground/40 tracking-widest uppercase mb-2 flex items-center gap-1.5">
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
                <h2 className="px-2 text-[10px] font-semibold text-sidebar-foreground/40 tracking-widest uppercase mb-2 flex items-center gap-1.5">
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
      <div className="p-3 border-t border-sidebar-border">
        <p className="text-[10px] text-sidebar-foreground/30 font-mono text-center">
          {agents.length > 0 ? `${agents.length} agents loaded` : "loading agents…"}
        </p>
      </div>
    </div>
  );
}

function AgentItem({ agent, isActive, onClick }: { agent: Agent; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all text-left group ${
        isActive
          ? "bg-primary/10 border border-primary/20"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground border border-transparent"
      }`}
    >
      <div className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 transition-all ${
        isActive
          ? "bg-primary shadow-[0_0_6px_rgba(99,102,241,0.9)]"
          : "bg-sidebar-foreground/20 group-hover:bg-sidebar-foreground/40"
      }`} />
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-medium truncate transition-colors ${
          isActive ? "text-primary" : "text-sidebar-foreground"
        }`}>
          {agent.name}
        </div>
        <div className={`text-[11px] truncate transition-colors ${
          isActive ? "text-primary/60" : "text-sidebar-foreground/40"
        }`}>
          {agent.role}
        </div>
      </div>
    </button>
  );
}
