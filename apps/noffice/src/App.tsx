import { AppId } from "@noffice/shared";
import { useTheme } from "@noffice/ui-core";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import { SettingsPage } from "./pages/SettingsPage";

type Page = "launcher" | "settings";

export function App() {
  const [page, setPage] = useState<Page>("launcher");
  const [activeApp, setActiveApp] = useState<AppId>(AppId.NWrite);
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;
    const unlisten = listen<{ stage: string; progress: number; message: string }>(
      "ai:download:progress",
      () => {},
    );

    function checkAndDownload() {
      invoke("ai_get_model_status")
        .then((models: unknown) => {
          if (cancelled) return;
          const modelList = models as Array<{ name: string; is_loaded: boolean }>;
          if (!(modelList.length > 0 && modelList[0]?.is_loaded)) {
            invoke("ai_download_model").catch(() => {});
          }
        })
        .catch(() => {});
    }

    checkAndDownload();

    return () => {
      cancelled = true;
      unlisten.then((f) => f());
    };
  }, []);

  return (
    <div className="flex h-screen flex-col bg-surface text-black dark:bg-surface-dark dark:text-white">
      {page === "launcher" ? (
        <AppShell
          activeApp={activeApp}
          onSelectApp={setActiveApp}
          aiSidebarOpen={aiSidebarOpen}
          onToggleAi={() => setAiSidebarOpen((prev) => !prev)}
          onOpenSettings={() => setPage("settings")}
          theme={theme}
          onSetTheme={setTheme}
        />
      ) : (
        <SettingsPage onBack={() => setPage("launcher")} />
      )}
    </div>
  );
}
