import { useState } from "react";
import { useListAgents } from "@workspace/api-client-react";
import type { Agent, ChatMessage } from "@workspace/api-client-react/src/generated/api.schemas";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";

export function MainChat() {
  const { data: agents, isLoading } = useListAgents();
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Record<string, ChatMessage[]>>({});

  const activeAgent = agents?.find((a: Agent) => a.id === activeAgentId) || null;

  const handleSelectAgent = (agentId: string) => {
    setActiveAgentId(agentId);
  };

  const activeMessages = activeAgentId ? (conversations[activeAgentId] || []) : [];

  const updateMessages = (agentId: string, messages: ChatMessage[]) => {
    setConversations(prev => ({
      ...prev,
      [agentId]: messages
    }));
  };

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      <ChatSidebar 
        agents={agents || []} 
        isLoading={isLoading}
        activeAgentId={activeAgentId}
        onSelectAgent={handleSelectAgent}
      />
      <main className="flex-1 flex flex-col min-w-0 relative">
        <ChatWindow 
          agent={activeAgent}
          messages={activeMessages}
          onUpdateMessages={(messages) => activeAgentId && updateMessages(activeAgentId, messages)}
        />
      </main>
    </div>
  );
}
