import { useState } from "react";
import { useListAgents } from "@workspace/api-client-react";
import type { Agent, ChatMessage } from "@workspace/api-client-react/src/generated/api.schemas";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { Link } from "wouter";
import { BookOpen, Menu, Sparkles } from "lucide-react";

export function MainChat() {
  const { data: agents, isLoading } = useListAgents();
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Record<string, ChatMessage[]>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeAgent = agents?.find((a: Agent) => a.id === activeAgentId) || null;
  const activeMessages = activeAgentId ? (conversations[activeAgentId] || []) : [];

  const handleSelectAgent = (agentId: string) => {
    setActiveAgentId(agentId);
    setSidebarOpen(false);
  };

  const updateMessages = (agentId: string, messages: ChatMessage[]) => {
    setConversations(prev => ({ ...prev, [agentId]: messages }));
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      {/* Mobile top navbar */}
      <header className="md:hidden flex items-center justify-between px-4 h-13 shrink-0 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
            <Sparkles size={14} />
          </div>
          <div>
            <span className="font-semibold text-sm text-foreground tracking-wide">Wander AI</span>
            <span className="ml-2 text-[10px] text-muted-foreground/50 font-mono">IDE Agent Config</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/docs"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            aria-label="Documentation"
          >
            <BookOpen size={18} />
          </Link>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            aria-label="Open agent menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Body: sidebar + chat */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <ChatSidebar
          agents={agents || []}
          isLoading={isLoading}
          activeAgentId={activeAgentId}
          onSelectAgent={handleSelectAgent}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Chat window */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          <ChatWindow
            agent={activeAgent}
            messages={activeMessages}
            onUpdateMessages={(messages) => activeAgentId && updateMessages(activeAgentId, messages)}
          />
        </main>
      </div>
    </div>
  );
}
