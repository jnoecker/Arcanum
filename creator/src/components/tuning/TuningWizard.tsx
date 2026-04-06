// ─── Tuning Wizard Workspace ────────────────────────────────────────
// Root component for the Tuning Wizard. Shows preset cards, a sticky
// search/filter bar, and a parameter browser with diff highlighting.

import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import { useTuningWizardStore } from "@/stores/tuningWizardStore";
import { TUNING_PRESETS } from "@/lib/tuning/presets";
import type { TuningPreset } from "@/lib/tuning/presets";
import { computeMetrics } from "@/lib/tuning/formulas";
import { FIELD_METADATA } from "@/lib/tuning/fieldMetadata";
import { computeDiff, groupDiffBySection } from "@/lib/tuning/diffEngine";
import { TuningSection } from "@/lib/tuning/types";
import { deepMerge, setNestedValue } from "@/lib/tuning/merge";
import type { AppConfig } from "@/types/config";
import type { DeepPartial, FieldMeta, DiffEntry } from "@/lib/tuning/types";
import { PresetCard } from "./PresetCard";
import { SearchFilterBar } from "./SearchFilterBar";
import { ParameterSection } from "./ParameterSection";
import { MetricSectionCards } from "./MetricSectionCards";
import { ApplyFooterBar } from "./ApplyFooterBar";
import { HealthCheckBanner } from "./HealthCheckBanner";
import { ChartRow } from "./charts/ChartRow";
import { Spinner } from "@/components/ui/FormWidgets";

const ALL_SECTIONS_ORDERED = [
  TuningSection.CombatStats,
  TuningSection.EconomyCrafting,
  TuningSection.ProgressionQuests,
  TuningSection.WorldSocial,
];

const PRESET_BORDER: Record<string, string> = {
  casual: "border-warm",
  balanced: "border-stellar-blue",
  hardcore: "border-status-error",
  soloStory: "border-status-success",
  pvpArena: "border-status-warning",
  loreExplorer: "border-accent",
};

export function TuningWizard() {
  const config = useConfigStore((s) => s.config);
  const dirty = useConfigStore((s) => s.dirty);
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const project = useProjectStore((s) => s.project);
  const selectedPresetId = useTuningWizardStore((s) => s.selectedPresetId);
  const selectPreset = useTuningWizardStore((s) => s.selectPreset);
  const searchQuery = useTuningWizardStore((s) => s.searchQuery);
  const activeSections = useTuningWizardStore((s) => s.activeSections);
  const collapsedSections = useTuningWizardStore((s) => s.collapsedSections);
  const toggleCollapsed = useTuningWizardStore((s) => s.toggleCollapsed);
  const collapseAll = useTuningWizardStore((s) => s.collapseAll);
  const acceptedSections = useTuningWizardStore((s) => s.acceptedSections);
  const toggleAccepted = useTuningWizardStore((s) => s.toggleAccepted);

  const browserRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  /** Inline edit: update a single field by dot-path in the config. */
  const handleValueChange = useCallback(
    (path: string, value: unknown) => {
      if (!config) return;
      const clone = structuredClone(config) as unknown as Record<string, unknown>;
      setNestedValue(clone, path, value);
      updateConfig(clone as unknown as AppConfig);
    },
    [config, updateConfig],
  );

  /** Explicit save to disk. */
  const handleSave = useCallback(async () => {
    if (!project || saving) return;
    setSaving(true);
    try {
      const { saveProjectConfig } = await import("@/lib/saveConfig");
      await saveProjectConfig(project);
      useConfigStore.getState().markClean();
    } catch (err) {
      console.error("Tuning save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [project, saving]);

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

  /** Compute metrics for the current config. */
  const currentMetrics = useMemo(() => {
    if (!config) return null;
    return computeMetrics(config);
  }, [config]);

  /** Find the currently selected preset object. */
  const selectedPreset = TUNING_PRESETS.find((p) => p.id === selectedPresetId) ?? null;

  /** Merged config for the selected preset. */
  const presetConfig = useMemo(() => {
    if (!selectedPreset || !config) return null;
    return deepMerge(
      config as unknown as Record<string, unknown>,
      selectedPreset.config as unknown as DeepPartial<Record<string, unknown>>,
    ) as unknown as AppConfig;
  }, [config, selectedPreset]);

  /** Metrics for the active (selected) preset. */
  const activePresetMetrics = useMemo(() => {
    if (!presetConfig) return null;
    return computeMetrics(presetConfig);
  }, [presetConfig]);

  /** Diff counts per section for the World & Social footnote. */
  const sectionDiffCounts = useMemo(() => {
    if (!selectedPresetId || !config) return undefined;
    const preset = TUNING_PRESETS.find((p) => p.id === selectedPresetId);
    if (!preset) return undefined;
    const diffs = computeDiff(
      config as unknown as Record<string, unknown>,
      preset.config as unknown as Record<string, unknown>,
    );
    const grouped = groupDiffBySection(diffs);
    const counts = new Map<string, number>();
    for (const [section, entries] of Object.entries(grouped)) {
      counts.set(section, entries.length);
    }
    return counts;
  }, [selectedPresetId, config]);

  /** Filter fields by active sections and search query. */
  const filteredFields = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase();
    return (Object.entries(FIELD_METADATA) as [string, FieldMeta][]).filter(([path, meta]) => {
      if (!activeSections.has(meta.section)) return false;
      if (!searchQuery) return true;
      return (
        meta.label.toLowerCase().includes(lowerQuery) ||
        meta.description.toLowerCase().includes(lowerQuery) ||
        path.toLowerCase().includes(lowerQuery)
      );
    });
  }, [searchQuery, activeSections]);

  /** Group filtered fields by section in display order. */
  const groupedFields = useMemo(() => {
    const groups = new Map<string, [string, FieldMeta][]>([
      [TuningSection.CombatStats, []],
      [TuningSection.EconomyCrafting, []],
      [TuningSection.ProgressionQuests, []],
      [TuningSection.WorldSocial, []],
    ]);
    for (const [path, meta] of filteredFields) {
      groups.get(meta.section)!.push([path, meta]);
    }
    return groups;
  }, [filteredFields]);

  /** Compute diffs between current config and selected preset. */
  const diffMap = useMemo(() => {
    if (!selectedPresetId || !config) return new Map<string, DiffEntry>();
    const preset = TUNING_PRESETS.find((p) => p.id === selectedPresetId);
    if (!preset) return new Map<string, DiffEntry>();
    const diffs = computeDiff(
      config as unknown as Record<string, unknown>,
      preset.config as unknown as Record<string, unknown>,
    );
    return new Map(diffs.map((d) => [d.path, d]));
  }, [selectedPresetId, config]);

  const totalFilteredCount = filteredFields.length;
  const presetAccentBorder = selectedPresetId ? PRESET_BORDER[selectedPresetId] : undefined;

  /** Scroll parameter browser into view when a preset is selected. */
  useEffect(() => {
    if (selectedPresetId && browserRef.current) {
      browserRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedPresetId]);

  function handleSelect(preset: TuningPreset) {
    if (selectedPresetId === preset.id) {
      selectPreset(null);
      // do NOT collapseAll on deselect -- preserve builder's expanded state
    } else {
      selectPreset(preset.id);
      collapseAll();
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
      {/* Title section + save button */}
      <div className="flex items-center justify-between px-6 pt-16">
        <h1 className="font-display text-[22px] leading-[1.2] tracking-[1px] text-text-primary">
          Tuning Wizard
        </h1>
        {(dirty || saving) && (
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="focus-ring rounded-full border border-white/10 bg-bg-primary/80 px-4 py-1.5 text-sm font-medium text-accent shadow-md backdrop-blur-sm transition hover:bg-bg-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? <span className="flex items-center gap-1.5"><Spinner />Saving</span> : "Save Changes"}
          </button>
        )}
      </div>

      {/* Preset card grid */}
      <div className="grid grid-cols-3 justify-items-center gap-4 px-6 mt-8 max-w-[1020px] mx-auto">
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

      {/* Metric summary cards (D-05, D-06) */}
      {selectedPresetId && currentMetrics && activePresetMetrics && (
        <MetricSectionCards
          currentMetrics={currentMetrics}
          presetMetrics={activePresetMetrics}
          diffCounts={sectionDiffCounts}
        />
      )}

      {/* Chart visualizations (VIZ-01, VIZ-02, VIZ-03) */}
      {selectedPresetId && currentMetrics && activePresetMetrics && presetConfig && (
        <ChartRow
          currentConfig={config}
          presetConfig={presetConfig}
          currentMetrics={currentMetrics}
          presetMetrics={activePresetMetrics}
        />
      )}

      {/* Health check banner (D-08) -- after metric cards, before search */}
      <HealthCheckBanner />

      {/* Sticky search/filter bar */}
      <SearchFilterBar />

      {/* Parameter browser */}
      <div ref={browserRef} className={`px-6 ${selectedPresetId ? "pb-20" : "pb-8"}`}>
        {totalFilteredCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="font-sans text-lg font-semibold text-text-secondary">
              No parameters found
            </p>
            <p className="mt-2 font-sans text-[15px] text-text-muted">
              Try broadening your search or enabling more section filters.
            </p>
          </div>
        ) : (
          ALL_SECTIONS_ORDERED.map((section) => {
            const fields = groupedFields.get(section) ?? [];
            if (fields.length === 0) return null;
            const isAccepted = acceptedSections.has(section);
            return (
              <div
                key={section}
                className={`transition-opacity duration-300 ${
                  selectedPresetId && !isAccepted ? "opacity-[0.45]" : ""
                }`}
              >
                <ParameterSection
                  section={section}
                  fields={fields}
                  currentConfig={config as unknown as Record<string, unknown>}
                  diffMap={diffMap}
                  hasPreset={selectedPresetId !== null}
                  isAccepted={isAccepted}
                  onToggleAccepted={() => toggleAccepted(section)}
                  isCollapsed={collapsedSections.has(section)}
                  onToggleCollapsed={() => toggleCollapsed(section)}
                  presetAccentBorder={presetAccentBorder}
                  onValueChange={handleValueChange}
                />
              </div>
            );
          })
        )}
      </div>

      {/* Apply footer bar (D-04) */}
      {selectedPresetId && <ApplyFooterBar />}
    </div>
  );
}
