import type { ThemeOption } from "@noffice/shared";
import { AppId, APPS } from "@noffice/shared";
import { AISidebar } from "@noffice/ui-core";
import { useCallback, useEffect, useRef } from "react";
import { SidebarDock } from "./SidebarDock";

interface AppShellProps {
  activeApp: AppId;
  onSelectApp: (app: AppId) => void;
  aiSidebarOpen: boolean;
  onToggleAi: () => void;
  onOpenSettings: () => void;
  theme: ThemeOption;
  onSetTheme: (t: ThemeOption) => void;
}

const SUB_APP_PORTS: Record<string, number> = {
  nwrite: 5180,
  nsheet: 5181,
  nslides: 5182,
  nimg: 5183,
  ncode: 5184,
};

export function AppShell({
  activeApp,
  onSelectApp,
  aiSidebarOpen,
  onToggleAi,
  onOpenSettings,
  theme,
  onSetTheme,
}: AppShellProps) {
  const app = APPS[activeApp];
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const iframeSrc = import.meta.env.DEV
    ? `http://localhost:${SUB_APP_PORTS[activeApp]}/${activeApp}/`
    : `./${activeApp}/`;

  const sendMessageToIframe = useCallback(
    (type: string, value: unknown) => {
      iframeRef.current?.contentWindow?.postMessage({ type, value }, "*");
    },
    [],
  );

  useEffect(() => {
    sendMessageToIframe("theme", theme);
  }, [theme, sendMessageToIframe]);

  useEffect(() => {
    sendMessageToIframe("ai-toggle", aiSidebarOpen);
  }, [aiSidebarOpen, sendMessageToIframe]);

  return (
    <div className="flex h-full w-full">
      <SidebarDock
        activeApp={activeApp}
        onSelectApp={onSelectApp}
        onOpenSettings={onOpenSettings}
        aiSidebarOpen={aiSidebarOpen}
        onToggleAi={onToggleAi}
        theme={theme}
        onSetTheme={onSetTheme}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-border px-4 py-2 dark:border-border-dark">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-black dark:text-white">
              {app.name}
            </span>
            <span className="text-xs text-gray-400">&mdash;</span>
            <span className="text-xs text-gray-500">Untitled</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{app.description}</span>
          </div>
        </header>
        <div className="flex flex-1 overflow-hidden">
          <iframe
            ref={iframeRef}
            key={activeApp}
            src={iframeSrc}
            className="flex-1 border-0 bg-white"
            title={app.name}
          />
          <AISidebar isOpen={aiSidebarOpen} onToggle={onToggleAi} />
        </div>
      </div>
    </div>
  );
}
