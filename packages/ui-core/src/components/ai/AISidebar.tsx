import { useState, useRef, useEffect } from "react";
import {
  MessageCircle,
  Pencil,
  HelpCircle,
  Sparkles,
  FileText,
  Globe,
  Send,
  X,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Square,
} from "lucide-react";
import { AI_CONTEXT_MODES } from "@noffice/shared";
import { useAIStream } from "../../hooks/useAIStream";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

const MODE_ICONS: Record<string, typeof MessageCircle> = {
  free_chat: MessageCircle,
  edit_selection: Pencil,
  explain: HelpCircle,
  generate: Sparkles,
  summarize: FileText,
  translate: Globe,
};

interface AISidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  appContext?: string;
  selectedText?: string;
}

export function AISidebar({ isOpen, onToggle, appContext, selectedText }: AISidebarProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const { isStreaming, content, mode, startStream, cancelStream, setMode } = useAIStream();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, content]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  function handleSend() {
    if (!input.trim() || isStreaming) return;
    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    startStream(userMsg, mode.id);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  useEffect(() => {
    if (content && isStreaming) {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return [...prev.slice(0, -1), { role: "assistant", content }];
        }
        return [...prev, { role: "assistant", content }];
      });
    }
  }, [content, isStreaming]);

  return (
    <div
      className={cn(
        "relative flex h-full flex-col border-l border-border bg-surface transition-all duration-300 dark:border-border-dark dark:bg-surface-dark",
        isOpen ? "w-[var(--sidebar-width)]" : "w-0 overflow-hidden",
      )}
    >
      <div className="flex h-full min-w-[var(--sidebar-width)] flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
          <span className="text-sm font-semibold">AI Assistant</span>
          <Button variant="ghost" size="icon" onClick={onToggle}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-1 border-b border-border px-3 py-2 dark:border-border-dark">
          {AI_CONTEXT_MODES.map((m) => {
            const Icon = MODE_ICONS[m.id]!;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                  mode.id === m.id
                    ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                    : "text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary",
                )}
                title={m.label}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{m.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          {messages.length === 0 && (
            <div className="mt-8 text-center text-sm text-gray-400">
              Ask me anything about your document
              {appContext && <p className="mt-2 text-xs">Context: {appContext}</p>}
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={cn("mb-4", msg.role === "user" ? "text-right" : "text-left")}>
              <div
                className={cn(
                  "inline-block rounded-lg px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "bg-brand-600 text-white"
                    : "bg-surface-secondary dark:bg-surface-dark-secondary",
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isStreaming && (
            <div className="text-left">
              <div className="inline-block rounded-lg bg-surface-secondary px-3 py-2 text-sm dark:bg-surface-dark-secondary">
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Generating...
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-border p-4 dark:border-border-dark">
          {selectedText && (
            <div className="mb-2 rounded-md bg-surface-secondary p-2 text-xs dark:bg-surface-dark-secondary">
              <span className="font-medium">Selected: </span>
              {selectedText.slice(0, 100)}{selectedText.length > 100 ? "..." : ""}
            </div>
          )}
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask AI..."
              rows={1}
              className="flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 dark:border-border-dark dark:bg-surface-dark"
            />
            {isStreaming ? (
              <Button variant="ghost" size="icon" onClick={cancelStream}>
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="default" size="icon" onClick={handleSend} disabled={!input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AISidebarToggle({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggle}
      className="fixed right-4 top-4 z-40"
      title="Toggle AI sidebar"
    >
      {isOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
    </Button>
  );
}
