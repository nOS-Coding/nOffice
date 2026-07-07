import type { ThemeOption } from "@noffice/shared";
import { AppId, APPS } from "@noffice/shared";
import { cn } from "@noffice/ui-core";
import { Bot, Monitor, Moon, Settings, Sun } from "lucide-react";

const APP_ORDER = [AppId.NWrite, AppId.NSheet, AppId.NSlides, AppId.NImg, AppId.NCode];
const VERSION = "2026.7.0";

interface SidebarDockProps {
  activeApp: AppId;
  onSelectApp: (app: AppId) => void;
  onOpenSettings: () => void;
  aiSidebarOpen: boolean;
  onToggleAi: () => void;
  theme: ThemeOption;
  onSetTheme: (t: ThemeOption) => void;
}

function getThemeIcon(t: ThemeOption) {
  switch (t) {
    case "light": return Sun;
    case "dark": return Moon;
    case "system": return Monitor;
    default: return Monitor;
  }
}

export function SidebarDock({
  activeApp,
  onSelectApp,
  onOpenSettings,
  aiSidebarOpen,
  onToggleAi,
  theme,
  onSetTheme,
}: SidebarDockProps) {
  const ThemeIcon = getThemeIcon(theme);

  function cycleTheme() {
    const order: ThemeOption[] = ["dark", "light", "system"];
    const idx = order.indexOf(theme);
    onSetTheme(order[(idx + 1) % order.length]!);
  }

  return (
    <nav className="flex w-14 flex-col items-center border-r border-border bg-surface-secondary py-3 dark:border-border-dark dark:bg-surface-dark-secondary">
      <div className="flex flex-col items-center gap-2">
        {APP_ORDER.map((appId) => {
          const app = APPS[appId]!;
          const isActive = activeApp === appId;
          return (
            <button
              key={appId}
              onClick={() => onSelectApp(appId)}
              title={app.name}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg transition-all",
                isActive
                  ? "bg-brand-500/20 text-brand-500 ring-1 ring-brand-500/40"
                  : "text-gray-500 hover:bg-surface-tertiary hover:text-gray-700 dark:text-gray-400 dark:hover:bg-surface-dark-tertiary dark:hover:text-gray-200",
              )}
            >
              <img src={`/icons/${appId}.png`} alt={app.name} className="h-5 w-5" />
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex flex-col items-center gap-2">
        <button
          onClick={onOpenSettings}
          title="Settings"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-surface-tertiary hover:text-gray-700 dark:text-gray-400 dark:hover:bg-surface-dark-tertiary dark:hover:text-gray-200"
        >
          <Settings className="h-4 w-4" />
        </button>
        <button
          onClick={onToggleAi}
          title={aiSidebarOpen ? "Close AI" : "Open AI"}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
            aiSidebarOpen
              ? "bg-brand-500/20 text-brand-500"
              : "text-gray-500 hover:bg-surface-tertiary hover:text-gray-700 dark:text-gray-400 dark:hover:bg-surface-dark-tertiary dark:hover:text-gray-200",
          )}
        >
          <Bot className="h-4 w-4" />
        </button>
        <button
          onClick={cycleTheme}
          title={`Theme: ${theme}`}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-surface-tertiary hover:text-gray-700 dark:text-gray-400 dark:hover:bg-surface-dark-tertiary dark:hover:text-gray-200"
        >
          <ThemeIcon className="h-4 w-4" />
        </button>
        <div className="mt-2 flex h-9 w-9 items-center justify-center">
          <span
            className="select-none text-[9px] font-medium text-gray-400"
            title={`v${VERSION}`}
          >
            v{VERSION.split(".").slice(0, 2).join(".")}
          </span>
        </div>
      </div>
    </nav>
  );
}
