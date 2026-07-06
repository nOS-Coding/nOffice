import { APPS, type AppDefinition, AppId } from "@noffice/shared";
import { Button } from "@noffice/ui-core";
import { invoke } from "@tauri-apps/api/core";
import { Download, FileText, Settings } from "lucide-react";
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

const APP_TILES: AppDefinition[] = [
  APPS[AppId.NWrite],
  APPS[AppId.NSheet],
  APPS[AppId.NSlides],
  APPS[AppId.NImg],
  APPS[AppId.NCode],
];

export function LauncherPage({ onOpenSettings }: LauncherPageProps) {
  const [modelStatus, setModelStatus] = useState<string>("checking");
  const [recentDocs, setRecentDocs] = useState<Array<{ name: string; app_id: string }>>([]);

  useEffect(() => {
    invoke("ai_get_model_status")
      .then((models: unknown) => {
        const modelList = models as Array<{ name: string; is_loaded: boolean }>;
        if (modelList.length > 0 && modelList[0]?.is_loaded) {
          setModelStatus("ready");
        } else if (modelList.length > 0) {
          setModelStatus("loaded");
        } else {
          setModelStatus("no-model");
        }
      })
      .catch(() => setModelStatus("error"));

    invoke("get_recent_documents")
      .then((docs: unknown) => {
        setRecentDocs((docs as Array<{ name: string; app_id: string }>).slice(0, 6));
      })
      .catch(() => {});
  }, []);

  function openApp(app: AppDefinition) {
    invoke("open_app_window", { appId: app.id });
  }

  function downloadModel() {
    invoke("ai_download_model");
    setModelStatus("downloading");
  }

  return (
    <div className="flex h-full flex-col p-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">nOffice</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            AI-powered productivity suite
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                modelStatus === "ready"
                  ? "bg-green-500"
                  : modelStatus === "downloading"
                    ? "bg-yellow-500 animate-pulse"
                    : "bg-gray-400"
              }`}
            />
            {modelStatus === "ready"
              ? "AI Ready"
              : modelStatus === "no-model"
                ? "No Model"
                : modelStatus === "downloading"
                  ? "Downloading..."
                  : modelStatus}
          </span>
          <Button variant="ghost" size="icon" onClick={onOpenSettings}>
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-5 gap-4">
        {APP_TILES.map((app) => (
          <button
            type="button"
            key={app.id}
            onClick={() => openApp(app)}
            className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-secondary p-6 transition-all hover:border-brand-500 hover:shadow-lg dark:border-border-dark dark:bg-surface-dark-secondary"
          >
            <div className="flex h-16 w-16 items-center justify-center">
              <img src={APP_ICONS[app.id]} alt={app.name} className="h-16 w-16" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold">{app.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{app.description}</p>
            </div>
          </button>
        ))}
      </div>

      {modelStatus === "no-model" && (
        <div className="mb-6 rounded-xl border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-900/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                AI model not installed
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                Download Qwen3 8B (Q4_K_M, ~4.5GB) for local AI features
              </p>
            </div>
            <Button variant="default" size="sm" onClick={downloadModel}>
              <Download className="mr-1 h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      )}

      {recentDocs.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Recent Documents
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {recentDocs.map((doc, i) => (
              <div
                key={`${doc.name}-${i}`}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-sm hover:bg-surface-secondary dark:border-border-dark dark:hover:bg-surface-dark-secondary"
              >
                <FileText className="h-4 w-4 text-gray-400" />
                <span className="truncate">{doc.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
