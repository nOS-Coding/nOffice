import { DEFAULT_SETTINGS, type UserSettings } from "@noffice/shared";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@noffice/ui-core";
import { invoke } from "@tauri-apps/api/core";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

interface SettingsPageProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  function updateSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    invoke("set_config", { config: updated }).catch(console.error);
  }

  return (
    <div className="flex h-full flex-col p-8">
      <header className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Settings</h1>
      </header>

      <div className="max-w-xl space-y-6">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Appearance
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Theme</span>
              <Select
                value={settings.theme}
                onValueChange={(v: "light" | "dark" | "system") => updateSetting("theme", v)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Language</span>
              <Select
                value={settings.language}
                onValueChange={(v: string) => updateSetting("language", v)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                  <SelectItem value="ja">Japanese</SelectItem>
                  <SelectItem value="zh">Chinese</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
            AI & Models
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">AI Features</span>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={settings.aiEnabled}
                  onChange={(e) => updateSetting("aiEnabled", e.target.checked)}
                  className="peer sr-only"
                />
                <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-brand-600 peer-checked:after:translate-x-full" />
              </label>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Quantization</span>
              <Select
                value={settings.modelQuantization}
                onValueChange={(v: string) => updateSetting("modelQuantization", v)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Q4_K_M">Q4_K_M (Balanced)</SelectItem>
                  <SelectItem value="Q3_K_S">Q3_K_S (Light)</SelectItem>
                  <SelectItem value="Q5_K_M">Q5_K_M (Quality)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Documents
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Auto-save</span>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={settings.autoSave}
                  onChange={(e) => updateSetting("autoSave", e.target.checked)}
                  className="peer sr-only"
                />
                <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-brand-600 peer-checked:after:translate-x-full" />
              </label>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Auto-save interval (s)</span>
              <input
                type="number"
                value={settings.autoSaveInterval}
                onChange={(e) => updateSetting("autoSaveInterval", Number(e.target.value))}
                className="w-20 rounded-lg border border-border bg-surface px-3 py-1 text-sm dark:border-border-dark dark:bg-surface-dark"
                min={10}
                max={300}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
