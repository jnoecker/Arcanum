// ─── Simulation Lab ────────────────────────────────────────────────
// Tabbed "what-if" workspace sitting below the Tuning Wizard charts.
// Four simulators share the active (merged) config so designers can
// preview balance changes without applying the preset.

import { useState } from "react";
import type { AppConfig } from "@/types/config";
import { CombatSimulator } from "./CombatSimulator";
import { EconomySimulator } from "./EconomySimulator";
import { ProgressionSimulator } from "./ProgressionSimulator";
import { CraftingSimulator } from "./CraftingSimulator";

type SimTab = "combat" | "economy" | "progression" | "crafting";

const TABS: Array<{ id: SimTab; label: string; blurb: string }> = [
  { id: "combat", label: "Combat", blurb: "Player vs mob expected outcome" },
  { id: "economy", label: "Economy", blurb: "Gold in vs out per hour" },
  { id: "progression", label: "Progression", blurb: "Hours to reach each level" },
  { id: "crafting", label: "Crafting", blurb: "Recipe viability & gather time" },
];

interface SimulationLabProps {
  /** Preset-merged config if a preset is selected, else current config. */
  activeConfig: AppConfig;
  /** Whether a preset is currently highlighted. */
  hasPresetSelected: boolean;
}

export function SimulationLab({ activeConfig, hasPresetSelected }: SimulationLabProps) {
  const [tab, setTab] = useState<SimTab>("combat");

  return (
    <section className="animate-unfurl-in mx-auto mb-6 w-full max-w-6xl px-6">
      <div className="panel-surface rounded-[1.5rem] p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="font-display text-[14px] font-normal uppercase tracking-[0.5px] text-text-secondary">
              Simulation Lab
            </h3>
            <p className="mt-1 text-xs text-text-muted">
              {hasPresetSelected
                ? "Running against the selected preset's merged configuration."
                : "Running against your current configuration."}
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <div
          role="tablist"
          aria-label="Simulation type"
          className="mb-4 flex flex-wrap gap-1 border-b border-border-muted"
        >
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`group relative -mb-px border-b-2 px-4 py-2 text-left text-xs transition-colors ${
                  active
                    ? "border-accent text-accent"
                    : "border-transparent text-text-muted hover:text-text-secondary"
                }`}
              >
                <span className="block font-display text-[13px] uppercase tracking-wider">
                  {t.label}
                </span>
                <span className="block text-2xs text-text-muted group-hover:text-text-secondary">
                  {t.blurb}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active simulator */}
        <div role="tabpanel">
          {tab === "combat" && <CombatSimulator config={activeConfig} />}
          {tab === "economy" && <EconomySimulator config={activeConfig} />}
          {tab === "progression" && <ProgressionSimulator config={activeConfig} />}
          {tab === "crafting" && <CraftingSimulator config={activeConfig} />}
        </div>
      </div>
    </section>
  );
}
