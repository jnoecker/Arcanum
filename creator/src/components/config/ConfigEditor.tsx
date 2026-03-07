import { useState, useCallback, useEffect } from "react";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import { saveConfig } from "@/lib/saveConfig";
import type { AppConfig } from "@/types/config";
import { ServerPanel } from "./panels/ServerPanel";
import { CombatPanel } from "./panels/CombatPanel";
import { MobTiersPanel } from "./panels/MobTiersPanel";
import { ProgressionPanel } from "./panels/ProgressionPanel";
import { EconomyPanel } from "./panels/EconomyPanel";
import { RegenPanel } from "./panels/RegenPanel";
import { CraftingPanel } from "./panels/CraftingPanel";
import { GroupPanel } from "./panels/GroupPanel";

const CONFIG_TABS = [
  { id: "server", label: "Server" },
  { id: "combat", label: "Combat" },
  { id: "mobTiers", label: "Mob Tiers" },
  { id: "progression", label: "Progression" },
  { id: "economy", label: "Economy" },
  { id: "regen", label: "Regen" },
  { id: "crafting", label: "Crafting" },
  { id: "group", label: "Group" },
] as const;

type ConfigTabId = (typeof CONFIG_TABS)[number]["id"];

export function ConfigEditor() {
  const config = useConfigStore((s) => s.config);
  const dirty = useConfigStore((s) => s.dirty);
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const mudDir = useProjectStore((s) => s.project?.mudDir);
  const [activeTab, setActiveTab] = useState<ConfigTabId>("server");
  const [saving, setSaving] = useState(false);

  const handleChange = useCallback(
    (patch: Partial<AppConfig>) => {
      if (!config) return;
      updateConfig({ ...config, ...patch });
    },
    [config, updateConfig],
  );

  const handleSave = useCallback(async () => {
    if (!mudDir || saving) return;
    setSaving(true);
    try {
      await saveConfig(mudDir);
    } catch (err) {
      console.error("Config save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [mudDir, saving]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  if (!config) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-muted">
        No config loaded
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Tab bar + save */}
      <div className="flex shrink-0 items-center border-b border-border-default bg-bg-secondary">
        <div className="flex items-end gap-0 overflow-x-auto">
          {CONFIG_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-xs transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 border-b-accent text-text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 px-3">
          {dirty && (
            <span className="text-xs text-accent">modified</span>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="h-6 rounded px-2 text-xs transition-colors enabled:bg-accent/20 enabled:text-accent enabled:hover:bg-accent/30 disabled:text-text-muted disabled:opacity-30"
          >
            {saving ? "Saving..." : "Save Config"}
          </button>
        </div>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-4">
          {activeTab === "server" && (
            <ServerPanel config={config} onChange={handleChange} />
          )}
          {activeTab === "combat" && (
            <CombatPanel config={config} onChange={handleChange} />
          )}
          {activeTab === "mobTiers" && (
            <MobTiersPanel config={config} onChange={handleChange} />
          )}
          {activeTab === "progression" && (
            <ProgressionPanel config={config} onChange={handleChange} />
          )}
          {activeTab === "economy" && (
            <EconomyPanel config={config} onChange={handleChange} />
          )}
          {activeTab === "regen" && (
            <RegenPanel config={config} onChange={handleChange} />
          )}
          {activeTab === "crafting" && (
            <CraftingPanel config={config} onChange={handleChange} />
          )}
          {activeTab === "group" && (
            <GroupPanel config={config} onChange={handleChange} />
          )}
        </div>
      </div>
    </div>
  );
}
