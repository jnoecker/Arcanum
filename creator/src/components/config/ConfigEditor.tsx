import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import { saveProjectConfig } from "@/lib/saveConfig";
import type { AppConfig } from "@/types/config";
import type { ConfigSubTab } from "@/types/project";
import configBg from "@/assets/config-bg.png";
import subtoolbarBg from "@/assets/subtoolbar-bg.jpg";
import { ServerPanel } from "./panels/ServerPanel";
import { CombatPanel } from "./panels/CombatPanel";
import { MobTiersPanel } from "./panels/MobTiersPanel";
import { ProgressionPanel } from "./panels/ProgressionPanel";
import { EconomyPanel } from "./panels/EconomyPanel";
import { RegenPanel } from "./panels/RegenPanel";
import { StatsPanel } from "./panels/StatsPanel";
import { RawYamlPanel } from "./panels/RawYamlPanel";
import { EquipmentSlotsPanel } from "./panels/EquipmentSlotsPanel";
import { ImagesPanel } from "./panels/ImagesPanel";
import { GlobalAssetsPanel } from "./panels/GlobalAssetsPanel";
import { ApiSettingsPanel } from "./panels/ApiSettingsPanel";
import { WorldPanel } from "./panels/WorldPanel";
import { NavigationPanel } from "./panels/NavigationPanel";
import { PlayerTiersPanel } from "./panels/PlayerTiersPanel";
import { ClassDesigner } from "./ClassDesigner";
import { RaceDesigner } from "./RaceDesigner";
import { AbilityDesigner } from "./AbilityDesigner";
import { StatusEffectDesigner } from "./StatusEffectDesigner";
import { AchievementDesigner } from "./AchievementDesigner";
import { QuestTaxonomyDesigner } from "./QuestTaxonomyDesigner";
import { CharacterCreationStudio } from "./CharacterCreationStudio";
import { CraftingStudio } from "./CraftingStudio";
import { GuildDesigner } from "./GuildDesigner";
import { CommandDesigner } from "./CommandDesigner";

interface WorkspaceDef {
  id: ConfigSubTab;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  maxWidth: string;
}

const CONFIG_WORKSPACES: WorkspaceDef[] = [
  {
    id: "characterStudio",
    label: "Character Studio",
    eyebrow: "People",
    title: "Design classes, races, and player presentation together.",
    description: "Character creation, class identity, race identity, sprite progression, and wear slots belong in one place.",
    maxWidth: "max-w-6xl",
  },
  {
    id: "abilityStudio",
    label: "Ability Studio",
    eyebrow: "Powers",
    title: "Tune stats, abilities, and status effects as one combat language.",
    description: "Keep scaling, ability definitions, and status systems adjacent so balance changes stay coherent.",
    maxWidth: "max-w-5xl",
  },
  {
    id: "worldSystems",
    label: "World Systems",
    eyebrow: "Rules",
    title: "Shape world rules, progression, combat, and game flow.",
    description: "Server-facing config, systemic progression, economy, and travel now live together instead of across unrelated tabs.",
    maxWidth: "max-w-5xl",
  },
  {
    id: "contentStudio",
    label: "Content Studio",
    eyebrow: "Content",
    title: "Manage quest-facing content, achievements, and shared presentation assets.",
    description: "Content and player-facing rewards are easier to review when they are not buried under systems tabs.",
    maxWidth: "max-w-5xl",
  },
  {
    id: "operations",
    label: "Operations",
    eyebrow: "Ops",
    title: "Keep deployment-facing settings and external services contained.",
    description: "Infrastructure and API credentials are isolated from world design so they do not pollute creator workflows.",
    maxWidth: "max-w-4xl",
  },
  {
    id: "rawYaml",
    label: "Raw YAML",
    eyebrow: "Advanced",
    title: "Inspect the raw config when you need exact control.",
    description: "Fallback editing stays available, but it is no longer the primary experience.",
    maxWidth: "max-w-5xl",
  },
];

function WorkspaceSection({
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
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(56,66,96,0.9),rgba(39,48,72,0.92))] p-5 shadow-[0_16px_42px_rgba(9,12,24,0.22)]">
      <div className="mb-4">
        <p className="text-[11px] uppercase tracking-[0.3em] text-text-muted">{kicker}</p>
        <h3 className="mt-2 font-display text-2xl text-text-primary">{title}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-text-secondary">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

export function ConfigEditor() {
  const config = useConfigStore((s) => s.config);
  const dirty = useConfigStore((s) => s.dirty);
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const project = useProjectStore((s) => s.project);
  const activeWorkspace = useProjectStore((s) => s.configSubTab);
  const setActiveWorkspace = useProjectStore((s) => s.setConfigSubTab);
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

  const handleChange = useCallback(
    (patch: Partial<AppConfig>) => {
      if (!config) return;
      updateConfig({ ...config, ...patch });
    },
    [config, updateConfig],
  );

  const handleSave = useCallback(async () => {
    if (!project || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveProjectConfig(project);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Config save failed:", msg);
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }, [project, saving]);

  const workspace = useMemo(
    () => CONFIG_WORKSPACES.find((entry) => entry.id === activeWorkspace) ?? CONFIG_WORKSPACES[0]!,
    [activeWorkspace],
  );

  if (!config) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-muted">
        No config loaded
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative shrink-0 overflow-hidden border-b border-border-default bg-bg-secondary">
        <img src={subtoolbarBg} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.1]" />
        <div className="relative z-10 flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.34em] text-text-muted">Config Studio</p>
            <h2 className="mt-2 font-display text-2xl text-text-primary">{workspace.label}</h2>
          </div>
          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs text-accent">modified</span>}
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="rounded-full border border-white/10 bg-black/10 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save Config"}
            </button>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap gap-2 px-5 pb-4">
          {CONFIG_WORKSPACES.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setActiveWorkspace(entry.id)}
              className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                activeWorkspace === entry.id
                  ? "border-[rgba(184,216,232,0.35)] bg-[linear-gradient(135deg,rgba(168,151,210,0.2),rgba(140,174,201,0.14))] text-text-primary"
                  : "border-white/10 bg-black/10 text-text-secondary hover:bg-white/10 hover:text-text-primary"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {saveError && (
          <div className="relative z-10 px-5 pb-3 text-xs text-status-error">
            Save failed: {saveError}
          </div>
        )}
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="pointer-events-none sticky top-0 z-0 -mb-[100vh] h-[100vh] w-full overflow-hidden">
          <img
            src={configBg}
            alt=""
            className="h-full w-full object-cover opacity-[0.14]"
            style={{ objectPosition: "center 40%" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/60 to-transparent" />
        </div>

        <div className={`relative z-10 mx-auto flex flex-col gap-6 px-6 py-6 ${workspace.maxWidth}`}>
          <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(73,84,118,0.94),rgba(49,60,90,0.92))] p-6 shadow-[0_18px_60px_rgba(9,12,24,0.32)]">
            <p className="text-[11px] uppercase tracking-[0.35em] text-text-muted">{workspace.eyebrow}</p>
            <h1 className="mt-3 max-w-4xl font-display text-4xl text-text-primary">{workspace.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-text-secondary">{workspace.description}</p>
          </section>

          {activeWorkspace === "characterStudio" && (
            <>
              <WorkspaceSection
                kicker="Classes"
                title="Class designer"
                description="Class identity, scaling, visual direction, and start-room overrides are edited together here."
              >
                <ClassDesigner config={config} onChange={handleChange} />
              </WorkspaceSection>

              <WorkspaceSection
                kicker="Races"
                title="Race designer"
                description="Race lore, traits, stat modifiers, portraits, and staff-tier overrides stay adjacent so each race reads as one coherent design."
              >
                <RaceDesigner config={config} onChange={handleChange} />
              </WorkspaceSection>

              <WorkspaceSection
                kicker="Character foundations"
                title="Creation, slots, and sprite progression"
                description="Starting state, genders, wear-slot layout, and player sprite conventions now live in one creator-facing surface."
              >
                <div className="flex flex-col gap-6">
                  <CharacterCreationStudio config={config} onChange={handleChange} />
                  <EquipmentSlotsPanel config={config} onChange={handleChange} />
                  <ImagesPanel config={config} onChange={handleChange} />
                  <PlayerTiersPanel config={config} onChange={handleChange} />
                </div>
              </WorkspaceSection>
            </>
          )}

          {activeWorkspace === "abilityStudio" && (
            <>
              <WorkspaceSection
                kicker="Stats"
                title="Stat definitions and bindings"
                description="Keep primary stats and their mechanical bindings near the abilities that depend on them."
              >
                <StatsPanel config={config} onChange={handleChange} />
              </WorkspaceSection>

              <WorkspaceSection
                kicker="Abilities"
                title="Ability designer"
                description="Class restrictions, cost, cooldown, target type, and effect tuning all stay in one editing pass."
              >
                <AbilityDesigner config={config} onChange={handleChange} />
              </WorkspaceSection>

              <WorkspaceSection
                kicker="Status effects"
                title="Condition designer"
                description="Buffs, debuffs, and ticks are grouped with the rest of the combat language instead of isolated in a separate config strip."
              >
                <StatusEffectDesigner config={config} onChange={handleChange} />
              </WorkspaceSection>
            </>
          )}

          {activeWorkspace === "worldSystems" && (
            <>
              <WorkspaceSection
                kicker="World"
                title="World structure and server behavior"
                description="Core world references, server ports, and global behavior settings sit together because they shape how the game runs."
              >
                <div className="flex flex-col gap-6">
                  <WorldPanel config={config} onChange={handleChange} />
                  <ServerPanel config={config} onChange={handleChange} />
                </div>
              </WorkspaceSection>

              <WorkspaceSection
                kicker="Combat"
                title="Combat and progression rules"
                description="Combat pacing, mob tier scaling, level curve, economy, and regeneration are grouped so balance passes can happen in one place."
              >
                <div className="flex flex-col gap-6">
                  <CombatPanel config={config} onChange={handleChange} />
                  <MobTiersPanel config={config} onChange={handleChange} />
                  <ProgressionPanel config={config} onChange={handleChange} />
                  <RegenPanel config={config} onChange={handleChange} />
                  <EconomyPanel config={config} onChange={handleChange} />
                </div>
              </WorkspaceSection>

              <WorkspaceSection
                kicker="Flow"
                title="Travel, crafting, commands, and social rules"
                description="These are all player-facing systems that shape how the world feels moment to moment."
              >
                <div className="flex flex-col gap-6">
                  <CraftingStudio config={config} onChange={handleChange} />
                  <NavigationPanel config={config} onChange={handleChange} />
                  <CommandDesigner config={config} onChange={handleChange} />
                  <GuildDesigner config={config} onChange={handleChange} />
                </div>
              </WorkspaceSection>
            </>
          )}

          {activeWorkspace === "contentStudio" && (
            <>
              <WorkspaceSection
                kicker="Progression content"
                title="Achievement language"
                description="Categories and criterion definitions now live in a purpose-built content workbench instead of a pair of flat registries."
              >
                <AchievementDesigner config={config} onChange={handleChange} />
              </WorkspaceSection>

              <WorkspaceSection
                kicker="Quest language"
                title="Quest taxonomy designer"
                description="Objective and completion vocabularies stay together so authored quest structure remains readable and consistent."
              >
                <QuestTaxonomyDesigner config={config} onChange={handleChange} />
              </WorkspaceSection>

              <WorkspaceSection
                kicker="Shared assets"
                title="Global presentation assets"
                description="Keep worldwide UI and presentation assets near the content surfaces they support."
              >
                <GlobalAssetsPanel config={config} onChange={handleChange} />
              </WorkspaceSection>
            </>
          )}

          {activeWorkspace === "operations" && (
            <>
              <WorkspaceSection
                kicker="Services"
                title="API and service credentials"
                description="External providers live here so they stop intruding on world design workflows."
              >
                <ApiSettingsPanel />
              </WorkspaceSection>
            </>
          )}

          {activeWorkspace === "rawYaml" && (
            <WorkspaceSection
              kicker="Advanced"
              title="Raw configuration"
              description="Use this when the structured editors are not enough or when you need to inspect exact serialized data."
            >
              <RawYamlPanel config={config} onChange={handleChange} />
            </WorkspaceSection>
          )}
        </div>
      </div>
    </div>
  );
}
