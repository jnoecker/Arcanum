// ─── Tuning Wizard Store ────────────────────────────────────────────
// Session-only UI state for the Tuning Wizard workspace.
// No persistence -- resets each session.

import { create } from "zustand";
import { TuningSection } from "@/lib/tuning/types";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import { TUNING_PRESETS } from "@/lib/tuning/presets";
import { computeDiff } from "@/lib/tuning/diffEngine";
import { computeMetrics } from "@/lib/tuning/formulas";
import { deepMerge, buildPartialFromDiffs } from "@/lib/tuning/merge";
import { checkTuningHealth, checkPacingHealth } from "@/lib/tuning/healthCheck";
import type { HealthWarning } from "@/lib/tuning/healthCheck";
import type { AppConfig } from "@/types/config";
import { useToastStore } from "@/stores/toastStore";

const ALL_SECTIONS = new Set([
  TuningSection.CombatStats,
  TuningSection.EconomyCrafting,
  TuningSection.ProgressionQuests,
  TuningSection.WorldSocial,
]);

interface TuningWizardStore {
  selectedPresetId: string | null;
  searchQuery: string;
  activeSections: Set<TuningSection>;
  collapsedSections: Set<TuningSection>;
  acceptedSections: Set<TuningSection>;
  configSnapshot: AppConfig | null;
  undoAvailable: boolean;
  healthWarnings: HealthWarning[];
  applySuccess: boolean;
  actionError: string | null;
  selectPreset: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  toggleSection: (s: TuningSection) => void;
  toggleCollapsed: (s: TuningSection) => void;
  collapseAll: () => void;
  toggleAccepted: (s: TuningSection) => void;
  applyPreset: () => Promise<void>;
  undoApply: () => Promise<void>;
  resetWizard: () => void;
  setHealthWarnings: (w: HealthWarning[]) => void;
  clearApplySuccess: () => void;
  clearActionError: () => void;
}

export const useTuningWizardStore = create<TuningWizardStore>((set, get) => ({
  selectedPresetId: null,
  searchQuery: "",
  activeSections: new Set(ALL_SECTIONS),
  collapsedSections: new Set(),
  acceptedSections: new Set(ALL_SECTIONS),
  configSnapshot: null,
  undoAvailable: false,
  healthWarnings: [],
  applySuccess: false,
  actionError: null,

  selectPreset: (id) =>
    set({
      selectedPresetId: id,
      acceptedSections: new Set(ALL_SECTIONS),
      healthWarnings: [],
      applySuccess: false,
      actionError: null,
    }),

  setSearchQuery: (q) => set({ searchQuery: q }),

  toggleSection: (s) =>
    set((state) => {
      const next = new Set(state.activeSections);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return { activeSections: next };
    }),

  toggleCollapsed: (s) =>
    set((state) => {
      const next = new Set(state.collapsedSections);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return { collapsedSections: next };
    }),

  collapseAll: () =>
    set({
      collapsedSections: new Set([
        TuningSection.CombatStats,
        TuningSection.EconomyCrafting,
        TuningSection.ProgressionQuests,
        TuningSection.WorldSocial,
      ]),
    }),

  toggleAccepted: (s) =>
    set((state) => {
      const next = new Set(state.acceptedSections);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return { acceptedSections: next };
    }),

  applyPreset: async () => {
    const { selectedPresetId, acceptedSections } = get();
    if (!selectedPresetId || acceptedSections.size === 0) return;

    const config = useConfigStore.getState().config;
    const wasDirty = useConfigStore.getState().dirty;
    const project = useProjectStore.getState().project;
    if (!config || !project) return;

    // D-05: Snapshot before apply
    const snapshot = structuredClone(config);

    // Compute pre-apply metrics for health check
    const preMetrics = computeMetrics(config);

    const preset = TUNING_PRESETS.find((p) => p.id === selectedPresetId);
    if (!preset) return;

    // Build partial from accepted sections only
    const diffs = computeDiff(
      config as unknown as Record<string, unknown>,
      preset.config as unknown as Record<string, unknown>,
    );
    const partial = buildPartialFromDiffs(diffs, acceptedSections);
    const merged = deepMerge(
      config as unknown as Record<string, unknown>,
      partial,
    ) as unknown as AppConfig;

    // Don't silently flip on daily/global quests when the prereq content
    // (dailyPool / weeklyPool / objectives) isn't authored — doing so produces
    // config validation errors. Keep the flag off and warn the user.
    const suppressedFeatures: string[] = [];
    if (merged.dailyQuests?.enabled && !config.dailyQuests?.enabled) {
      const dq = merged.dailyQuests;
      const dailyOK = (dq.dailyPool?.length ?? 0) >= (dq.dailySlots ?? 3);
      const weeklyOK = (dq.weeklyPool?.length ?? 0) >= (dq.weeklySlots ?? 1);
      if (!dailyOK || !weeklyOK) {
        merged.dailyQuests = { ...dq, enabled: false };
        suppressedFeatures.push("Daily Quests");
      }
    }
    if (merged.globalQuests?.enabled && !config.globalQuests?.enabled) {
      const gq = merged.globalQuests;
      if ((gq.objectives?.length ?? 0) === 0) {
        merged.globalQuests = { ...gq, enabled: false };
        suppressedFeatures.push("Global Quests");
      }
    }

    try {
      // Apply to configStore and persist (D-11)
      useConfigStore.getState().updateConfig(merged);
      const { saveProjectConfig } = await import("@/lib/saveConfig");
      await saveProjectConfig(project);
      useConfigStore.getState().markClean();

      // Health check (D-09): only when mixed sections
      const postMetrics = computeMetrics(merged);
      const warnings = [
        ...checkTuningHealth(preMetrics, postMetrics, acceptedSections),
        ...checkPacingHealth(merged, selectedPresetId),
      ];
      if (suppressedFeatures.length > 0) {
        warnings.push({
          severity: "warning",
          message: `${suppressedFeatures.join(" and ")} left disabled — the preset would have enabled ${suppressedFeatures.length > 1 ? "them" : "it"}, but required content isn't authored yet.`,
          detail: "Add at least dailySlots entries to dailyPool, weeklySlots entries to weeklyPool, and one objective to globalQuests, then toggle Enabled on the Daily Quests / Global Quests panels.",
        });
      }

      set({
        configSnapshot: snapshot,
        undoAvailable: true,
        applySuccess: true,
        healthWarnings: warnings,
        actionError: null,
      });
      useToastStore.getState().show({
        kicker: "Tuning Wizard",
        message: "Preset sections applied and saved.",
        variant: "astral",
      });
    } catch (err) {
      useConfigStore.getState().updateConfig(snapshot);
      if (!wasDirty) {
        useConfigStore.getState().markClean();
      }
      const message = err instanceof Error ? err.message : String(err);
      set({
        configSnapshot: null,
        undoAvailable: false,
        applySuccess: false,
        healthWarnings: [],
        actionError: message,
      });
      useToastStore.getState().show({
        kicker: "Tuning Wizard",
        message: `Apply failed: ${message}`,
        variant: "ember",
      }, 4000);
    }
  },

  undoApply: async () => {
    const { configSnapshot } = get();
    if (!configSnapshot) return;

    const wasDirty = useConfigStore.getState().dirty;
    const project = useProjectStore.getState().project;
    if (!project) return;

    try {
      useConfigStore.getState().updateConfig(configSnapshot);
      const { saveProjectConfig } = await import("@/lib/saveConfig");
      await saveProjectConfig(project);
      useConfigStore.getState().markClean();

      set({
        configSnapshot: null,
        undoAvailable: false,
        healthWarnings: [],
        applySuccess: false,
        actionError: null,
      });
      useToastStore.getState().show({
        kicker: "Tuning Wizard",
        message: "Last preset apply was undone.",
      });
    } catch (err) {
      if (!wasDirty) {
        useConfigStore.getState().markClean();
      }
      const message = err instanceof Error ? err.message : String(err);
      set({
        applySuccess: false,
        actionError: message,
      });
      useToastStore.getState().show({
        kicker: "Tuning Wizard",
        message: `Undo failed: ${message}`,
        variant: "ember",
      }, 4000);
    }
  },

  resetWizard: () =>
    set({
      selectedPresetId: null,
      searchQuery: "",
      activeSections: new Set(ALL_SECTIONS),
      collapsedSections: new Set(),
      acceptedSections: new Set(ALL_SECTIONS),
      configSnapshot: null,
      undoAvailable: false,
      healthWarnings: [],
      applySuccess: false,
      actionError: null,
    }),

  setHealthWarnings: (w) => set({ healthWarnings: w }),
  clearApplySuccess: () => set({ applySuccess: false }),
  clearActionError: () => set({ actionError: null }),
}));
