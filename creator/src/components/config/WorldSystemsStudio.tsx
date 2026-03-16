import type { ReactNode } from "react";
import type { AppConfig } from "@/types/config";
import type { WorldSystemsSubView } from "@/types/project";
import { ServerPanel } from "./panels/ServerPanel";
import { CombatPanel } from "./panels/CombatPanel";
import { MobTiersPanel } from "./panels/MobTiersPanel";
import { ProgressionPanel } from "./panels/ProgressionPanel";
import { EconomyPanel } from "./panels/EconomyPanel";
import { RegenPanel } from "./panels/RegenPanel";
import { StatsPanel } from "./panels/StatsPanel";
import { WorldPanel } from "./panels/WorldPanel";
import { NavigationPanel } from "./panels/NavigationPanel";
import { CraftingStudio } from "./CraftingStudio";
import { GuildDesigner } from "./GuildDesigner";
import { CommandDesigner } from "./CommandDesigner";

const WORLD_SYSTEM_VIEWS: Array<{
  id: WorldSystemsSubView;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
}> = [
  {
    id: "overview",
    label: "Overview",
    eyebrow: "Map",
    title: "All world rules, grouped by domain.",
    description: "World rules grouped by domain.",
  },
  {
    id: "world",
    label: "World & Server",
    eyebrow: "Foundation",
    title: "World resources, start rooms, and server settings.",
    description: "World references, start rooms, server ports, and runtime behavior.",
  },
  {
    id: "combat",
    label: "Combat Loop",
    eyebrow: "Conflict",
    title: "Combat loop, mob tiers, and recovery.",
    description: "Combat pacing, creature scaling, and regeneration.",
  },
  {
    id: "progression",
    label: "Progression & Stats",
    eyebrow: "Growth",
    title: "Level curve and stats.",
    description: "Level rewards and the stat system.",
  },
  {
    id: "travel",
    label: "Travel & Commands",
    eyebrow: "Flow",
    title: "Movement, recall, and commands.",
    description: "Movement, recall rules, and player commands.",
  },
  {
    id: "economy",
    label: "Economy & Crafting",
    eyebrow: "Production",
    title: "Economy and crafting.",
    description: "Buy/sell settings, harvesting cadence, and crafting mastery.",
  },
  {
    id: "social",
    label: "Social Systems",
    eyebrow: "Community",
    title: "Groups, guilds, and friends.",
    description: "Social defaults and hierarchy.",
  },
];

function StudioSection({
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
      <div className="mb-3">
        <p className="text-[11px] uppercase tracking-[0.3em] text-text-muted">{kicker}</p>
        <h3 className="mt-2 font-display text-xl text-text-primary">{title}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

export function WorldSystemsStudio({
  config,
  onChange,
  activeView,
  onViewChange,
}: {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
  activeView: WorldSystemsSubView;
  onViewChange: (view: WorldSystemsSubView) => void;
}) {
  const zoneCount = config.world.resources.length;
  const classStartCount = Object.keys(config.classStartRooms).length;
  const commandCount = Object.keys(config.commands).length;
  const abilityCount = Object.keys(config.abilities).length;

  return (
    <div className="flex flex-col gap-6">
      {activeView === "overview" && (
        <div className="grid gap-4">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[22px] border border-white/10 bg-black/12 p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-text-muted">Resources</div>
              <div className="mt-2 font-display text-3xl text-text-primary">{zoneCount}</div>
              <div className="mt-2 text-xs text-text-secondary">World files in the active project</div>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-black/12 p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-text-muted">Class Starts</div>
              <div className="mt-2 font-display text-3xl text-text-primary">{classStartCount}</div>
              <div className="mt-2 text-xs text-text-secondary">Class-specific spawn overrides</div>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-black/12 p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-text-muted">Commands</div>
              <div className="mt-2 font-display text-3xl text-text-primary">{commandCount}</div>
              <div className="mt-2 text-xs text-text-secondary">Help-facing command entries</div>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-black/12 p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-text-muted">Abilities</div>
              <div className="mt-2 font-display text-3xl text-text-primary">{abilityCount}</div>
              <div className="mt-2 text-xs text-text-secondary">Defined abilities</div>
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
          {WORLD_SYSTEM_VIEWS.filter((view) => view.id !== "overview").map((view) => (
            <button
              key={view.id}
              onClick={() => onViewChange(view.id)}
              className="rounded-[26px] border border-white/10 bg-[linear-gradient(160deg,rgba(56,66,96,0.9),rgba(39,48,72,0.92))] p-4 text-left shadow-[0_16px_42px_rgba(9,12,24,0.22)] transition hover:border-[rgba(184,216,232,0.2)] hover:bg-[linear-gradient(160deg,rgba(63,73,105,0.94),rgba(43,52,79,0.96))]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-text-muted">{view.eyebrow}</p>
                  <h3 className="mt-2 font-display text-xl text-text-primary">{view.label}</h3>
                </div>
                <div className="rounded-full border border-white/8 bg-black/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-accent">
                  Open
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-text-secondary">{view.description}</p>
            </button>
          ))}
          </div>
        </div>
      )}

      {activeView === "world" && (
        <>
          <StudioSection
            kicker="World topology"
            title="World resources, start rooms, and spawn rules"
            description="Global world references and namespaced start rooms."
          >
            <WorldPanel config={config} onChange={onChange} />
          </StudioSection>
          <StudioSection
            kicker="Server runtime"
            title="Ports and server process behavior"
            description="Ports and server process settings."
          >
            <ServerPanel config={config} onChange={onChange} />
          </StudioSection>
        </>
      )}

      {activeView === "combat" && (
        <>
          <StudioSection
            kicker="Combat pacing"
            title="Combat loop"
            description="Damage floors, tick cadence, feedback, and throughput."
          >
            <CombatPanel config={config} onChange={onChange} />
          </StudioSection>
          <StudioSection
            kicker="Creature scaling"
            title="Mob tiers"
            description="Baseline stats for each mob difficulty tier."
          >
            <MobTiersPanel config={config} onChange={onChange} />
          </StudioSection>
          <StudioSection
            kicker="Recovery"
            title="Regen cadence"
            description="HP and mana recovery rates."
          >
            <RegenPanel config={config} onChange={onChange} />
          </StudioSection>
        </>
      )}

      {activeView === "progression" && (
        <>
          <StudioSection
            kicker="Level curve"
            title="Progression rewards"
            description="Level curve, XP pacing, and baseline HP and mana scaling."
          >
            <ProgressionPanel config={config} onChange={onChange} />
          </StudioSection>
          <StudioSection
            kicker="Stat language"
            title="Stats and bindings"
            description="Stat names, descriptions, and bindings."
          >
            <StatsPanel config={config} onChange={onChange} />
          </StudioSection>
        </>
      )}

      {activeView === "travel" && (
        <>
          <StudioSection
            kicker="Travel rules"
            title="Navigation and recall"
            description="Movement and recall rules for the player journey."
          >
            <NavigationPanel config={config} onChange={onChange} />
          </StudioSection>
          <StudioSection
            kicker="Command language"
            title="Commands and discoverability"
            description="Usage strings, categories, and staff visibility."
          >
            <CommandDesigner config={config} onChange={onChange} />
          </StudioSection>
        </>
      )}

      {activeView === "economy" && (
        <>
          <StudioSection
            kicker="Money loop"
            title="Economy tuning"
            description="Gold sinks, buy/sell ratios, and shop behavior."
          >
            <EconomyPanel config={config} onChange={onChange} />
          </StudioSection>
          <StudioSection
            kicker="Production loop"
            title="Crafting and gathering"
            description="Gathering, skill leveling, station types, and crafting disciplines."
          >
            <CraftingStudio config={config} onChange={onChange} />
          </StudioSection>
        </>
      )}

      {activeView === "social" && (
        <StudioSection
          kicker="Social layer"
          title="Groups, guilds, and friends"
          description="Party pacing, guild defaults, and permission hierarchy."
        >
          <GuildDesigner config={config} onChange={onChange} />
        </StudioSection>
      )}
    </div>
  );
}
