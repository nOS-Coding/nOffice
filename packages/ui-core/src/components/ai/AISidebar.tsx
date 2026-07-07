import { type AIContextMode, AI_CONTEXT_MODES } from "@noffice/shared";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Globe,
  HelpCircle,
  Loader2,
  MessageCircle,
  Pencil,
  Search,
  Send,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAIStream } from "../../hooks/useAIStream";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

const MODE_ICONS: Record<AIContextMode["id"], typeof MessageCircle> = {
  free_chat: MessageCircle,
  edit_selection: Pencil,
  explain: HelpCircle,
  generate: Sparkles,
  summarize: FileText,
  translate: Globe,
};

type AIStatus = "idle" | "installing" | "thinking" | "searching" | "generating" | "error";

type ModelStatus = "checking" | "prompt" | "downloading" | "ready" | "error";

const COWORK_TOOLS = [
  { id: "fix_grammar", label: "Fix Grammar", icon: Pencil, prompt: "Fix grammar and spelling in the text below. Return only the corrected text:" },
  { id: "summarize", label: "Summarize", icon: FileText, prompt: "Summarize the following content concisely:" },
  { id: "generate_code", label: "Generate Code", icon: Sparkles, prompt: "Generate code for the following request:" },
  { id: "explain", label: "Explain", icon: HelpCircle, prompt: "Explain the following in simple terms:" },
  { id: "translate_en", label: "Translate to EN", icon: Globe, prompt: "Translate the following to English:" },
  { id: "web_search", label: "Search Web", icon: Search, prompt: "Search the web for information about:" },
];

interface AISidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  appContext?: string;
  selectedText?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

export function AISidebar({ isOpen, onToggle, appContext, selectedText }: AISidebarProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [aiStatus, setAiStatus] = useState<AIStatus>("idle");
  const [modelStatus, setModelStatus] = useState<ModelStatus>("checking");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const { isStreaming, content, mode, startStream, cancelStream, setMode, error } = useAIStream();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, content]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (isStreaming) {
      setAiStatus("generating");
    } else if (aiStatus === "generating") {
      setAiStatus("idle");
    }
  }, [isStreaming]);

  useEffect(() => {
    let cancelled = false;

    async function checkModel() {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const { listen } = await import("@tauri-apps/api/event");

        const unlistenProgress = await listen<{
          type: string;
          bytesDownloaded: number;
          totalBytes: number;
          speed: number;
          progress: number;
        }>("ai:download:progress", (event) => {
          if (cancelled) return;
          setModelStatus("downloading");
          setDownloadProgress(event.payload.progress);
          setDownloadSpeed(event.payload.speed);
          setDownloadedBytes(event.payload.bytesDownloaded);
          setTotalBytes(event.payload.totalBytes);
        });

        const unlistenComplete = await listen("ai:download:complete", () => {
          if (cancelled) return;
          setModelStatus("ready");
          setDownloadProgress(100);
        });

        const status = await invoke<{ modelDownloaded: boolean; modelReady: boolean }>("ai_check_model_status");
        if (!cancelled) {
          if (status.modelReady || status.modelDownloaded) {
            setModelStatus("ready");
          } else {
            setModelStatus("prompt");
          }
        }

        return () => {
          unlistenProgress();
          unlistenComplete();
        };
      } catch {
        if (!cancelled) setModelStatus("error");
      }
    }

    const cleanup = checkModel();
    return () => { cancelled = true; cleanup.then((f) => f?.()); };
  }, []);

  function handleSend() {
    if (!input.trim() || isStreaming) return;
    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    setAiStatus("thinking");
    startStream(userMsg, mode.id);
  }

  function useCoworkTool(tool: (typeof COWORK_TOOLS)[number]) {
    const context = selectedText || input || appContext || "";
    if (!context.trim()) return;
    const fullPrompt = `${tool.prompt}\n\n${context}`;
    setMessages((prev) => [...prev, { role: "user", content: `${tool.label}: ${context.slice(0, 200)}` }]);
    setInput("");
    setAiStatus("thinking");
    startStream(fullPrompt, mode.id);
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

  async function handleDownloadModel() {
    setModelStatus("downloading");
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("ai_start_download", { modelName: "qwen3-8b-q4_k_m" });
    } catch {
      setModelStatus("error");
    }
  }

  const statusConfig: Record<AIStatus, { icon: typeof Loader2; text: string; color: string }> = {
    idle: { icon: MessageCircle, text: "", color: "" },
    installing: { icon: Download, text: "Installing AI model... (~4.5 GB)", color: "text-yellow-500" },
    thinking: { icon: Loader2, text: "AI is thinking...", color: "text-brand-500" },
    searching: { icon: Search, text: "Searching the web...", color: "text-blue-500" },
    generating: { icon: Loader2, text: "Generating response...", color: "text-brand-500" },
    error: { icon: X, text: "An error occurred", color: "text-red-500" },
  };

  function renderMarkdown(text: string): string {
    return text
      .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs my-1 overflow-x-auto"><code>$1</code></pre>')
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\n\n/g, "<br><br>");
  }

  const hasContext = !!(selectedText || input || appContext);

  if (modelStatus === "checking") {
    return (
      <div className={cn(
        "relative flex h-full flex-col border-l border-border bg-surface transition-all duration-300 dark:border-border-dark dark:bg-surface-dark",
        isOpen ? "w-80 max-w-full" : "w-0 overflow-hidden",
      )}>
        <div className="flex h-full min-w-80 flex-col items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <p className="mt-3 text-sm text-gray-400">Checking model status...</p>
        </div>
      </div>
    );
  }

  if (modelStatus === "prompt") {
    return (
      <div className={cn(
        "relative flex h-full flex-col border-l border-border bg-surface transition-all duration-300 dark:border-border-dark dark:bg-surface-dark",
        isOpen ? "w-80 max-w-full" : "w-0 overflow-hidden",
      )}>
        <div className="flex h-full min-w-80 flex-col items-center justify-center p-6 text-center">
          <Download className="mb-4 h-10 w-10 text-brand-500" />
          <h3 className="mb-2 text-base font-semibold">Download AI Model</h3>
          <p className="mb-4 text-xs text-gray-400">
            nOffice needs the Qwen3 8B AI model (~4.5 GB) to enable AI features.
          </p>
          <button
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm text-white hover:bg-brand-700 transition-colors"
            onClick={handleDownloadModel}
          >
            Start Download
          </button>
        </div>
      </div>
    );
  }

  if (modelStatus === "downloading") {
    return (
      <div className={cn(
        "relative flex h-full flex-col border-l border-border bg-surface transition-all duration-300 dark:border-border-dark dark:bg-surface-dark",
        isOpen ? "w-80 max-w-full" : "w-0 overflow-hidden",
      )}>
        <div className="flex h-full min-w-80 flex-col items-center justify-center p-6 text-center">
          <Download className="mb-4 h-10 w-10 text-brand-500 animate-pulse" />
          <h3 className="mb-2 text-base font-semibold">Downloading AI Model</h3>
          <div className="mb-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-surface-tertiary dark:bg-surface-dark-tertiary">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-300"
              style={{ width: `${Math.max(downloadProgress, 2)}%` }}
            />
          </div>
          <p className="mb-1 text-sm font-medium">{downloadProgress}%</p>
          {totalBytes > 0 && (
            <div className="flex gap-3 text-[10px] text-gray-400">
              <span>{formatBytes(downloadedBytes)} / {formatBytes(totalBytes)}</span>
              <span>{formatSpeed(downloadSpeed)}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (modelStatus === "error") {
    return (
      <div className={cn(
        "relative flex h-full flex-col border-l border-border bg-surface transition-all duration-300 dark:border-border-dark dark:bg-surface-dark",
        isOpen ? "w-80 max-w-full" : "w-0 overflow-hidden",
      )}>
        <div className="flex h-full min-w-80 flex-col items-center justify-center p-6 text-center">
          <X className="mb-4 h-10 w-10 text-red-500" />
          <h3 className="mb-2 text-base font-semibold">Download Failed</h3>
          <p className="mb-4 text-xs text-gray-400">
            Failed to download the AI model. Check your internet connection and try again.
          </p>
          <button
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm text-white hover:bg-brand-700 transition-colors"
            onClick={handleDownloadModel}
          >
            Retry Download
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-full flex-col border-l border-border bg-surface transition-all duration-300 dark:border-border-dark dark:bg-surface-dark",
        isOpen ? "w-80 max-w-full" : "w-0 overflow-hidden",
      )}
    >
      <div className="flex h-full min-w-80 flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
          <span className="text-sm font-semibold">AI Assistant</span>
          <Button variant="ghost" size="icon" onClick={onToggle}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-1 border-b border-border px-3 py-2 dark:border-border-dark">
          {AI_CONTEXT_MODES.map((m) => {
            const Icon = MODE_ICONS[m.id];
            return (
              <button
                type="button"
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

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            {messages.length === 0 && (
              <div className="mt-8 text-center text-sm text-gray-400">
                Ask me anything about your document
                {appContext && <p className="mt-2 text-xs">Context: {appContext}</p>}
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={`${msg.role}-${i}`}
                className={cn("mb-4", msg.role === "user" ? "text-right" : "text-left")}
              >
                <div
                  className={cn(
                    "inline-block rounded-lg px-3 py-2 text-sm",
                    msg.role === "user"
                      ? "bg-brand-600 text-white"
                      : "bg-surface-secondary dark:bg-surface-dark-secondary",
                  )}
                >
                  {msg.role === "assistant" ? (
                    <span dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-border px-3 py-2 dark:border-border-dark">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-400">
              Cowork Tools
            </p>
            <div className="flex flex-wrap gap-1">
              {COWORK_TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    onClick={() => useCoworkTool(tool)}
                    disabled={!hasContext || isStreaming}
                    title={tool.prompt}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                      "hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary",
                      hasContext ? "text-gray-600 dark:text-gray-400" : "text-gray-300 dark:text-gray-600 cursor-not-allowed",
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {tool.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-3 mb-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="border-t border-border p-4 dark:border-border-dark">
          {selectedText && (
            <div className="mb-2 rounded-md bg-surface-secondary p-2 text-xs dark:bg-surface-dark-secondary">
              <span className="font-medium">Selected: </span>
              {selectedText.slice(0, 100)}
              {selectedText.length > 100 ? "..." : ""}
            </div>
          )}
          {aiStatus !== "idle" && (
            <div className="mb-2 flex items-center gap-2 rounded-md bg-surface-secondary px-3 py-2 text-xs dark:bg-surface-dark-secondary">
              <Loader2 className={cn("h-3 w-3 animate-spin", statusConfig[aiStatus].color)} />
              <span className={statusConfig[aiStatus].color}>{statusConfig[aiStatus].text}</span>
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
