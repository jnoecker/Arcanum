import { create } from "zustand";
import type { ValidationIssue } from "@/lib/validateZone";

interface ValidationStore {
  /** Map of zoneId -> issues from last validation run. null = never run. */
  results: Map<string, ValidationIssue[]> | null;
  /** Whether the validation panel is open */
  panelOpen: boolean;

  setResults: (results: Map<string, ValidationIssue[]>) => void;
  openPanel: () => void;
  closePanel: () => void;
  clear: () => void;
}

export const useValidationStore = create<ValidationStore>((set) => ({
  results: null,
  panelOpen: false,

  setResults: (results) => set({ results }),
  openPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
  clear: () => set({ results: null, panelOpen: false }),
}));
