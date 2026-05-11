import { create } from "zustand";

export interface QuestAuthoringStore {
  /** When set, the Quests panel should select this quest on mount/change. */
  pendingFocus: { zoneId: string; questId: string } | null;
  /** When set, the Quests panel should create a fresh quest in this zone and focus it. */
  pendingCreate: { zoneId: string } | null;

  setPendingFocus: (focus: { zoneId: string; questId: string } | null) => void;
  setPendingCreate: (create: { zoneId: string } | null) => void;
  consumePendingFocus: () => { zoneId: string; questId: string } | null;
  consumePendingCreate: () => { zoneId: string } | null;
}

export const useQuestAuthoringStore = create<QuestAuthoringStore>((set, get) => ({
  pendingFocus: null,
  pendingCreate: null,

  setPendingFocus: (pendingFocus) => set({ pendingFocus }),
  setPendingCreate: (pendingCreate) => set({ pendingCreate }),

  consumePendingFocus: () => {
    const focus = get().pendingFocus;
    if (focus) set({ pendingFocus: null });
    return focus;
  },
  consumePendingCreate: () => {
    const create = get().pendingCreate;
    if (create) set({ pendingCreate: null });
    return create;
  },
}));
