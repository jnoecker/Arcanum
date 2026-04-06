import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import { saveProjectConfig } from "@/lib/saveConfig";
import { PANEL_MAP } from "@/lib/panelRegistry";
import type { AppConfig } from "@/types/config";
import { Spinner } from "@/components/ui/FormWidgets";
import configBg from "@/assets/config-bg.png";

import { ClassDesigner } from "./ClassDesigner";
import { RaceDesigner } from "./RaceDesigner";
import { CharacterCreationStudio } from "./CharacterCreationStudio";
import { EquipmentSlotsPanel } from "./panels/EquipmentSlotsPanel";
import { ImagesPanel } from "./panels/ImagesPanel";
import { PlayerTiersPanel } from "./panels/PlayerTiersPanel";

import { StatsPanel } from "./panels/StatsPanel";
import { AbilityDesigner } from "./AbilityDesigner";
import { StatusEffectDesigner } from "./StatusEffectDesigner";

import { WorldPanel } from "./panels/WorldPanel";
import { ServerPanel } from "./panels/ServerPanel";
import { AdminConfigPanel } from "./panels/AdminConfigPanel";
import { ObservabilityPanel } from "./panels/ObservabilityPanel";
import { LoggingPanel } from "./panels/LoggingPanel";
import { CommandDesigner } from "./CommandDesigner";
import { CraftingStudio } from "./CraftingStudio";
import { GuildDesigner } from "./GuildDesigner";
import { EmotePresetsPanel } from "./panels/EmotePresetsPanel";
import { HousingPanel } from "./panels/HousingPanel";
import { GuildHallsPanel } from "./panels/GuildHallsPanel";
import { FactionPanel } from "./panels/FactionPanel";
import { PetsPanel } from "./panels/PetsPanel";
import { EnchantingPanel } from "./panels/EnchantingPanel";
import { WorldEventsPanel } from "./panels/WorldEventsPanel";
import { CurrenciesPanel } from "./panels/CurrenciesPanel";

import { AchievementDesigner } from "./AchievementDesigner";
import { AchievementDefEditor } from "./AchievementDefEditor";
import { QuestTaxonomyDesigner } from "./QuestTaxonomyDesigner";
import { GlobalAssetsPanel } from "./panels/GlobalAssetsPanel";

import { ApiSettingsPanel } from "./panels/ApiSettingsPanel";
import { RuntimeHandoffStudio } from "./RuntimeHandoffStudio";
import { RawYamlPanel } from "./panels/RawYamlPanel";
import { VersionControlPanel } from "./panels/VersionControlPanel";

function Section({
  kicker,
  title,
  description,
  children,
}: {
  kicker: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="panel-surface rounded-3xl p-5 shadow-section">
      <div className="mb-3">
        <p className="border-l-2 border-[rgba(140,174,201,0.3)] pl-2 text-2xs uppercase tracking-wide-ui text-text-muted">{kicker}</p>
        <h3 className="mt-2 font-display font-semibold text-xl text-text-primary">{title}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

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
    case "characterSprites":
      return (
        <div className="flex flex-col gap-6">
          <ImagesPanel config={config} onChange={onChange} />
          <PlayerTiersPanel config={config} onChange={onChange} />
        </div>
      );

    // Abilities
    case "stats":
      return <StatsPanel config={config} onChange={onChange} />;
    case "abilityDesigner":
      return <AbilityDesigner config={config} onChange={onChange} />;
    case "conditions":
      return <StatusEffectDesigner config={config} onChange={onChange} />;

    // World
    case "worldServer":
      return (
        <>
          <Section kicker="World topology" title="World resources, start rooms, and spawn rules" description="Global world references and namespaced start rooms.">
            <WorldPanel config={config} onChange={onChange} />
          </Section>
          <Section kicker="Server runtime" title="Ports and server process behavior" description="Ports and server process settings.">
            <ServerPanel config={config} onChange={onChange} />
          </Section>
          <Section kicker="Admin server" title="Remote administration API" description="Enable the admin HTTP server for the Arcanum to connect to. Set a token for authentication.">
            <AdminConfigPanel config={config} onChange={onChange} />
          </Section>
          <Section kicker="Observability" title="Metrics and monitoring" description="Prometheus metrics endpoint for server health and performance data.">
            <ObservabilityPanel config={config} onChange={onChange} />
          </Section>
          <Section kicker="Logging" title="Log levels" description="Control the verbosity of server logs. Per-package overrides let you debug specific systems without flooding the console.">
            <LoggingPanel config={config} onChange={onChange} />
          </Section>
        </>
      );
    case "commands":
      return <CommandDesigner config={config} onChange={onChange} />;
    case "crafting":
      return <CraftingStudio config={config} onChange={onChange} />;
    case "enchanting":
      return <EnchantingPanel config={config} onChange={onChange} />;
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
    case "currencies":
      return <CurrenciesPanel config={config} onChange={onChange} />;

    // Content
    case "achievements":
      return <AchievementDesigner config={config} onChange={onChange} />;
    case "achievementDefs":
      return <AchievementDefEditor config={config} onChange={onChange} />;
    case "quests":
      return <QuestTaxonomyDesigner config={config} onChange={onChange} />;
    case "sharedAssets":
      return (
        <div className="flex flex-col gap-6">
          <ImagesPanel config={config} onChange={onChange} />
          <GlobalAssetsPanel config={config} onChange={onChange} />
        </div>
      );

    // Operations
    case "services":
      return <ApiSettingsPanel />;
    case "deployment":
      return <RuntimeHandoffStudio />;
    case "rawYaml":
      return <RawYamlPanel config={config} onChange={onChange} />;
    case "versionControl":
      return <VersionControlPanel />;

    default:
      return <div className="px-6 py-8 text-sm text-text-muted/60">Panel not found: {panelId}</div>;
  }
}

export function ConfigPanelHost({ panelId }: { panelId: string }) {
  const config = useConfigStore((s) => s.config);
  const dirty = useConfigStore((s) => s.dirty);
  const updateConfig = useConfigStore((s) => s.updateConfig);
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
        <p className="font-display text-base text-text-muted">The Workbench Awaits</p>
        <p className="max-w-xs text-xs leading-6 text-text-muted/60">Open a world project to begin shaping its rules and systems.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <img
            src={configBg}
            alt=""
            className="h-full w-full object-cover opacity-[0.10] mix-blend-soft-light"
            style={{ objectPosition: "center 40%" }}
          />
        </div>

        <div className={`relative z-10 mx-auto flex flex-col gap-6 px-6 py-5 ${def?.maxWidth ?? "max-w-5xl"}`}>
          {(dirty || saving || saveError) && (
            <div className="pointer-events-auto sticky top-3 z-20 flex items-center justify-end gap-2">
              {saveError && <span role="alert" className="text-2xs text-status-error">Save failed</span>}
              <button
                onClick={handleSave}
                disabled={!dirty || saving}
                aria-label={saving ? "Saving configuration" : "Save configuration"}
                className="focus-ring rounded-full border border-white/10 bg-bg-primary/80 px-3 py-1 text-2xs font-medium text-accent shadow-md backdrop-blur-sm transition hover:bg-bg-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? <span className="flex items-center gap-1.5"><Spinner />Saving</span> : "Save Config"}
              </button>
            </div>
          )}
          {renderPanel(panelId, { config, onChange: handleChange })}
        </div>
      </div>
    </div>
  );
}
