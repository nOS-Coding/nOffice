import { AISidebar, useTheme } from "@noffice/ui-core";
import {
  Circle, Eye, Plus, Square, Trash2, AlignLeft, AlignCenter, AlignRight,
  AlignStartVertical, AlignEndVertical, AlignVerticalDistributeCenter,
  AlignHorizontalDistributeCenter, ChartBar, Table, FileDown, BookOpen,
  ArrowUpDown,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

type SlideLayout = "title" | "title-content" | "blank" | "two-columns";

type ElementAnimationType = "fade-in" | "slide-in-left" | "slide-in-right" | "bounce" | "zoom-in" | "rotate";

interface ElementAnimation {
  type: ElementAnimationType;
  delay: number;
  duration: number;
}

type SlideTransition = "none" | "fade" | "slide-left" | "slide-right" | "zoom-in" | "zoom-out" | "wipe" | "dissolve";

interface SlideElement {
  id: string;
  type: "text" | "rect" | "circle" | "image" | "chart" | "table";
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: string;
  bgColor: string;
  fontSize: number;
  animation?: ElementAnimation;
  chartType?: "bar" | "line" | "pie";
  chartData?: number[];
  chartLabels?: string[];
  rows?: number;
  cols?: number;
  cells?: string[][];
}

interface Slide {
  id: string;
  title: string;
  content: string;
  content2: string;
  layout: SlideLayout;
  elements: SlideElement[];
  bgColor: string;
  notes: string;
  transition: SlideTransition;
  masterId: string;
}

function createSlide(overrides?: Partial<Slide>): Slide {
  return {
    id: String(Date.now()),
    title: "",
    content: "",
    content2: "",
    layout: "title-content",
    elements: [],
    bgColor: "#ffffff",
    notes: "",
    transition: "fade",
    masterId: "",
    ...overrides,
  };
}

const initialSlides: Slide[] = [
  createSlide({ id: "1", title: "Title Slide", content: "Click to add subtitle", layout: "title" }),
  createSlide({ id: "2", title: "Content Slide", content: "Add your content here", layout: "title-content" }),
];

const TRANSITION_KEYFRAMES: Record<string, string> = {
  "slide-left": "from { transform: translateX(-100%); } to { transform: translateX(0); }",
  "slide-right": "from { transform: translateX(100%); } to { transform: translateX(0); }",
  "zoom-in": "from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; }",
  "zoom-out": "from { transform: scale(1.5); opacity: 0; } to { transform: scale(1); opacity: 1; }",
  wipe: "from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); }",
  dissolve: "from { mask-image: linear-gradient(to bottom, transparent 0%, black 0%); -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 0%); } to { mask-image: linear-gradient(to bottom, transparent 100%, black 100%); -webkit-mask-image: linear-gradient(to bottom, transparent 100%, black 100%); }",
  fade: "from { opacity: 0; } to { opacity: 1; }",
  none: "from { opacity: 1; } to { opacity: 1; }",
};

const ELEMENT_KEYFRAMES: Record<string, string> = {
  "fade-in": "from { opacity: 0; } to { opacity: 1; }",
  "slide-in-left": "from { transform: translateX(-100px); opacity: 0; } to { transform: translateX(0); opacity: 1; }",
  "slide-in-right": "from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; }",
  bounce: "0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); }",
  "zoom-in": "from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; }",
  rotate: "from { transform: rotate(0deg); } to { transform: rotate(360deg); }",
};

const TRANSITION_NAMES: SlideTransition[] = ["none", "fade", "slide-left", "slide-right", "zoom-in", "zoom-out", "wipe", "dissolve"];

const ANIMATION_TYPES: ElementAnimationType[] = ["fade-in", "slide-in-left", "slide-in-right", "bounce", "zoom-in", "rotate"];

function injectAnimationStyles() {
  const styleId = "nslides-anim";
  if (document.getElementById(styleId)) return;
  const style = document.createElement("style");
  style.id = styleId;
  let css = "";
  for (const [name, kf] of Object.entries(TRANSITION_KEYFRAMES)) {
    if (name !== "none" && name !== "fade") {
      css += `@keyframes tr-${name} { ${kf} }\n`;
    }
  }
  css += `@keyframes tr-fade { ${TRANSITION_KEYFRAMES.fade} }\n`;
  css += `@keyframes tr-none { ${TRANSITION_KEYFRAMES.none} }\n`;
  for (const [name, kf] of Object.entries(ELEMENT_KEYFRAMES)) {
    css += `@keyframes el-${name} { ${kf} }\n`;
  }
  style.textContent = css;
  document.head.appendChild(style);
}

let animInjected = false;

function SlideThumbnail({ slide }: { slide: Slide }) {
  return (
    <div
      className="mb-1 h-14 rounded p-2 text-[8px] leading-tight"
      style={{ background: slide.bgColor || "#ffffff" }}
    >
      <div className="text-[7px] font-bold" style={{ color: "#000000" }}>{slide.title || "Untitled"}</div>
      {slide.elements.length > 0 ? (
        <div className="mt-0.5 text-[6px] text-gray-400">{slide.elements.length} element(s)</div>
      ) : slide.layout === "blank" ? (
        <div className="flex h-full items-center justify-center text-gray-300">blank</div>
      ) : (
        <div className="line-clamp-2 text-gray-400">{(slide.content || "...").slice(0, 30)}</div>
      )}
    </div>
  );
}

function LayoutBadge({ layout }: { layout: SlideLayout }) {
  const labels: Record<SlideLayout, string> = {
    title: "Title",
    "title-content": "Title + Content",
    blank: "Blank",
    "two-columns": "Two Columns",
  };
  return (
    <span className="rounded bg-surface-tertiary px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-surface-dark-tertiary">
      {labels[layout]}
    </span>
  );
}

function ChartSvg({ el, slideWidth }: { el: SlideElement; slideWidth: number }) {
  const data = el.chartData ?? [];
  const labels = el.chartLabels ?? [];
  const ct = el.chartType ?? "bar";
  const w = Math.min(el.width, slideWidth - el.x);
  const h = el.height;
  const pad = 20;
  const chartW = w - pad * 2;
  const chartH = h - pad * 2;
  const maxVal = Math.max(...data, 1);
  const barW = data.length > 0 ? chartW / data.length - 4 : 10;

  if (ct === "bar") {
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {data.map((v, i) => {
          const barH = (v / maxVal) * chartH;
          const x = pad + i * (barW + 4);
          const y = pad + chartH - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} fill="#4f46e5" rx={2} />
              {labels[i] && (
                <text x={x + barW / 2} y={h - 4} textAnchor="middle" fontSize={9} fill="#6b7280">
                  {labels[i]}
                </text>
              )}
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="#374151">
                {v}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  if (ct === "line") {
    const pts = data
      .map((v, i) => {
        const x = pad + (i / Math.max(data.length - 1, 1)) * chartW;
        const y = pad + chartH - (v / maxVal) * chartH;
        return `${x},${y}`;
      })
      .join(" ");
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <polyline points={pts} fill="none" stroke="#4f46e5" strokeWidth={2} />
        {data.map((v, i) => {
          const x = pad + (i / Math.max(data.length - 1, 1)) * chartW;
          const y = pad + chartH - (v / maxVal) * chartH;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={3} fill="#4f46e5" />
              {labels[i] && (
                <text x={x} y={h - 4} textAnchor="middle" fontSize={9} fill="#6b7280">
                  {labels[i]}
                </text>
              )}
              <text x={x} y={y - 6} textAnchor="middle" fontSize={9} fill="#374151">
                {v}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  if (ct === "pie") {
    const total = data.reduce((a, b) => a + b, 0) || 1;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(chartW, chartH) / 2 - 5;
    let cumul = 0;
    const colors = ["#4f46e5", "#06b6d4", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6", "#ec4899", "#f97316"];
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {data.map((v, i) => {
          const angle = (v / total) * 360;
          const startAngle = (cumul / total) * 360;
          cumul += v;
          const startRad = ((startAngle - 90) * Math.PI) / 180;
          const endRad = ((startAngle + angle - 90) * Math.PI) / 180;
          const x1 = cx + r * Math.cos(startRad);
          const y1 = cy + r * Math.sin(startRad);
          const x2 = cx + r * Math.cos(endRad);
          const y2 = cy + r * Math.sin(endRad);
          const large = angle > 180 ? 1 : 0;
          const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
          return <path key={i} d={d} fill={colors[i % colors.length]} stroke="#fff" strokeWidth={1} />;
        })}
        <g transform={`translate(${cx + r + 10}, ${cy - r})`}>
          {data.map((v, i) => (
            <g key={i} transform={`translate(0, ${i * 16})`}>
              <rect x={0} y={0} width={10} height={10} fill={colors[i % colors.length]} rx={2} />
              <text x={16} y={9} fontSize={9} fill="#374151">{labels[i] ?? ""} ({v})</text>
            </g>
          ))}
        </g>
      </svg>
    );
  }

  return null;
}

function TableElement({ el, onCellChange }: { el: SlideElement; onCellChange: (row: number, col: number, val: string) => void }) {
  const rows = el.rows ?? 2;
  const cols = el.cols ?? 2;
  const cells = el.cells ?? Array.from({ length: rows }, () => Array(cols).fill(""));

  return (
    <table className="h-full w-full border-collapse" style={{ fontSize: el.fontSize }}>
      <tbody>
        {Array.from({ length: rows }, (_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }, (_, c) => (
              <td
                key={c}
                contentEditable
                suppressContentEditableWarning
                spellCheck
                className="border border-gray-300 px-1 py-0.5 text-center outline-none"
                style={{ color: el.color, minWidth: 40, minHeight: 24 }}
                onBlur={(e) => onCellChange(r, c, e.currentTarget.textContent ?? "")}
              >
                {cells[r]?.[c] ?? ""}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CellInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      className="w-full rounded border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-brand-500 dark:border-border-dark dark:bg-surface-dark"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function SlideNumberOverlay({ index, show }: { index: number; show: boolean }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute bottom-3 right-6 text-xs text-gray-400/70 select-none">
      {index + 1}
    </div>
  );
}

function PresentView({
  slides, masterSlides, onClose, showSlideNumbers,
}: {
  slides: Slide[]; masterSlides: Slide[]; onClose: () => void; showSlideNumbers: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [transitionDuration, setTransitionDuration] = useState(0.3);
  const slidesRef = useRef(slides);
  slidesRef.current = slides;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const len = slidesRef.current.length;
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setCurrentIndex((i) => Math.min(i + 1, len - 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setCurrentIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Escape") {
        onClose();
      } else if (e.key === "n" || e.key === "N") {
        setShowNotes((v) => !v);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const slide = slides[currentIndex];
  if (!slide) return null;

  const master = masterSlides.find((m) => m.id === slide.masterId);
  const trName = slide.transition === "none" ? "tr-none" : slide.transition === "fade" ? "tr-fade" : `tr-${slide.transition}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-6 py-3 text-white/60">
        <span>{currentIndex + 1} / {slides.length}</span>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1 text-xs">
            Speed:
            <input
              type="range"
              min={0.1}
              max={2}
              step={0.1}
              value={transitionDuration}
              onChange={(e) => setTransitionDuration(Number(e.target.value))}
              className="w-20"
            />
            <span className="w-6">{transitionDuration.toFixed(1)}s</span>
          </label>
          <button onClick={() => setShowNotes((v) => !v)} className="px-2 py-1 text-sm hover:text-white" title="Toggle notes (N)">
            <BookOpen className="h-4 w-4" />
          </button>
          <button onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))} className="px-2 py-1 text-sm hover:text-white disabled:opacity-30" disabled={currentIndex === 0}>Prev</button>
          <button onClick={() => setCurrentIndex((i) => Math.min(i + 1, slides.length - 1))} className="px-2 py-1 text-sm hover:text-white disabled:opacity-30" disabled={currentIndex === slides.length - 1}>Next</button>
          <button onClick={onClose} className="px-2 py-1 text-sm hover:text-white">Exit (Esc)</button>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center p-12 relative">
        <div
          key={slide.id}
          className="relative aspect-video w-full max-w-5xl rounded-2xl p-16 shadow-2xl"
          style={{
            background: slide.bgColor || "#ffffff",
            animation: `${trName} ${transitionDuration}s ease`,
          }}
        >
          <SlideNumberOverlay index={currentIndex} show={showSlideNumbers} />
          {master?.elements.map((mel) => (
            <div
              key={mel.id}
              className="absolute pointer-events-none"
              style={{
                left: mel.x, top: mel.y, width: mel.width, height: mel.height,
                background: mel.bgColor, color: mel.color,
                fontSize: mel.fontSize, borderRadius: mel.type === "circle" ? "50%" : "4px",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {mel.type === "image" ? (
                <img src={mel.content} alt="" className="h-full w-full object-cover" />
              ) : mel.type === "chart" ? (
                <ChartSvg el={mel} slideWidth={1280} />
              ) : mel.type === "table" ? (
                <TableElement el={mel} onCellChange={() => {}} />
              ) : (
                <span className="px-2 text-center">{mel.content}</span>
              )}
            </div>
          ))}
          {slide.elements.map((el) => {
            const anim = el.animation;
            const animStyle: React.CSSProperties = anim
              ? {
                  animation: `el-${anim.type} ${anim.duration}s ${anim.delay}s both`,
                }
              : {};
            return (
              <div
                key={el.id}
                className="absolute"
                style={{
                  left: el.x, top: el.y, width: el.width, height: el.height,
                  background: el.bgColor, color: el.color,
                  fontSize: el.fontSize, borderRadius: el.type === "circle" ? "50%" : "4px",
                  border: el.type !== "text" ? "1px solid #dee2e6" : undefined,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden",
                  ...animStyle,
                }}
              >
                {el.type === "image" ? (
                  <img src={el.content} alt="" className="h-full w-full object-cover" />
                ) : el.type === "chart" ? (
                  <ChartSvg el={el} slideWidth={1280} />
                ) : el.type === "table" ? (
                  <TableElement el={el} onCellChange={() => {}} />
                ) : (
                  <span className="px-2 text-center" style={{ color: el.color }}>{el.content}</span>
                )}
              </div>
            );
          })}
          <h1 className="mb-6 text-5xl font-bold" style={{ color: "#000000" }}>{slide.title}</h1>
          {slide.layout === "blank" ? null : slide.layout === "title" ? null : slide.layout === "two-columns" ? (
            <div className="flex gap-8">
              <div className="flex-1 whitespace-pre-wrap text-2xl leading-relaxed" style={{ color: slide.title ? "#374151" : "#9ca3af" }}>{slide.content || "Left content"}</div>
              <div className="flex-1 whitespace-pre-wrap text-2xl leading-relaxed" style={{ color: slide.title ? "#374151" : "#9ca3af" }}>{slide.content2 || "Right content"}</div>
            </div>
          ) : (
            <div className="whitespace-pre-wrap text-2xl leading-relaxed" style={{ color: slide.title ? "#374151" : "#9ca3af" }}>{slide.content}</div>
          )}
        </div>
      </div>
      {showNotes && slide.notes && (
        <div className="absolute bottom-0 left-0 right-0 bg-gray-900/90 p-4 text-white/80 text-sm max-h-24 overflow-y-auto">
          <div className="mx-auto max-w-5xl">{slide.notes}</div>
        </div>
      )}
    </div>
  );
}

interface ResizeHandleProps {
  onResize: (dx: number, dy: number) => void;
}

function ResizeHandle({ onResize }: ResizeHandleProps) {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  function handleMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    startRef.current = { x: e.clientX, y: e.clientY };
    function handleMove(ev: MouseEvent) {
      if (!startRef.current) return;
      onResize(ev.clientX - startRef.current.x, ev.clientY - startRef.current.y);
      startRef.current = { x: ev.clientX, y: ev.clientY };
    }
    function handleUp() {
      startRef.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  return (
    <div
      className="absolute bottom-0 right-0 z-20 h-3 w-3 cursor-se-resize rounded-sm bg-brand-500 border border-white"
      onMouseDown={handleMouseDown}
    />
  );
}

function exportToPdf(slides: Slide[], masterSlides: Slide[]) {
  (async () => {
    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [1280, 720] });
    const pageW = 1280;
    const pageH = 720;

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      if (!slide) continue;
      const master = masterSlides.find((m) => m.id === slide.masterId);

      const container = document.createElement("div");
      container.style.cssText = `width:${pageW}px;height:${pageH}px;background:${slide.bgColor};position:relative;overflow:hidden;font-family:sans-serif;padding:80px;box-sizing:border-box;`;
      container.innerHTML = `
        <h1 style="font-size:48px;font-weight:bold;margin-bottom:24px;color:#000;">${slide.title}</h1>
        <div style="font-size:24px;color:#374151;white-space:pre-wrap;">${slide.content}</div>
      `;

      for (const el of slide.elements) {
        const div = document.createElement("div");
        div.style.cssText = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;background:${el.bgColor};color:${el.color};font-size:${el.fontSize}px;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:${el.type === "circle" ? "50%" : "4px"};${el.type !== "text" ? "border:1px solid #dee2e6;" : ""}`;
        div.textContent = el.content;
        container.appendChild(div);
      }

      if (master) {
        for (const el of master.elements) {
          const div = document.createElement("div");
          div.style.cssText = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;background:${el.bgColor};color:${el.color};font-size:${el.fontSize}px;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:${el.type === "circle" ? "50%" : "4px"};${el.type !== "text" ? "border:1px solid #dee2e6;" : ""}`;
          div.textContent = el.content;
          container.appendChild(div);
        }
      }

      document.body.appendChild(container);
      try {
        const canvas = await html2canvas(container, { useCORS: true, scale: 1 });
        const imgData = canvas.toDataURL("image/png");
        if (i > 0) pdf.addPage([pageW, pageH]);
        pdf.addImage(imgData, "PNG", 0, 0, pageW, pageH);
      } finally {
        document.body.removeChild(container);
      }
    }
    pdf.save("presentation.pdf");
  })();
}

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [slides, setSlides] = useState<Slide[]>(initialSlides);
  const [masterSlides, setMasterSlides] = useState<Slide[]>([]);
  const [masterMode, setMasterMode] = useState(false);
  const [activeSlide, setActiveSlide] = useState("1");
  const [activeMasterSlide, setActiveMasterSlide] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [elementTextColor, setElementTextColor] = useState("#000000");
  const [elementBgColor, setElementBgColor] = useState("transparent");
  const [history, setHistory] = useState<Slide[][]>([initialSlides]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyIndexRef = useRef(0);
  const slideAreaRef = useRef<HTMLDivElement>(null);
  const [showChartDialog, setShowChartDialog] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [chartType, setChartType] = useState<"bar" | "line" | "pie">("bar");
  const [chartDataStr, setChartDataStr] = useState("10,20,15,30");
  const [chartLabelsStr, setChartLabelsStr] = useState("A,B,C,D");
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [showSlideNumbers, setShowSlideNumbers] = useState(false);
  const [transitionDuration, setTransitionDuration] = useState(0.3);
  const selectedTransition = "fade";
  useTheme();

  if (!animInjected) {
    injectAnimationStyles();
    animInjected = true;
  }

  const currentSlides = masterMode ? masterSlides : slides;
  const currentActiveId = masterMode ? (activeMasterSlide ?? masterSlides[0]?.id ?? "") : activeSlide;
  const setCurrentActiveId = masterMode ? setActiveMasterSlide : setActiveSlide;

  function saveToHistory(currentSlidesArr: Slide[]) {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(currentSlidesArr);
    if (newHistory.length > 50) newHistory.splice(0, newHistory.length - 50);
    setHistory(newHistory);
    const newIndex = newHistory.length - 1;
    setHistoryIndex(newIndex);
    historyIndexRef.current = newIndex;
  }

  function undo() {
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      const slidesAtIdx = history[newIdx];
      if (!slidesAtIdx) return;
      setHistoryIndex(newIdx);
      historyIndexRef.current = newIdx;
      if (masterMode) {
        setMasterSlides(slidesAtIdx);
      } else {
        setSlides(slidesAtIdx);
      }
    }
  }

  function redo() {
    if (historyIndex < history.length - 1) {
      const newIdx = historyIndex + 1;
      const slidesAtIdx = history[newIdx];
      if (!slidesAtIdx) return;
      setHistoryIndex(newIdx);
      historyIndexRef.current = newIdx;
      if (masterMode) {
        setMasterSlides(slidesAtIdx);
      } else {
        setSlides(slidesAtIdx);
      }
    }
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nslides-data");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSlides(parsed);
          setHistory([parsed]);
          setHistoryIndex(0);
          historyIndexRef.current = 0;
        }
      }
    } catch (e) {
      console.error("Failed to load slides", e);
    }
    try {
      const masterSaved = localStorage.getItem("nslides-master-data");
      if (masterSaved) {
        const parsed = JSON.parse(masterSaved);
        if (Array.isArray(parsed)) setMasterSlides(parsed);
      }
    } catch (e) {
      console.error("Failed to load master slides", e);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("nslides-data", JSON.stringify(slides));
      } catch (e) {
        console.error("Failed to save slides", e);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [slides]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("nslides-master-data", JSON.stringify(masterSlides));
      } catch (e) {
        /* ignore */
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [masterSlides]);

  const addSlide = useCallback((layout?: SlideLayout) => {
    saveToHistory(currentSlides);
    const id = String(Date.now());
    const newSlide = createSlide({ id, layout: layout || "title-content", transition: selectedTransition });
    if (masterMode) {
      setMasterSlides((prev) => [...prev, newSlide]);
      setActiveMasterSlide(id);
    } else {
      setSlides((prev) => [...prev, newSlide]);
      setActiveSlide(id);
    }
    setShowAddMenu(false);
  }, [currentSlides, masterMode, selectedTransition]);

  const deleteSlide = useCallback((id: string) => {
    if (masterMode) {
      setMasterSlides((prev) => {
        const filtered = prev.filter((s) => s.id !== id);
        if (filtered.length === 0) return [createSlide()];
        return filtered;
      });
      setActiveMasterSlide((prev) => {
        if (prev === id) {
          const idx = masterSlides.findIndex((s) => s.id === id);
          const next = masterSlides[Math.max(idx - 1, 0)];
          return next?.id ?? null;
        }
        return prev;
      });
    } else {
      saveToHistory(slides);
      setSlides((prev) => {
        const filtered = prev.filter((s) => s.id !== id);
        if (filtered.length === 0) return [createSlide()];
        return filtered;
      });
      setActiveSlide((prev) => {
        if (prev === id) {
          const idx = slides.findIndex((s) => s.id === id);
          const next = slides[Math.max(idx - 1, 0)];
          return next?.id || slides[0]?.id || "";
        }
        return prev;
      });
    }
  }, [slides, masterSlides, masterMode]);

  function updateSlide(id: string, patch: Partial<Slide>) {
    if (!masterMode) saveToHistory(slides);
    if (masterMode) {
      setMasterSlides((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    } else {
      setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    }
  }

  function addElement(type: SlideElement["type"]) {
    if (!masterMode) saveToHistory(slides);
    const el: SlideElement = {
      id: String(Date.now()),
      type,
      x: 50,
      y: 50,
      width: type === "image" ? 200 : type === "chart" ? 300 : type === "table" ? 250 : 160,
      height: type === "image" ? 150 : type === "chart" ? 220 : type === "table" ? 180 : type === "text" ? 40 : 100,
      content: type === "text" ? "Text" : type === "image" ? "" : "",
      color: elementTextColor,
      bgColor: type !== "text" ? elementBgColor : "transparent",
      fontSize: 16,
      chartType: type === "chart" ? chartType : undefined,
      chartData: type === "chart" ? chartDataStr.split(",").map(Number).filter((n) => !isNaN(n)) : undefined,
      chartLabels: type === "chart" ? chartLabelsStr.split(",").map((s) => s.trim()) : undefined,
      rows: type === "table" ? tableRows : undefined,
      cols: type === "table" ? tableCols : undefined,
      cells: type === "table" ? Array.from({ length: tableRows }, () => Array(tableCols).fill("")) : undefined,
    };
    const targetArrSetter = masterMode ? setMasterSlides : setSlides;
    const targetId = masterMode ? (activeMasterSlide ?? masterSlides[0]?.id ?? "") : activeSlide;
    targetArrSetter((prev) => prev.map((s) => {
      if (s.id !== targetId) return s;
      return { ...s, elements: [...s.elements, el] };
    }));
    setSelectedElements([el.id]);
  }

  function updateElement(elId: string, patch: Partial<SlideElement>, skipHistory?: boolean) {
    if (!skipHistory && !masterMode) saveToHistory(slides);
    const targetArrSetter = masterMode ? setMasterSlides : setSlides;
    const targetId = masterMode ? (activeMasterSlide ?? masterSlides[0]?.id ?? "") : activeSlide;
    targetArrSetter((prev) => prev.map((s) => {
      if (s.id !== targetId) return s;
      return { ...s, elements: s.elements.map((e) => e.id === elId ? { ...e, ...patch } : e) };
    }));
  }

  function handleElementMouseDown(e: React.MouseEvent, elId: string) {
    e.stopPropagation();
    if (!masterMode) saveToHistory(slides);
    const isMulti = e.shiftKey;
    setSelectedElements((prev) => {
      if (isMulti) {
        if (prev.includes(elId)) return prev.filter((id) => id !== elId);
        return [...prev, elId];
      }
      return [elId];
    });
    const el = currentSlides.find((s) => s.id === currentActiveId)?.elements.find((e) => e.id === elId);
    if (el) {
      setElementTextColor(el.color);
      setElementBgColor(el.bgColor);
    }
    setDragStart({ x: e.clientX, y: e.clientY });
  }

  function handleSlideClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest(".slide-element")) return;
    setSelectedElements([]);
  }

  function handleResizeElement(elId: string, dx: number, dy: number) {
    if (!masterMode) saveToHistory(slides);
    const targetArrSetter = masterMode ? setMasterSlides : setSlides;
    const targetId = masterMode ? (activeMasterSlide ?? masterSlides[0]?.id ?? "") : activeSlide;
    targetArrSetter((prev) => prev.map((s) => {
      if (s.id !== targetId) return s;
      return {
        ...s,
        elements: s.elements.map((e) =>
          e.id === elId ? { ...e, width: Math.max(30, e.width + dx), height: Math.max(20, e.height + dy) } : e
        ),
      };
    }));
  }

  function nudgeElement(elId: string, dx: number, dy: number) {
    const targetId = masterMode ? (activeMasterSlide ?? masterSlides[0]?.id ?? "") : activeSlide;
    const source = masterMode ? masterSlides : slides;
    const el = source.find((s) => s.id === targetId)?.elements.find((e) => e.id === elId);
    if (!el) return;
    const slideEl = slideAreaRef.current?.querySelector(".aspect-video");
    const slideWidth = slideEl?.clientWidth || 960;
    const slideHeight = slideEl?.clientHeight || 540;
    const newX = Math.max(0, Math.min(el.x + dx, slideWidth - el.width));
    const newY = Math.max(0, Math.min(el.y + dy, slideHeight - el.height));
    updateElement(elId, { x: newX, y: newY }, true);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const target = e.target as HTMLElement;
    const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

    if ((e.key === "Delete" || e.key === "Backspace") && !isInput) {
      if (selectedElements.length > 0) {
        if (!masterMode) saveToHistory(slides);
        const targetArrSetter = masterMode ? setMasterSlides : setSlides;
        const targetId = masterMode ? (activeMasterSlide ?? masterSlides[0]?.id ?? "") : activeSlide;
        targetArrSetter((prev) => prev.map((s) => {
          if (s.id !== targetId) return s;
          return { ...s, elements: s.elements.filter((el) => !selectedElements.includes(el.id)) };
        }));
        setSelectedElements([]);
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      if (e.shiftKey) {
        e.preventDefault();
        redo();
      } else {
        e.preventDefault();
        undo();
      }
    }

    if (!isInput && (e.key.startsWith("Arrow"))) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      for (const selId of selectedElements) {
        if (e.key === "ArrowUp") nudgeElement(selId, 0, -step);
        else if (e.key === "ArrowDown") nudgeElement(selId, 0, step);
        else if (e.key === "ArrowLeft") nudgeElement(selId, -step, 0);
        else if (e.key === "ArrowRight") nudgeElement(selId, step, 0);
      }
    }
  }

  useEffect(() => {
    const start = dragStart;
    const selList = selectedElements;
    if (!start || selList.length === 0) return;
    const startPos = start;
    const targetId = masterMode ? (activeMasterSlide ?? masterSlides[0]?.id ?? "") : activeSlide;
    function handleMove(e: MouseEvent) {
      const dx = e.clientX - startPos.x;
      const dy = e.clientY - startPos.y;
      const source = masterMode ? masterSlides : slides;
      const slideEl = slideAreaRef.current?.querySelector(".aspect-video");
      const slideWidth = slideEl?.clientWidth || 960;
      const slideHeight = slideEl?.clientHeight || 540;
      for (const selId of selList) {
        const el = source.find((s) => s.id === targetId)?.elements.find((e) => e.id === selId);
        if (el) {
          const newX = Math.max(0, Math.min(el.x + dx, slideWidth - el.width));
          const newY = Math.max(0, Math.min(el.y + dy, slideHeight - el.height));
          updateElement(selId, { x: newX, y: newY }, true);
        }
      }
      setDragStart({ x: e.clientX, y: e.clientY });
    }
    function handleUp() {
      setDragStart(null);
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragStart, selectedElements, slides, masterSlides, activeSlide, activeMasterSlide, masterMode]);

  const current = currentSlides.find((s) => s.id === currentActiveId);

  function insertImage() {
    const url = window.prompt("Image URL");
    if (url) {
      if (!masterMode) saveToHistory(slides);
      const el: SlideElement = {
        id: String(Date.now()),
        type: "image",
        x: 50,
        y: 50,
        width: 200,
        height: 150,
        content: url,
        color: "#000000",
        bgColor: "transparent",
        fontSize: 16,
      };
      const targetArrSetter = masterMode ? setMasterSlides : setSlides;
      const targetId = masterMode ? (activeMasterSlide ?? masterSlides[0]?.id ?? "") : activeSlide;
      targetArrSetter((prev) => prev.map((s) => {
        if (s.id !== targetId) return s;
        return { ...s, elements: [...s.elements, el] };
      }));
    }
  }

  function handleAlign(align: "left" | "center" | "right" | "top" | "middle" | "bottom") {
    if (selectedElements.length < 1) return;
    if (!current) return;
    const targetId = masterMode ? (activeMasterSlide ?? masterSlides[0]?.id ?? "") : activeSlide;
    const source = masterMode ? masterSlides : slides;
    const slide = source.find((s) => s.id === targetId);
    if (!slide) return;
    const els = slide.elements.filter((e) => selectedElements.includes(e.id));
    if (els.length === 0) return;

    const slideEl = slideAreaRef.current?.querySelector(".aspect-video");
    const slideWidth = slideEl?.clientWidth || 960;
    const slideHeight = slideEl?.clientHeight || 540;
    const first = els[0];
    if (!first) return;

    if (align === "left") {
      const minX = Math.min(...els.map((e) => e.x));
      for (const e of els) {
        updateElement(e.id, { x: e.x - (e.x - minX) }, true);
      }
      return;
    }
    if (align === "right") {
      const maxRight = Math.max(...els.map((e) => e.x + e.width));
      for (const e of els) {
        updateElement(e.id, { x: maxRight - e.width }, true);
      }
      return;
    }
    if (align === "center") {
      for (const e of els) {
        updateElement(e.id, { x: (slideWidth - e.width) / 2 }, true);
      }
      return;
    }
    if (align === "top") {
      const minY = Math.min(...els.map((e) => e.y));
      for (const e of els) {
        updateElement(e.id, { y: minY }, true);
      }
      return;
    }
    if (align === "bottom") {
      const maxBottom = Math.max(...els.map((e) => e.y + e.height));
      for (const e of els) {
        updateElement(e.id, { y: maxBottom - e.height }, true);
      }
      return;
    }
    if (align === "middle") {
      for (const e of els) {
        updateElement(e.id, { y: (slideHeight - e.height) / 2 }, true);
      }
      return;
    }
  }

  function handleDistribute(dir: "horizontal" | "vertical") {
    if (selectedElements.length < 3) return;
    if (!current) return;
    const targetId = masterMode ? (activeMasterSlide ?? masterSlides[0]?.id ?? "") : activeSlide;
    const source = masterMode ? masterSlides : slides;
    const slide = source.find((s) => s.id === targetId);
    if (!slide) return;
    let els = slide.elements.filter((e) => selectedElements.includes(e.id));
    if (els.length < 3) return;

    if (dir === "horizontal") {
      els.sort((a, b) => a.x - b.x);
      const first = els[0];
      const last = els[els.length - 1];
      if (!first || !last) return;
      const totalSpace = last.x - first.x;
      const totalElWidth = els.slice(1, -1).reduce((sum, e) => sum + e.width, 0);
      const gap = (totalSpace - totalElWidth) / (els.length - 1);
      let cx = first.x + first.width + gap;
      for (let i = 1; i < els.length - 1; i++) {
        const e = els[i];
        if (!e) continue;
        updateElement(e.id, { x: cx }, true);
        cx += e.width + gap;
      }
    } else {
      els.sort((a, b) => a.y - b.y);
      const first = els[0];
      const last = els[els.length - 1];
      if (!first || !last) return;
      const totalSpace = last.y - first.y;
      const totalElHeight = els.slice(1, -1).reduce((sum, e) => sum + e.height, 0);
      const gap = (totalSpace - totalElHeight) / (els.length - 1);
      let cy = first.y + first.height + gap;
      for (let i = 1; i < els.length - 1; i++) {
        const e = els[i];
        if (!e) continue;
        updateElement(e.id, { y: cy }, true);
        cy += e.height + gap;
      }
    }
  }

  const selElement = selectedElements.length === 1
    ? currentSlides.find((s) => s.id === currentActiveId)?.elements.find((e) => e.id === selectedElements[0])
    : null;

  return (
    <div className="flex h-screen" onKeyDown={handleKeyDown} tabIndex={-1}>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2 dark:border-border-dark">
          <div className="flex items-center gap-1">
            <div className="relative">
              <button
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
                onClick={() => setShowAddMenu(!showAddMenu)}
              >
                <Plus className="h-4 w-4" /> Add Slide
              </button>
              {showAddMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowAddMenu(false)} />
                  <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-lg border border-border bg-surface py-1 shadow-lg dark:border-border-dark dark:bg-surface-dark">
                    {(["title-content", "title", "blank", "two-columns"] as SlideLayout[]).map((layout) => (
                      <button
                        key={layout}
                        className="flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
                        onClick={() => addSlide(layout)}
                      >
                        <LayoutBadge layout={layout} />
                        <span className="ml-2 text-xs text-gray-500">
                          {layout === "title-content" ? "Default" : layout === "title" ? "Title only" : layout === "blank" ? "Empty" : "Side by side"}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              className="rounded-lg p-1.5 text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              onClick={() => deleteSlide(currentActiveId)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <div className="mx-2 h-4 w-px bg-border dark:bg-border-dark" />
            <label className="text-[10px] text-gray-500">Master</label>
            <button
              className={`rounded px-2 py-0.5 text-xs ${masterMode ? "bg-brand-500 text-white" : "text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"}`}
              onClick={() => setMasterMode((v) => !v)}
            >
              {masterMode ? "ON" : "OFF"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            {current && <LayoutBadge layout={current.layout} />}
            <button
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              onClick={() => exportToPdf(slides, masterSlides)}
            >
              <FileDown className="h-4 w-4" /> Export PDF
            </button>
            <button
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              onClick={() => setPresenting(true)}
            >
              <Eye className="h-4 w-4" /> Present
            </button>
            <button
              className="rounded-lg p-1.5 text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              AI
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="flex w-52 flex-col overflow-hidden border-r border-border dark:border-border-dark">
            <div className="border-b border-border px-2 py-1 dark:border-border-dark">
              {masterMode ? (
                <span className="text-[10px] font-semibold text-brand-500">MASTER SLIDES</span>
              ) : (
                <span className="text-[10px] font-semibold text-gray-500">SLIDES</span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {currentSlides.map((slide, i) => (
                <button
                  type="button"
                  key={slide.id}
                  onClick={() => setCurrentActiveId(slide.id)}
                  className={`mb-2 w-full rounded-lg border p-2 text-left text-xs transition-colors ${
                    currentActiveId === slide.id
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                      : "border-border hover:bg-surface-secondary dark:border-border-dark dark:hover:bg-surface-dark-secondary"
                  }`}
                >
                  <SlideThumbnail slide={slide} />
                  <p className="truncate font-medium" style={{ color: "#000000" }}>{slide.title || "Untitled"}</p>
                  <p className="text-[10px] text-gray-400">Slide {i + 1}</p>
                </button>
              ))}
            </div>
            <div className="border-t border-border p-2 dark:border-border-dark">
              <button
                className="w-full rounded-lg p-1 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
                onClick={() => addSlide()}
              >
                + New {masterMode ? "Master" : "Slide"}
              </button>
            </div>
            <div className="border-t border-border p-2 dark:border-border-dark">
              <label className="text-[10px] text-gray-500">Notes</label>
              <textarea
                className="mt-1 w-full resize-none rounded border border-border bg-surface p-1.5 text-xs outline-none dark:border-border-dark dark:bg-surface-dark"
                rows={4}
                value={current?.notes ?? ""}
                onChange={(e) => updateSlide(currentActiveId, { notes: e.target.value })}
                placeholder="Speaker notes..."
              />
            </div>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex flex-wrap items-center gap-1 border-b border-border bg-surface-secondary px-3 py-1 dark:border-border-dark dark:bg-surface-dark-secondary">
              <button className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary" onClick={() => addElement("text")}>+ Text</button>
              <button className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary" onClick={() => addElement("rect")}><Square className="mr-0.5 inline h-3 w-3" />Rect</button>
              <button className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary" onClick={() => addElement("circle")}><Circle className="mr-0.5 inline h-3 w-3" />Circle</button>
              <button className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary" onClick={insertImage}>+ Image</button>
              <button className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary" onClick={() => { setShowChartDialog(true); }}><ChartBar className="mr-0.5 inline h-3 w-3" />Chart</button>
              <button className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary" onClick={() => { setShowTableDialog(true); }}><Table className="mr-0.5 inline h-3 w-3" />Table</button>

              <div className="mx-1 h-4 w-px bg-border dark:bg-border-dark" />

              {selectedElements.length > 1 && (
                <>
                  <button className="rounded p-0.5 text-xs text-gray-500 hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary" onClick={() => handleAlign("left")} title="Align Left"><AlignLeft className="h-3.5 w-3.5" /></button>
                  <button className="rounded p-0.5 text-xs text-gray-500 hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary" onClick={() => handleAlign("center")} title="Align Center"><AlignCenter className="h-3.5 w-3.5" /></button>
                  <button className="rounded p-0.5 text-xs text-gray-500 hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary" onClick={() => handleAlign("right")} title="Align Right"><AlignRight className="h-3.5 w-3.5" /></button>
                  <button className="rounded p-0.5 text-xs text-gray-500 hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary" onClick={() => handleAlign("top")} title="Align Top"><AlignStartVertical className="h-3.5 w-3.5" /></button>
                  <button className="rounded p-0.5 text-xs text-gray-500 hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary" onClick={() => handleAlign("middle")} title="Align Middle"><AlignVerticalDistributeCenter className="h-3.5 w-3.5" /></button>
                  <button className="rounded p-0.5 text-xs text-gray-500 hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary" onClick={() => handleAlign("bottom")} title="Align Bottom"><AlignEndVertical className="h-3.5 w-3.5" /></button>
                  <button className="rounded p-0.5 text-xs text-gray-500 hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary" onClick={() => handleDistribute("horizontal")} title="Distribute Horizontally"><AlignHorizontalDistributeCenter className="h-3.5 w-3.5" /></button>
                  <button className="rounded p-0.5 text-xs text-gray-500 hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary" onClick={() => handleDistribute("vertical")} title="Distribute Vertically"><ArrowUpDown className="h-3.5 w-3.5" /></button>
                  <div className="mx-1 h-4 w-px bg-border dark:bg-border-dark" />
                </>
              )}

              <label className="text-[10px] text-gray-500">Text Color</label>
              <input type="color" value={elementTextColor} onChange={(e) => { setElementTextColor(e.target.value); if (selElement) updateElement(selElement.id, { color: e.target.value }); }} className="h-5 w-6 cursor-pointer rounded border-0 p-0" />
              <label className="text-[10px] text-gray-500">Fill</label>
              <input type="color" value={elementBgColor === "transparent" ? "#ffffff" : elementBgColor} onChange={(e) => { setElementBgColor(e.target.value); if (selElement) updateElement(selElement.id, { bgColor: e.target.value }); }} className="h-5 w-6 cursor-pointer rounded border-0 p-0" />
              <div className="mx-1 h-4 w-px bg-border dark:bg-border-dark" />
              <label className="text-[10px] text-gray-500">Slide Bg</label>
              <input type="color" value={current?.bgColor || "#ffffff"} onChange={(e) => updateSlide(currentActiveId, { bgColor: e.target.value })} className="h-5 w-6 cursor-pointer rounded border-0 p-0" />

              <div className="mx-1 h-4 w-px bg-border dark:bg-border-dark" />
              <label className="text-[10px] text-gray-500">Transition</label>
              <select
                className="rounded border border-border bg-surface px-1 py-0.5 text-[10px] outline-none dark:border-border-dark dark:bg-surface-dark"
                value={current?.transition ?? "fade"}
                onChange={(e) => updateSlide(currentActiveId, { transition: e.target.value as SlideTransition })}
              >
                {TRANSITION_NAMES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <label className="text-[10px] text-gray-500">Speed</label>
              <input type="range" min={0.1} max={2} step={0.1} value={transitionDuration} onChange={(e) => setTransitionDuration(Number(e.target.value))} className="w-16" title={`${transitionDuration.toFixed(1)}s`} />

              <div className="mx-1 h-4 w-px bg-border dark:bg-border-dark" />
              <label className="text-[10px] text-gray-500 flex items-center gap-1">
                <input type="checkbox" checked={showSlideNumbers} onChange={(e) => setShowSlideNumbers(e.target.checked)} className="h-3 w-3" />
                #
              </label>

              {selElement && (
                <>
                  <div className="mx-1 h-4 w-px bg-border dark:bg-border-dark" />
                  <button className="rounded px-2 py-0.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => {
                    if (!masterMode) saveToHistory(slides);
                    const targetArrSetter = masterMode ? setMasterSlides : setSlides;
                    const targetId = masterMode ? (activeMasterSlide ?? masterSlides[0]?.id ?? "") : activeSlide;
                    targetArrSetter((prev) => prev.map((s) => {
                      if (s.id !== targetId) return s;
                      return { ...s, elements: s.elements.filter((e) => !selectedElements.includes(e.id)) };
                    }));
                    setSelectedElements([]);
                  }}>
                    Delete
                  </button>
                </>
              )}

              {selElement && (
                <>
                  <div className="mx-1 h-4 w-px bg-border dark:bg-border-dark" />
                  <label className="text-[10px] text-gray-500">Font</label>
                  <input type="number" min={8} max={200} value={selElement.fontSize} onChange={(e) => updateElement(selElement.id, { fontSize: Number(e.target.value) })} className="h-5 w-12 rounded border border-border px-1 text-[10px] outline-none dark:border-border-dark dark:bg-surface-dark" />
                </>
              )}

              {selElement && (
                <>
                  <div className="mx-1 h-4 w-px bg-border dark:bg-border-dark" />
                  <label className="text-[10px] text-gray-500">Anim</label>
                  <select
                    className="rounded border border-border bg-surface px-1 py-0.5 text-[10px] outline-none dark:border-border-dark dark:bg-surface-dark"
                    value={selElement.animation?.type ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        updateElement(selElement.id, { animation: undefined });
                      } else {
                        updateElement(selElement.id, {
                          animation: {
                            type: val as ElementAnimationType,
                            delay: selElement.animation?.delay ?? 0,
                            duration: selElement.animation?.duration ?? 0.5,
                          },
                        });
                      }
                    }}
                  >
                    <option value="">None</option>
                    {ANIMATION_TYPES.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                  {(() => {
                    const anim = selElement.animation;
                    if (!anim) return null;
                    return (
                      <>
                        <label className="text-[10px] text-gray-500">Delay</label>
                        <input type="number" min={0} max={10} step={0.1} value={anim.delay} onChange={(e) => updateElement(selElement.id, { animation: { ...anim, delay: Number(e.target.value) } })} className="h-5 w-12 rounded border border-border px-1 text-[10px] outline-none dark:border-border-dark dark:bg-surface-dark" />
                        <label className="text-[10px] text-gray-500">Dur</label>
                        <input type="number" min={0.1} max={5} step={0.1} value={anim.duration} onChange={(e) => updateElement(selElement.id, { animation: { ...anim, duration: Number(e.target.value) } })} className="h-5 w-12 rounded border border-border px-1 text-[10px] outline-none dark:border-border-dark dark:bg-surface-dark" />
                      </>
                    );
                  })()}
                </>
              )}
            </div>

            <div ref={slideAreaRef} className="flex-1 overflow-y-auto bg-surface-secondary p-6 dark:bg-surface-dark-secondary" onClick={handleSlideClick} tabIndex={0}>
              <div className="relative mx-auto aspect-video max-w-4xl rounded-2xl p-10 shadow-lg" style={{ background: current?.bgColor || "#ffffff" }}>
                <SlideNumberOverlay index={currentSlides.findIndex((s) => s.id === currentActiveId)} show={showSlideNumbers} />

                {masterMode && current && (
                  <div className="absolute -top-7 left-0 rounded-t bg-brand-500 px-2 py-0.5 text-[9px] text-white">
                    MASTER SLIDE EDITOR
                  </div>
                )}

                {!masterMode && current?.masterId && (() => {
                  const master = masterSlides.find((m) => m.id === current.masterId);
                  return master?.elements.map((mel) => (
                    <div
                      key={mel.id}
                      className="slide-element absolute pointer-events-none opacity-40"
                      style={{
                        left: mel.x, top: mel.y, width: mel.width, height: mel.height,
                        background: mel.bgColor, color: mel.color,
                        fontSize: mel.fontSize, borderRadius: mel.type === "circle" ? "50%" : "4px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {mel.type === "image" ? (
                        <img src={mel.content} alt="" className="h-full w-full object-cover" />
                      ) : mel.type === "chart" ? (
                        <ChartSvg el={mel} slideWidth={960} />
                      ) : mel.type === "table" ? (
                        <TableElement el={mel} onCellChange={() => {}} />
                      ) : (
                        <span className="px-2 text-center">{mel.content}</span>
                      )}
                    </div>
                  ));
                })()}

                <div className="mb-6">
                  <input className="w-full text-3xl font-bold outline-none placeholder:text-gray-300 bg-transparent" value={current?.title ?? ""} onChange={(e) => updateSlide(currentActiveId, { title: e.target.value })} placeholder="Slide title" style={{ color: "#000000" }} />
                </div>
                {current?.layout === "blank" && (!current.elements || current.elements.length === 0) ? (
                  <div className="flex h-40 items-center justify-center text-gray-300">Blank slide — add elements above</div>
                ) : current?.layout === "title" ? null : current?.layout === "two-columns" ? (
                  <div className="flex gap-6">
                    <textarea className="flex-1 resize-none text-lg outline-none placeholder:text-gray-300 bg-transparent" rows={8} value={current?.content ?? ""} onChange={(e) => updateSlide(currentActiveId, { content: e.target.value })} placeholder="Left column" style={{ color: "#000000" }} />
                    <div className="w-px bg-border dark:bg-border-dark" />
                    <textarea className="flex-1 resize-none text-lg outline-none placeholder:text-gray-300 bg-transparent" rows={8} value={current?.content2 ?? ""} onChange={(e) => updateSlide(currentActiveId, { content2: e.target.value })} placeholder="Right column" style={{ color: "#000000" }} />
                  </div>
                ) : current?.layout !== "blank" ? (
                  <textarea className="w-full resize-none text-lg leading-relaxed outline-none placeholder:text-gray-300 bg-transparent" rows={10} value={current?.content ?? ""} onChange={(e) => updateSlide(currentActiveId, { content: e.target.value })} placeholder="Slide content" style={{ color: "#000000" }} />
                ) : null}

                {current?.elements.map((el) => (
                  <div
                    key={el.id}
                    className={`slide-element absolute cursor-move ${selectedElements.includes(el.id) ? "ring-2 ring-brand-500" : ""}`}
                    style={{
                      left: el.x,
                      top: el.y,
                      width: el.width,
                      height: el.height,
                      background: el.bgColor !== "transparent" ? el.bgColor : undefined,
                      color: el.color,
                      fontSize: el.fontSize,
                      borderRadius: el.type === "circle" ? "50%" : "4px",
                      border: el.type !== "text" && el.type !== "table" ? "1px solid #dee2e6" : undefined,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                    onMouseDown={(e) => handleElementMouseDown(e, el.id)}
                  >
                    {el.type === "image" ? (
                      <img src={el.content} alt="" className="h-full w-full object-cover" />
                    ) : el.type === "text" ? (
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        spellCheck
                        className="w-full h-full px-2 py-1 outline-none"
                        style={{ color: el.color }}
                        onInput={(e) => updateElement(el.id, { content: e.currentTarget.textContent || "" })}
                        onBlur={(e) => updateElement(el.id, { content: e.currentTarget.textContent || "" })}
                      >
                        {el.content}
                      </div>
                    ) : el.type === "chart" ? (
                      <ChartSvg el={el} slideWidth={960} />
                    ) : el.type === "table" ? (
                      <TableElement el={el} onCellChange={(r, c, val) => {
                        const cells = el.cells ? el.cells.map((row) => [...row]) : Array.from({ length: el.rows ?? 2 }, () => Array(el.cols ?? 2).fill(""));
                        if (!cells[r]) cells[r] = [];
                        cells[r][c] = val;
                        updateElement(el.id, { cells });
                      }} />
                    ) : (
                      <span style={{ color: el.color, fontSize: el.fontSize - 2 }}>{el.content}</span>
                    )}
                    {selectedElements.includes(el.id) && (
                      <ResizeHandle onResize={(dx, dy) => handleResizeElement(el.id, dx, dy)} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showChartDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowChartDialog(false)}>
          <div className="w-80 rounded-lg border border-border bg-surface p-4 shadow-xl dark:border-border-dark dark:bg-surface-dark" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-medium">Insert Chart</h3>
            <label className="mb-1 block text-[10px] text-gray-500">Chart Type</label>
            <select className="mb-2 w-full rounded border border-border bg-surface px-2 py-1 text-xs outline-none dark:border-border-dark dark:bg-surface-dark" value={chartType} onChange={(e) => setChartType(e.target.value as "bar" | "line" | "pie")}>
              <option value="bar">Bar</option>
              <option value="line">Line</option>
              <option value="pie">Pie</option>
            </select>
            <label className="mb-1 block text-[10px] text-gray-500">Data (comma-separated)</label>
            <CellInput value={chartDataStr} onChange={setChartDataStr} placeholder="10,20,15,30" />
            <label className="mb-1 mt-2 block text-[10px] text-gray-500">Labels (comma-separated)</label>
            <CellInput value={chartLabelsStr} onChange={setChartLabelsStr} placeholder="A,B,C,D" />
            <div className="mt-3 flex justify-end gap-2">
              <button className="rounded px-3 py-1 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary" onClick={() => setShowChartDialog(false)}>Cancel</button>
              <button className="rounded bg-brand-500 px-3 py-1 text-xs text-white hover:bg-brand-600" onClick={() => { addElement("chart"); setShowChartDialog(false); }}>Insert</button>
            </div>
          </div>
        </div>
      )}

      {showTableDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowTableDialog(false)}>
          <div className="w-72 rounded-lg border border-border bg-surface p-4 shadow-xl dark:border-border-dark dark:bg-surface-dark" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-medium">Insert Table</h3>
            <label className="mb-1 block text-[10px] text-gray-500">Rows (2-10)</label>
            <input type="number" min={2} max={10} value={tableRows} onChange={(e) => setTableRows(Math.max(2, Math.min(10, Number(e.target.value) || 2)))} className="mb-2 w-full rounded border border-border bg-surface px-2 py-1 text-xs outline-none dark:border-border-dark dark:bg-surface-dark" />
            <label className="mb-1 block text-[10px] text-gray-500">Columns (2-10)</label>
            <input type="number" min={2} max={10} value={tableCols} onChange={(e) => setTableCols(Math.max(2, Math.min(10, Number(e.target.value) || 2)))} className="mb-2 w-full rounded border border-border bg-surface px-2 py-1 text-xs outline-none dark:border-border-dark dark:bg-surface-dark" />
            <div className="mt-3 flex justify-end gap-2">
              <button className="rounded px-3 py-1 text-xs text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary" onClick={() => setShowTableDialog(false)}>Cancel</button>
              <button className="rounded bg-brand-500 px-3 py-1 text-xs text-white hover:bg-brand-600" onClick={() => { addElement("table"); setShowTableDialog(false); }}>Insert</button>
            </div>
          </div>
        </div>
      )}

      <AISidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(false)} appContext="nSlides Presentation" />

      {presenting && (
        <PresentView
          slides={slides}
          masterSlides={masterSlides}
          onClose={() => setPresenting(false)}
          showSlideNumbers={showSlideNumbers}
        />
      )}
    </div>
  );
}
