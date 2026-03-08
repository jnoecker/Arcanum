import { useState, useCallback } from "react";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import { saveConfig } from "@/lib/saveConfig";
import type { AppConfig } from "@/types/config";
import configBg from "@/assets/config-bg.png";
import toolbarBg from "@/assets/toolbar-bg.jpg";
import { ServerPanel } from "./panels/ServerPanel";
import { CombatPanel } from "./panels/CombatPanel";
import { MobTiersPanel } from "./panels/MobTiersPanel";
import { ProgressionPanel } from "./panels/ProgressionPanel";
import { EconomyPanel } from "./panels/EconomyPanel";
import { RegenPanel } from "./panels/RegenPanel";
import { CraftingPanel } from "./panels/CraftingPanel";
import { GroupPanel } from "./panels/GroupPanel";
import { StatsPanel } from "./panels/StatsPanel";
import { AbilitiesPanel } from "./panels/AbilitiesPanel";
import { StatusEffectsPanel } from "./panels/StatusEffectsPanel";
import { RawYamlPanel } from "./panels/RawYamlPanel";
import { ClassesPanel } from "./panels/ClassesPanel";
import { RacesPanel } from "./panels/RacesPanel";
import { EquipmentSlotsPanel } from "./panels/EquipmentSlotsPanel";
import { CharacterCreationPanel } from "./panels/CharacterCreationPanel";
import { AchievementsPanel } from "./panels/AchievementsPanel";
import { QuestsPanel } from "./panels/QuestsPanel";
import { ImagesPanel } from "./panels/ImagesPanel";
import { ApiSettingsPanel } from "./panels/ApiSettingsPanel";

const CONFIG_TABS = [
  { id: "server", label: "Server" },
  { id: "stats", label: "Stats" },
  { id: "classes", label: "Classes" },
  { id: "races", label: "Races" },
  { id: "equipmentSlots", label: "Equipment" },
  { id: "abilities", label: "Abilities" },
  { id: "statusEffects", label: "Status FX" },
  { id: "combat", label: "Combat" },
  { id: "mobTiers", label: "Mob Tiers" },
  { id: "progression", label: "Progression" },
  { id: "economy", label: "Economy" },
  { id: "regen", label: "Regen" },
  { id: "crafting", label: "Crafting" },
  { id: "group", label: "Group" },
  { id: "charCreate", label: "Char Create" },
  { id: "achievements", label: "Achievements" },
  { id: "quests", label: "Quests" },
  { id: "images", label: "Images" },
  { id: "rawYaml", label: "Raw YAML" },
  { id: "apiSettings", label: "API Settings" },
] as const;

export function ConfigEditor() {
  const config = useConfigStore((s) => s.config);
  const dirty = useConfigStore((s) => s.dirty);
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const mudDir = useProjectStore((s) => s.project?.mudDir);
  const activeTab = useProjectStore((s) => s.configSubTab);
  const setActiveTab = useProjectStore((s) => s.setConfigSubTab);
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

  if (!config) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-muted">
        No config loaded
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Tab bar + save */}
      <div className="relative flex shrink-0 items-center overflow-hidden border-b border-border-default bg-bg-secondary">
        <img src={toolbarBg} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.10]" />
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
        {activeTab !== "apiSettings" && (
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
        )}
      </div>

      {/* Panel content */}
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {/* Background image — sticky so it stays visible while scrolling */}
        <div className="pointer-events-none sticky top-0 z-0 -mb-[100vh] h-[100vh] w-full overflow-hidden">
          <img
            src={configBg}
            alt=""
            className="h-full w-full object-cover opacity-[0.14]"
            style={{ objectPosition: "center 40%" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/60 to-transparent" />
        </div>
        <div className={`relative z-10 mx-auto px-6 py-4 ${activeTab === "equipmentSlots" ? "max-w-5xl" : "max-w-2xl"}`}>
          {activeTab === "server" && (
            <ServerPanel config={config} onChange={handleChange} />
          )}
          {activeTab === "stats" && (
            <StatsPanel config={config} onChange={handleChange} />
          )}
          {activeTab === "classes" && (
            <ClassesPanel config={config} onChange={handleChange} />
          )}
          {activeTab === "races" && (
            <RacesPanel config={config} onChange={handleChange} />
          )}
          {activeTab === "equipmentSlots" && (
            <EquipmentSlotsPanel config={config} onChange={handleChange} />
          )}
          {activeTab === "abilities" && (
            <AbilitiesPanel config={config} onChange={handleChange} />
          )}
          {activeTab === "statusEffects" && (
            <StatusEffectsPanel config={config} onChange={handleChange} />
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
          {activeTab === "charCreate" && (
            <CharacterCreationPanel config={config} onChange={handleChange} />
          )}
          {activeTab === "achievements" && (
            <AchievementsPanel config={config} onChange={handleChange} />
          )}
          {activeTab === "quests" && (
            <QuestsPanel config={config} onChange={handleChange} />
          )}
          {activeTab === "images" && (
            <ImagesPanel config={config} onChange={handleChange} />
          )}
          {activeTab === "rawYaml" && (
            <RawYamlPanel config={config} onChange={handleChange} />
          )}
          {activeTab === "apiSettings" && <ApiSettingsPanel />}
        </div>
      </div>
    </div>
  );
}
