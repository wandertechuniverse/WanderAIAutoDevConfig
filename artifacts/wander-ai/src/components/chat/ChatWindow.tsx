import { useState, useRef, useEffect } from "react";
import { Agent, ChatMessage } from "@workspace/api-client-react/src/generated/api.schemas";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Send, Code2, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";

interface ChatWindowProps {
  agent: Agent | null;
  messages: ChatMessage[];
  onUpdateMessages: (messages: ChatMessage[]) => void;
}

const IDE_PLACEHOLDERS: Record<string, string> = {
  leader: "Describe a feature, architecture decision, or sprint goal...",
  worker: "Paste code, ask for a review, or request an implementation...",
};

export function ChatWindow({ agent, messages, onUpdateMessages }: ChatWindowProps) {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
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
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-background">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 border border-border flex items-center justify-center mb-6 shadow-xl">
          <Code2 size={26} className="text-primary/60" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2 tracking-tight">Select an IDE Agent</h2>
        <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
          Each agent is a specialized AI persona for your IDE workflow. Leaders plan and coordinate. Workers implement, review, and ship.
        </p>
        <div className="mt-8 grid grid-cols-3 gap-3 text-left max-w-sm w-full">
          {["VSCode", "Cursor", "Windsurf"].map(ide => (
            <div key={ide} className="bg-card border border-border rounded-lg px-3 py-2 text-center">
              <span className="text-xs text-muted-foreground/70 font-mono">{ide}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-muted-foreground/40 font-mono">
          Compatible with any IDE that supports AI agents
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
            } catch (_) {
              // ignore malformed SSE chunks
            }
          }
        }
      }
    } catch (error) {
      onUpdateMessages([
        ...newMessages,
        { role: "assistant", content: "> _Connection error. Check that the agent server is reachable._" }
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
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/40 font-mono hidden sm:block">
            system prompt: {agent.id}.agent.md
          </span>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-6">
        <div className="max-w-3xl mx-auto space-y-6 pb-4">
          {messages.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Code2 className="mx-auto h-10 w-10 mb-4 opacity-20" />
              <p className="font-medium text-foreground/60">{agent.name} is ready</p>
              <p className="text-sm opacity-50 mt-1">
                {IDE_PLACEHOLDERS[agent.agent_type] ?? "Type your message below to begin."}
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`max-w-[85%] rounded-lg p-4 ${
                  msg.role === "user"
                    ? "bg-primary/10 border border-primary/20 text-foreground"
                    : "bg-card border border-border text-card-foreground shadow-sm"
                }`}>
                  <div className="flex items-center gap-2 mb-2 opacity-50 text-[10px] font-mono uppercase tracking-wider">
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
          {isStreaming && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
            <div className="flex flex-col items-start">
              <div className="bg-card border border-border rounded-lg p-4 shadow-sm min-w-[80px] flex items-center h-[64px]">
                <div className="flex gap-1.5 items-center">
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
      <div className="p-4 bg-background border-t border-border">
        <div className="max-w-3xl mx-auto">
          <form
            onSubmit={handleSubmit}
            className="relative flex items-end gap-2 bg-card border border-border rounded-xl shadow-sm focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/50 transition-all p-1"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${agent.name}… (Enter to send, Shift+Enter for new line)`}
              className="flex-1 max-h-48 min-h-[44px] bg-transparent resize-none border-0 focus:ring-0 text-sm p-3 outline-none leading-relaxed placeholder:text-muted-foreground/40"
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
                <Send size={14} />
              </Button>
            </div>
          </form>
          <p className="text-center mt-2 text-[10px] text-muted-foreground/40 font-mono">
            persona loaded from <span className="text-primary/50">{agent.id}.agent.md</span>
          </p>
        </div>
      </div>
    </div>
  );
}
