import { create } from "zustand";
import type { WorldFile } from "@/types/world";

const MAX_HISTORY = 100;

export interface ZoneState {
  filePath: string;
  data: WorldFile;
  dirty: boolean;
  past: WorldFile[];
  future: WorldFile[];
}

interface ZoneStore {
  zones: Map<string, ZoneState>;

  loadZone: (zoneId: string, filePath: string, data: WorldFile) => void;
  updateZone: (zoneId: string, data: WorldFile) => void;
  markClean: (zoneId: string) => void;
  removeZone: (zoneId: string) => void;
  clearZones: () => void;
  undo: (zoneId: string) => void;
  redo: (zoneId: string) => void;
  canUndo: (zoneId: string) => boolean;
  canRedo: (zoneId: string) => boolean;
}

export const useZoneStore = create<ZoneStore>((set, get) => ({
  zones: new Map(),

  loadZone: (zoneId, filePath, data) =>
    set((state) => {
      const zones = new Map(state.zones);
      zones.set(zoneId, { filePath, data, dirty: false, past: [], future: [] });
      return { zones };
    }),

  updateZone: (zoneId, data) =>
    set((state) => {
      const zones = new Map(state.zones);
      const existing = zones.get(zoneId);
      if (existing) {
        const past = [...existing.past, existing.data];
        if (past.length > MAX_HISTORY) past.splice(0, past.length - MAX_HISTORY);
        zones.set(zoneId, {
          ...existing,
          data,
          dirty: true,
          past,
          future: [], // new edit clears redo stack
        });
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

  removeZone: (zoneId) =>
    set((state) => {
      const zones = new Map(state.zones);
      zones.delete(zoneId);
      return { zones };
    }),

  clearZones: () => set({ zones: new Map() }),

  undo: (zoneId) =>
    set((state) => {
      const zones = new Map(state.zones);
      const zone = zones.get(zoneId);
      if (!zone || zone.past.length === 0) return state;

      const past = [...zone.past];
      const prev = past.pop()!;
      zones.set(zoneId, {
        ...zone,
        data: prev,
        dirty: true,
        past,
        future: [zone.data, ...zone.future],
      });
      return { zones };
    }),

  redo: (zoneId) =>
    set((state) => {
      const zones = new Map(state.zones);
      const zone = zones.get(zoneId);
      if (!zone || zone.future.length === 0) return state;

      const future = [...zone.future];
      const next = future.shift()!;
      zones.set(zoneId, {
        ...zone,
        data: next,
        dirty: true,
        past: [...zone.past, zone.data],
        future,
      });
      return { zones };
    }),

  canUndo: (zoneId) => {
    const zone = get().zones.get(zoneId);
    return !!zone && zone.past.length > 0;
  },

  canRedo: (zoneId) => {
    const zone = get().zones.get(zoneId);
    return !!zone && zone.future.length > 0;
  },
}));
