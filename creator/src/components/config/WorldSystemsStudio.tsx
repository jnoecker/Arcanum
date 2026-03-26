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
    <section className="rounded-[28px] border border-white/10 bg-gradient-panel-light p-5 shadow-section-sm">
      <div className="mb-3">
        <p className="text-[11px] uppercase tracking-wide-ui text-text-muted">{kicker}</p>
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
}: {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
  activeView: WorldSystemsSubView;
}) {
  return (
    <div className="flex flex-col gap-6">
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
