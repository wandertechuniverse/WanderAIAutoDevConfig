import { useState, useRef, useEffect } from "react";
import { Agent, ChatMessage } from "@workspace/api-client-react/src/generated/api.schemas";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Send, TerminalSquare, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";

interface ChatWindowProps {
  agent: Agent | null;
  messages: ChatMessage[];
  onUpdateMessages: (messages: ChatMessage[]) => void;
}

export function ChatWindow({ agent, messages, onUpdateMessages }: ChatWindowProps) {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  if (!agent) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[url('https://transparenttextures.com/patterns/cubes.png')] bg-repeat">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 border border-border flex items-center justify-center mb-6 shadow-xl">
          <TerminalSquare size={24} className="text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2 tracking-tight">Wander AI Command Center</h2>
        <p className="text-muted-foreground max-w-md">
          Select an specialized AI agent from the sidebar to begin your session. Leaders manage strategy, while workers execute tasks.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    
    onUpdateMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id, messages: newMessages }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      
      // Initialize assistant message
      onUpdateMessages([...newMessages, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                assistantContent += data.content;
                onUpdateMessages([...newMessages, { role: "assistant", content: assistantContent }]);
              }
            } catch (e) {
              console.error("Failed to parse SSE chunk", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to send message", error);
      onUpdateMessages([
        ...newMessages, 
        { role: "assistant", content: "> _Error communicating with the agent. Please try again._" }
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background relative z-0">
      {/* Header */}
      <div className="h-14 border-b border-border flex items-center px-6 justify-between bg-card/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h2 className="text-sm font-semibold text-foreground">{agent.name}</h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-wider text-muted-foreground uppercase">
                {agent.role}
              </span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                agent.agent_type === 'leader' 
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                  : 'bg-primary/10 text-primary border border-primary/20'
              }`}>
                {agent.agent_type}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-6" ref={scrollRef}>
        <div className="max-w-3xl mx-auto space-y-8 pb-4">
          {messages.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <TerminalSquare className="mx-auto h-12 w-12 mb-4 opacity-20" />
              <p>Session started with {agent.name}.</p>
              <p className="text-sm opacity-50 mt-1">Type a command below to begin.</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`max-w-[85%] rounded-lg p-4 ${
                  msg.role === "user" 
                    ? "bg-primary/10 border border-primary/20 text-foreground" 
                    : "bg-card border border-border text-card-foreground shadow-sm"
                }`}>
                  <div className="flex items-center gap-2 mb-2 opacity-50 text-xs font-mono uppercase tracking-wider">
                    {msg.role === "user" ? "You" : agent.name}
                  </div>
                  <div className={`prose prose-invert prose-sm max-w-none ${msg.role === 'user' ? 'prose-p:text-foreground' : ''}`}>
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap m-0 leading-relaxed">{msg.content}</p>
                    ) : (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({node, inline, className, children, ...props}: any) {
                            const match = /language-(\w+)/.exec(className || '')
                            return !inline && match ? (
                              <SyntaxHighlighter
                                {...props}
                                children={String(children).replace(/\n$/, '')}
                                style={vscDarkPlus}
                                language={match[1]}
                                PreTag="div"
                                className="rounded-md border border-white/10 !my-4 !bg-[#0d1117]"
                              />
                            ) : (
                              <code {...props} className="bg-white/10 text-primary-foreground px-1.5 py-0.5 rounded text-[13px] font-mono">
                                {children}
                              </code>
                            )
                          }
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          {isStreaming && messages.length > 0 && messages[messages.length-1].role === 'user' && (
            <div className="flex flex-col items-start">
               <div className="bg-card border border-border rounded-lg p-4 shadow-sm min-w-[100px] flex items-center h-[72px]">
                  <div className="flex gap-1.5 items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"></div>
                  </div>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-1" />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 bg-background border-t border-border mt-auto">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-card border border-border rounded-xl shadow-sm focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/50 transition-all p-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Send a command to ${agent.name}... (Enter to send)`}
              className="flex-1 max-h-48 min-h-[44px] bg-transparent resize-none border-0 focus:ring-0 text-sm p-3 outline-none scrollbar-thin scrollbar-thumb-white/10 leading-relaxed"
              rows={1}
              disabled={isStreaming}
            />
            <div className="p-2 shrink-0">
              <Button 
                type="submit" 
                size="icon" 
                disabled={!input.trim() || isStreaming}
                className="h-8 w-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all"
              >
                <Send size={14} className={input.trim() && !isStreaming ? "opacity-100" : "opacity-50"} />
              </Button>
            </div>
          </form>
          <div className="text-center mt-2">
            <span className="text-[10px] text-muted-foreground/50 font-mono">
              Wander AI // COMMAND LINE INTERFACE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
