import { create } from "zustand";
import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { parse, stringify } from "yaml";
import type { Project } from "@/types/project";
import type { SpriteDefinition, SpriteRequirement, SpriteVariant } from "@/types/sprites";

function spritesPath(project: Project): string {
  return project.format === "standalone"
    ? `${project.mudDir}/config/sprites.yaml`
    : `${project.mudDir}/src/main/resources/sprites.yaml`;
}

/** Parse a raw YAML requirement entry into a typed SpriteRequirement. */
function parseRequirement(raw: Record<string, unknown>): SpriteRequirement | null {
  switch (raw.type) {
    case "minLevel":
      return { type: "minLevel", level: Number(raw.level) || 0 };
    case "race":
      return { type: "race", race: String(raw.race ?? "") };
    case "class":
      return { type: "class", playerClass: String(raw.playerClass ?? "") };
    case "achievement":
      return { type: "achievement", achievementId: String(raw.achievementId ?? "") };
    case "staff":
      return { type: "staff" };
    default:
      return null;
  }
}

/** Parse a raw YAML entry into a SpriteDefinition. */
function parseDefinition(id: string, entry: Record<string, unknown>): SpriteDefinition {
  const requirements: SpriteRequirement[] = [];
  if (Array.isArray(entry.requirements)) {
    for (const r of entry.requirements) {
      if (r && typeof r === "object") {
        const req = parseRequirement(r as Record<string, unknown>);
        if (req) requirements.push(req);
      }
    }
  }

  const variants: SpriteVariant[] | undefined = Array.isArray(entry.variants)
    ? (entry.variants as SpriteVariant[])
    : undefined;

  return {
    displayName: String(entry.displayName ?? id),
    description: entry.description ? String(entry.description) : undefined,
    artDirection: entry.artDirection ? String(entry.artDirection) : undefined,
    category: entry.category === "staff" ? "staff" : "general",
    sortOrder: Number(entry.sortOrder) || 0,
    requirements,
    image: entry.image ? String(entry.image) : undefined,
    variants,
  };
}

/** Serialize a SpriteRequirement for YAML output. */
function requirementToPlain(req: SpriteRequirement): Record<string, unknown> {
  switch (req.type) {
    case "minLevel":
      return { type: "minLevel", level: req.level };
    case "race":
      return { type: "race", race: req.race };
    case "class":
      return { type: "class", playerClass: req.playerClass };
    case "achievement":
      return { type: "achievement", achievementId: req.achievementId };
    case "staff":
      return { type: "staff" };
  }
}

/** Serialize a SpriteDefinition for YAML output. */
function definitionToPlain(def: SpriteDefinition): Record<string, unknown> {
  const out: Record<string, unknown> = {
    displayName: def.displayName,
  };
  if (def.description) out.description = def.description;
  if (def.artDirection) out.artDirection = def.artDirection;
  out.category = def.category;
  out.sortOrder = def.sortOrder;
  // Always emit a non-empty requirements list. The MUD's SpriteLoader rejects
  // sprites with no unlock specification (it reads an empty `type` field and
  // throws "unknown unlock type ''"), so we use minLevel:0 — equivalent to
  // "no requirement", since player levels start at 1.
  out.requirements = def.requirements.length > 0
    ? def.requirements.map(requirementToPlain)
    : [{ type: "minLevel", level: 0 }];
  if (def.variants && def.variants.length > 0) {
    out.variants = def.variants;
  } else if (def.image) {
    out.image = def.image;
  }
  return out;
}

interface SpriteDefinitionStore {
  definitions: Record<string, SpriteDefinition>;
  dirty: boolean;

  loadDefinitions: (project: Project) => Promise<void>;
  saveDefinitions: (project: Project) => Promise<void>;
  setDefinition: (id: string, def: SpriteDefinition) => void;
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
      // Support both wrapped (`sprites:` root key) and flat (legacy) format
      const spriteMap = (parsed.sprites && typeof parsed.sprites === "object")
        ? parsed.sprites as Record<string, any>
        : parsed;
      const defs: Record<string, SpriteDefinition> = {};
      for (const [id, entry] of Object.entries(spriteMap)) {
        if (entry && typeof entry === "object") {
          defs[id] = parseDefinition(id, entry as Record<string, unknown>);
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

    const output: Record<string, unknown> = {};
    for (const [id, def] of Object.entries(definitions)) {
      output[id] = definitionToPlain(def);
    }

    const yaml = stringify({ sprites: output }, { lineWidth: 120 });
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
