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
    title: "Move through world rules by domain instead of by tab strip.",
    description: "Each system area now opens as its own focused workspace so balance passes and runtime edits stop collapsing into one long scroll.",
  },
  {
    id: "world",
    label: "World & Server",
    eyebrow: "Foundation",
    title: "Shape startup, entry points, and server behavior together.",
    description: "World references, start rooms, server ports, and runtime-facing global behavior belong in the same operator view.",
  },
  {
    id: "combat",
    label: "Combat Loop",
    eyebrow: "Conflict",
    title: "Tune encounter pacing, mob tiers, and survivability in one pass.",
    description: "Combat flow, mob scaling, and regeneration all contribute to encounter feel and need to be reviewed side by side.",
  },
  {
    id: "progression",
    label: "Progression & Stats",
    eyebrow: "Growth",
    title: "Keep level curve and stat language adjacent.",
    description: "Character growth only stays coherent when level rewards and the stat system are edited as one balancing surface.",
  },
  {
    id: "travel",
    label: "Travel & Commands",
    eyebrow: "Flow",
    title: "Author movement, recall, and command language together.",
    description: "Navigation rules and the commands that expose them are one player-facing conversation, not separate maintenance chores.",
  },
  {
    id: "economy",
    label: "Economy & Crafting",
    eyebrow: "Production",
    title: "Tune money and making things in the same workspace.",
    description: "Buy/sell pressure, harvesting cadence, and crafting mastery affect the same reward loops and should live together.",
  },
  {
    id: "social",
    label: "Social Systems",
    eyebrow: "Community",
    title: "Group, guild, and friends rules now share one social design surface.",
    description: "Social friction and organization hierarchy are easier to reason about when the whole social layer is visible together.",
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
  const current = WORLD_SYSTEM_VIEWS.find((view) => view.id === activeView) ?? WORLD_SYSTEM_VIEWS[0]!;
  const zoneCount = config.world.resources.length;
  const classStartCount = Object.keys(config.classStartRooms).length;
  const commandCount = Object.keys(config.commands).length;
  const abilityCount = Object.keys(config.abilities).length;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(73,84,118,0.94),rgba(49,60,90,0.92))] p-5 shadow-[0_18px_60px_rgba(9,12,24,0.32)]">
        <p className="text-[11px] uppercase tracking-[0.35em] text-text-muted">{current.eyebrow}</p>
        <h2 className="mt-2 max-w-4xl font-display text-3xl text-text-primary">{current.title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">{current.description}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            <div className="mt-2 text-xs text-text-secondary">Current balancing vocabulary</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {WORLD_SYSTEM_VIEWS.map((view) => (
            <button
              key={view.id}
              onClick={() => onViewChange(view.id)}
              className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                activeView === view.id
                  ? "border-[rgba(184,216,232,0.48)] bg-[linear-gradient(135deg,rgba(168,151,210,0.3),rgba(140,174,201,0.2))] text-white shadow-[0_10px_24px_rgba(137,155,214,0.18)]"
                  : "border-white/10 bg-black/10 text-text-secondary hover:bg-white/10 hover:text-text-primary"
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>
      </section>

      {activeView === "overview" && (
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
      )}

      {activeView === "world" && (
        <>
          <StudioSection
            kicker="World topology"
            title="World resources, start rooms, and spawn rules"
            description="Use one view for global world references, namespaced start rooms, and other startup-critical location rules."
          >
            <WorldPanel config={config} onChange={onChange} />
          </StudioSection>
          <StudioSection
            kicker="Server runtime"
            title="Ports and server process behavior"
            description="Server-facing config stays together so local boot and deployment handoff remain easy to validate."
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
            description="Damage floors, tick cadence, feedback, and throughput belong in the same balancing pass."
          >
            <CombatPanel config={config} onChange={onChange} />
          </StudioSection>
          <StudioSection
            kicker="Creature scaling"
            title="Mob tiers"
            description="Tier baselines sit next to the combat loop so PvE tuning doesn’t fragment across multiple screens."
          >
            <MobTiersPanel config={config} onChange={onChange} />
          </StudioSection>
          <StudioSection
            kicker="Recovery"
            title="Regen cadence"
            description="Health and mana recovery influence encounter tempo and downtime as much as raw combat numbers do."
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
            description="Level milestones, XP pacing, and baseline HP or mana should be reviewed before class and ability balancing."
          >
            <ProgressionPanel config={config} onChange={onChange} />
          </StudioSection>
          <StudioSection
            kicker="Stat language"
            title="Stats and bindings"
            description="Keep stat names, descriptions, and mechanical bindings together so the rest of the design vocabulary stays readable."
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
            description="Movement and recall rules are part of the same player flow and should be edited in one place."
          >
            <NavigationPanel config={config} onChange={onChange} />
          </StudioSection>
          <StudioSection
            kicker="Command language"
            title="Commands and discoverability"
            description="Help-facing command metadata belongs beside the systems it exposes, not in an isolated registry."
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
            description="Buy and sell pressure define how quickly value circulates through the world and should anchor the crafting loop beside it."
          >
            <EconomyPanel config={config} onChange={onChange} />
          </StudioSection>
          <StudioSection
            kicker="Production loop"
            title="Crafting and gathering"
            description="Gathering pace, skill mastery, station types, and discipline lists all live in this single production workspace."
          >
            <CraftingStudio config={config} onChange={onChange} />
          </StudioSection>
        </>
      )}

      {activeView === "social" && (
        <StudioSection
          kicker="Social layer"
          title="Groups, guilds, and friends"
          description="Party pacing, social reach, guild defaults, and permission hierarchy now share one social systems view."
        >
          <GuildDesigner config={config} onChange={onChange} />
        </StudioSection>
      )}
    </div>
  );
}
