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
    case "mount":
      return { type: "mount", mountId: String(raw.mountId ?? "") };
    default:
      return null;
  }
}

/**
 * Flatten legacy multi-variant definitions into one definition per variant.
 * Each sprite is now itself a variant, so a def carrying a `variants[]` array
 * is exploded into sibling definitions keyed by each variant's imageId — which
 * is also the asset's variant-group key, so generated images stay associated.
 * Variant race/class filters become requirements; gender/displayName carry over.
 * Returns whether any definition was rewritten so the caller can mark dirty.
 */
function flattenVariantDefinitions(
  defs: Record<string, SpriteDefinition>,
): { defs: Record<string, SpriteDefinition>; changed: boolean } {
  const out: Record<string, SpriteDefinition> = {};
  let changed = false;

  const claim = (preferred: string): string => {
    if (!out[preferred]) return preferred;
    let n = 1;
    while (out[`${preferred}_${n}`]) n += 1;
    return `${preferred}_${n}`;
  };

  for (const [id, def] of Object.entries(defs)) {
    if (!def.variants || def.variants.length === 0) {
      out[claim(id)] = def;
      continue;
    }
    changed = true;
    def.variants.forEach((variant, index) => {
      const newId = claim(variant.imageId || (index === 0 ? id : `${id}_v${index}`));
      const requirements: SpriteRequirement[] = [...def.requirements];
      if (variant.race && !requirements.some((r) => r.type === "race")) {
        requirements.push({ type: "race", race: variant.race });
      }
      if (variant.playerClass && !requirements.some((r) => r.type === "class")) {
        requirements.push({ type: "class", playerClass: variant.playerClass });
      }
      out[newId] = {
        displayName: variant.displayName ?? def.displayName,
        description: def.description,
        artDirection: def.artDirection,
        category: def.category,
        gender: variant.gender ?? def.gender,
        sortOrder: def.sortOrder + index,
        requirements,
        image: variant.imagePath || `player_sprites/${newId}.png`,
      };
    });
  }

  return { defs: out, changed };
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
    category: entry.category === "staff" ? "staff" : entry.category === "mount" ? "mount" : "general",
    gender: entry.gender ? String(entry.gender) : undefined,
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
    case "mount":
      return { type: "mount", mountId: req.mountId };
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
  if (def.gender) out.gender = def.gender;
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
      const flattened = flattenVariantDefinitions(defs);
      set({ definitions: flattened.defs, dirty: flattened.changed });
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
