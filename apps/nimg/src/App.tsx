import { useState, useRef, useEffect } from "react";
import { useTheme, AISidebar, Button } from "@noffice/ui-core";
import { Application, Graphics } from "pixi.js";
import {
  Brush, Eraser, Square, Circle, Type, Pipette, Droplets, Blend, Layers, Bot, Undo, Redo,
} from "lucide-react";

const TOOLS = [
  { id: "brush", icon: Brush, label: "Brush" },
  { id: "eraser", icon: Eraser, label: "Eraser" },
  { id: "rect", icon: Square, label: "Rectangle" },
  { id: "circle", icon: Circle, label: "Circle" },
  { id: "text", icon: Type, label: "Text" },
  { id: "eyedropper", icon: Pipette, label: "Eyedropper" },
  { id: "fill", icon: Droplets, label: "Fill" },
  { id: "blur", icon: Blend, label: "Blur" },
  { id: "clone", icon: Layers, label: "Clone Stamp" },
  { id: "gradient", icon: Droplets, label: "Gradient" },
];

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTool, setActiveTool] = useState("brush");
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  useTheme();

  useEffect(() => {
    if (!canvasRef.current || appRef.current) return;
    const app = new Application();
    appRef.current = app;

    async function init() {
      await app.init({
        resizeTo: canvasRef.current!,
        background: "#ffffff",
        antialias: true,
      });
      canvasRef.current!.appendChild(app.canvas);

      const bg = new Graphics();
      bg.beginFill(0xffffff);
      bg.drawRect(0, 0, app.screen.width, app.screen.height);
      bg.endFill();
      app.stage.addChild(bg);

      const drawLayer = new Graphics();
      drawLayer.eventMode = "static";
      drawLayer.cursor = "crosshair";
      app.stage.addChild(drawLayer);

      let isDrawing = false;
      drawLayer.on("pointerdown", () => { isDrawing = true; });
      drawLayer.on("pointerup", () => { isDrawing = false; });
      drawLayer.on("pointermove", (e) => {
        if (!isDrawing) return;
        drawLayer.lineStyle(2, 0x000000, 1);
        drawLayer.moveTo(e.global.x, e.global.y);
        // Draw would go here
      });
    }
    init();

    return () => { app.destroy(true); appRef.current = null; };
  }, []);

  return (
    <div className="flex h-screen">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2 dark:border-border-dark">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon"><Undo className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon"><Redo className="h-4 w-4" /></Button>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Bot className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex w-14 flex-col items-center gap-1 border-r border-border py-2 dark:border-border-dark">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
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
          <div ref={canvasRef} className="flex-1 overflow-hidden" />
        </div>
      </div>
      <AISidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(false)} appContext="nImg Image Editor" />
    </div>
  );
}
