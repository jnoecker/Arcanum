import { create } from "zustand";
import type { WorldFile } from "@/types/world";

export interface ZoneState {
  filePath: string;
  data: WorldFile;
  dirty: boolean;
}

interface ZoneStore {
  zones: Map<string, ZoneState>;

  loadZone: (zoneId: string, filePath: string, data: WorldFile) => void;
  updateZone: (zoneId: string, data: WorldFile) => void;
  markClean: (zoneId: string) => void;
  clearZones: () => void;
}

export const useZoneStore = create<ZoneStore>((set) => ({
  zones: new Map(),

  loadZone: (zoneId, filePath, data) =>
    set((state) => {
      const zones = new Map(state.zones);
      zones.set(zoneId, { filePath, data, dirty: false });
      return { zones };
    }),

  updateZone: (zoneId, data) =>
    set((state) => {
      const zones = new Map(state.zones);
      const existing = zones.get(zoneId);
      if (existing) {
        zones.set(zoneId, { ...existing, data, dirty: true });
      }
      return { zones };
    }),

  markClean: (zoneId) =>
    set((state) => {
      const zones = new Map(state.zones);
      const existing = zones.get(zoneId);
      if (existing) {
        zones.set(zoneId, { ...existing, dirty: false });
      }
      return { zones };
    }),

  clearZones: () => set({ zones: new Map() }),
}));
