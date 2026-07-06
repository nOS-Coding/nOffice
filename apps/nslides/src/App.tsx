import { AISidebar, Button, useTheme } from "@noffice/ui-core";
import { Bot, Copy, Eye, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

interface Slide {
  id: string;
  title: string;
  content: string;
}

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([
    { id: "1", title: "Title Slide", content: "Click to add title" },
    { id: "2", title: "Content Slide", content: "Click to add content" },
  ]);
  const [activeSlide, setActiveSlide] = useState("1");
  useTheme();

  function addSlide() {
    const id = String(Date.now());
    setSlides((prev) => [...prev, { id, title: "New Slide", content: "" }]);
    setActiveSlide(id);
  }

  function deleteSlide(id: string) {
    setSlides((prev) => prev.filter((s) => s.id !== id));
    if (activeSlide === id && slides.length > 1) {
      setActiveSlide(slides[slides.length - 2]?.id ?? slides[0]?.id ?? "");
    }
  }

  const current = slides.find((s) => s.id === activeSlide);

  return (
    <div className="flex h-screen">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2 dark:border-border-dark">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={addSlide}>
              <Plus className="mr-1 h-4 w-4" /> Add Slide
            </Button>
            <Button variant="ghost" size="icon">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => deleteSlide(activeSlide)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <Eye className="mr-1 h-4 w-4" /> Present
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
              <Bot className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-48 overflow-y-auto border-r border-border p-2 dark:border-border-dark">
            {slides.map((slide, i) => (
              <button
                type="button"
                key={slide.id}
                onClick={() => setActiveSlide(slide.id)}
                className={`mb-2 w-full rounded-lg border p-3 text-left text-xs transition-colors ${
                  activeSlide === slide.id
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                    : "border-border dark:border-border-dark"
                }`}
              >
                <div className="mb-1 h-16 rounded bg-white dark:bg-surface-dark" />
                <p className="truncate font-medium">{slide.title}</p>
                <p className="truncate text-gray-400">Slide {i + 1}</p>
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto bg-surface-secondary p-8 dark:bg-surface-dark-secondary">
            <div className="mx-auto aspect-video rounded-2xl bg-white p-12 shadow-lg dark:bg-surface-dark">
              <input
                className="mb-4 w-full text-3xl font-bold outline-none"
                value={current?.title ?? ""}
                onChange={(e) =>
                  setSlides((prev) =>
                    prev.map((s) => (s.id === activeSlide ? { ...s, title: e.target.value } : s)),
                  )
                }
                placeholder="Slide title"
              />
              <textarea
                className="w-full resize-none text-lg outline-none"
                rows={10}
                value={current?.content ?? ""}
                onChange={(e) =>
                  setSlides((prev) =>
                    prev.map((s) => (s.id === activeSlide ? { ...s, content: e.target.value } : s)),
                  )
                }
                placeholder="Slide content"
              />
            </div>
          </div>
        </div>
      </div>
      <AISidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(false)}
        appContext="nSlides Presentation"
      />
    </div>
  );
}
