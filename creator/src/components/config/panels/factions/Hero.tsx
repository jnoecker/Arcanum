import { useEffect, useRef, useState } from "react";
import type { FactionConfig } from "@/types/config";
import { NumberInput } from "@/components/ui/FormWidgets";

interface HeroProps {
  factions: FactionConfig;
  count: number;
  onPatch: (patch: Partial<FactionConfig>) => void;
}

interface EconomicsKnobProps {
  label: string;
  hint: string;
  value: number;
  onCommit: (v: number) => void;
  min?: number;
}

/**
 * Inline labelled value: small Cinzel uppercase label sitting above a
 * mono numeral. Click the numeral to open a tiny popover with NumberInput.
 * No card chrome, no glow halos — meant to read as a single typographic
 * line of "reputation economics" rather than a SaaS KPI strip.
 */
function EconomicsKnob({ label, hint, value, onCommit, min }: EconomicsKnobProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative flex items-baseline gap-2">
      <span className="font-display text-2xs font-semibold uppercase tracking-[0.22em] text-text-muted">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={hint}
        aria-label={`${label}: ${value} (click to edit)`}
        className="focus-ring rounded font-mono text-base font-semibold leading-none text-text-primary transition hover:text-accent"
      >
        {value}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 w-44 rounded-lg border border-[var(--chrome-stroke-strong)] bg-[var(--bg-panel)] p-2 shadow-glow-warm">
          <p className="mb-1 font-display text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted">
            {label}
          </p>
          <NumberInput
            value={value}
            onCommit={(v) => {
              if (v != null) onCommit(v);
              setOpen(false);
            }}
            min={min}
            dense
          />
          <p className="mt-1 text-2xs leading-snug text-text-muted/70">{hint}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Factions panel header. Intentionally chrome-light — kicker, title, and
 * lede sit directly on the panel bg, with a single horizontal "Reputation
 * Economics" row of inline labelled values (no cards, no halos).
 */
export function Hero({ factions, count, onPatch }: HeroProps) {
  return (
    <section className="flex flex-col gap-5 px-1 pt-1">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="font-display text-2xs font-semibold uppercase tracking-[0.22em] text-text-muted">
          Political Landscape
        </p>
        <span aria-hidden="true" className="text-text-muted/40">·</span>
        <p className="font-display text-2xs uppercase tracking-[0.18em] text-text-muted">
          {count} {count === 1 ? "faction" : "factions"}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-2xl font-semibold text-text-primary">
          Factions &amp; Reputation
        </h2>
        <p className="max-w-2xl text-xs leading-relaxed text-text-secondary">
          Guilds, courts, cabals, and mercenary companies. Players earn or
          lose standing with each through quests and combat; reputation
          gates shops, quests, and regions tied to each group.
        </p>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
        <span className="font-display text-2xs font-semibold uppercase tracking-[0.22em] text-text-muted/80">
          Reputation Economics
        </span>
        <EconomicsKnob
          label="Starting"
          hint="Where new players begin with every faction."
          value={factions.defaultReputation}
          onCommit={(v) => onPatch({ defaultReputation: v })}
        />
        <span aria-hidden="true" className="text-text-muted/40">·</span>
        <EconomicsKnob
          label="Kill Penalty"
          hint="Lost with the mob's own faction per kill (× level)."
          value={factions.killPenalty}
          onCommit={(v) => onPatch({ killPenalty: v })}
          min={0}
        />
        <span aria-hidden="true" className="text-text-muted/40">·</span>
        <EconomicsKnob
          label="Kill Bonus"
          hint="Gained with the victim's enemy factions per kill (× level)."
          value={factions.killBonus}
          onCommit={(v) => onPatch({ killBonus: v })}
          min={0}
        />
      </div>
    </section>
  );
}
