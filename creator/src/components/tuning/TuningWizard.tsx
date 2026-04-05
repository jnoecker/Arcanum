// ─── Tuning Wizard Workspace ────────────────────────────────────────
// Root component for the Tuning Wizard. Shows preset cards and (in Plan 02)
// a search/filter bar + parameter browser below.

import { useMemo } from "react";
import { useConfigStore } from "@/stores/configStore";
import { useTuningWizardStore } from "@/stores/tuningWizardStore";
import { TUNING_PRESETS } from "@/lib/tuning/presets";
import type { TuningPreset } from "@/lib/tuning/presets";
import { computeMetrics } from "@/lib/tuning/formulas";
import type { AppConfig } from "@/types/config";
import type { DeepPartial } from "@/lib/tuning/types";
import { PresetCard } from "./PresetCard";

/** Recursively merge a DeepPartial overlay onto a base config. */
function deepMerge<T extends Record<string, unknown>>(base: T, overlay: DeepPartial<T>): T {
  const result = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(overlay)) {
    const ov = (overlay as Record<string, unknown>)[key];
    const bv = (base as Record<string, unknown>)[key];
    if (
      ov != null &&
      typeof ov === "object" &&
      !Array.isArray(ov) &&
      bv != null &&
      typeof bv === "object" &&
      !Array.isArray(bv)
    ) {
      result[key] = deepMerge(
        bv as Record<string, unknown>,
        ov as DeepPartial<Record<string, unknown>>,
      );
    } else if (ov !== undefined) {
      result[key] = ov;
    }
  }
  return result as T;
}

export function TuningWizard() {
  const config = useConfigStore((s) => s.config);
  const selectedPresetId = useTuningWizardStore((s) => s.selectedPresetId);
  const selectPreset = useTuningWizardStore((s) => s.selectPreset);

  /** Compute metrics for each preset by merging onto current config. */
  const presetMetrics = useMemo(() => {
    if (!config) return null;
    const map = new Map<string, ReturnType<typeof computeMetrics>>();
    for (const preset of TUNING_PRESETS) {
      const merged = deepMerge(config as unknown as Record<string, unknown>, preset.config as unknown as DeepPartial<Record<string, unknown>>) as unknown as AppConfig;
      map.set(preset.id, computeMetrics(merged));
    }
    return map;
  }, [config]);

  function handleSelect(preset: TuningPreset) {
    if (selectedPresetId === preset.id) {
      selectPreset(null);
    } else {
      selectPreset(preset.id);
    }
  }

  // ─── Empty state: no config loaded ──────────────────────────────
  if (!config) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        <h2 className="font-sans text-lg font-semibold text-text-secondary">
          No configuration loaded
        </h2>
        <p className="mt-2 font-sans text-[15px] text-text-muted">
          Open a project with an application.yaml to begin tuning.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {/* Title section */}
      <div className="px-6 pt-16">
        <h1 className="font-display text-[22px] leading-[1.2] tracking-[1px] text-text-primary">
          Tuning Wizard
        </h1>
      </div>

      {/* Preset card row */}
      <div className="flex justify-center gap-8 px-6 mt-8">
        {TUNING_PRESETS.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            metrics={presetMetrics!.get(preset.id)!}
            isSelected={selectedPresetId === preset.id}
            isDimmed={selectedPresetId !== null && selectedPresetId !== preset.id}
            onSelect={() => handleSelect(preset)}
          />
        ))}
      </div>

      {/* Placeholder for SearchFilterBar + ParameterBrowser (Plan 02) */}
    </div>
  );
}
