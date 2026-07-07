import { AISidebar, useTheme } from "@noffice/ui-core";
import {
  Brush, Circle, Eraser, Maximize2, Minus, Redo2, Square, Type, Undo2, ZoomIn, ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const TOOLS = [
  { id: "brush", icon: Brush, label: "Brush" },
  { id: "eraser", icon: Eraser, label: "Eraser" },
  { id: "rect", icon: Square, label: "Rectangle" },
  { id: "circle", icon: Circle, label: "Circle" },
  { id: "line", icon: Minus, label: "Line" },
  { id: "text", icon: Type, label: "Text" },
];

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTool, setActiveTool] = useState("brush");
  const [color, setColor] = useState("#1a1b1e");
  const [fillColor, setFillColor] = useState("#ffffff");
  const [brushSize, setBrushSize] = useState(4);
  const [fillMode, setFillMode] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [canvasSize] = useState({ width: 800, height: 600 });
  const [zoom, setZoom] = useState(1);
  const textInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useTheme();
  const historyIndexRef = useRef(historyIndex);
  historyIndexRef.current = historyIndex;

  const saveState = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const state = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => {
      const next = prev.slice(0, historyIndexRef.current + 1);
      next.push(state);
      if (next.length > 50) next.shift();
      return next;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
  }, []);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const newIndex = historyIndex - 1;
    const imgData = history[newIndex];
    if (!imgData) return;
    ctx.putImageData(imgData, 0, 0);
    setHistoryIndex(newIndex);
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const newIndex = historyIndex + 1;
    const imgData = history[newIndex];
    if (!imgData) return;
    ctx.putImageData(imgData, 0, 0);
    setHistoryIndex(newIndex);
  }, [historyIndex, history]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;
    saveState();
  }, [canvasSize]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        exportPNG();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (document.activeElement?.tagName === "INPUT") return;
        if (window.confirm("Clear the canvas?")) {
          clearCanvas();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  function getPos(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  }

  function startDraw(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = getPos(e);
    setStartPos(pos);
    setLastPos(pos);
    setIsDrawing(true);
    if (activeTool === "text") {
      setTextInput(pos);
      return;
    }
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.strokeStyle = color;
    if (activeTool === "eraser") ctx.globalCompositeOperation = "destination-out";
    else ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = activeTool === "eraser" ? brushSize * 2 : brushSize;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing || !lastPos) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    const pos = getPos(e);
    const imgData = history[historyIndex];
    if (!imgData) return;
    ctx.strokeStyle = color;
    if (activeTool === "eraser") ctx.globalCompositeOperation = "destination-out";
    else ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = activeTool === "eraser" ? brushSize * 2 : brushSize;
    if (activeTool === "brush" || activeTool === "eraser") {
      ctx.beginPath();
      ctx.moveTo(lastPos.x, lastPos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (activeTool === "line") {
      ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
      ctx.putImageData(imgData, 0, 0);
      ctx.beginPath();
      ctx.moveTo(startPos!.x, startPos!.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (activeTool === "rect") {
      ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
      ctx.putImageData(imgData, 0, 0);
      const w = pos.x - startPos!.x;
      const h = pos.y - startPos!.y;
      if (fillMode) {
        ctx.fillStyle = fillColor;
        ctx.fillRect(startPos!.x, startPos!.y, w, h);
      }
      ctx.strokeRect(startPos!.x, startPos!.y, w, h);
    } else if (activeTool === "circle") {
      ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
      ctx.putImageData(imgData, 0, 0);
      const cx = (startPos!.x + pos.x) / 2;
      const cy = (startPos!.y + pos.y) / 2;
      const rx = Math.abs(pos.x - startPos!.x) / 2;
      const ry = Math.abs(pos.y - startPos!.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      if (fillMode) {
        ctx.fillStyle = fillColor;
        ctx.fill();
      }
      ctx.stroke();
    }
    setLastPos(pos);
  }

  function endDraw() {
    if (!isDrawing) return;
    setIsDrawing(false);
    saveState();
  }

  function addText(text: string) {
    if (!textInput || !text) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.font = `${brushSize * 5}px Inter, sans-serif`;
    ctx.fillStyle = color;
    ctx.fillText(text, textInput.x, textInput.y);
    setTextInput(null);
    saveState();
  }

  function clearCanvas() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
    saveState();
  }

  function exportPNG() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "drawing.png";
    a.click();
  }

  function importImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpg,image/jpeg,image/gif,image/webp";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          const ctx = ctxRef.current;
          if (!canvas || !ctx) return;
          const x = (canvas.width - img.width) / 2;
          const y = (canvas.height - img.height) / 2;
          ctx.drawImage(img, x, y);
          saveState();
        };
        if (typeof reader.result === "string") {
          img.src = reader.result;
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  return (
    <div className="flex h-screen">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2 dark:border-border-dark">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <label className="text-xs text-gray-500">Color</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-6 w-8 cursor-pointer rounded border-0 p-0"
              />
            </div>
            {fillMode && (
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-500">Fill</label>
                <input
                  type="color"
                  value={fillColor}
                  onChange={(e) => setFillColor(e.target.value)}
                  className="h-6 w-8 cursor-pointer rounded border-0 p-0"
                />
              </div>
            )}
            <div className="flex items-center gap-1">
              <label className="text-xs text-gray-500">
                {activeTool === "text" ? "Size" : "Brush"}
              </label>
              <input
                type="range"
                min={1}
                max={activeTool === "text" ? 8 : 50}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-16"
              />
              <span className="w-4 text-xs text-gray-400">{brushSize}</span>
            </div>
            <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={fillMode}
                onChange={(e) => setFillMode(e.target.checked)}
                className="rounded"
              />
              Fill
            </label>
            <button
              className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              onClick={clearCanvas}
            >
              Clear
            </button>
            <button
              className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              onClick={exportPNG}
            >
              Export PNG
            </button>
            <button
              className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              onClick={importImage}
            >
              Open Image
            </button>
            <div className="mx-1 h-4 w-px bg-border dark:bg-border-dark" />
            <button
              className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
              disabled={zoom >= 4}
            >
              <ZoomIn className="inline h-3 w-3" />
            </button>
            <button
              className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
              disabled={zoom <= 0.25}
            >
              <ZoomOut className="inline h-3 w-3" />
            </button>
            <button
              className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              onClick={() => setZoom(1)}
            >
              <Maximize2 className="inline h-3 w-3" /> {Math.round(zoom * 100)}%
            </button>
            <div className="mx-1 h-4 w-px bg-border dark:bg-border-dark" />
            <button
              className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              onClick={undo}
              disabled={historyIndex <= 0}
            >
              <Undo2 className="inline h-3 w-3" /> Undo
            </button>
            <button
              className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
            >
              <Redo2 className="inline h-3 w-3" /> Redo
            </button>
          </div>
          <button
            className="rounded-lg p-1.5 text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
            onClick={() => setSidebarOpen(true)}
          >
            AI
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex w-14 flex-col items-center gap-1 border-r border-border py-2 dark:border-border-dark">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  type="button"
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  title={tool.label}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                    activeTool === tool.id
                      ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                      : "text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
          <div
            ref={containerRef}
            className="relative flex-1 overflow-hidden bg-surface-secondary dark:bg-surface-dark-secondary"
          >
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ transform: `translate(-50%, -50%) scale(${zoom})` }}
            >
              <canvas
                ref={canvasRef}
                className="cursor-crosshair rounded-lg shadow-lg"
                style={{ background: "#ffffff" }}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
              />
              {textInput && (
                <div
                  className="absolute z-10"
                  style={{ left: textInput.x + 8, top: textInput.y - 8 }}
                >
                  <input
                    ref={textInputRef}
                    className="rounded border border-brand-500 bg-white px-2 py-1 text-sm outline-none shadow-lg"
                    placeholder="Type text..."
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        addText(e.currentTarget.value);
                      } else if (e.key === "Escape") {
                        setTextInput(null);
                      }
                    }}
                    onBlur={(e) => {
                      if (e.currentTarget.value) addText(e.currentTarget.value);
                      else setTextInput(null);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <AISidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(false)}
        appContext="nImg Image Editor"
      />
    </div>
  );
}
