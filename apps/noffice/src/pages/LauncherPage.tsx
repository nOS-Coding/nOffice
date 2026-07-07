import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

const APP_ICONS: Record<string, string> = {
  nwrite: "/icons/nwrite.png",
  nsheet: "/icons/nsheet.png",
  nslides: "/icons/nslides.png",
  nimg: "/icons/nimg.png",
  ncode: "/icons/ncode.png",
};

interface LauncherPageProps {
  onOpenSettings: () => void;
}

const APP_TILES = [
  { id: "nwrite", name: "nWrite", desc: "Word processor", icon: APP_ICONS.nwrite, color: "#2b8a3e" },
  { id: "nsheet", name: "nSheet", desc: "Spreadsheet", icon: APP_ICONS.nsheet, color: "#e67700" },
  { id: "nslides", name: "nSlides", desc: "Presentations", icon: APP_ICONS.nslides, color: "#cc5de8" },
  { id: "nimg", name: "nImg", desc: "Image editor", icon: APP_ICONS.nimg, color: "#d6336c" },
  { id: "ncode", name: "nCode", desc: "Code editor", icon: APP_ICONS.ncode, color: "#1971c2" },
  { id: "settings", name: "Settings", desc: "Preferences", icon: null, color: "#495057" },
];

export function LauncherPage({ onOpenSettings }: LauncherPageProps) {
  const [modelStatus, setModelStatus] = useState<string>("checking");
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  useEffect(() => {
    const unlisten = listen<{ stage: string; progress: number; message: string }>("ai:download:progress", (event) => {
      const { stage, progress } = event.payload;
      if (stage === "downloading") {
        setModelStatus("downloading");
        setDownloadProgress(progress);
      } else if (stage === "ready") {
        setModelStatus("ready");
        setDownloadProgress(100);
      }
    });

    invoke("ai_get_model_status")
      .then((models: unknown) => {
        const modelList = models as Array<{ name: string; is_loaded: boolean }>;
        if (modelList.length > 0 && modelList[0]?.is_loaded) {
          setModelStatus("ready");
        } else {
          setModelStatus("downloading");
          setDownloadProgress(0);
          invoke("ai_download_model").catch(() => {});
        }
      })
      .catch(() => setModelStatus("error"));

    return () => { unlisten.then((f) => f()); };
  }, []);

  function openApp(appId: string) {
    if (appId === "settings") {
      onOpenSettings();
      return;
    }
    invoke("open_app_window", { appId });
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center p-8 bg-surface dark:bg-surface-dark">
      <h1 className="mb-2 text-3xl font-bold tracking-tight text-black dark:text-white">nOffice</h1>
      <p className="mb-10 text-sm text-gray-500 dark:text-gray-400">
        AI-powered productivity suite
      </p>

      <div className="grid w-full max-w-lg grid-cols-2 gap-4">
        {APP_TILES.map((tile) => (
          <button
            type="button"
            key={tile.id}
            onClick={() => openApp(tile.id)}
            className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-secondary p-6 transition-all hover:border-brand-500 hover:shadow-lg dark:border-border-dark dark:bg-surface-dark-secondary"
          >
            <div
              className="flex h-14 w-14 items-center justify-center rounded-xl"
              style={{ backgroundColor: tile.color + "20" }}
            >
              {tile.icon ? (
                <img src={tile.icon} alt={tile.name} className="h-8 w-8" />
              ) : (
                <svg className="h-8 w-8 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              )}
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-black dark:text-white">{tile.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{tile.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-8 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className={`h-2 w-2 rounded-full ${
            modelStatus === "ready" ? "bg-green-500" :
            modelStatus === "downloading" ? "bg-brand-500 animate-pulse" :
            modelStatus === "error" ? "bg-red-500" : "bg-gray-400"
          }`} />
          <span className={modelStatus === "ready" ? "text-green-500" : modelStatus === "error" ? "text-red-400" : "text-gray-400"}>
            {modelStatus === "ready" ? "AI Ready" :
             modelStatus === "downloading" ? `Downloading model... ${downloadProgress}%` :
             modelStatus === "error" ? "AI Error" : "Checking..."}
          </span>
        </div>
        {modelStatus === "downloading" && downloadProgress > 0 && (
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-surface-tertiary dark:bg-surface-dark-tertiary">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
