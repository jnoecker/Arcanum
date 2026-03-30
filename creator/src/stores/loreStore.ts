import { create } from "zustand";
import type { WorldLore, WorldSetting, Faction, CodexEntry } from "@/types/lore";

interface LoreStore {
  lore: WorldLore | null;
  dirty: boolean;

  setLore: (lore: WorldLore) => void;
  updateLore: (patch: Partial<WorldLore>) => void;
  updateSetting: (patch: Partial<WorldSetting>) => void;
  updateFaction: (id: string, patch: Partial<Faction>) => void;
  updateCodexEntry: (id: string, patch: Partial<CodexEntry>) => void;
  markClean: () => void;
  clearLore: () => void;
}

export const useLoreStore = create<LoreStore>((set) => ({
  lore: null,
  dirty: false,

  setLore: (lore) => set({ lore, dirty: false }),

  updateLore: (patch) =>
    set((s) => (s.lore ? { lore: { ...s.lore, ...patch }, dirty: true } : s)),

  updateSetting: (patch) =>
    set((s) =>
      s.lore
        ? { lore: { ...s.lore, setting: { ...s.lore.setting, ...patch } }, dirty: true }
        : s,
    ),

  updateFaction: (id, patch) =>
    set((s) => {
      if (!s.lore) return s;
      const existing = s.lore.factions[id];
      if (!existing) return s;
      return {
        lore: {
          ...s.lore,
          factions: { ...s.lore.factions, [id]: { ...existing, ...patch } },
        },
        dirty: true,
      };
    }),

  updateCodexEntry: (id, patch) =>
    set((s) => {
      if (!s.lore) return s;
      const existing = s.lore.codex[id];
      if (!existing) return s;
      return {
        lore: {
          ...s.lore,
          codex: { ...s.lore.codex, [id]: { ...existing, ...patch } },
        },
        dirty: true,
      };
    }),

  markClean: () => set({ dirty: false }),
  clearLore: () => set({ lore: null, dirty: false }),
}));
