"use client";

import { useState, useEffect } from "react";
import type { AppSettings } from "@/lib/types";
import { CheckIcon, SunIcon, MoonIcon } from "@/components/icons";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({
    theme: "light",
    autoSave: true,
    logLevel: "normal",
  });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [resetConfirm, setResetConfirm] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(updates?: Partial<AppSettings>) {
    setSaveError("");
    const newSettings = updates ? { ...settings, ...updates } : settings;
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: newSettings }),
      });
      if (res.ok) {
        if (updates) setSettings(newSettings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setSaveError("Failed to save settings");
      }
    } catch {
      setSaveError("Failed to save settings");
    }
  }

  function handleToggle(field: keyof AppSettings, value: boolean) {
    const newSettings = { ...settings, [field]: value };
    setSettings(newSettings);
    if (settings.autoSave || field === "autoSave") {
      handleSave({ [field]: value });
    }
  }

  async function handleReset() {
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: { theme: "light", autoSave: true, logLevel: "normal" },
        }),
      });
      setSettings({ theme: "light", autoSave: true, logLevel: "normal" });
      setResetConfirm(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError("Failed to reset settings");
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-3xl">
        <p className="text-text-secondary text-sm">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-text">Settings</h2>
        <p className="text-text-secondary text-sm mt-1">Configure Mission Control</p>
      </div>

      {saved && (
        <div className="mb-4 px-3 py-2 bg-success/10 border border-success/20 rounded-md text-sm text-success flex items-center gap-2">
          <CheckIcon /> Settings saved
        </div>
      )}
      {saveError && (
        <div className="mb-4 px-3 py-2 bg-danger/10 border border-danger/20 rounded-md text-sm text-danger">
          {saveError}
        </div>
      )}

      <div className="space-y-5">
        {/* Appearance */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <h3 className="text-sm font-medium text-text mb-4">Appearance</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text">Theme</p>
                <p className="text-xs text-text-muted mt-0.5">Switch between light and dark mode</p>
              </div>
              <div className="flex items-center gap-1 bg-background border border-border rounded-md p-0.5">
                <button
                  onClick={() => {
                    const newSettings = { ...settings, theme: "light" as const };
                    setSettings(newSettings);
                    document.documentElement.setAttribute("data-theme", "light");
                    handleSave({ theme: "light" });
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-sm transition-colors ${
                    settings.theme === "light"
                      ? "bg-surface text-text shadow-sm"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  <SunIcon />
                  Light
                </button>
                <button
                  onClick={() => {
                    const newSettings = { ...settings, theme: "dark" as const };
                    setSettings(newSettings);
                    document.documentElement.setAttribute("data-theme", "dark");
                    handleSave({ theme: "dark" });
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-sm transition-colors ${
                    settings.theme === "dark"
                      ? "bg-surface text-text shadow-sm"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  <MoonIcon />
                  Dark
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Behavior */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <h3 className="text-sm font-medium text-text mb-4">Behavior</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text">Auto-save</p>
                <p className="text-xs text-text-muted mt-0.5">
                  Automatically save changes as you make them
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoSave}
                  onChange={(e) => handleToggle("autoSave", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-background border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-muted after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent peer-checked:border-accent peer-checked:after:bg-white" />
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text">Log Level</p>
                <p className="text-xs text-text-muted mt-0.5">Verbose logs capture more detail</p>
              </div>
              <select
                value={settings.logLevel}
                onChange={(e) => {
                  const val = e.target.value as "verbose" | "normal";
                  if (settings.autoSave) {
                    handleSave({ logLevel: val });
                  } else {
                    setSettings({ ...settings, logLevel: val });
                  }
                }}
                onBlur={() => {
                  if (!settings.autoSave) handleSave();
                }}
                className="bg-background border border-border rounded-md px-3 py-1.5 text-sm text-text focus:border-accent transition-colors"
              >
                <option value="normal">Normal</option>
                <option value="verbose">Verbose</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <h3 className="text-sm font-medium text-text mb-4">Data</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text">Reset Settings</p>
                <p className="text-xs text-text-muted mt-0.5">
                  Restore all settings to their default values
                </p>
              </div>
              {resetConfirm ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReset}
                    className="px-3 py-1.5 text-xs rounded bg-danger/15 text-danger hover:bg-danger/25 transition-colors"
                  >
                    Confirm Reset
                  </button>
                  <button
                    onClick={() => setResetConfirm(false)}
                    className="px-3 py-1.5 text-xs rounded bg-surface-hover text-text-secondary hover:bg-border transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setResetConfirm(true)}
                  className="px-3 py-1.5 text-xs rounded bg-surface-hover text-text-secondary hover:bg-border hover:text-danger transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* About */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <h3 className="text-sm font-medium text-text mb-4">About</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Version</span>
              <span className="text-text">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Built with</span>
              <span className="text-text">Next.js + Tailwind</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">For</span>
              <span className="text-text">Misko & Marko</span>
            </div>
          </div>
        </div>

        {/* Save button — only shown when auto-save is off */}
        {!settings.autoSave && (
          <button
            onClick={() => handleSave()}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded-md transition-colors"
          >
            Save Settings
          </button>
        )}
      </div>
    </div>
  );
}

