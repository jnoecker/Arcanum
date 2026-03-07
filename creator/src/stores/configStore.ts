import { create } from "zustand";
import type { AppConfig } from "@/types/config";

interface ConfigStore {
  config: AppConfig | null;
  dirty: boolean;

  setConfig: (config: AppConfig) => void;
  updateConfig: (config: AppConfig) => void;
  markClean: () => void;
  clearConfig: () => void;
}

export const useConfigStore = create<ConfigStore>((set) => ({
  config: null,
  dirty: false,

  setConfig: (config) => set({ config, dirty: false }),
  updateConfig: (config) => set({ config, dirty: true }),
  markClean: () => set({ dirty: false }),
  clearConfig: () => set({ config: null, dirty: false }),
}));
