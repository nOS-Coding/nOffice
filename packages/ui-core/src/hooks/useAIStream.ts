import { type AIContextMode, type AIStreamChunk, AI_CONTEXT_MODES } from "@noffice/shared";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseAIStreamOptions {
  onChunk?: (chunk: AIStreamChunk) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
}

interface UseAIStreamReturn {
  isStreaming: boolean;
  content: string;
  mode: AIContextMode;
  error: string | null;
  startStream: (prompt: string, modeId: AIContextMode["id"]) => Promise<void>;
  cancelStream: () => void;
  setMode: (modeId: AIContextMode["id"]) => void;
}

export function useAIStream(options: UseAIStreamOptions = {}): UseAIStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [content, setContent] = useState("");
  const [mode, setModeState] = useState<AIContextMode>(AI_CONTEXT_MODES[0]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      eventSourceRef.current?.close();
    };
  }, []);

  const startStream = useCallback(
    async (prompt: string, modeId: AIContextMode["id"]) => {
      abortRef.current?.abort();
      setError(null);
      setContent("");
      setIsStreaming(true);

      const m = AI_CONTEXT_MODES.find((m) => m.id === modeId) ?? AI_CONTEXT_MODES[0];
      setModeState(m);

      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const unlisten = await import("@tauri-apps/api/event");

        const streamId = crypto.randomUUID();
        await invoke("ai_start_stream", { prompt, modeId: m.id, streamId });

        const cleanup = await unlisten.listen<AIStreamChunk>(`ai:stream:${streamId}`, (event) => {
          const chunk = event.payload;
          if (chunk.error) {
            setError(chunk.error);
            options.onError?.(chunk.error);
            setIsStreaming(false);
            return;
          }
          setContent((prev) => prev + chunk.content);
          options.onChunk?.(chunk);
          if (chunk.done) {
            setIsStreaming(false);
            options.onDone?.();
          }
        });

        abortRef.current = new AbortController();
        abortRef.current.signal.addEventListener("abort", () => {
          cleanup();
          invoke("ai_cancel_stream", { streamId });
          setIsStreaming(false);
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "AI stream failed";
        setError(message);
        setIsStreaming(false);
        options.onError?.(message);
      }
    },
    [options],
  );

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    eventSourceRef.current?.close();
    setIsStreaming(false);
  }, []);

  const setMode = useCallback((modeId: AIContextMode["id"]) => {
    const m = AI_CONTEXT_MODES.find((mode) => mode.id === modeId);
    if (m) setModeState(m);
  }, []);

  return { isStreaming, content, mode, error, startStream, cancelStream, setMode };
}
