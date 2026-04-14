import { create } from "zustand";
import type { WorldFile } from "@/types/world";
import { HISTORY_DEPTHS } from "@/lib/historyDepths";

const MAX_HISTORY = HISTORY_DEPTHS.ZONE;

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
  /**
   * Re-key a loaded zone from `oldId` to `newId`, updating its file path and
   * the `zone` field inside its data. Preserves undo/redo history. No-op if
   * the old zone is missing or the new id already exists.
   */
  renameZone: (oldId: string, newId: string, newFilePath: string) => void;
  removeZone: (zoneId: string) => void;
  clearZones: () => void;
  undo: (zoneId: string) => void;
  redo: (zoneId: string) => void;
  canUndo: (zoneId: string) => boolean;
  canRedo: (zoneId: string) => boolean;
}

/** Selector: count of zones with unsaved changes (returns a primitive). */
export const selectDirtyCount = (s: ZoneStore) => {
  let count = 0;
  for (const z of s.zones.values()) {
    if (z.dirty) count++;
  }
  return count;
};

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

  renameZone: (oldId, newId, newFilePath) =>
    set((state) => {
      if (oldId === newId) return state;
      const existing = state.zones.get(oldId);
      if (!existing) return state;
      if (state.zones.has(newId)) return state;

      // Rebuild the Map preserving insertion order so sidebar ordering is
      // stable (alphabetical sort happens at render time anyway).
      const zones = new Map<string, ZoneState>();
      for (const [id, zone] of state.zones) {
        if (id === oldId) {
          zones.set(newId, {
            ...existing,
            filePath: newFilePath,
            data: { ...existing.data, zone: newId },
            dirty: true,
          });
        } else {
          zones.set(id, zone);
        }
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
