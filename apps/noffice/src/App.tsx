import { useState } from "react";
import { useTheme } from "@noffice/ui-core";
import { LauncherPage } from "./pages/LauncherPage";
import { SettingsPage } from "./pages/SettingsPage";

type Page = "launcher" | "settings";

export function App() {
  const [page, setPage] = useState<Page>("launcher");
  useTheme();

  return (
    <div className="flex h-screen flex-col bg-surface text-black dark:bg-surface-dark dark:text-white">
      {page === "launcher" && <LauncherPage onOpenSettings={() => setPage("settings")} />}
      {page === "settings" && <SettingsPage onBack={() => setPage("launcher")} />}
    </div>
  );
}
