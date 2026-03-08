import type { AppConfig } from "@/types/config";
import type { WorldFile } from "@/types/world";

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  features?: string[];
  defaultWorldTheme?: string;
  defaultZoneTheme?: string;
  configOverrides: DeepPartial<AppConfig>;
  starterZones?: WorldFile[];
}

export const TEMPLATES: ProjectTemplate[] = [
  {
    id: "classic_fantasy",
    name: "Classic Fantasy",
    description:
      "6 stats (STR/DEX/CON/INT/WIS/CHA), 4 classes, 3 races, standard equipment slots, and a starter town zone.",
    features: ["6 stats", "4 classes", "3 races", "9 equipment slots", "Starter town zone"],
    defaultWorldTheme: "A classic high-fantasy realm of swords, sorcery, and ancient ruins waiting to be explored.",
    defaultZoneTheme: "A bustling medieval town square where adventurers gather before heading into the wild.",
    configOverrides: {
      stats: {
        definitions: {
          STR: { id: "STR", displayName: "Strength", abbreviation: "STR", description: "Physical power", baseStat: 10 },
          DEX: { id: "DEX", displayName: "Dexterity", abbreviation: "DEX", description: "Agility and reflexes", baseStat: 10 },
          CON: { id: "CON", displayName: "Constitution", abbreviation: "CON", description: "Health and endurance", baseStat: 10 },
          INT: { id: "INT", displayName: "Intelligence", abbreviation: "INT", description: "Magical aptitude", baseStat: 10 },
          WIS: { id: "WIS", displayName: "Wisdom", abbreviation: "WIS", description: "Insight and willpower", baseStat: 10 },
          CHA: { id: "CHA", displayName: "Charisma", abbreviation: "CHA", description: "Force of personality", baseStat: 10 },
        },
      },
      classes: {
        WARRIOR: { displayName: "Warrior", hpPerLevel: 4, manaPerLevel: 1, primaryStat: "STR", description: "A stalwart fighter trained in martial combat." },
        MAGE: { displayName: "Mage", hpPerLevel: 1, manaPerLevel: 5, primaryStat: "INT", description: "A scholar who wields arcane magic." },
        CLERIC: { displayName: "Cleric", hpPerLevel: 2, manaPerLevel: 4, primaryStat: "WIS", description: "A healer who channels divine power." },
        ROGUE: { displayName: "Rogue", hpPerLevel: 2, manaPerLevel: 2, primaryStat: "DEX", description: "A nimble trickster skilled in stealth." },
      },
      races: {
        HUMAN: { displayName: "Human", description: "Versatile and adaptable." },
        ELF: { displayName: "Elf", description: "Graceful and attuned to magic.", statMods: { DEX: 1, INT: 1, CON: -1 } },
        DWARF: { displayName: "Dwarf", description: "Stout and resilient.", statMods: { CON: 2, CHA: -1 } },
      },
      equipmentSlots: {
        HEAD: { displayName: "Head", order: 1 },
        CHEST: { displayName: "Chest", order: 2 },
        LEGS: { displayName: "Legs", order: 3 },
        FEET: { displayName: "Feet", order: 4 },
        HANDS: { displayName: "Hands", order: 5 },
        MAIN_HAND: { displayName: "Main Hand", order: 6 },
        OFF_HAND: { displayName: "Off Hand", order: 7 },
        RING: { displayName: "Ring", order: 8 },
        NECK: { displayName: "Neck", order: 9 },
      },
      world: { startRoom: "town_square:town_center" },
    },
    starterZones: [
      {
        zone: "town_square",
        lifespan: 30,
        startRoom: "town_center",
        rooms: {
          town_center: {
            title: "Town Center",
            description: "A bustling town square with cobblestone paths radiating outward. A weathered fountain stands at the center, its water sparkling in the sunlight.",
            exits: { north: "market", east: "tavern", south: "south_gate" },
          },
          market: {
            title: "Market Street",
            description: "Colorful stalls line both sides of a wide street. Merchants call out their wares to passing adventurers.",
            exits: { south: "town_center" },
          },
          tavern: {
            title: "The Rusty Tankard",
            description: "A warm tavern filled with the smell of ale and roasting meat. A crackling fireplace illuminates the wooden interior.",
            exits: { west: "town_center" },
          },
          south_gate: {
            title: "South Gate",
            description: "A heavy iron gate marks the southern boundary of town. Beyond lies the wilderness, where danger and adventure await.",
            exits: { north: "town_center" },
          },
        },
        mobs: {},
        items: {},
        shops: {},
        quests: {},
        gatheringNodes: {},
        recipes: {},
      },
    ],
  },
  {
    id: "minimal_sandbox",
    name: "Minimal Sandbox",
    description:
      "Bare-bones setup with 3 stats, 1 class, 1 race. No starter zones — a clean slate for custom world building.",
    features: ["3 stats", "1 class", "1 race", "Stat bindings pre-configured"],
    defaultWorldTheme: "A simple world ready to be shaped by your imagination.",
    defaultZoneTheme: "A quiet clearing where the story begins.",
    configOverrides: {
      stats: {
        definitions: {
          MIGHT: { id: "MIGHT", displayName: "Might", abbreviation: "MIG", description: "Physical and magical power", baseStat: 10 },
          AGILITY: { id: "AGILITY", displayName: "Agility", abbreviation: "AGI", description: "Speed and finesse", baseStat: 10 },
          VITALITY: { id: "VITALITY", displayName: "Vitality", abbreviation: "VIT", description: "Health and resilience", baseStat: 10 },
        },
        bindings: {
          meleeDamageStat: "MIGHT",
          spellDamageStat: "MIGHT",
          dodgeStat: "AGILITY",
          hpScalingStat: "VITALITY",
          manaScalingStat: "MIGHT",
          hpRegenStat: "VITALITY",
          manaRegenStat: "MIGHT",
          xpBonusStat: "AGILITY",
        },
      },
      classes: {
        ADVENTURER: { displayName: "Adventurer", hpPerLevel: 3, manaPerLevel: 3, description: "A jack of all trades." },
      },
      races: {
        HUMAN: { displayName: "Human", description: "The common folk of the realm." },
      },
    },
  },
  {
    id: "blank_slate",
    name: "Blank Slate",
    description:
      "AmbonMUD defaults with demo zones cleared. No config changes — start completely from scratch.",
    features: ["Server defaults only", "No pre-configured stats/classes", "Full creative freedom"],
    configOverrides: {},
  },
];

/** Deep merge template overrides into the loaded config. */
export function applyTemplate(
  config: AppConfig,
  overrides: DeepPartial<AppConfig>,
): AppConfig {
  return deepMerge(config as unknown as Record<string, unknown>, overrides as unknown as Record<string, unknown>) as unknown as AppConfig;
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (sv && typeof sv === "object" && !Array.isArray(sv) && tv && typeof tv === "object" && !Array.isArray(tv)) {
      result[key] = deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>);
    } else {
      result[key] = sv;
    }
  }
  return result;
}
