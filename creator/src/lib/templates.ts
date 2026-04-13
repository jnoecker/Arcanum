import type { AppConfig } from "@/types/config";
import type { WorldFile } from "@/types/world";
import { BASE_ACADEMY_ZONE } from "@/lib/baseTemplate/baseZone";
import {
  BASE_STATS,
  BASE_CLASSES,
  BASE_ABILITIES,
  BASE_STATUS_EFFECTS,
  BASE_RACES,
  BASE_PETS,
} from "@/lib/baseTemplate/baseConfig";

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

const EQUIPMENT_SLOTS = {
  head: { displayName: "Head", order: 1 },
  chest: { displayName: "Chest", order: 2 },
  legs: { displayName: "Legs", order: 3 },
  feet: { displayName: "Feet", order: 4 },
  hands: { displayName: "Hands", order: 5 },
  main_hand: { displayName: "Main Hand", order: 6 },
  off_hand: { displayName: "Off Hand", order: 7 },
  ring: { displayName: "Ring", order: 8 },
  neck: { displayName: "Neck", order: 9 },
} as const;

const GENDERS = {
  MALE: { displayName: "Male" },
  FEMALE: { displayName: "Female" },
  NON_BINARY: { displayName: "Non-Binary" },
} as const;

export const TEMPLATES: ProjectTemplate[] = [
  {
    id: "classic_fantasy",
    name: "Classic Fantasy",
    description:
      "5 classes, 3 races, 25 abilities, pets, a full tutorial academy zone, and everything you need to start building.",
    features: ["6 stats", "5 classes", "3 races", "25 abilities", "9 equipment slots", "Starter academy zone"],
    defaultWorldTheme: "A classic high-fantasy realm of swords, sorcery, and ancient ruins waiting to be explored.",
    defaultZoneTheme: "A grand academy where new adventurers learn the arts of combat, magic, and exploration.",
    configOverrides: {
      stats: { definitions: BASE_STATS },
      classes: BASE_CLASSES,
      abilities: BASE_ABILITIES,
      statusEffects: BASE_STATUS_EFFECTS,
      races: BASE_RACES,
      pets: BASE_PETS,
      equipmentSlots: EQUIPMENT_SLOTS,
      genders: GENDERS,
      characterCreation: {
        startingGold: 100,
        defaultRace: "HUMAN",
        defaultClass: "WARRIOR",
        defaultGender: "MALE",
      },
      world: { startRoom: "academy:academy_gates" },
    },
    starterZones: [BASE_ACADEMY_ZONE],
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
