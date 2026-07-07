import { AISidebar, useTheme } from "@noffice/ui-core";
import { Circle, Eye, Plus, Square, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type SlideLayout = "title" | "title-content" | "blank" | "two-columns";

interface SlideElement {
  id: string;
  type: "text" | "rect" | "circle" | "image";
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: string;
  bgColor: string;
  fontSize: number;
}

interface Slide {
  id: string;
  title: string;
  content: string;
  content2: string;
  layout: SlideLayout;
  elements: SlideElement[];
  bgColor: string;
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
    ...overrides,
  };
}

function SlideThumbnail({ slide }: { slide: Slide; index: number }) {
  return (
    <div
      className="mb-1 h-14 rounded p-2 text-[8px] leading-tight"
      style={{ background: slide.bgColor || "#ffffff" }}
    >
      {slide.layout === "blank" && slide.elements.length === 0 ? (
        <div className="flex h-full items-center justify-center text-gray-300">blank</div>
      ) : (
        <>
          <div className="mb-1 text-[7px] font-bold" style={{ color: "#000000" }}>{slide.title || "Untitled"}</div>
          {slide.layout !== "title" && (
            <div className="line-clamp-2 text-gray-400">{slide.content || "..."}</div>
          )}
        </>
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

function PresentView({ slides, onClose }: { slides: Slide[]; onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const slide = slides[currentIndex];

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setCurrentIndex((i) => Math.min(i + 1, slides.length - 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setCurrentIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [slides.length, onClose]);

  if (!slide) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-6 py-3 text-white/60">
        <span>{currentIndex + 1} / {slides.length}</span>
        <div className="flex gap-3">
          <button onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))} className="px-2 py-1 text-sm hover:text-white disabled:opacity-30" disabled={currentIndex === 0}>Prev</button>
          <button onClick={() => setCurrentIndex((i) => Math.min(i + 1, slides.length - 1))} className="px-2 py-1 text-sm hover:text-white disabled:opacity-30" disabled={currentIndex === slides.length - 1}>Next</button>
          <button onClick={onClose} className="px-2 py-1 text-sm hover:text-white">Exit (Esc)</button>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center p-12">
        <div
          className="relative aspect-video w-full max-w-5xl rounded-2xl p-16 shadow-2xl"
          style={{ background: slide.bgColor || "#ffffff" }}
        >
          <h1 className="mb-6 text-5xl font-bold" style={{ color: "#000000" }}>{slide.title}</h1>
          {slide.elements.map((el) => (
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
              }}
            >
              {el.type === "image" ? (
                <img src={el.content} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="px-2 text-center">{el.content}</span>
              )}
            </div>
          ))}
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
    </div>
  );
}

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([
    createSlide({ id: "1", title: "Title Slide", content: "Click to add subtitle", layout: "title" }),
    createSlide({ id: "2", title: "Content Slide", content: "Add your content here", layout: "title-content" }),
  ]);
  const [activeSlide, setActiveSlide] = useState("1");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [elementTextColor, setElementTextColor] = useState("#000000");
  const [elementBgColor, setElementBgColor] = useState("transparent");
  const slideAreaRef = useRef<HTMLDivElement>(null);
  useTheme();

  const addSlide = useCallback((layout?: SlideLayout) => {
    const id = String(Date.now());
    setSlides((prev) => [...prev, createSlide({ id, layout: layout || "title-content" })]);
    setActiveSlide(id);
    setShowAddMenu(false);
  }, []);

  const deleteSlide = useCallback((id: string) => {
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
  }, [slides]);

  function updateSlide(id: string, patch: Partial<Slide>) {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addElement(type: SlideElement["type"]) {
    const el: SlideElement = {
      id: String(Date.now()),
      type,
      x: 50,
      y: 50,
      width: type === "image" ? 200 : 160,
      height: type === "image" ? 150 : type === "text" ? 40 : 100,
      content: type === "text" ? "Text" : type === "image" ? "" : "",
      color: elementTextColor,
      bgColor: type !== "text" ? elementBgColor : "transparent",
      fontSize: 16,
    };
    updateSlide(activeSlide, {
      elements: [...(slides.find((s) => s.id === activeSlide)?.elements || []), el],
    });
    setSelectedElement(el.id);
  }

  function updateElement(elId: string, patch: Partial<SlideElement>) {
    setSlides((prev) => prev.map((s) => {
      if (s.id !== activeSlide) return s;
      return { ...s, elements: s.elements.map((e) => e.id === elId ? { ...e, ...patch } : e) };
    }));
  }

  function handleElementMouseDown(e: React.MouseEvent, elId: string) {
    e.stopPropagation();
    setSelectedElement(elId);
    const el = slides.find((s) => s.id === activeSlide)?.elements.find((e) => e.id === elId);
    if (el) {
      setElementTextColor(el.color);
      setElementBgColor(el.bgColor);
    }
    setDragStart({ x: e.clientX, y: e.clientY });
  }

  function handleSlideClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest(".slide-element")) return;
    setSelectedElement(null);
  }

  useEffect(() => {
    const start = dragStart;
    const sel = selectedElement;
    if (!start || !sel) return;
    type Point = { x: number; y: number };
    const startPos: Point = start;
    const selId: string = sel;
    function handleMove(e: MouseEvent) {
      const dx = e.clientX - startPos.x;
      const dy = e.clientY - startPos.y;
      const el = slides.find((s) => s.id === activeSlide)?.elements.find((e) => e.id === selId);
      if (el) {
        updateElement(selId, { x: el.x + dx, y: el.y + dy });
        setDragStart({ x: e.clientX, y: e.clientY });
      }
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
  }, [dragStart, selectedElement, slides, activeSlide]);

  const current = slides.find((s) => s.id === activeSlide);

  function insertImage() {
    const url = window.prompt("Image URL");
    if (url) {
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
      updateSlide(activeSlide, {
        elements: [...(slides.find((s) => s.id === activeSlide)?.elements || []), el],
      });
    }
  }

  return (
    <div className="flex h-screen">
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
              onClick={() => deleteSlide(activeSlide)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {current && <LayoutBadge layout={current.layout} />}
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
            <div className="flex-1 overflow-y-auto p-2">
              {slides.map((slide, i) => (
                <button
                  type="button"
                  key={slide.id}
                  onClick={() => setActiveSlide(slide.id)}
                  className={`mb-2 w-full rounded-lg border p-2 text-left text-xs transition-colors ${
                    activeSlide === slide.id
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                      : "border-border hover:bg-surface-secondary dark:border-border-dark dark:hover:bg-surface-dark-secondary"
                  }`}
                >
                  <SlideThumbnail slide={slide} index={i} />
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
                + New Slide
              </button>
            </div>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-surface-secondary px-3 py-1 dark:border-border-dark dark:bg-surface-dark-secondary">
              <button
                className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary"
                onClick={() => addElement("text")}
              >
                + Text
              </button>
              <button
                className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary"
                onClick={() => addElement("rect")}
              >
                <Square className="mr-1 inline h-3 w-3" /> Rect
              </button>
              <button
                className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary"
                onClick={() => addElement("circle")}
              >
                <Circle className="mr-1 inline h-3 w-3" /> Circle
              </button>
              <button
                className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary"
                onClick={insertImage}
              >
                + Image
              </button>
              <div className="mx-2 h-4 w-px bg-border dark:bg-border-dark" />
              <label className="text-[10px] text-gray-500">Text Color</label>
              <input
                type="color"
                value={elementTextColor}
                onChange={(e) => {
                  setElementTextColor(e.target.value);
                  if (selectedElement) updateElement(selectedElement, { color: e.target.value });
                }}
                className="h-5 w-6 cursor-pointer rounded border-0 p-0"
              />
              <label className="text-[10px] text-gray-500">Fill</label>
              <input
                type="color"
                value={elementBgColor === "transparent" ? "#ffffff" : elementBgColor}
                onChange={(e) => {
                  setElementBgColor(e.target.value);
                  if (selectedElement) updateElement(selectedElement, { bgColor: e.target.value });
                }}
                className="h-5 w-6 cursor-pointer rounded border-0 p-0"
              />
              {selectedElement && (
                <button
                  className="ml-auto rounded px-2 py-0.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => {
                    updateSlide(activeSlide, {
                      elements: (slides.find((s) => s.id === activeSlide)?.elements || []).filter((e) => e.id !== selectedElement),
                    });
                    setSelectedElement(null);
                  }}
                >
                  Delete
                </button>
              )}
            </div>
            <div
              ref={slideAreaRef}
              className="flex-1 overflow-y-auto bg-surface-secondary p-6 dark:bg-surface-dark-secondary"
              onClick={handleSlideClick}
            >
              <div className="relative mx-auto aspect-video max-w-4xl rounded-2xl p-10 shadow-lg"
                style={{ background: current?.bgColor || "#ffffff" }}
              >
                <div className="mb-6">
                  <input
                    className="w-full text-3xl font-bold outline-none placeholder:text-gray-300 bg-transparent"
                    value={current?.title ?? ""}
                    onChange={(e) => updateSlide(activeSlide, { title: e.target.value })}
                    placeholder="Slide title"
                    style={{ color: "#000000" }}
                  />
                </div>
                {current?.layout === "blank" && (!current.elements || current.elements.length === 0) ? (
                  <div className="flex h-40 items-center justify-center text-gray-300">
                    Blank slide — add elements above
                  </div>
                ) : current?.layout === "title" ? null : current?.layout === "two-columns" ? (
                  <div className="flex gap-6">
                    <textarea
                      className="flex-1 resize-none text-lg outline-none placeholder:text-gray-300 bg-transparent"
                      rows={8}
                      value={current?.content ?? ""}
                      onChange={(e) => updateSlide(activeSlide, { content: e.target.value })}
                      placeholder="Left column"
                      style={{ color: "#000000" }}
                    />
                    <div className="w-px bg-border dark:bg-border-dark" />
                    <textarea
                      className="flex-1 resize-none text-lg outline-none placeholder:text-gray-300 bg-transparent"
                      rows={8}
                      value={current?.content2 ?? ""}
                      onChange={(e) => updateSlide(activeSlide, { content2: e.target.value })}
                      placeholder="Right column"
                      style={{ color: "#000000" }}
                    />
                  </div>
                ) : current?.layout !== "blank" ? (
                  <textarea
                    className="w-full resize-none text-lg leading-relaxed outline-none placeholder:text-gray-300 bg-transparent"
                    rows={10}
                    value={current?.content ?? ""}
                    onChange={(e) => updateSlide(activeSlide, { content: e.target.value })}
                    placeholder="Slide content"
                    style={{ color: "#000000" }}
                  />
                ) : null}
                {current?.elements.map((el) => (
                  <div
                    key={el.id}
                    className={`slide-element absolute cursor-move ${selectedElement === el.id ? "ring-2 ring-brand-500" : ""}`}
                    style={{
                      left: el.x,
                      top: el.y,
                      width: el.width,
                      height: el.height,
                      background: el.bgColor !== "transparent" ? el.bgColor : undefined,
                      color: el.color,
                      fontSize: el.fontSize,
                      borderRadius: el.type === "circle" ? "50%" : "4px",
                      border: el.type !== "text" ? "1px solid #dee2e6" : undefined,
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
                        className="w-full h-full px-2 py-1 outline-none"
                        style={{ color: el.color }}
                        onBlur={(e) => updateElement(el.id, { content: e.currentTarget.textContent || "" })}
                      >
                        {el.content}
                      </div>
                    ) : (
                      <span style={{ color: el.color, fontSize: el.fontSize - 2 }}>{el.content}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AISidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(false)} appContext="nSlides Presentation" />

      {presenting && <PresentView slides={slides} onClose={() => setPresenting(false)} />}
    </div>
  );
}
