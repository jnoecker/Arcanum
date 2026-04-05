// ─── Tuning Wizard Store ────────────────────────────────────────────
// Session-only UI state for the Tuning Wizard workspace.
// No persistence -- resets each session.

import { create } from "zustand";
import { TuningSection } from "@/lib/tuning/types";

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
  selectPreset: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  toggleSection: (s: TuningSection) => void;
  toggleCollapsed: (s: TuningSection) => void;
  collapseAll: () => void;
}

export const useTuningWizardStore = create<TuningWizardStore>((set) => ({
  selectedPresetId: null,
  searchQuery: "",
  activeSections: new Set(ALL_SECTIONS),
  collapsedSections: new Set(),
  selectPreset: (id) => set({ selectedPresetId: id }),
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
}));
