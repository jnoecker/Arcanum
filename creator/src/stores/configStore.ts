import { create } from "zustand";
import type { AppConfig } from "@/types/config";
import { snapshot as histSnapshot, undo as histUndo, redo as histRedo } from "@/lib/historyStack";
import { HISTORY_DEPTHS } from "@/lib/historyDepths";

const MAX_CONFIG_HISTORY = HISTORY_DEPTHS.CONFIG;

interface ConfigStore {
  config: AppConfig | null;
  dirty: boolean;
  configPast: AppConfig[];
  configFuture: AppConfig[];

  setConfig: (config: AppConfig) => void;
  updateConfig: (config: AppConfig) => void;
  markClean: () => void;
  clearConfig: () => void;
  undoConfig: () => void;
  redoConfig: () => void;
  canUndoConfig: () => boolean;
  canRedoConfig: () => boolean;
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  config: null,
  dirty: false,
  configPast: [],
  configFuture: [],

  // Replace config without recording history — used when loading from disk.
  setConfig: (config) => set({ config, dirty: false, configPast: [], configFuture: [] }),

  updateConfig: (config) =>
    set((s) => {
      if (!s.config) return { config, dirty: true };
      const { past, future } = histSnapshot(s.configPast, s.config, MAX_CONFIG_HISTORY);
      return { config, dirty: true, configPast: past, configFuture: future };
    }),

  markClean: () => set({ dirty: false }),

  clearConfig: () => set({ config: null, dirty: false, configPast: [], configFuture: [] }),

  undoConfig: () =>
    set((s) => {
      if (!s.config) return s;
      const result = histUndo(s.configPast, s.config, s.configFuture);
      if (!result) return s;
      return { config: result.data, dirty: true, configPast: result.past, configFuture: result.future };
    }),

  redoConfig: () =>
    set((s) => {
      if (!s.config) return s;
      const result = histRedo(s.configPast, s.config, s.configFuture);
      if (!result) return s;
      return { config: result.data, dirty: true, configPast: result.past, configFuture: result.future };
    }),

  canUndoConfig: () => get().configPast.length > 0,
  canRedoConfig: () => get().configFuture.length > 0,
}));
