import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import { saveProjectConfig } from "@/lib/saveConfig";
import type { AppConfig } from "@/types/config";
import type { AbilityStudioSubView, CharacterStudioSubView, ConfigSubTab } from "@/types/project";
import configBg from "@/assets/config-bg.png";
import subtoolbarBg from "@/assets/subtoolbar-bg.jpg";
import { StatsPanel } from "./panels/StatsPanel";
import { RawYamlPanel } from "./panels/RawYamlPanel";
import { EquipmentSlotsPanel } from "./panels/EquipmentSlotsPanel";
import { ImagesPanel } from "./panels/ImagesPanel";
import { PlayerTiersPanel } from "./panels/PlayerTiersPanel";
import { ClassDesigner } from "./ClassDesigner";
import { RaceDesigner } from "./RaceDesigner";
import { AbilityDesigner } from "./AbilityDesigner";
import { StatusEffectDesigner } from "./StatusEffectDesigner";
import { CharacterCreationStudio } from "./CharacterCreationStudio";
import { WorldSystemsStudio } from "./WorldSystemsStudio";
import { ContentStudio } from "./ContentStudio";
import { OperationsStudio } from "./OperationsStudio";

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
    description: "Classes, races, character setup, and sprite rules.",
    maxWidth: "max-w-6xl",
  },
  {
    id: "abilityStudio",
    label: "Ability Studio",
    eyebrow: "Powers",
    title: "Stats, abilities, and status effects.",
    description: "Balance stats, abilities, and status effects together.",
    maxWidth: "max-w-5xl",
  },
  {
    id: "worldSystems",
    label: "World Systems",
    eyebrow: "Rules",
    title: "Progression, combat, economy, and world rules.",
    description: "Progression, combat, economy, travel, and runtime rules.",
    maxWidth: "max-w-5xl",
  },
  {
    id: "contentStudio",
    label: "Content Studio",
    eyebrow: "Content",
    title: "Achievements, quest structure, and shared assets.",
    description: "Achievements, quest taxonomy, crafting, commands, and guilds.",
    maxWidth: "max-w-5xl",
  },
  {
    id: "operations",
    label: "Operations",
    eyebrow: "Ops",
    title: "API credentials, deployment, and publishing.",
    description: "Providers, delivery credentials, and deployment.",
    maxWidth: "max-w-4xl",
  },
  {
    id: "rawYaml",
    label: "Raw YAML",
    eyebrow: "Advanced",
    title: "Inspect the raw config when you need exact control.",
    description: "Direct YAML editing for exact changes.",
    maxWidth: "max-w-5xl",
  },
];

const CHARACTER_STUDIO_VIEWS: Array<{ id: CharacterStudioSubView; label: string; title: string; description: string }> = [
  { id: "classes", label: "Classes", title: "Class designer", description: "Class identity, scaling, visual direction, and start-room overrides." },
  { id: "races", label: "Races", title: "Race designer", description: "Race lore, traits, stat modifiers, portraits, and staff-tier overrides." },
  { id: "creation", label: "Creation", title: "Character creation", description: "Starting state and gender definitions." },
  { id: "equipment", label: "Equipment", title: "Equipment slots", description: "Wear slots and layout." },
  { id: "sprites", label: "Sprites", title: "Sprite rules", description: "Image serving, sprite tiers, and player tier visuals." },
];

const ABILITY_STUDIO_VIEWS: Array<{ id: AbilityStudioSubView; label: string; title: string; description: string }> = [
  { id: "stats", label: "Stats", title: "Stat definitions and bindings", description: "Primary stats and their bindings." },
  { id: "abilities", label: "Abilities", title: "Ability designer", description: "Class restrictions, costs, cooldowns, targets, and effects." },
  { id: "conditions", label: "Conditions", title: "Condition designer", description: "Status effects, stack rules, and ticking behavior." },
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
    <section className="rounded-[28px] border border-white/10 bg-gradient-panel-light p-5 shadow-[0_16px_42px_rgba(9,12,24,0.22)]">
      <div className="mb-3">
        <p className="text-[11px] uppercase tracking-wide-ui text-text-muted">{kicker}</p>
        <h3 className="mt-2 font-display text-xl text-text-primary">{title}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">{description}</p>
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
  const characterStudioSubView = useProjectStore((s) => s.characterStudioSubView);
  const setCharacterStudioSubView = useProjectStore((s) => s.setCharacterStudioSubView);
  const abilityStudioSubView = useProjectStore((s) => s.abilityStudioSubView);
  const setAbilityStudioSubView = useProjectStore((s) => s.setAbilityStudioSubView);
  const worldSystemsSubView = useProjectStore((s) => s.worldSystemsSubView);
  const setWorldSystemsSubView = useProjectStore((s) => s.setWorldSystemsSubView);
  const contentStudioSubView = useProjectStore((s) => s.contentStudioSubView);
  const setContentStudioSubView = useProjectStore((s) => s.setContentStudioSubView);
  const operationsSubView = useProjectStore((s) => s.operationsSubView);
  const setOperationsSubView = useProjectStore((s) => s.setOperationsSubView);
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
  const headerSubTabs = useMemo(() => {
    if (activeWorkspace === "characterStudio") {
      return {
        active: characterStudioSubView,
        items: CHARACTER_STUDIO_VIEWS.map((view) => ({ id: view.id, label: view.label })),
        onChange: (id: string) => setCharacterStudioSubView(id as CharacterStudioSubView),
      };
    }
    if (activeWorkspace === "abilityStudio") {
      return {
        active: abilityStudioSubView,
        items: ABILITY_STUDIO_VIEWS.map((view) => ({ id: view.id, label: view.label })),
        onChange: (id: string) => setAbilityStudioSubView(id as AbilityStudioSubView),
      };
    }
    if (activeWorkspace === "worldSystems") {
      return {
        active: worldSystemsSubView,
        items: [
          { id: "world", label: "World & Server" },
          { id: "combat", label: "Combat Loop" },
          { id: "progression", label: "Progression & Stats" },
          { id: "travel", label: "Travel & Commands" },
          { id: "economy", label: "Economy & Crafting" },
          { id: "social", label: "Social Systems" },
        ],
        onChange: (id: string) => setWorldSystemsSubView(id as typeof worldSystemsSubView),
      };
    }
    if (activeWorkspace === "contentStudio") {
      return {
        active: contentStudioSubView,
        items: [
          { id: "achievements", label: "Achievements" },
          { id: "quests", label: "Quest Taxonomy" },
          { id: "assets", label: "Shared Assets" },
        ],
        onChange: (id: string) => setContentStudioSubView(id as typeof contentStudioSubView),
      };
    }
    if (activeWorkspace === "operations") {
      return {
        active: operationsSubView,
        items: [
          { id: "services", label: "Services" },
          { id: "delivery", label: "Deployment" },
        ],
        onChange: (id: string) => setOperationsSubView(id as typeof operationsSubView),
      };
    }
    return null;
  }, [
    abilityStudioSubView,
    activeWorkspace,
    characterStudioSubView,
    contentStudioSubView,
    operationsSubView,
    setContentStudioSubView,
    setOperationsSubView,
    setWorldSystemsSubView,
    setAbilityStudioSubView,
    setCharacterStudioSubView,
    worldSystemsSubView,
  ]);

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
        <div className="relative z-10 flex items-center justify-between gap-4 px-5 py-3">
          <div className="min-w-0 flex-1">
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="font-display text-2xl text-text-primary">{workspace.label}</h2>
              <span className="text-xs text-text-secondary">{workspace.description}</span>
            </div>
            {headerSubTabs && (
              <div className="mt-4 flex flex-wrap gap-2">
                {headerSubTabs.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => headerSubTabs.onChange(item.id)}
                    className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                      headerSubTabs.active === item.id
                        ? "border-[rgba(184,216,232,0.48)] bg-[linear-gradient(135deg,rgba(168,151,210,0.3),rgba(140,174,201,0.2))] text-white shadow-[0_10px_24px_rgba(137,155,214,0.18)]"
                        : "border-white/10 bg-black/10 text-text-secondary hover:bg-white/10 hover:text-text-primary"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs text-accent">modified</span>}
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="rounded-full border border-[rgba(184,216,232,0.28)] bg-gradient-active-strong px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:shadow-[0_10px_20px_rgba(137,155,214,0.2)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save Config"}
            </button>
          </div>
        </div>

        {saveError && (
          <div className="relative z-10 px-5 pb-3 text-xs text-status-error">
            Could not save config: {saveError}
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

        <div className={`relative z-10 mx-auto flex flex-col gap-6 px-6 py-5 ${workspace.maxWidth}`}>
          {activeWorkspace === "characterStudio" && (
            <>
              {characterStudioSubView === "classes" && (
              <WorkspaceSection
                kicker="Classes"
                title={CHARACTER_STUDIO_VIEWS.find((view) => view.id === "classes")!.title}
                description={CHARACTER_STUDIO_VIEWS.find((view) => view.id === "classes")!.description}
              >
                <ClassDesigner config={config} onChange={handleChange} />
              </WorkspaceSection>
              )}

              {characterStudioSubView === "races" && (
              <WorkspaceSection
                kicker="Races"
                title={CHARACTER_STUDIO_VIEWS.find((view) => view.id === "races")!.title}
                description={CHARACTER_STUDIO_VIEWS.find((view) => view.id === "races")!.description}
              >
                <RaceDesigner config={config} onChange={handleChange} />
              </WorkspaceSection>
              )}

              {characterStudioSubView === "creation" && (
              <WorkspaceSection
                kicker="Character foundations"
                title={CHARACTER_STUDIO_VIEWS.find((view) => view.id === "creation")!.title}
                description={CHARACTER_STUDIO_VIEWS.find((view) => view.id === "creation")!.description}
              >
                <CharacterCreationStudio config={config} onChange={handleChange} />
              </WorkspaceSection>
              )}

              {characterStudioSubView === "equipment" && (
              <WorkspaceSection
                kicker="Equipment"
                title={CHARACTER_STUDIO_VIEWS.find((view) => view.id === "equipment")!.title}
                description={CHARACTER_STUDIO_VIEWS.find((view) => view.id === "equipment")!.description}
              >
                <EquipmentSlotsPanel config={config} onChange={handleChange} />
              </WorkspaceSection>
              )}

              {characterStudioSubView === "sprites" && (
              <WorkspaceSection
                kicker="Sprites"
                title={CHARACTER_STUDIO_VIEWS.find((view) => view.id === "sprites")!.title}
                description={CHARACTER_STUDIO_VIEWS.find((view) => view.id === "sprites")!.description}
              >
                <div className="flex flex-col gap-6">
                  <ImagesPanel config={config} onChange={handleChange} />
                  <PlayerTiersPanel config={config} onChange={handleChange} />
                </div>
              </WorkspaceSection>
              )}
            </>
          )}

          {activeWorkspace === "abilityStudio" && (
            <>
              {abilityStudioSubView === "stats" && (
              <WorkspaceSection
                kicker="Stats"
                title={ABILITY_STUDIO_VIEWS.find((view) => view.id === "stats")!.title}
                description={ABILITY_STUDIO_VIEWS.find((view) => view.id === "stats")!.description}
              >
                <StatsPanel config={config} onChange={handleChange} />
              </WorkspaceSection>
              )}

              {abilityStudioSubView === "abilities" && (
              <WorkspaceSection
                kicker="Abilities"
                title={ABILITY_STUDIO_VIEWS.find((view) => view.id === "abilities")!.title}
                description={ABILITY_STUDIO_VIEWS.find((view) => view.id === "abilities")!.description}
              >
                <AbilityDesigner config={config} onChange={handleChange} />
              </WorkspaceSection>
              )}

              {abilityStudioSubView === "conditions" && (
              <WorkspaceSection
                kicker="Status effects"
                title={ABILITY_STUDIO_VIEWS.find((view) => view.id === "conditions")!.title}
                description={ABILITY_STUDIO_VIEWS.find((view) => view.id === "conditions")!.description}
              >
                <StatusEffectDesigner config={config} onChange={handleChange} />
              </WorkspaceSection>
              )}
            </>
          )}

          {activeWorkspace === "worldSystems" && (
            <WorldSystemsStudio
              config={config}
              onChange={handleChange}
              activeView={worldSystemsSubView}
            />
          )}

          {activeWorkspace === "contentStudio" && (
            <ContentStudio
              config={config}
              onChange={handleChange}
              activeView={contentStudioSubView}
            />
          )}

          {activeWorkspace === "operations" && (
            <OperationsStudio
              activeView={operationsSubView}
            />
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
