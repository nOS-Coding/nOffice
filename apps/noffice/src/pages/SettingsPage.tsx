import { DEFAULT_SETTINGS, THEME_OPTIONS, type ThemeOption, type UserSettings } from "@noffice/shared";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@noffice/ui-core";
import { invoke } from "@tauri-apps/api/core";
import { ArrowLeft, CheckCircle, ExternalLink, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

const LS_CHECKOUT_URL = "https://holmiumai.lemonsqueezy.com/checkout/buy/576dd66a-d746-4177-a77b-82da16ef77de";

interface SettingsPageProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    invoke("get_config")
      .then((config: unknown) => {
        const c = config as Partial<UserSettings>;
        if (c.theme) setSettings((prev) => ({ ...prev, ...c }));
      })
      .catch(() => {});
  }, []);
  const [licenseInput, setLicenseInput] = useState(settings.licenseKey || "");
  const [validating, setValidating] = useState(false);
  const [licenseError, setLicenseError] = useState("");

  function updateSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    if (key === "theme") {
      const theme = value as ThemeOption;
      localStorage.setItem("noffice-theme", theme);
      const root = document.documentElement;
      root.classList.remove("light", "dark", "sepia", "forest", "ocean", "midnight", "solarized");
      root.classList.add(theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme);
    }
    invoke("set_config", { config: updated }).catch(console.error);
  }

  async function validateLicense() {
    if (!licenseInput.trim()) return;
    setValidating(true);
    setLicenseError("");
    try {
      const res = await fetch("https://api.lemonsqueezy.com/v1/licenses/validate", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ license_key: licenseInput.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        updateSetting("licenseKey", licenseInput.trim());
        updateSetting("licenseValid", true);
        updateSetting("licenseEmail", data.meta?.customer_email || "");
      } else {
        setLicenseError(data.error || "Invalid license key");
        updateSetting("licenseValid", false);
      }
    } catch {
      setLicenseError("Network error — check your connection");
    } finally {
      setValidating(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface p-6 dark:bg-surface-dark">
      <header className="mb-8 flex shrink-0 items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-black dark:text-white">Settings</h1>
      </header>

      <div className="mx-auto w-full max-w-xl space-y-8">
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Appearance</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-black dark:text-white">Theme</span>
              <Select value={settings.theme} onValueChange={(v: ThemeOption) => updateSetting("theme", v)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THEME_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div>
                        <span>{opt.label}</span>
                        <span className="ml-2 text-xs text-gray-400">{opt.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">AI & Models</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-black dark:text-white">AI Features</span>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" checked={settings.aiEnabled} onChange={(e) => updateSetting("aiEnabled", e.target.checked)} className="peer sr-only" />
                <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-brand-600 peer-checked:after:translate-x-full dark:bg-gray-600" />
              </label>
            </div>
            <div className="rounded-xl border border-border bg-surface-secondary p-3 dark:border-border-dark dark:bg-surface-dark-secondary">
              <p className="text-xs text-gray-500 leading-relaxed">
                AI runs entirely on your device using a local language model.
                No internet connection is needed for AI features — your data never leaves your computer.
                The model (Qwen3 8B, ~4.5 GB) will be downloaded once and cached locally.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">License</h2>
          <div className="rounded-xl border border-border bg-surface-secondary p-4 dark:border-border-dark dark:bg-surface-dark-secondary">
            {settings.licenseValid ? (
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 shrink-0 text-green-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">Licensed</p>
                  {settings.licenseEmail && (
                    <p className="text-xs text-gray-500">{settings.licenseEmail}</p>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => updateSetting("licenseValid", false)}>Remove</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Subscribe to unlock all features — AI, cloud sync, and more.
                </p>
                <a href={LS_CHECKOUT_URL} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
                >
                  Subscribe $8/mo <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <div className="border-t border-border pt-3 dark:border-border-dark">
                  <p className="mb-2 text-xs text-gray-500">Already have a license key?</p>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-border-dark dark:bg-surface-dark dark:text-white"
                      placeholder="Enter license key"
                      value={licenseInput}
                      onChange={(e) => setLicenseInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && validateLicense()}
                    />
                    <Button variant="default" size="sm" onClick={validateLicense} disabled={validating || !licenseInput.trim()}>
                      {validating ? "..." : "Verify"}
                    </Button>
                  </div>
                  {licenseError && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-red-500">
                      <XCircle className="h-3.5 w-3.5" /> {licenseError}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Documents</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-black dark:text-white">Auto-save</span>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" checked={settings.autoSave} onChange={(e) => updateSetting("autoSave", e.target.checked)} className="peer sr-only" />
                <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-brand-600 peer-checked:after:translate-x-full dark:bg-gray-600" />
              </label>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-black dark:text-white">Auto-save interval (s)</span>
              <input type="number" value={settings.autoSaveInterval} onChange={(e) => updateSetting("autoSaveInterval", Number(e.target.value))}
                className="w-20 rounded-lg border border-border bg-surface px-3 py-1 text-sm outline-none focus:border-brand-500 dark:border-border-dark dark:bg-surface-dark dark:text-white" min={10} max={300} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
