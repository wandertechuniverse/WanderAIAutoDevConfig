import { Agent } from "@workspace/api-client-react/src/generated/api.schemas";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, Users, Cpu } from "lucide-react";

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
      <div className="p-4 border-b border-sidebar-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
          <Terminal size={18} />
        </div>
        <div>
          <h1 className="font-semibold text-sidebar-foreground text-sm tracking-wide">Wander AI</h1>
          <p className="text-xs text-sidebar-foreground/50">Auto Dev Config</p>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        {isLoading ? (
          <div className="space-y-4 px-2">
            <div className="h-4 bg-white/5 rounded w-1/3 animate-pulse"></div>
            <div className="space-y-2">
              <div className="h-10 bg-white/5 rounded w-full animate-pulse"></div>
              <div className="h-10 bg-white/5 rounded w-full animate-pulse"></div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {leaders.length > 0 && (
              <div>
                <h2 className="px-2 text-xs font-semibold text-sidebar-foreground/50 tracking-wider uppercase mb-2 flex items-center gap-2">
                  <Users size={12} /> Leaders
                </h2>
                <div className="space-y-1">
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
                <h2 className="px-2 text-xs font-semibold text-sidebar-foreground/50 tracking-wider uppercase mb-2 flex items-center gap-2">
                  <Cpu size={12} /> Workers
                </h2>
                <div className="space-y-1">
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
    </div>
  );
}

function AgentItem({ agent, isActive, onClick }: { agent: Agent, isActive: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-3 py-2 rounded-md transition-all text-left group ${
        isActive 
          ? "bg-primary/10 text-primary-foreground border border-primary/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]" 
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground border border-transparent"
      }`}
    >
      <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
        isActive ? "bg-primary shadow-[0_0_8px_rgba(99,102,241,0.8)]" : "bg-sidebar-foreground/20 group-hover:bg-sidebar-foreground/40"
      }`} />
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-medium truncate ${isActive ? "text-primary" : ""}`}>
          {agent.name}
        </div>
        <div className={`text-xs truncate ${isActive ? "text-primary/70" : "text-sidebar-foreground/40"}`}>
          {agent.role}
        </div>
      </div>
    </button>
  );
}
