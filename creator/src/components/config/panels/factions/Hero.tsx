import type { FactionConfig } from "@/types/config";
import { StatCard } from "./StatCard";

interface HeroProps {
  factions: FactionConfig;
  count: number;
  onPatch: (patch: Partial<FactionConfig>) => void;
}

export function Hero({ factions, count, onPatch }: HeroProps) {
  return (
    <section className="panel-surface relative overflow-hidden rounded-3xl px-6 py-5 shadow-section">
      <div className="relative z-10 flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xs font-semibold uppercase tracking-[0.22em] text-text-muted">
              Political Landscape
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-text-primary">
              Factions &amp; Reputation
            </h2>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-text-secondary">
              Guilds, courts, cabals, and mercenary companies. Players earn
              or lose standing with each through quests and combat;
              reputation gates shops, quests, and regions tied to each group.
            </p>
          </div>
          <div className="hidden shrink-0 items-center justify-center rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-5 py-3 sm:inline-flex sm:flex-col">
            <span className="font-display text-3xl font-bold leading-none text-text-primary">
              {count}
            </span>
            <span className="mt-1 font-display text-2xs uppercase tracking-[0.18em] text-text-muted">
              {count === 1 ? "Faction" : "Factions"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatCard
            label="Starting Rep"
            hint="Where new players begin with every faction."
            value={factions.defaultReputation}
            onCommit={(v) => onPatch({ defaultReputation: v })}
          />
          <StatCard
            label="Kill Penalty"
            hint="Lost with the mob's own faction per kill (× level)."
            value={factions.killPenalty}
            onCommit={(v) => onPatch({ killPenalty: v })}
            min={0}
            tint="rose"
          />
          <StatCard
            label="Kill Bonus"
            hint="Gained with the victim's enemy factions per kill (× level)."
            value={factions.killBonus}
            onCommit={(v) => onPatch({ killBonus: v })}
            min={0}
            tint="emerald"
          />
        </div>
      </div>
    </section>
  );
}
