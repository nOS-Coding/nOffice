import { AppId, APPS } from "@noffice/shared";

interface LauncherPageProps {
  activeApp: AppId | null;
  onSelectApp: (app: AppId) => void;
  onOpenSettings: () => void;
}

const APP_TILES = Object.values(APPS).filter((a) => a.id !== AppId.Launcher);

export function LauncherPage({ onSelectApp, onOpenSettings }: LauncherPageProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      <h1 className="mb-2 text-3xl font-bold tracking-tight text-black dark:text-white">
        nOffice
      </h1>
      <p className="mb-10 text-sm text-gray-500 dark:text-gray-400">
        AI-powered productivity suite
      </p>

      <div className="grid w-full max-w-lg grid-cols-2 gap-4">
        {APP_TILES.map((tile) => (
          <button
            type="button"
            key={tile.id}
            onClick={() => onSelectApp(tile.id as AppId)}
            className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-secondary p-6 transition-all hover:border-brand-500 hover:shadow-lg dark:border-border-dark dark:bg-surface-dark-secondary"
          >
            <div
              className="flex h-14 w-14 items-center justify-center rounded-xl"
              style={{ backgroundColor: tile.color + "20" }}
            >
              <img src={`/icons/${tile.id}.png`} alt={tile.name} className="h-8 w-8" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-black dark:text-white">
                {tile.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {tile.description}
              </p>
            </div>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onOpenSettings}
        className="mt-8 flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
        Settings
      </button>
    </div>
  );
}
