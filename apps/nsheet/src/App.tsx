import { useState, useRef, useEffect } from "react";
import { useTheme, AISidebar, Button } from "@noffice/ui-core";
import { Application, Container, Text as PixiText, Graphics } from "pixi.js";
import { Undo, Redo, Plus, Bot } from "lucide-react";

const COLS = 26;
const ROWS = 100;
const CELL_W = 100;
const CELL_H = 28;
const HEADER_W = 50;
const HEADER_H = 28;

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      canvasRef.current!.appendChild(app.canvas);

      const gridContainer = new Container();
      app.stage.addChild(gridContainer);

      const gridGraphics = new Graphics();
      gridContainer.addChild(gridGraphics);

      function drawGrid() {
        gridGraphics.clear();
        gridGraphics.lineStyle(1, 0xdee2e6, 1);

        for (let c = 0; c <= COLS; c++) {
          const x = HEADER_W + c * CELL_W;
          gridGraphics.moveTo(x, HEADER_H);
          gridGraphics.lineTo(x, HEADER_H + ROWS * CELL_H);
        }
        for (let r = 0; r <= ROWS; r++) {
          const y = HEADER_H + r * CELL_H;
          gridGraphics.moveTo(HEADER_W, y);
          gridGraphics.lineTo(HEADER_W + COLS * CELL_W, y);
        }

        for (let c = 0; c < COLS; c++) {
          const label = String.fromCharCode(65 + c);
          const header = new PixiText({
            text: label,
            style: { fontSize: 11, fill: 0x495057, fontFamily: "Inter" },
          });
          header.x = HEADER_W + c * CELL_W + 4;
          header.y = 4;
          gridContainer.addChild(header);
        }
        for (let r = 0; r < ROWS; r++) {
          const header = new PixiText({
            text: String(r + 1),
            style: { fontSize: 11, fill: 0x495057, fontFamily: "Inter" },
          });
          header.x = 4;
          header.y = HEADER_H + r * CELL_H + 4;
          gridContainer.addChild(header);
        }
      }

      drawGrid();
      app.stage.addChild(gridContainer);
    }
    init();

    return () => {
      app.destroy(true);
      appRef.current = null;
    };
  }, []);

  return (
    <div className="flex h-screen">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 dark:border-border-dark">
          <Button variant="ghost" size="icon"><Undo className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon"><Redo className="h-4 w-4" /></Button>
          <div className="mx-2 h-6 w-px bg-border dark:bg-border-dark" />
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1 text-sm dark:border-border-dark dark:bg-surface-dark">
            <span className="font-medium text-brand-600">fx</span>
            <input className="flex-1 bg-transparent outline-none" placeholder="Enter value or formula..." />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <Plus className="mr-1 h-3 w-3" /> Sheet 1
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
              <Bot className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div ref={canvasRef} className="flex-1 overflow-hidden" />
      </div>
      <AISidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(false)} appContext="nSheet Spreadsheet" />
    </div>
  );
}
