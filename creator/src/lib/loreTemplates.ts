import type { ArticleTemplate, CustomTemplateDefinition } from "@/types/lore";

/** Color palette for custom template badge pickers — references design token hex values. */
export const CUSTOM_TEMPLATE_COLORS = [
  "#ff7d00", "#15616d", "#ffecd1", "#78290f", "#ffb86b",
  "#35a1b0", "#c0622a", "#ad9d88", "#7cb66d", "#d88c3a",
];

// ─── Template field definitions ─────────────────────────────────────

export interface TemplateFieldDef {
  key: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "select"
    | "tags"
    | "article_ref"
    | "article_refs"
    | "number"
    | "config_faction_ref";
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface TemplateSchema {
  template: ArticleTemplate;
  label: string;
  pluralLabel: string;
  description?: string;
  aiDescription?: string;
  fields: TemplateFieldDef[];
}

// ─── Schema registry ────────────────────────────────────────────────

export const TEMPLATE_SCHEMAS: Record<ArticleTemplate, TemplateSchema> = {
  world_setting: {
    template: "world_setting",
    label: "World Setting",
    pluralLabel: "World Settings",
    description: "The top-level overview of your world — its name, themes, history, and setting.",
    aiDescription: "One per world. Serves as the root context for all other articles.",
    fields: [
      { key: "name", label: "World name", type: "text", placeholder: "The name of your world" },
      { key: "tagline", label: "Tagline", type: "text", placeholder: "A one-line hook for your setting" },
      { key: "tone", label: "Tone", type: "text", placeholder: "e.g. whimsical, grimdark, heroic, cozy, surreal" },
      {
        key: "language",
        label: "Output language",
        type: "select",
        options: [
          { value: "", label: "English (default)" },
          { value: "français", label: "Français" },
          { value: "español", label: "Español" },
          { value: "deutsch", label: "Deutsch" },
          { value: "italiano", label: "Italiano" },
          { value: "português", label: "Português" },
          { value: "русский", label: "Русский" },
          { value: "日本語", label: "日本語" },
          { value: "中文", label: "中文" },
          { value: "한국어", label: "한국어" },
          { value: "other", label: "Other (write in the world language below in the prose)" },
        ],
      },
      { key: "visualStyle", label: "Visual style", type: "textarea", placeholder: "Describe the art style for generated images — e.g. 'dreamy watercolor storybook illustration with soft pastels' or 'gritty dark fantasy oil painting with desaturated earth tones'" },
      { key: "era", label: "Current era", type: "text", placeholder: "e.g. The Age of Fractures" },
      { key: "themes", label: "Themes", type: "tags", placeholder: "Add a theme..." },
      { key: "geography", label: "Geography", type: "textarea", placeholder: "Continents, biomes, major landmarks..." },
      { key: "magic", label: "Magic system", type: "textarea", placeholder: "How magic works, its sources and limits..." },
      { key: "technology", label: "Technology", type: "textarea", placeholder: "What level of technology exists?" },
      { key: "history", label: "History", type: "textarea", placeholder: "Creation myth, major ages, wars..." },
      { key: "appearance", label: "Appearance", type: "textarea", placeholder: "What the world looks like — signature visual motifs, dominant colors, characteristic forms..." },
    ],
  },

  organization: {
    template: "organization",
    label: "Organization",
    pluralLabel: "Organizations",
    fields: [
      { key: "motto", label: "Motto", type: "text", placeholder: "A rallying cry or creed" },
      { key: "leader", label: "Leader", type: "text", placeholder: "Current leader or ruling body" },
      { key: "territory", label: "Territory", type: "text", placeholder: "Regions or strongholds" },
      { key: "values", label: "Values", type: "tags", placeholder: "Add a core value..." },
      { key: "configFactionId", label: "Game faction", type: "config_faction_ref", placeholder: "Link to a mechanical faction" },
      { key: "appearance", label: "Appearance", type: "textarea", placeholder: "Heraldry, regalia, signature colors and symbols..." },
    ],
  },

  character: {
    template: "character",
    label: "Character",
    pluralLabel: "Characters",
    fields: [
      { key: "fullName", label: "Full name", type: "text", placeholder: "Full name or title" },
      { key: "title", label: "Title", type: "text", placeholder: "King, Captain, High Priestess..." },
      { key: "race", label: "Race", type: "text", placeholder: "Species or ancestry" },
      { key: "class", label: "Class", type: "text", placeholder: "Warrior, mage, rogue..." },
      { key: "age", label: "Age", type: "text", placeholder: "Age or apparent age" },
      { key: "affiliation", label: "Affiliation", type: "article_ref", placeholder: "Linked organization" },
      { key: "personality", label: "Personality", type: "textarea", placeholder: "Temperament, quirks, motivations..." },
      { key: "appearance", label: "Appearance", type: "textarea", placeholder: "Physical description..." },
    ],
  },

  location: {
    template: "location",
    label: "Location",
    pluralLabel: "Locations",
    fields: [
      {
        key: "locationType", label: "Type", type: "select", options: [
          { value: "city", label: "City" },
          { value: "region", label: "Region" },
          { value: "landmark", label: "Landmark" },
          { value: "dungeon", label: "Dungeon" },
          { value: "wilderness", label: "Wilderness" },
          { value: "building", label: "Building" },
          { value: "plane", label: "Plane / Realm" },
        ],
      },
      { key: "climate", label: "Climate", type: "text", placeholder: "Weather and environment" },
      { key: "population", label: "Population", type: "text", placeholder: "Who lives here?" },
      { key: "government", label: "Government", type: "text", placeholder: "Ruling system or authority" },
      { key: "resources", label: "Resources", type: "tags", placeholder: "Add a resource..." },
      { key: "appearance", label: "Appearance", type: "textarea", placeholder: "What the place looks like — architecture, terrain, signature visuals..." },
    ],
  },

  ancestry: {
    template: "ancestry",
    label: "Ancestry",
    pluralLabel: "Ancestries",
    fields: [
      { key: "heritage", label: "Heritage", type: "textarea", placeholder: "Cultural origin, lineage, and shared history..." },
      { key: "size", label: "Size", type: "text", placeholder: "Small, medium, large..." },
      { key: "traits", label: "Innate traits", type: "tags", placeholder: "Add a trait..." },
      { key: "signatureAbilities", label: "Signature abilities", type: "tags", placeholder: "Add a signature ability..." },
      { key: "statTendencies", label: "Stat tendencies", type: "text", placeholder: "Common stat leanings — Strong, Wise, Quick..." },
      { key: "appearance", label: "Appearance", type: "textarea", placeholder: "Physical description — body, coloration, distinguishing features..." },
    ],
  },

  bestiary: {
    template: "bestiary",
    label: "Bestiary entry",
    pluralLabel: "Bestiary",
    fields: [
      { key: "habitat", label: "Habitat", type: "text", placeholder: "Where this creature lives" },
      { key: "size", label: "Size", type: "text", placeholder: "Small, medium, large..." },
      { key: "temperament", label: "Temperament", type: "text", placeholder: "Docile, aggressive, cunning..." },
      {
        key: "dangerRating", label: "Danger rating", type: "select", options: [
          { value: "harmless", label: "Harmless" },
          { value: "threat", label: "Threat" },
          { value: "lethal", label: "Lethal" },
          { value: "mythic", label: "Mythic" },
        ],
      },
      { key: "signatureBehaviors", label: "Signature behaviors", type: "tags", placeholder: "Hunts in packs, mimics voices..." },
      {
        key: "rarity", label: "Rarity", type: "select", options: [
          { value: "common", label: "Common" },
          { value: "uncommon", label: "Uncommon" },
          { value: "rare", label: "Rare" },
          { value: "legendary", label: "Legendary" },
          { value: "extinct", label: "Extinct" },
        ],
      },
      { key: "appearance", label: "Appearance", type: "textarea", placeholder: "Physical description — body, coloration, distinguishing features..." },
    ],
  },

  /** @deprecated Replaced by `ancestry` (playable) and `bestiary` (non-playable). Kept for back-compat with old saves. */
  species: {
    template: "species",
    label: "Species (legacy)",
    pluralLabel: "Species (legacy)",
    fields: [
      { key: "habitat", label: "Habitat", type: "text", placeholder: "Where this species lives" },
      { key: "size", label: "Size", type: "text", placeholder: "Small, medium, large..." },
      { key: "temperament", label: "Temperament", type: "text", placeholder: "Docile, aggressive, cunning..." },
      { key: "abilities", label: "Abilities", type: "tags", placeholder: "Add an ability..." },
      {
        key: "rarity", label: "Rarity", type: "select", options: [
          { value: "common", label: "Common" },
          { value: "uncommon", label: "Uncommon" },
          { value: "rare", label: "Rare" },
          { value: "legendary", label: "Legendary" },
          { value: "extinct", label: "Extinct" },
        ],
      },
      { key: "appearance", label: "Appearance", type: "textarea", placeholder: "Physical description — body, coloration, distinguishing features..." },
    ],
  },

  item: {
    template: "item",
    label: "Item",
    pluralLabel: "Items",
    fields: [
      {
        key: "itemType", label: "Type", type: "select", options: [
          { value: "weapon", label: "Weapon" },
          { value: "armor", label: "Armor" },
          { value: "artifact", label: "Artifact" },
          { value: "consumable", label: "Consumable" },
          { value: "material", label: "Material" },
          { value: "tool", label: "Tool" },
          { value: "treasure", label: "Treasure" },
        ],
      },
      {
        key: "rarity", label: "Rarity", type: "select", options: [
          { value: "common", label: "Common" },
          { value: "uncommon", label: "Uncommon" },
          { value: "rare", label: "Rare" },
          { value: "legendary", label: "Legendary" },
          { value: "unique", label: "Unique" },
        ],
      },
      { key: "properties", label: "Properties", type: "textarea", placeholder: "Magical properties, effects..." },
      { key: "origin", label: "Origin", type: "text", placeholder: "Where it was made or found" },
      { key: "appearance", label: "Appearance", type: "textarea", placeholder: "Physical description — materials, shape, ornamentation, colors..." },
    ],
  },

  event: {
    template: "event",
    label: "Event",
    pluralLabel: "Events",
    fields: [
      { key: "dateLabel", label: "Date", type: "text", placeholder: "Year 5 of the Reign of..." },
      { key: "duration", label: "Duration", type: "text", placeholder: "A single day, decades, an age..." },
      { key: "participants", label: "Participants", type: "article_refs" },
      { key: "outcome", label: "Outcome", type: "textarea", placeholder: "What changed as a result?" },
      { key: "appearance", label: "Appearance", type: "textarea", placeholder: "How the event looked — setting, key visuals, dramatic moment..." },
    ],
  },

  language: {
    template: "language",
    label: "Language",
    pluralLabel: "Languages",
    fields: [
      { key: "speakers", label: "Speakers", type: "article_refs" },
      { key: "writingSystem", label: "Writing system", type: "text", placeholder: "Runes, glyphs, alphabet..." },
      { key: "samplePhrases", label: "Sample phrases", type: "textarea", placeholder: "Greetings, oaths, proverbs..." },
      { key: "appearance", label: "Appearance", type: "textarea", placeholder: "Visual character of the script — letterforms, materials, decoration..." },
    ],
  },

  class: {
    template: "class",
    label: "Class",
    pluralLabel: "Classes",
    fields: [
      { key: "role", label: "Role", type: "select", options: [
        { value: "tank", label: "Tank" },
        { value: "healer", label: "Healer" },
        { value: "damage", label: "Damage" },
        { value: "support", label: "Support" },
        { value: "hybrid", label: "Hybrid" },
      ]},
      { key: "primaryStat", label: "Primary stat", type: "text", placeholder: "Strength, Intelligence, etc." },
      { key: "resource", label: "Resource", type: "text", placeholder: "Mana, Rage, Energy..." },
      { key: "playstyle", label: "Playstyle", type: "textarea", placeholder: "How this class plays in combat and exploration..." },
      { key: "strengths", label: "Strengths", type: "tags", placeholder: "Add a strength..." },
      { key: "weaknesses", label: "Weaknesses", type: "tags", placeholder: "Add a weakness..." },
      { key: "keyAbilities", label: "Key abilities", type: "article_refs" },
      { key: "appearance", label: "Appearance", type: "textarea", placeholder: "Iconic look — armor, garb, signature weapons, stance..." },
    ],
  },

  occupation: {
    template: "occupation",
    label: "Occupation",
    pluralLabel: "Occupations",
    fields: [
      { key: "socialRole", label: "Social role", type: "text", placeholder: "Innkeeper, blacksmith, scribe, magistrate..." },
      { key: "whereFound", label: "Where found", type: "text", placeholder: "Settlements, courts, wilderness..." },
      { key: "dailyWork", label: "Daily work", type: "textarea", placeholder: "What they actually do day-to-day..." },
      { key: "tools", label: "Tools of the trade", type: "tags", placeholder: "Add a tool..." },
      { key: "culturalSignificance", label: "Cultural significance", type: "textarea", placeholder: "Standing, traditions, guild structures, taboos..." },
      { key: "appearance", label: "Appearance", type: "textarea", placeholder: "Garb, tools-on-belt, signs of the trade..." },
    ],
  },

  /** @deprecated Replaced by `class` (playable) and `occupation` (non-playable). Kept for back-compat with old saves. */
  profession: {
    template: "profession",
    label: "Profession (legacy)",
    pluralLabel: "Professions (legacy)",
    fields: [
      { key: "role", label: "Role", type: "select", options: [
        { value: "tank", label: "Tank" },
        { value: "healer", label: "Healer" },
        { value: "damage", label: "Damage" },
        { value: "support", label: "Support" },
        { value: "hybrid", label: "Hybrid" },
      ]},
      { key: "primaryStat", label: "Primary stat", type: "text", placeholder: "Strength, Intelligence, etc." },
      { key: "resource", label: "Resource", type: "text", placeholder: "Mana, Rage, Energy..." },
      { key: "playstyle", label: "Playstyle", type: "textarea", placeholder: "How this profession plays in combat and exploration..." },
      { key: "strengths", label: "Strengths", type: "tags", placeholder: "Add a strength..." },
      { key: "weaknesses", label: "Weaknesses", type: "tags", placeholder: "Add a weakness..." },
      { key: "keyAbilities", label: "Key abilities", type: "article_refs" },
      { key: "appearance", label: "Appearance", type: "textarea", placeholder: "Iconic look — armor, garb, signature weapons, stance..." },
    ],
  },

  ability: {
    template: "ability",
    label: "Ability",
    pluralLabel: "Abilities",
    fields: [
      { key: "abilityType", label: "Type", type: "select", options: [
        { value: "spell", label: "Spell" },
        { value: "skill", label: "Skill" },
        { value: "passive", label: "Passive" },
        { value: "ultimate", label: "Ultimate" },
      ]},
      { key: "profession", label: "Profession", type: "article_ref", placeholder: "Which class uses this" },
      { key: "resource_cost", label: "Cost", type: "text", placeholder: "50 mana, 2 charges..." },
      { key: "cooldown", label: "Cooldown", type: "text", placeholder: "Instant, 10s, 5 min..." },
      { key: "range", label: "Range", type: "text", placeholder: "Self, melee, 30m..." },
      { key: "effect", label: "Effect", type: "textarea", placeholder: "What the ability does mechanically and narratively..." },
      { key: "ranks", label: "Ranks / upgrades", type: "textarea", placeholder: "How it improves at higher levels..." },
      { key: "appearance", label: "Appearance", type: "textarea", placeholder: "Visual effect — energy, color, shape, motion of the spell or skill..." },
    ],
  },

  freeform: {
    template: "freeform",
    label: "Freeform",
    pluralLabel: "Freeform",
    fields: [
      { key: "appearance", label: "Appearance", type: "textarea", placeholder: "Visual description for image generation — what should this look like?" },
    ],
  },

  story: {
    template: "story",
    label: "Cinematic Story",
    pluralLabel: "Cinematic Stories",
    description: "A multi-scene cinematic with narration, voice, and music for a specific zone. Created from the Stories panel — not a freeform narrative article.",
    fields: [
      { key: "zoneId", label: "Linked zone", type: "text" },
      { key: "storyId", label: "Story ID", type: "text" },
    ],
  },
};

export const TEMPLATE_OPTIONS = Object.values(TEMPLATE_SCHEMAS).map((s) => ({
  value: s.template,
  label: s.label,
}));

/** Category-to-template mapping for v1 codex migration. */
export const CODEX_CATEGORY_TO_TEMPLATE: Record<string, ArticleTemplate> = {
  places: "location",
  creatures: "species",
  events: "event",
  materials: "item",
  deities: "character",
  legends: "freeform",
  customs: "freeform",
};

/** Convert a CustomTemplateDefinition to the same TemplateSchema shape used by built-ins */
export function customToSchema(def: CustomTemplateDefinition): TemplateSchema {
  return {
    template: def.id as ArticleTemplate,
    label: def.displayName,
    pluralLabel: def.pluralName,
    description: def.description,
    aiDescription: def.aiDescription,
    fields: def.fields.map((f): TemplateFieldDef => ({
      key: f.key,
      label: f.label,
      type: f.type === "select" ? "select" : f.type,
      options: f.options?.map((o) => ({ value: o, label: o })),
      placeholder: f.placeholder,
    })),
  };
}

/** Get the schema for any template — built-in or custom */
export function getTemplateSchema(
  templateId: string,
  customTemplates?: CustomTemplateDefinition[],
): TemplateSchema | undefined {
  if (templateId in TEMPLATE_SCHEMAS) {
    return TEMPLATE_SCHEMAS[templateId as ArticleTemplate];
  }
  const custom = customTemplates?.find((t) => t.id === templateId);
  return custom ? customToSchema(custom) : undefined;
}

/** Get all template schemas (built-in + custom) as an ordered list */
export function getAllTemplateSchemas(
  customTemplates?: CustomTemplateDefinition[],
): TemplateSchema[] {
  const builtIn = Object.values(TEMPLATE_SCHEMAS);
  const custom = (customTemplates ?? []).map(customToSchema);
  return [...builtIn, ...custom];
}

// ─── Template tints ─────────────────────────────────────────────────
// Each built-in template owns a CSS-token tint used for badges, connection
// avatars, and the article editor's accent rule. Custom templates fall back
// to the generic accent. Keep these in sync with --color-template-* in
// creator/src/index.css.

const TEMPLATE_TINTS: Partial<Record<string, string>> = {
  world_setting: "var(--color-template-world)",
  character:     "var(--color-template-character)",
  location:      "var(--color-template-location)",
  organization:  "var(--color-template-organization)",
  item:          "var(--color-template-item)",
  ancestry:      "var(--color-template-species)",
  bestiary:      "var(--color-template-species)",
  species:       "var(--color-template-species)",
  event:         "var(--color-template-event)",
  language:      "var(--color-template-language)",
  class:         "var(--color-template-profession)",
  occupation:    "var(--color-template-profession)",
  profession:    "var(--color-template-profession)",
  ability:       "var(--color-template-ability)",
  freeform:      "var(--color-template-freeform)",
  story:         "var(--color-template-story)",
};

/**
 * Resolve a CSS-token color expression for a given template. Pass a fallback
 * to override the default `--color-accent`.
 */
export function templateTint(
  template: string,
  fallback: string = "var(--color-accent)",
): string {
  return TEMPLATE_TINTS[template] ?? fallback;
}
