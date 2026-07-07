import { AISidebar, useTheme } from "@noffice/ui-core";
import {
  ArrowDown,
  ArrowUp,
  Bold,
  Brush,
  Check,
  Circle,
  Copy,
  Crop,
  Download,
  Eraser,
  Eye,
  EyeOff,
  Grid3x3,
  Italic,
  Layers,
  Maximize2,
  Minus,
  MousePointer2,
  PaintBucket,
  Pipette,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Square,
  Trash2,
  Type,
  Underline,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  imageData: ImageData | null;
}

const TOOLS = [
  { id: "brush", icon: Brush, label: "Brush" },
  { id: "eraser", icon: Eraser, label: "Eraser" },
  { id: "rect", icon: Square, label: "Rectangle" },
  { id: "circle", icon: Circle, label: "Circle" },
  { id: "line", icon: Minus, label: "Line" },
  { id: "text", icon: Type, label: "Text" },
  { id: "crop", icon: Crop, label: "Crop" },
  { id: "fill", icon: PaintBucket, label: "Fill" },
  { id: "eyedropper", icon: Pipette, label: "Eyedropper" },
  { id: "select", icon: MousePointer2, label: "Selection" },
];

function applyBlur(d: Uint8ClampedArray, w: number, h: number) {
  const src = new Uint8ClampedArray(d);
  const kernel = [1, 1, 1, 1, 1, 1, 1, 1, 1];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pi = ((y + ky) * w + (x + kx)) * 4;
          const kv = kernel[(ky + 1) * 3 + (kx + 1)] ?? 0;
          r += (src[pi] ?? 0) * kv;
          g += (src[pi + 1] ?? 0) * kv;
          b += (src[pi + 2] ?? 0) * kv;
        }
      }
      d[i] = r / 9;
      d[i + 1] = g / 9;
      d[i + 2] = b / 9;
    }
  }
}

const FILTERS: Record<string, (data: Uint8ClampedArray, w: number, h: number) => void> = {
  blur: (data, w, h) => applyBlur(data, w, h),
  sharpen: (data, w, h) => {
    const src = new Uint8ClampedArray(data);
    const k = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        let r = 0;
        let g = 0;
        let b = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pi = ((y + ky) * w + (x + kx)) * 4;
            const kv = k[(ky + 1) * 3 + (kx + 1)] ?? 0;
            r += (src[pi] ?? 0) * kv;
            g += (src[pi + 1] ?? 0) * kv;
            b += (src[pi + 2] ?? 0) * kv;
          }
        }
        data[i] = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, b));
      }
    }
  },
  emboss: (data, w, h) => {
    const src = new Uint8ClampedArray(data);
    const k = [-2, -1, 0, -1, 1, 1, 0, 1, 2];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        let r = 0;
        let g = 0;
        let b = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pi = ((y + ky) * w + (x + kx)) * 4;
            const kv = k[(ky + 1) * 3 + (kx + 1)] ?? 0;
            r += (src[pi] ?? 0) * kv;
            g += (src[pi + 1] ?? 0) * kv;
            b += (src[pi + 2] ?? 0) * kv;
          }
        }
        data[i] = Math.max(0, Math.min(255, r + 128));
        data[i + 1] = Math.max(0, Math.min(255, g + 128));
        data[i + 2] = Math.max(0, Math.min(255, b + 128));
      }
    }
  },
  invert: (data) => {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - (data[i] ?? 0);
      data[i + 1] = 255 - (data[i + 1] ?? 0);
      data[i + 2] = 255 - (data[i + 2] ?? 0);
    }
  },
  grayscale: (data) => {
    for (let i = 0; i < data.length; i += 4) {
      const v = 0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
  },
  sepia: (data) => {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
      data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
      data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
    }
  },
};

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTool, setActiveTool] = useState("brush");
  const [color, setColor] = useState("#1a1b1e");
  const [fillColor, setFillColor] = useState("#ffffff");
  const [brushSize, setBrushSize] = useState(4);
  const [fillMode, setFillMode] = useState(false);
  const [fillTolerance, setFillTolerance] = useState(30);
  const [canvasWidth, setCanvasWidth] = useState(800);
  const [canvasHeight, setCanvasHeight] = useState(600);
  const [widthInput, setWidthInput] = useState(800);
  const [heightInput, setHeightInput] = useState(600);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [layers, setLayers] = useState<Layer[]>([
    { id: "bg", name: "Background", visible: true, opacity: 1, imageData: null },
  ]);
  const [activeLayerId, setActiveLayerId] = useState("bg");

  const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null);
  const [fontFamily, setFontFamily] = useState("sans-serif");
  const [fontSize, setFontSize] = useState(20);
  const [fontBold, setFontBold] = useState(false);
  const [fontItalic, setFontItalic] = useState(false);
  const [fontUnderline, setFontUnderline] = useState(false);

  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [antsPhase, setAntsPhase] = useState(0);

  const [exportFormat, setExportFormat] = useState("png");
  const [jpegQuality, setJpegQuality] = useState(0.92);
  const [showFilterDialog, setShowFilterDialog] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const overlayCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const historyIndexRef = useRef(historyIndex);
  const layerCanvasesRef = useRef<Record<string, HTMLCanvasElement>>({});
  const layersRef = useRef(layers);
  const activeLayerIdRef = useRef(activeLayerId);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);

  const isCroppingRef = useRef(false);
  const cropStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cropHandleRef = useRef<string | null>(null);
  const isSelectingRef = useRef(false);
  const selectStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const selectHandleRef = useRef<string | null>(null);
  const isMovingRef = useRef(false);
  const moveOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useTheme();
  historyIndexRef.current = historyIndex;
  layersRef.current = layers;
  activeLayerIdRef.current = activeLayerId;

  function getPos(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  }

  function getActiveLayerCtx(): CanvasRenderingContext2D | null {
    const lc = layerCanvasesRef.current[activeLayerIdRef.current];
    if (!lc) return null;
    return lc.getContext("2d");
  }

  function saveLayerToState(id: string) {
    const canvas = layerCanvasesRef.current[id];
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, imageData: imgData } : l)));
  }

  function renderFull() {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    compositeTo(ctx);
    drawOverlays(ctx);
  }

  function compositeTo(ctx: CanvasRenderingContext2D) {
    const w = canvasWidth;
    const h = canvasHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    for (const layer of layersRef.current) {
      if (!layer.visible) continue;
      const lc = layerCanvasesRef.current[layer.id];
      if (!lc) continue;
      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(lc, 0, 0);
      ctx.globalAlpha = 1;
    }
  }

  function drawOverlays(ctx: CanvasRenderingContext2D) {
    if (showGrid) {
      ctx.save();
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 2]);
      for (let x = 0; x <= canvasWidth; x += 10) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, canvasHeight);
        ctx.stroke();
      }
      for (let y = 0; y <= canvasHeight; y += 10) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(canvasWidth, y + 0.5);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (selectionRect) {
      drawMarchingAnts(ctx, selectionRect);
    }
    if (cropRect) {
      drawCropOverlay(ctx, cropRect);
    }

  }

  function drawMarchingAnts(ctx: CanvasRenderingContext2D, rect: { x: number; y: number; w: number; h: number }) {
    const offset = antsPhase;
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -offset;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -offset;
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }

  function drawCropOverlay(ctx: CanvasRenderingContext2D, rect: { x: number; y: number; w: number; h: number }) {
    const { x, y, w, h } = rect;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, canvasWidth, y);
    ctx.fillRect(0, y + h, canvasWidth, canvasHeight - y - h);
    ctx.fillRect(0, y, x, h);
    ctx.fillRect(x + w, y, canvasWidth - x - w, h);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    const hs = 8;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 1;
    const hPositions: Array<[number, number]> = [
      [x, y], [x + w / 2, y], [x + w, y],
      [x, y + h / 2], [x + w, y + h / 2],
      [x, y + h], [x + w / 2, y + h], [x + w, y + h],
    ];
    for (const [hx, hy] of hPositions) {
      ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
      ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
    }
    ctx.restore();
  }

  function initLayerCanvases() {
    const newCanvases: Record<string, HTMLCanvasElement> = {};
    for (const layer of layersRef.current) {
      const oc = document.createElement("canvas");
      oc.width = canvasWidth;
      oc.height = canvasHeight;
      const octx = oc.getContext("2d")!;
      if (layer.id === "bg") {
        octx.fillStyle = "#ffffff";
        octx.fillRect(0, 0, oc.width, oc.height);
      } else if (layer.imageData && layer.imageData.width === canvasWidth && layer.imageData.height === canvasHeight) {
        octx.putImageData(layer.imageData, 0, 0);
      }
      newCanvases[layer.id] = oc;
    }
    layerCanvasesRef.current = newCanvases;
  }

  const saveState = useCallback(() => {
    const canvas = layerCanvasesRef.current[activeLayerIdRef.current];
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const state = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => {
      const next = prev.slice(0, historyIndexRef.current + 1);
      next.push(state);
      if (next.length > 100) next.shift();
      return next;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 99));
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    const newIndex = historyIndexRef.current - 1;
    const imgData = historyRef.current[newIndex];
    if (!imgData) return;
    const lc = layerCanvasesRef.current[activeLayerIdRef.current];
    if (!lc) return;
    const lctx = lc.getContext("2d")!;
    lctx.putImageData(imgData, 0, 0);
    saveLayerToState(activeLayerIdRef.current);
    setHistoryIndex(newIndex);
    renderFull();
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    const newIndex = historyIndexRef.current + 1;
    const imgData = historyRef.current[newIndex];
    if (!imgData) return;
    const lc = layerCanvasesRef.current[activeLayerIdRef.current];
    if (!lc) return;
    const lctx = lc.getContext("2d")!;
    lctx.putImageData(imgData, 0, 0);
    saveLayerToState(activeLayerIdRef.current);
    setHistoryIndex(newIndex);
    renderFull();
  }, []);

  const historyRef = useRef<ImageData[]>(history);
  historyRef.current = history;

  const undoRef = useRef(undo);
  undoRef.current = undo;
  const redoRef = useRef(redo);
  redoRef.current = redo;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;
    const overlay = overlayRef.current;
    if (overlay) {
      overlay.width = canvasWidth;
      overlay.height = canvasHeight;
      overlayCtxRef.current = overlay.getContext("2d");
    }
    initLayerCanvases();
    renderFull();
  }, [canvasWidth, canvasHeight]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (document.activeElement?.tagName === "INPUT") return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undoRef.current();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        redoRef.current();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        redoRef.current();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        exportImage(exportFormatRef.current);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        if (selectionRectRef.current) copySelection();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        if (copiedDataRef.current) pasteSelection();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "x") {
        if (selectionRectRef.current) cutSelection();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectionRectRef.current) {
          deleteSelection();
        } else if (cropRectRef.current) {
          cancelCrop();
        } else {
          clearCanvas();
        }
        return;
      }
      if (e.key === "Enter" && cropRectRef.current) {
        applyCrop();
        return;
      }
      if (e.key === "Escape") {
        if (cropRectRef.current) cancelCrop();
        else if (selectionRectRef.current) setSelectionRect(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const cropRectRef = useRef(cropRect);
  cropRectRef.current = cropRect;
  const selectionRectRef = useRef(selectionRect);
  selectionRectRef.current = selectionRect;
  const exportFormatRef = useRef(exportFormat);
  exportFormatRef.current = exportFormat;
  const copiedDataRef = useRef<ImageData | null>(null);

  useEffect(() => {
    if (!selectionRect) return;
    const id = setInterval(() => {
      setAntsPhase((p) => (p + 1) % 12);
    }, 100);
    return () => clearInterval(id);
  }, [!!selectionRect]);

  useEffect(() => {
    if (!selectionRect) return;
    renderFull();
  }, [antsPhase]);

  useEffect(() => {
    renderFull();
  }, [layers, activeLayerId, showGrid, cropRect, selectionRect]);

  function newCanvas(w: number, h: number) {
    if (w < 1 || h < 1 || w > 10000 || h > 10000) return;
    saveState();
    setCanvasWidth(w);
    setCanvasHeight(h);
  }

  function clearCanvas() {
    const lc = layerCanvasesRef.current[activeLayerIdRef.current];
    if (!lc) return;
    const lctx = lc.getContext("2d")!;
    if (activeLayerIdRef.current === "bg") {
      lctx.fillStyle = "#ffffff";
      lctx.fillRect(0, 0, lc.width, lc.height);
    } else {
      lctx.clearRect(0, 0, lc.width, lc.height);
    }
    saveLayerToState(activeLayerIdRef.current);
    saveState();
    renderFull();
  }

  function exportImage(format: string) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mimeTypes: Record<string, string> = {
      png: "image/png",
      jpeg: "image/jpeg",
      webp: "image/webp",
      bmp: "image/bmp",
    };
    const mime = mimeTypes[format] || "image/png";
    const ext = format === "jpeg" ? "jpg" : format;
    const quality = format === "png" || format === "bmp" ? undefined : jpegQuality;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `drawing.${ext}`;
        a.click();
        URL.revokeObjectURL(a.href);
      },
      mime,
      quality,
    );
  }

  function importImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpg,image/jpeg,image/gif,image/webp,image/bmp";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const lc = layerCanvasesRef.current[activeLayerIdRef.current];
          if (!lc) return;
          const lctx = lc.getContext("2d")!;
          const x = (lc.width - img.width) / 2;
          const y = (lc.height - img.height) / 2;
          lctx.drawImage(img, Math.max(0, x), Math.max(0, y));
          saveLayerToState(activeLayerIdRef.current);
          saveState();
          renderFull();
        };
        if (typeof reader.result === "string") img.src = reader.result;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function addLayer() {
    const id = `layer-${Date.now()}`;
    const name = `Layer ${layers.length}`;
    const oc = document.createElement("canvas");
    oc.width = canvasWidth;
    oc.height = canvasHeight;
    layerCanvasesRef.current[id] = oc;
    const octx = oc.getContext("2d")!;
    const imgData = octx.getImageData(0, 0, canvasWidth, canvasHeight);
    const newLayer: Layer = { id, name, visible: true, opacity: 1, imageData: imgData };
    setLayers((prev) => [...prev, newLayer]);
    setActiveLayerId(id);
  }

  function deleteLayer(id: string) {
    if (layers.length <= 1) return;
    if (id === "bg") return;
    setLayers((prev) => prev.filter((l) => l.id !== id));
    if (activeLayerId === id) {
      const idx = layers.findIndex((l) => l.id === id);
      const prevLayer = idx > 0 ? layers[idx - 1] : layers[1];
      if (prevLayer) setActiveLayerId(prevLayer.id);
    }
    delete layerCanvasesRef.current[id];
    renderFull();
  }

  function duplicateLayer(id: string) {
    const src = layers.find((l) => l.id === id);
    if (!src) return;
    const newId = `layer-${Date.now()}`;
    const srcCanvas = layerCanvasesRef.current[id];
    const oc = document.createElement("canvas");
    oc.width = canvasWidth;
    oc.height = canvasHeight;
    if (srcCanvas) {
      oc.getContext("2d")!.drawImage(srcCanvas, 0, 0);
    }
    layerCanvasesRef.current[newId] = oc;
    const octx = oc.getContext("2d")!;
    const imgData = octx.getImageData(0, 0, canvasWidth, canvasHeight);
    const newLayer: Layer = {
      id: newId,
      name: `${src.name} Copy`,
      visible: true,
      opacity: 1,
      imageData: imgData,
    };
    const idx = layers.findIndex((l) => l.id === id);
    setLayers((prev) => [...prev.slice(0, idx + 1), newLayer, ...prev.slice(idx + 1)]);
    setActiveLayerId(newId);
  }

  function moveLayerUp(id: string) {
    const idx = layers.findIndex((l) => l.id === id);
    if (idx >= layers.length - 1) return;
    const next = [...layers];
    const tmp = next[idx]!;
    next[idx] = next[idx + 1]!;
    next[idx + 1] = tmp;
    setLayers(next);
  }

  function moveLayerDown(id: string) {
    const idx = layers.findIndex((l) => l.id === id);
    if (idx <= 0) return;
    const next = [...layers];
    const tmp = next[idx]!;
    next[idx] = next[idx - 1]!;
    next[idx - 1] = tmp;
    setLayers(next);
  }

  function toggleLayerVisibility(id: string) {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));
  }

  function setLayerOpacity(id: string, opacity: number) {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, opacity } : l)));
  }

  function rotateImage(angle: number) {
    saveState();
    const lc = layerCanvasesRef.current[activeLayerIdRef.current];
    if (!lc) return;
    const lctx = lc.getContext("2d")!;
    const temp = document.createElement("canvas");
    const swap = angle === 90 || angle === 270;
    temp.width = swap ? lc.height : lc.width;
    temp.height = swap ? lc.width : lc.height;
    const tctx = temp.getContext("2d")!;
    tctx.translate(temp.width / 2, temp.height / 2);
    tctx.rotate((angle * Math.PI) / 180);
    tctx.drawImage(lc, -lc.width / 2, -lc.height / 2);
    lc.width = temp.width;
    lc.height = temp.height;
    lctx.drawImage(temp, 0, 0);
    saveLayerToState(activeLayerIdRef.current);
    setCanvasWidth(temp.width);
    setCanvasHeight(temp.height);
  }

  function flipImage(horizontal: boolean) {
    saveState();
    const lc = layerCanvasesRef.current[activeLayerIdRef.current];
    if (!lc) return;
    const lctx = lc.getContext("2d")!;
    const temp = document.createElement("canvas");
    temp.width = lc.width;
    temp.height = lc.height;
    const tctx = temp.getContext("2d")!;
    tctx.translate(horizontal ? temp.width : 0, horizontal ? 0 : temp.height);
    tctx.scale(horizontal ? -1 : 1, horizontal ? 1 : -1);
    tctx.drawImage(lc, 0, 0);
    lctx.clearRect(0, 0, lc.width, lc.height);
    lctx.drawImage(temp, 0, 0);
    saveLayerToState(activeLayerIdRef.current);
    saveState();
    renderFull();
  }

  function applyFilter(filterName: string) {
    saveState();
    const lc = layerCanvasesRef.current[activeLayerIdRef.current];
    if (!lc) return;
    const lctx = lc.getContext("2d")!;
    const imgData = lctx.getImageData(0, 0, lc.width, lc.height);
    const fn = FILTERS[filterName];
    if (!fn) return;
    fn(imgData.data, lc.width, lc.height);
    lctx.putImageData(imgData, 0, 0);
    saveLayerToState(activeLayerIdRef.current);
    saveState();
    setShowFilterDialog(false);
    renderFull();
  }

  function floodFill(startX: number, startY: number) {
    const lc = layerCanvasesRef.current[activeLayerIdRef.current];
    if (!lc) return;
    const lctx = lc.getContext("2d")!;
    const w = lc.width;
    const h = lc.height;
    const imgData = lctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const pixIdx = (Math.floor(startY) * w + Math.floor(startX)) * 4;
    const tr = data[pixIdx];
    const tg = data[pixIdx + 1];
    const tb = data[pixIdx + 2];
    const fr = parseInt(fillColor.slice(1, 3), 16);
    const fg = parseInt(fillColor.slice(3, 5), 16);
    const fb = parseInt(fillColor.slice(5, 7), 16);
    if (tr === undefined || tg === undefined || tb === undefined) return;
    if (Math.abs(tr - fr) <= fillTolerance / 100 * 255 && Math.abs(tg - fg) <= fillTolerance / 100 * 255 && Math.abs(tb - fb) <= fillTolerance / 100 * 255) return;
    const tol = fillTolerance / 100 * 255;
    const stack: Array<[number, number]> = [[Math.floor(startX), Math.floor(startY)]];
    const visited = new Uint8Array(w * h);
    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      const i = y * w + x;
      if (visited[i]) continue;
      visited[i] = 1;
      const pi = i * 4;
      if (Math.abs((data[pi] ?? 0) - tr) > tol || Math.abs((data[pi + 1] ?? 0) - tg) > tol || Math.abs((data[pi + 2] ?? 0) - tb) > tol) continue;
      data[pi] = fr;
      data[pi + 1] = fg;
      data[pi + 2] = fb;
      data[pi + 3] = 255;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    lctx.putImageData(imgData, 0, 0);
    saveLayerToState(activeLayerIdRef.current);
    saveState();
    renderFull();
  }

  function pickColor(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const pos = getPos(e);
    const px = ctx.getImageData(Math.floor(pos.x), Math.floor(pos.y), 1, 1).data;
    if (px[0] === undefined || px[1] === undefined || px[2] === undefined) return;
    const hex = `#${px[0].toString(16).padStart(2, "0")}${px[1].toString(16).padStart(2, "0")}${px[2].toString(16).padStart(2, "0")}`;
    setColor(hex);
    setActiveTool("brush");
  }

  function startCreateCrop(pos: { x: number; y: number }) {
    isCroppingRef.current = true;
    cropStartRef.current = pos;
    setCropRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
  }

  function updateCrop(pos: { x: number; y: number }) {
    if (!isCroppingRef.current || !cropHandleRef.current) {
      if (isCroppingRef.current) {
        const sx = cropStartRef.current.x;
        const sy = cropStartRef.current.y;
        const x = Math.min(sx, pos.x);
        const y = Math.min(sy, pos.y);
        const w = Math.abs(pos.x - sx);
        const h = Math.abs(pos.y - sy);
        setCropRect({ x, y, w, h });
      } else if (cropHandleRef.current) {
        const handle = cropHandleRef.current;
        const r = cropRectRef.current;
        if (!r) return;
        let { x, y, w, h } = r;
        const dx = pos.x - cropStartRef.current.x;
        const dy = pos.y - cropStartRef.current.y;
        if (handle.includes("l")) { x += dx; w -= dx; }
        if (handle.includes("r")) { w += dx; }
        if (handle.includes("t")) { y += dy; h -= dy; }
        if (handle.includes("b")) { h += dy; }
        if (handle === "move") { x += dx; y += dy; }
        if (w < 5) w = 5;
        if (h < 5) h = 5;
        cropStartRef.current = pos;
        setCropRect({ x, y, w, h });
      }
    }
  }

  function endCrop() {
    isCroppingRef.current = false;
    cropHandleRef.current = null;
  }

  function getCropHandle(pos: { x: number; y: number }): string | null {
    const r = cropRectRef.current;
    if (!r) return null;
    const hs = 10;
    const handles: Record<string, { x: number; y: number }> = {
      tl: { x: r.x, y: r.y },
      tc: { x: r.x + r.w / 2, y: r.y },
      tr: { x: r.x + r.w, y: r.y },
      ml: { x: r.x, y: r.y + r.h / 2 },
      mr: { x: r.x + r.w, y: r.y + r.h / 2 },
      bl: { x: r.x, y: r.y + r.h },
      bc: { x: r.x + r.w / 2, y: r.y + r.h },
      br: { x: r.x + r.w, y: r.y + r.h },
    };
    for (const [key, hp] of Object.entries(handles)) {
      if (Math.abs(pos.x - hp.x) < hs && Math.abs(pos.y - hp.y) < hs) return key;
    }
    if (pos.x >= r.x && pos.x <= r.x + r.w && pos.y >= r.y && pos.y <= r.y + r.h) return "move";
    return null;
  }

  function applyCrop() {
    const r = cropRectRef.current;
    if (!r || r.w < 1 || r.h < 1) return;
    saveState();
    const lc = layerCanvasesRef.current[activeLayerIdRef.current];
    if (!lc) return;
    const lctx = lc.getContext("2d")!;
    const imgData = lctx.getImageData(r.x, r.y, r.w, r.h);
    lc.width = r.w;
    lc.height = r.h;
    lctx.putImageData(imgData, 0, 0);
    saveLayerToState(activeLayerIdRef.current);
    setCropRect(null);
    setActiveTool("brush");
    setCanvasWidth(r.w);
    setCanvasHeight(r.h);
  }

  function cancelCrop() {
    setCropRect(null);
    setActiveTool("brush");
    renderFull();
  }

  function startSelect(pos: { x: number; y: number }) {
    if (selectionRectRef.current) {
      const r = selectionRectRef.current;
      const handle = getSelectHandle(pos);
      if (handle) {
        selectHandleRef.current = handle === "move" ? null : handle;
        if (handle === "move") {
          isMovingRef.current = true;
          moveOffsetRef.current = { x: pos.x - r.x, y: pos.y - r.y };
        } else {
          isSelectingRef.current = true;
          selectStartRef.current = pos;
        }
        return;
      }
    }
    isSelectingRef.current = true;
    selectStartRef.current = pos;
    setSelectionRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
  }

  function updateSelect(pos: { x: number; y: number }) {
    if (isMovingRef.current) {
      const r = selectionRectRef.current;
      if (!r) return;
      const mx = pos.x - moveOffsetRef.current.x;
      const my = pos.y - moveOffsetRef.current.y;
      const lc = layerCanvasesRef.current[activeLayerIdRef.current];
      if (lc) {
        const lctx = lc.getContext("2d")!;
        const temp = document.createElement("canvas");
        temp.width = canvasWidth;
        temp.height = canvasHeight;
        const tctx = temp.getContext("2d")!;
        tctx.drawImage(lc, 0, 0);
        const content = tctx.getImageData(r.x, r.y, r.w, r.h);
        lctx.clearRect(0, 0, canvasWidth, canvasHeight);
        if (activeLayerIdRef.current === "bg") {
          lctx.fillStyle = "#ffffff";
          lctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }
        savedContentRef.current = content;
        savedContentPosRef.current = { x: mx, y: my };
        saveLayerToState(activeLayerIdRef.current);
        setSelectionRect({ x: mx, y: my, w: r.w, h: r.h });
      }
      return;
    }
    if (isSelectingRef.current) {
      const sx = selectStartRef.current.x, sy = selectStartRef.current.y;
      const x = Math.min(sx, pos.x), y = Math.min(sy, pos.y);
      const w = Math.abs(pos.x - sx), h = Math.abs(pos.y - sy);
      setSelectionRect({ x, y, w, h });
    } else if (selectHandleRef.current) {
      const handle = selectHandleRef.current;
      const r = selectionRectRef.current;
      if (!r) return;
      let { x, y, w, h } = r;
      const dx = pos.x - selectStartRef.current.x;
      const dy = pos.y - selectStartRef.current.y;
      if (handle.includes("l")) { x += dx; w -= dx; }
      if (handle.includes("r")) { w += dx; }
      if (handle.includes("t")) { y += dy; h -= dy; }
      if (handle.includes("b")) { h += dy; }
      if (w < 5) w = 5;
      if (h < 5) h = 5;
      selectStartRef.current = pos;
      setSelectionRect({ x, y, w, h });
    }
  }

  function endSelect() {
    if (isMovingRef.current) {
      isMovingRef.current = false;
      const r = selectionRectRef.current;
      if (r && savedContentRef.current) {
        const lc = layerCanvasesRef.current[activeLayerIdRef.current];
        if (lc) {
          const lctx = lc.getContext("2d")!;
          lctx.putImageData(savedContentRef.current, r.x, r.y);
          saveLayerToState(activeLayerIdRef.current);
          saveState();
          renderFull();
        }
        savedContentRef.current = null;
      }
    }
    isSelectingRef.current = false;
    selectHandleRef.current = null;
  }

  const savedContentRef = useRef<ImageData | null>(null);
  const savedContentPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  function getSelectHandle(pos: { x: number; y: number }): string | null {
    const r = selectionRectRef.current;
    if (!r) return null;
    const hs = 10;
    const handles: Record<string, { x: number; y: number }> = {
      tl: { x: r.x, y: r.y },
      tc: { x: r.x + r.w / 2, y: r.y },
      tr: { x: r.x + r.w, y: r.y },
      ml: { x: r.x, y: r.y + r.h / 2 },
      mr: { x: r.x + r.w, y: r.y + r.h / 2 },
      bl: { x: r.x, y: r.y + r.h },
      bc: { x: r.x + r.w / 2, y: r.y + r.h },
      br: { x: r.x + r.w, y: r.y + r.h },
    };
    for (const [key, hp] of Object.entries(handles)) {
      if (Math.abs(pos.x - hp.x) < hs && Math.abs(pos.y - hp.y) < hs) return key;
    }
    if (pos.x >= r.x && pos.x <= r.x + r.w && pos.y >= r.y && pos.y <= r.y + r.h) return "move";
    return null;
  }

  function copySelection() {
    const r = selectionRectRef.current;
    if (!r || r.w < 1 || r.h < 1) return;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const data = ctx.getImageData(r.x, r.y, r.w, r.h);
    copiedDataRef.current = data;
  }

  function pasteSelection() {
    const data = copiedDataRef.current;
    if (!data) return;
    const id = `layer-${Date.now()}`;
    const oc = document.createElement("canvas");
    oc.width = canvasWidth;
    oc.height = canvasHeight;
    const octx = oc.getContext("2d")!;
    octx.putImageData(data, Math.round((canvasWidth - data.width) / 2), Math.round((canvasHeight - data.height) / 2));
    layerCanvasesRef.current[id] = oc;
    const imgData = octx.getImageData(0, 0, canvasWidth, canvasHeight);
    const newLayer: Layer = { id, name: `Pasted Layer`, visible: true, opacity: 1, imageData: imgData };
    setLayers((prev) => [...prev, newLayer]);
    setActiveLayerId(id);
  }

  function cutSelection() {
    copySelection();
    deleteSelection();
  }

  function deleteSelection() {
    const r = selectionRectRef.current;
    if (!r) return;
    const lc = layerCanvasesRef.current[activeLayerIdRef.current];
    if (!lc) return;
    const lctx = lc.getContext("2d")!;
    if (activeLayerIdRef.current === "bg") {
      lctx.fillStyle = "#ffffff";
      lctx.fillRect(r.x, r.y, r.w, r.h);
    } else {
      lctx.clearRect(r.x, r.y, r.w, r.h);
    }
    saveLayerToState(activeLayerIdRef.current);
    saveState();
    setSelectionRect(null);
    renderFull();
  }

  function addText(text: string) {
    if (!textInput || !text) return;
    const lc = layerCanvasesRef.current[activeLayerIdRef.current];
    if (!lc) return;
    const lctx = lc.getContext("2d")!;
    const style = `${fontItalic ? "italic " : ""}${fontBold ? "bold " : ""}${fontSize}px ${fontFamily}`;
    lctx.font = style;
    lctx.fillStyle = color;
    lctx.fillText(text, textInput.x, textInput.y);
    if (fontUnderline) {
      const metrics = lctx.measureText(text);
      lctx.strokeStyle = color;
      lctx.lineWidth = 1;
      lctx.beginPath();
      lctx.moveTo(textInput.x, textInput.y + 2);
      lctx.lineTo(textInput.x + metrics.width, textInput.y + 2);
      lctx.stroke();
    }
    saveLayerToState(activeLayerIdRef.current);
    saveState();
    setTextInput(null);
    renderFull();
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
    if (activeTool === "fill") {
      floodFill(pos.x, pos.y);
      return;
    }
    if (activeTool === "eyedropper") {
      pickColor(e);
      return;
    }
    if (activeTool === "crop") {
      const handle = cropRectRef.current ? getCropHandle(pos) : null;
      if (handle) {
        cropHandleRef.current = handle;
        cropStartRef.current = pos;
      } else {
        startCreateCrop(pos);
      }
      return;
    }
    if (activeTool === "select") {
      if (selectionRectRef.current && getSelectHandle(pos) === "move") {
        const r = selectionRectRef.current;
        isMovingRef.current = true;
        moveOffsetRef.current = { x: pos.x - r.x, y: pos.y - r.y };
        savedContentRef.current = null;
        return;
      }
      startSelect(pos);
      return;
    }

    const ctx = ctxRef.current;
    if (!ctx) return;
    compositeTo(ctx);

    if (activeTool === "brush" || activeTool === "eraser") {
      const actx = getActiveLayerCtx();
      if (!actx) return;
      const strokeColor = activeTool === "eraser" ? "#ffffff" : color;
      const lw = activeTool === "eraser" ? brushSize * 2 : brushSize;
      actx.strokeStyle = strokeColor;
      actx.lineWidth = lw;
      actx.lineCap = "round";
      actx.lineJoin = "round";
      actx.globalCompositeOperation = activeTool === "eraser" ? "destination-out" : "source-over";
      actx.beginPath();
      actx.moveTo(pos.x, pos.y);
      actx.strokeStyle = strokeColor;
      actx.lineWidth = lw;
      actx.lineCap = "round";
      actx.lineJoin = "round";
      actx.globalCompositeOperation = "source-over";
      actx.beginPath();
      actx.moveTo(pos.x, pos.y);

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lw;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalCompositeOperation = "source-over";
    }
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = getPos(e);
    if (activeTool === "crop") {
      updateCrop(pos);
      return;
    }
    if (activeTool === "select") {
      updateSelect(pos);
      return;
    }
    if (!isDrawing || !lastPos) return;
    const ctx = ctxRef.current;
    if (!ctx) return;

    if (activeTool === "brush" || activeTool === "eraser") {
      const actx = getActiveLayerCtx();
      if (!actx) return;
      actx.lineTo(pos.x, pos.y);
      actx.stroke();
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else {
      const imgData = historyRef.current[historyIndexRef.current];
      if (!imgData) {
        compositeTo(ctx);
      } else {
        compositeTo(ctx);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.globalCompositeOperation = "source-over";
      if (activeTool === "line") {
        ctx.beginPath();
        ctx.moveTo(startPos!.x, startPos!.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else if (activeTool === "rect") {
        const w = pos.x - startPos!.x;
        const h = pos.y - startPos!.y;
        if (fillMode) {
          ctx.fillStyle = fillColor;
          ctx.fillRect(startPos!.x, startPos!.y, w, h);
        }
        ctx.strokeRect(startPos!.x, startPos!.y, w, h);
      } else if (activeTool === "circle") {
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
    }
    setLastPos(pos);
  }

  function endDraw() {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (activeTool === "crop") { endCrop(); return; }
    if (activeTool === "select") { endSelect(); return; }
    if (activeTool === "brush" || activeTool === "eraser") {
      const actx = getActiveLayerCtx();
      if (actx) actx.globalCompositeOperation = "source-over";
    }
    if (activeTool !== "crop" && activeTool !== "select" && activeTool !== "fill" && activeTool !== "eyedropper") {
      if (activeTool === "rect" || activeTool === "circle" || activeTool === "line") {
        const lc = layerCanvasesRef.current[activeLayerIdRef.current];
        if (lc) {
          const lctx = lc.getContext("2d")!;
          lctx.clearRect(0, 0, lc.width, lc.height);
          if (activeLayerIdRef.current === "bg") {
            lctx.fillStyle = "#ffffff";
            lctx.fillRect(0, 0, lc.width, lc.height);
          }
          const main = canvasRef.current!;
          lctx.drawImage(main, 0, 0);
        }
      }
      saveLayerToState(activeLayerIdRef.current);
      saveState();
      renderFull();
    }
  }

  return (
    <div className="flex h-screen">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-1.5 dark:border-border-dark">
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
              {activeTool === "text" ? "Size" : activeTool === "fill" ? "Tolerance" : "Brush"}
            </label>
            {activeTool === "fill" ? (
              <>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={fillTolerance}
                  onChange={(e) => setFillTolerance(Number(e.target.value))}
                  className="w-16"
                />
                <span className="w-5 text-xs text-gray-400">{fillTolerance}</span>
              </>
            ) : (
              <>
                <input
                  type="range"
                  min={1}
                  max={activeTool === "text" ? 200 : 50}
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-16"
                />
                <span className="w-5 text-xs text-gray-400">
                  {activeTool === "text" ? fontSize : brushSize}
                </span>
              </>
            )}
          </div>
          {activeTool === "text" && (
            <>
              <select
                className="rounded border border-border bg-transparent px-1 py-0.5 text-xs text-gray-500 dark:border-border-dark"
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
              >
                <option value="sans-serif">Sans-serif</option>
                <option value="Arial">Arial</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Georgia">Georgia</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
              </select>
              <input
                type="number"
                min={8}
                max={200}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-12 rounded border border-border bg-transparent px-1 py-0.5 text-xs dark:border-border-dark"
              />
              <button
                className={`rounded px-1.5 py-0.5 text-xs ${fontBold ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300" : "text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"}`}
                onClick={() => setFontBold((b) => !b)}
              >
                <Bold className="inline h-3 w-3" />
              </button>
              <button
                className={`rounded px-1.5 py-0.5 text-xs ${fontItalic ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300" : "text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"}`}
                onClick={() => setFontItalic((i) => !i)}
              >
                <Italic className="inline h-3 w-3" />
              </button>
              <button
                className={`rounded px-1.5 py-0.5 text-xs ${fontUnderline ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300" : "text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"}`}
                onClick={() => setFontUnderline((u) => !u)}
              >
                <Underline className="inline h-3 w-3" />
              </button>
            </>
          )}
          <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={fillMode}
              onChange={(e) => setFillMode(e.target.checked)}
              className="rounded"
            />
            Fill
          </label>
          <div className="mx-1 h-4 w-px bg-border dark:bg-border-dark" />
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={10000}
              value={widthInput}
              onChange={(e) => setWidthInput(Number(e.target.value))}
              className="w-14 rounded border border-border bg-transparent px-1 py-0.5 text-xs dark:border-border-dark"
            />
            <span className="text-xs text-gray-400">&times;</span>
            <input
              type="number"
              min={1}
              max={10000}
              value={heightInput}
              onChange={(e) => setHeightInput(Number(e.target.value))}
              className="w-14 rounded border border-border bg-transparent px-1 py-0.5 text-xs dark:border-border-dark"
            />
            <button
              className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              onClick={() => newCanvas(widthInput, heightInput)}
            >
              New Canvas
            </button>
          </div>
          <button
            className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
            onClick={clearCanvas}
          >
            Clear
          </button>
          <button
            className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
            onClick={importImage}
          >
            Open
          </button>
          <div className="flex items-center gap-0.5">
            <select
              className="rounded-l border border-border bg-transparent px-1 py-0.5 text-xs text-gray-500 dark:border-border-dark"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
            >
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
              <option value="webp">WEBP</option>
              <option value="bmp">BMP</option>
            </select>
            <button
              className="rounded-r border border-l-0 border-border px-1.5 py-0.5 text-xs text-gray-500 hover:bg-surface-secondary dark:border-border-dark dark:hover:bg-surface-dark-secondary"
              onClick={() => exportImage(exportFormat)}
            >
              <Download className="inline h-3 w-3" />
            </button>
            {(exportFormat === "jpeg" || exportFormat === "webp") && (
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-400">Q</label>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={Math.round(jpegQuality * 100)}
                  onChange={(e) => setJpegQuality(Number(e.target.value) / 100)}
                  className="w-12"
                />
              </div>
            )}
          </div>
          <div className="mx-1 h-4 w-px bg-border dark:bg-border-dark" />
          <div className="flex items-center gap-0.5">
            <button
              className="rounded px-1 py-0.5 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              onClick={() => rotateImage(90)}
              title="Rotate 90° CW"
            >
              <RotateCw className="inline h-3 w-3" />
            </button>
            <button
              className="rounded px-1 py-0.5 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              onClick={() => rotateImage(270)}
              title="Rotate 90° CCW"
            >
              <RotateCcw className="inline h-3 w-3" />
            </button>
            <button
              className="rounded px-1 py-0.5 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              onClick={() => flipImage(true)}
              title="Flip Horizontal"
            >
              <ArrowUp className="inline h-3 w-3 rotate-90" />
            </button>
            <button
              className="rounded px-1 py-0.5 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              onClick={() => flipImage(false)}
              title="Flip Vertical"
            >
              <ArrowDown className="inline h-3 w-3 rotate-180" />
            </button>
          </div>
          <button
            className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
            onClick={() => setShowFilterDialog(true)}
          >
            <SlidersHorizontal className="inline h-3 w-3" /> Filters
          </button>
          <button
            className={`rounded px-1.5 py-0.5 text-xs ${showGrid ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300" : "text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"}`}
            onClick={() => setShowGrid((g) => !g)}
          >
            <Grid3x3 className="inline h-3 w-3" />
          </button>
          <div className="mx-1 h-4 w-px bg-border dark:bg-border-dark" />
          {cropRect && (
            <div className="flex items-center gap-1">
              <button
                className="rounded px-1.5 py-0.5 text-xs text-green-600 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
                onClick={applyCrop}
              >
                <Check className="inline h-3 w-3" /> Apply
              </button>
              <button
                className="rounded px-1.5 py-0.5 text-xs text-red-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
                onClick={cancelCrop}
              >
                <X className="inline h-3 w-3" /> Cancel
              </button>
            </div>
          )}
          {selectionRect && (
            <div className="flex items-center gap-1">
              <button
                className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
                onClick={copySelection}
              >
                <Copy className="inline h-3 w-3" />
              </button>
              <button
                className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
                onClick={cutSelection}
              >
                Cut
              </button>
              <button
                className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
                onClick={() => setSelectionRect(null)}
              >
                <X className="inline h-3 w-3" />
              </button>
            </div>
          )}
          <div className="mx-1 h-4 w-px bg-border dark:bg-border-dark" />
          <div className="flex items-center gap-0.5">
            <button
              className="rounded px-1 py-0.5 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
              disabled={zoom >= 4}
            >
              <ZoomIn className="inline h-3 w-3" />
            </button>
            <button
              className="rounded px-1 py-0.5 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
              disabled={zoom <= 0.25}
            >
              <ZoomOut className="inline h-3 w-3" />
            </button>
            <button
              className="rounded px-1 py-0.5 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              onClick={() => setZoom(1)}
            >
              <Maximize2 className="inline h-3 w-3" /> {Math.round(zoom * 100)}%
            </button>
          </div>
          <div className="mx-1 h-4 w-px bg-border dark:bg-border-dark" />
          <button
            className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
            onClick={undoRef.current}
            disabled={historyIndex <= 0}
          >
            <Undo2 className="inline h-3 w-3" />
          </button>
          <button
            className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
            onClick={redoRef.current}
            disabled={historyIndex >= history.length - 1}
          >
            <Redo2 className="inline h-3 w-3" />
          </button>
          <button
            className={`rounded px-1.5 py-0.5 text-xs ${layerPanelOpen ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300" : "text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"}`}
            onClick={() => setLayerPanelOpen((o) => !o)}
          >
            <Layers className="inline h-3 w-3" />
          </button>
          <button
            className="ml-auto rounded-lg p-1 text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
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

          <div className="flex flex-1 flex-col">
            <div
              ref={containerRef}
              className="relative flex-1 overflow-hidden bg-surface-secondary dark:bg-surface-dark-secondary"
            >
              <div
                className="absolute left-1/2 top-1/2"
                style={{ transform: `translate(-50%, -50%) scale(${zoom})`, transformOrigin: "center center" }}
              >
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    className="cursor-crosshair rounded-lg shadow-lg"
                    style={{ background: "#ffffff" }}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                  />
                  <canvas
                    ref={overlayRef}
                    className="pointer-events-none absolute left-0 top-0 rounded-lg"
                  />
                  {textInput && (
                    <div
                      className="absolute z-10"
                      style={{ left: textInput.x + 8, top: textInput.y - 8 }}
                    >
                      <input
                        ref={textInputRef}
                        className="rounded border border-brand-500 bg-white px-2 py-1 text-sm outline-none shadow-lg"
                        style={{ fontFamily, fontSize, fontWeight: fontBold ? "bold" : "normal", fontStyle: fontItalic ? "italic" : "normal" }}
                        placeholder="Type text..."
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addText(e.currentTarget.value);
                          else if (e.key === "Escape") setTextInput(null);
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

          {layerPanelOpen && (
            <div className="flex w-56 flex-col border-l border-border bg-white p-2 dark:border-border-dark dark:bg-surface-dark">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Layers</span>
                <button
                  className="rounded p-0.5 text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
                  onClick={addLayer}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <div className="flex flex-col gap-1 overflow-y-auto">
                {layers.map((layer, idx) => (
                  <div
                    key={layer.id}
                    className={`flex flex-col gap-1 rounded border px-2 py-1.5 text-xs cursor-pointer ${
                      layer.id === activeLayerId
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                        : "border-border dark:border-border-dark hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
                    }`}
                    onClick={() => setActiveLayerId(layer.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          className="rounded p-0.5 text-gray-400 hover:text-gray-600"
                          onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
                        >
                          {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        </button>
                        <span className="text-gray-700 dark:text-gray-200">{layer.name}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {idx < layers.length - 1 && (
                          <button className="rounded p-0.5 text-gray-400 hover:text-gray-600" onClick={(e) => { e.stopPropagation(); moveLayerUp(layer.id); }}>
                            <ArrowUp className="h-2.5 w-2.5" />
                          </button>
                        )}
                        {idx > 0 && (
                          <button className="rounded p-0.5 text-gray-400 hover:text-gray-600" onClick={(e) => { e.stopPropagation(); moveLayerDown(layer.id); }}>
                            <ArrowDown className="h-2.5 w-2.5" />
                          </button>
                        )}
                        <button
                          className="rounded p-0.5 text-gray-400 hover:text-gray-600"
                          onClick={(e) => { e.stopPropagation(); duplicateLayer(layer.id); }}
                        >
                          <Copy className="h-2.5 w-2.5" />
                        </button>
                        {layer.id !== "bg" && (
                          <button
                            className="rounded p-0.5 text-gray-400 hover:text-red-500"
                            onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }}
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400" style={{ fontSize: "9px" }}>O</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(layer.opacity * 100)}
                        onChange={(e) => setLayerOpacity(layer.id, Number(e.target.value) / 100)}
                        className="w-full"
                        style={{ height: "4px" }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showFilterDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded-lg bg-white p-4 shadow-xl dark:bg-surface-dark">
            <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-200">Filters</h3>
            <div className="flex flex-col gap-1.5">
              {Object.keys(FILTERS).map((name) => (
                <button
                  key={name}
                  className="rounded px-3 py-1.5 text-left text-xs text-gray-600 capitalize hover:bg-surface-secondary dark:text-gray-300 dark:hover:bg-surface-dark-secondary"
                  onClick={() => applyFilter(name)}
                >
                  {name}
                </button>
              ))}
            </div>
            <button
              className="mt-3 w-full rounded px-2 py-1 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              onClick={() => setShowFilterDialog(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <AISidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(false)}
        appContext="nImg Image Editor"
      />
    </div>
  );
}
