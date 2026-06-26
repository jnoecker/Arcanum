import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import { saveProjectConfig } from "@/lib/saveConfig";
import { PANEL_MAP } from "@/lib/panelRegistry";
import type { AppConfig } from "@/types/config";
import { Spinner } from "@/components/ui/FormWidgets";
import { UndoRedoButtons } from "@/components/ui/UndoRedoButtons";
import { useToastStore } from "@/stores/toastStore";

// Atmospheric backgrounds are painted at the MainArea level (driven by the
// active panel's island), so this host renders only its own chrome.

import { ClassDesigner } from "./ClassDesigner";
import { RaceDesigner } from "./RaceDesigner";
import { CharacterCreationStudio } from "./CharacterCreationStudio";
import { EquipmentSlotsPanel } from "./panels/EquipmentSlotsPanel";

import { StatsPanel } from "./panels/StatsPanel";
import { AbilityDesigner } from "./AbilityDesigner";
import { StatusEffectDesigner } from "./StatusEffectDesigner";

import { WorldPanel } from "./panels/WorldPanel";
import { ServerConfigStudio } from "./ServerConfigStudio";
import { CommandDesigner } from "./CommandDesigner";
import { CraftingStudio } from "./CraftingStudio";
import { GuildDesigner } from "./GuildDesigner";
import { EmotePresetsPanel } from "./panels/EmotePresetsPanel";
import { HousingPanel } from "./panels/HousingPanel";
import { GuildHallsPanel } from "./panels/GuildHallsPanel";
import { FactionPanel } from "./panels/FactionPanel";
import { PetsPanel } from "./panels/PetsPanel";
import { EnchantingPanel } from "./panels/EnchantingPanel";
import { AkathavaePanel } from "./panels/AkathavaePanel";
import { FlightPanel } from "./panels/FlightPanel";
import { BoatPanel } from "./panels/BoatPanel";
import { WorldEventsPanel } from "./panels/WorldEventsPanel";
import { WeatherEnvironmentPanel } from "./panels/WeatherEnvironmentPanel";
import { CurrenciesPanel } from "./panels/CurrenciesPanel";

import { AchievementDesigner } from "./AchievementDesigner";
import { QuestsStudio } from "./QuestsStudio";
import { SharedAssetsPanel } from "./panels/SharedAssetsPanel";

import { ApiSettingsPanel } from "./panels/ApiSettingsPanel";
import { HubSettingsPanel } from "./panels/HubSettingsPanel";
import { R2SettingsPanel } from "./panels/R2SettingsPanel";
import { RuntimeHandoffStudio } from "./RuntimeHandoffStudio";
import { RawYamlPanel } from "./panels/RawYamlPanel";
import { VersionControlPanel } from "./panels/VersionControlPanel";
import { InfrastructurePanel } from "./panels/InfrastructurePanel";
import { LoreIndexPanel } from "./panels/LoreIndexPanel";

type ConfigPanelProps = { config: AppConfig; onChange: (patch: Partial<AppConfig>) => void };

function renderPanel(panelId: string, props: ConfigPanelProps): ReactNode {
  const { config, onChange } = props;

  switch (panelId) {
    // Characters
    case "classes":
      return <ClassDesigner config={config} onChange={onChange} />;
    case "races":
      return <RaceDesigner config={config} onChange={onChange} />;
    case "creation":
      return <CharacterCreationStudio config={config} onChange={onChange} />;
    case "equipment":
      return <EquipmentSlotsPanel config={config} onChange={onChange} />;

    // Abilities
    case "stats":
      return <StatsPanel config={config} onChange={onChange} />;
    case "abilityDesigner":
      return <AbilityDesigner config={config} onChange={onChange} />;
    case "conditions":
      return <StatusEffectDesigner config={config} onChange={onChange} />;

    // World
    case "progression":
      return <WorldPanel config={config} onChange={onChange} />;
    case "world":
      return <WorldPanel config={config} onChange={onChange} />;
    case "serverConfig":
      return <ServerConfigStudio config={config} onChange={onChange} />;
    case "infrastructure":
      return <InfrastructurePanel config={config} onChange={onChange} />;
    case "commands":
      return <CommandDesigner config={config} onChange={onChange} />;
    case "crafting":
      return <CraftingStudio config={config} onChange={onChange} />;
    case "enchanting":
      return <EnchantingPanel config={config} onChange={onChange} />;
    case "akathavae":
      return <AkathavaePanel config={config} onChange={onChange} />;
    case "flight":
      return <FlightPanel config={config} onChange={onChange} />;
    case "boat":
      return <BoatPanel config={config} onChange={onChange} />;
    case "factions":
      return <FactionPanel />;
    case "guilds":
      return <GuildDesigner config={config} onChange={onChange} />;
    case "emotes":
      return <EmotePresetsPanel config={config} onChange={onChange} />;
    case "housing":
      return <HousingPanel config={config} onChange={onChange} />;
    case "guildHalls":
      return <GuildHallsPanel config={config} onChange={onChange} />;
    case "pets":
      return <PetsPanel config={config} onChange={onChange} />;
    case "worldEvents":
      return <WorldEventsPanel config={config} onChange={onChange} />;
    case "weatherEnvironment":
      return <WeatherEnvironmentPanel config={config} onChange={onChange} />;
    case "currencies":
      return <CurrenciesPanel config={config} onChange={onChange} />;

    // Content
    case "achievements":
      return <AchievementDesigner config={config} onChange={onChange} />;
    case "quests":
      return <QuestsStudio config={config} onChange={onChange} />;
    case "sharedAssets":
      return <SharedAssetsPanel config={config} onChange={onChange} />;

    // Operations
    case "services":
      return <ApiSettingsPanel />;
    case "hubSettings":
      return <HubSettingsPanel />;
    case "r2Settings":
      return <R2SettingsPanel />;
    case "deployment":
      return <RuntimeHandoffStudio />;
    case "rawYaml":
      return <RawYamlPanel config={config} onChange={onChange} />;
    case "versionControl":
      return <VersionControlPanel />;
    case "loreIndex":
      return <LoreIndexPanel />;

    default:
      return <div className="px-6 py-8 text-sm text-text-muted/60">Panel not found: {panelId}</div>;
  }
}

export function ConfigPanelHost({ panelId }: { panelId: string }) {
  const config = useConfigStore((s) => s.config);
  const dirty = useConfigStore((s) => s.dirty);
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const undoConfig = useConfigStore((s) => s.undoConfig);
  const redoConfig = useConfigStore((s) => s.redoConfig);
  const undoDepth = useConfigStore((s) => s.configPast.length);
  const redoDepth = useConfigStore((s) => s.configFuture.length);
  const project = useProjectStore((s) => s.project);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!dirty || !project) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveProjectConfig(project).catch((err) => {
        console.error("Auto-save failed:", err);
      });
    }, 3000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [dirty, project, config]);

  // Flush unsaved config when leaving the worldmaker workspace
  useEffect(() => {
    return () => {
      const { dirty: d } = useConfigStore.getState();
      const p = useProjectStore.getState().project;
      if (d && p) {
        saveProjectConfig(p).catch((err) => {
          console.error("Config flush-on-unmount failed:", err);
        });
      }
    };
  }, []);

  const handleChange = useCallback(
    (patch: Partial<AppConfig>) => {
      const current = useConfigStore.getState().config;
      if (!current) return;
      updateConfig({ ...current, ...patch });
    },
    [updateConfig],
  );

  const handleSave = useCallback(async () => {
    if (!project || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveProjectConfig(project);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }, [project, saving]);

  const def = PANEL_MAP[panelId];

  if (!config) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="ornate-divider" />
        <p className="font-display text-base text-text-muted">The Workbench Awaits</p>
        <p className="max-w-xs text-xs leading-6 text-text-muted/60">Open a world project to begin shaping its rules and systems.</p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className={`mx-auto flex flex-col gap-3 px-4 py-3 ${def?.maxWidth ?? "max-w-5xl"}`}>
          {renderPanel(panelId, { config, onChange: handleChange })}
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 z-30">
        <div className="pointer-events-auto rounded-full border border-[var(--chrome-stroke)] bg-bg-primary/80 px-1 py-0.5 shadow-md backdrop-blur">
          <UndoRedoButtons
            canUndo={undoDepth > 0}
            canRedo={redoDepth > 0}
            undoDepth={undoDepth}
            redoDepth={redoDepth}
            onUndo={() => {
              if (undoDepth > 0) {
                undoConfig();
                useToastStore.getState().show("Change undone");
              }
            }}
            onRedo={() => {
              if (redoDepth > 0) {
                redoConfig();
                useToastStore.getState().show("Change restored");
              }
            }}
          />
        </div>
      </div>
      {(dirty || saving || saveError) && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-30 flex items-center gap-2">
          {saveError && (
            <span
              role="alert"
              className="pointer-events-auto rounded-full border border-status-error/40 bg-bg-primary/80 px-3 py-1 text-2xs text-status-error shadow-md backdrop-blur"
            >
              Save failed
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            aria-label={saving ? "Saving configuration" : "Save configuration"}
            className="focus-ring pointer-events-auto rounded-full border border-accent/40 bg-bg-primary/80 px-3 py-1.5 text-2xs font-medium text-accent shadow-md backdrop-blur transition hover:bg-bg-primary hover:border-accent/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? <span className="flex items-center gap-1.5"><Spinner />Saving</span> : "Save Config"}
          </button>
        </div>
      )}
    </div>
  );
}
