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
    ],
  },

  species: {
    template: "species",
    label: "Species",
    pluralLabel: "Species",
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
    ],
  },

  profession: {
    template: "profession",
    label: "Profession",
    pluralLabel: "Professions",
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
    ],
  },

  freeform: {
    template: "freeform",
    label: "Freeform",
    pluralLabel: "Freeform",
    fields: [],
  },

  story: {
    template: "story",
    label: "Story",
    pluralLabel: "Stories",
    description: "A cinematic zone story with scenes and narration.",
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
