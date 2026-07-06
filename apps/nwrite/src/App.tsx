import { useState } from "react";
import { useTheme, AISidebar } from "@noffice/ui-core";
import { EditorCanvas } from "./components/EditorCanvas";
import { Toolbar } from "./components/Toolbar";

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useTheme();

  return (
    <div className="flex h-screen">
      <div className="flex flex-1 flex-col overflow-hidden">
        <Toolbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <EditorCanvas />
      </div>
      <AISidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(false)}
        appContext="nWrite Document"
      />
    </div>
  );
}
