import { create } from "zustand";
import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { parse, stringify } from "yaml";
import type { Project } from "@/types/project";
import type { AchievementSpriteDef } from "@/types/sprites";

function spritesPath(project: Project): string {
  return project.format === "standalone"
    ? `${project.mudDir}/config/sprites.yaml`
    : `${project.mudDir}/src/main/resources/sprites.yaml`;
}

interface SpriteDefinitionStore {
  definitions: Record<string, AchievementSpriteDef>;
  dirty: boolean;

  loadDefinitions: (project: Project) => Promise<void>;
  saveDefinitions: (project: Project) => Promise<void>;
  setDefinition: (id: string, def: AchievementSpriteDef) => void;
  deleteDefinition: (id: string) => void;
  markClean: () => void;
}

export const useSpriteDefinitionStore = create<SpriteDefinitionStore>((set, get) => ({
  definitions: {},
  dirty: false,

  loadDefinitions: async (project) => {
    const path = spritesPath(project);
    if (!(await exists(path))) {
      set({ definitions: {}, dirty: false });
      return;
    }
    try {
      const raw = await readTextFile(path);
      const parsed = parse(raw) as Record<string, any> | null;
      if (!parsed || typeof parsed !== "object") {
        set({ definitions: {}, dirty: false });
        return;
      }
      // Extract only achievement entries
      const defs: Record<string, AchievementSpriteDef> = {};
      for (const [id, entry] of Object.entries(parsed)) {
        if (entry?.category === "achievement" && entry?.unlock?.type === "achievement") {
          defs[id] = {
            displayName: entry.displayName ?? id,
            sortOrder: entry.sortOrder ?? 0,
            achievementId: entry.unlock.achievementId ?? "",
            brief: entry.brief,
            variants: Array.isArray(entry.variants) ? entry.variants : [],
          };
        }
      }
      set({ definitions: defs, dirty: false });
    } catch {
      set({ definitions: {}, dirty: false });
    }
  },

  saveDefinitions: async (project) => {
    const { definitions } = get();
    const path = spritesPath(project);

    // Read existing file to preserve non-achievement entries
    let existing: Record<string, any> = {};
    try {
      if (await exists(path)) {
        const raw = await readTextFile(path);
        existing = (parse(raw) as Record<string, any>) ?? {};
      }
    } catch {
      // start fresh
    }

    // Remove old achievement entries
    for (const [id, entry] of Object.entries(existing)) {
      if (entry?.category === "achievement") {
        delete existing[id];
      }
    }

    // Add current achievement definitions in sprites.yaml format
    for (const [id, def] of Object.entries(definitions)) {
      existing[id] = {
        displayName: def.displayName,
        category: "achievement",
        sortOrder: def.sortOrder,
        ...(def.brief ? { brief: def.brief } : {}),
        unlock: {
          type: "achievement",
          achievementId: def.achievementId,
        },
        variants: def.variants,
      };
    }

    const yaml = stringify(existing, { lineWidth: 120 });
    await writeTextFile(path, yaml);
    set({ dirty: false });
  },

  setDefinition: (id, def) =>
    set((s) => ({
      definitions: { ...s.definitions, [id]: def },
      dirty: true,
    })),

  deleteDefinition: (id) =>
    set((s) => {
      const next = { ...s.definitions };
      delete next[id];
      return { definitions: next, dirty: true };
    }),

  markClean: () => set({ dirty: false }),
}));
