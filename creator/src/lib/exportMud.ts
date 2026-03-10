import { writeTextFile, mkdir } from "@tauri-apps/plugin-fs";
import { stringify } from "yaml";
import { useConfigStore } from "@/stores/configStore";
import { useZoneStore } from "@/stores/zoneStore";
import { serializeZone } from "@/lib/saveZone";
import type { AppConfig } from "@/types/config";

const YAML_OPTS = {
  lineWidth: 120,
  defaultKeyType: "PLAIN" as const,
  defaultStringType: "PLAIN" as const,
};

/**
 * Build a monolithic application.yaml string from the in-memory AppConfig.
 * Wraps everything under the `ambonmud` root key with the `engine` sub-tree,
 * matching the structure that AmbonMUD server expects.
 */
export function buildMonolithicConfig(config?: AppConfig | null): string {
  const c = config ?? useConfigStore.getState().config;
  if (!c) throw new Error("No config loaded");

  const engine: Record<string, unknown> = {};

  // Stats
  engine.stats = {
    definitions: mapEntries(c.stats.definitions, (def) => ({
      displayName: def.displayName,
      abbreviation: def.abbreviation,
      description: def.description,
      baseStat: def.baseStat,
    })),
    bindings: c.stats.bindings,
  };

  // Abilities
  if (Object.keys(c.abilities).length > 0) {
    engine.abilities = {
      definitions: mapEntries(c.abilities, abilityToPlain),
    };
  }

  // Status Effects
  if (Object.keys(c.statusEffects).length > 0) {
    engine.statusEffects = {
      definitions: mapEntries(c.statusEffects, statusEffectToPlain),
    };
  }

  // Effect Types / Stack Behaviors / Target Types
  if (Object.keys(c.statusEffectTypes).length > 0) {
    engine.effectTypes = { types: c.statusEffectTypes };
  }
  if (Object.keys(c.stackBehaviors).length > 0) {
    engine.stackBehaviors = { behaviors: c.stackBehaviors };
  }
  if (Object.keys(c.abilityTargetTypes).length > 0) {
    engine.targetTypes = { types: c.abilityTargetTypes };
  }

  // Combat
  engine.combat = c.combat;
  engine.mob = {
    minActionDelayMillis: c.mobActionDelay.minActionDelayMillis,
    maxActionDelayMillis: c.mobActionDelay.maxActionDelayMillis,
    tiers: c.mobTiers,
  };

  // Economy
  engine.economy = c.economy;

  // Regen
  engine.regen = c.regen;

  // Crafting
  engine.crafting = c.crafting;
  if (Object.keys(c.craftingSkills).length > 0) {
    engine.craftingSkills = { skills: c.craftingSkills };
  }
  if (Object.keys(c.craftingStationTypes).length > 0) {
    engine.craftingStationTypes = { stationTypes: c.craftingStationTypes };
  }

  // Navigation
  engine.navigation = c.navigation;

  // Commands
  if (Object.keys(c.commands).length > 0) {
    engine.commands = { entries: c.commands };
  }

  // Group
  engine.group = c.group;

  // Guild
  engine.guildRanks = {
    founderRank: c.guild.founderRank,
    defaultRank: c.guild.defaultRank,
    ...(Object.keys(c.guildRanks).length > 0 ? { ranks: c.guildRanks } : {}),
  };

  // Friends
  engine.friends = c.friends;

  // Classes
  if (Object.keys(c.classes).length > 0) {
    engine.classes = {
      definitions: mapEntries(c.classes, classToPlain),
    };
  }

  // Races
  if (Object.keys(c.races).length > 0) {
    engine.races = {
      definitions: mapEntries(c.races, raceToPlain),
    };
  }

  // Equipment
  if (Object.keys(c.equipmentSlots).length > 0) {
    engine.equipment = {
      slots: mapEntries(c.equipmentSlots, (s) => ({
        displayName: s.displayName,
        order: s.order,
      })),
    };
  }

  // Character Creation
  engine.characterCreation = c.characterCreation;

  // Genders
  if (Object.keys(c.genders).length > 0) {
    engine.genders = c.genders;
  }

  // Class Start Rooms
  if (Object.keys(c.classStartRooms).length > 0) {
    engine.classStartRooms = c.classStartRooms;
  }

  // Achievement / Quest enum types
  if (Object.keys(c.achievementCategories).length > 0) {
    engine.achievementCategories = c.achievementCategories;
  }
  if (Object.keys(c.achievementCriterionTypes).length > 0) {
    engine.achievementCriterionTypes = c.achievementCriterionTypes;
  }
  if (Object.keys(c.questObjectiveTypes).length > 0) {
    engine.questObjectiveTypes = c.questObjectiveTypes;
  }
  if (Object.keys(c.questCompletionTypes).length > 0) {
    engine.questCompletionTypes = c.questCompletionTypes;
  }

  const ambonmud: Record<string, unknown> = {
    server: c.server,
    world: c.world,
    progression: c.progression,
    images: c.images,
    engine,
  };

  if (Object.keys(c.globalAssets).length > 0) {
    ambonmud.globalAssets = c.globalAssets;
  }

  return stringify({ ambonmud }, YAML_OPTS);
}

/**
 * Export the current project to MUD server format.
 * Writes application.yaml + world/*.yaml to the output directory.
 */
export async function exportMudFormat(outputDir: string): Promise<ExportResult> {
  const config = useConfigStore.getState().config;
  const zones = useZoneStore.getState().zones;

  if (!config) throw new Error("No config loaded");

  const resourcesDir = `${outputDir}/src/main/resources`;
  const worldDir = `${resourcesDir}/world`;

  // Create directory structure
  await mkdir(worldDir, { recursive: true });

  // Write monolithic config
  const configYaml = buildMonolithicConfig(config);
  await writeTextFile(`${resourcesDir}/application.yaml`, configYaml);

  // Write zone files
  let zonesExported = 0;
  const errors: string[] = [];

  for (const [zoneId] of zones) {
    try {
      const yaml = serializeZone(zoneId);
      await writeTextFile(`${worldDir}/${zoneId}.yaml`, yaml);
      zonesExported++;
    } catch (err) {
      errors.push(`${zoneId}: ${err}`);
    }
  }

  return {
    configExported: true,
    zonesExported,
    outputDir,
    errors,
  };
}

export interface ExportResult {
  configExported: boolean;
  zonesExported: number;
  outputDir: string;
  errors: string[];
}

// ─── Serialization helpers (shared with saveSplitConfig) ────────────

export function mapEntries<T>(
  data: Record<string, T>,
  toPlain: (item: T) => Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [id, item] of Object.entries(data)) {
    result[id] = toPlain(item);
  }
  return result;
}

export function abilityToPlain(a: AppConfig["abilities"][string]): Record<string, unknown> {
  const effect: Record<string, unknown> = { type: a.effect.type };
  if (a.effect.value != null) effect.value = a.effect.value;
  if (a.effect.statusEffectId) effect.statusEffectId = a.effect.statusEffectId;
  if (a.effect.minDamage != null) effect.minDamage = a.effect.minDamage;
  if (a.effect.maxDamage != null) effect.maxDamage = a.effect.maxDamage;
  if (a.effect.minHeal != null) effect.minHeal = a.effect.minHeal;
  if (a.effect.maxHeal != null) effect.maxHeal = a.effect.maxHeal;
  if (a.effect.flatThreat != null) effect.flatThreat = a.effect.flatThreat;
  if (a.effect.margin != null) effect.margin = a.effect.margin;
  const obj: Record<string, unknown> = {
    displayName: a.displayName,
    manaCost: a.manaCost,
    cooldownMs: a.cooldownMs,
    levelRequired: a.levelRequired,
    targetType: a.targetType,
    effect,
  };
  if (a.description) obj.description = a.description;
  if (a.image) obj.image = a.image;
  if (a.requiredClass != null) obj.requiredClass = a.requiredClass;
  if (a.classRestriction) obj.classRestriction = a.classRestriction;
  return obj;
}

export function statusEffectToPlain(e: AppConfig["statusEffects"][string]): Record<string, unknown> {
  const obj: Record<string, unknown> = {
    displayName: e.displayName,
    effectType: e.effectType,
    durationMs: e.durationMs,
  };
  if (e.tickIntervalMs != null) obj.tickIntervalMs = e.tickIntervalMs;
  if (e.tickValue != null) obj.tickValue = e.tickValue;
  if (e.tickMinValue != null) obj.tickMinValue = e.tickMinValue;
  if (e.tickMaxValue != null) obj.tickMaxValue = e.tickMaxValue;
  if (e.shieldAmount != null) obj.shieldAmount = e.shieldAmount;
  if (e.stackBehavior) obj.stackBehavior = e.stackBehavior;
  if (e.maxStacks != null) obj.maxStacks = e.maxStacks;
  if (e.strMod != null) obj.strMod = e.strMod;
  if (e.dexMod != null) obj.dexMod = e.dexMod;
  if (e.conMod != null) obj.conMod = e.conMod;
  if (e.intMod != null) obj.intMod = e.intMod;
  if (e.wisMod != null) obj.wisMod = e.wisMod;
  if (e.chaMod != null) obj.chaMod = e.chaMod;
  if (e.statMods && Object.keys(e.statMods).length > 0) obj.statMods = e.statMods;
  return obj;
}

export function classToPlain(cls: AppConfig["classes"][string]): Record<string, unknown> {
  const obj: Record<string, unknown> = {
    displayName: cls.displayName,
    hpPerLevel: cls.hpPerLevel,
    manaPerLevel: cls.manaPerLevel,
  };
  if (cls.description) obj.description = cls.description;
  if (cls.backstory) obj.backstory = cls.backstory;
  if (cls.primaryStat) obj.primaryStat = cls.primaryStat;
  if (cls.selectable != null) obj.selectable = cls.selectable;
  if (cls.startRoom) obj.startRoom = cls.startRoom;
  if (cls.threatMultiplier != null) obj.threatMultiplier = cls.threatMultiplier;
  if (cls.image) obj.image = cls.image;
  return obj;
}

export function raceToPlain(race: AppConfig["races"][string]): Record<string, unknown> {
  const obj: Record<string, unknown> = { displayName: race.displayName };
  if (race.description) obj.description = race.description;
  if (race.backstory) obj.backstory = race.backstory;
  if (race.traits && race.traits.length > 0) obj.traits = race.traits;
  if (race.abilities && race.abilities.length > 0) obj.abilities = race.abilities;
  if (race.image) obj.image = race.image;
  if (race.statMods && Object.keys(race.statMods).length > 0) obj.statMods = race.statMods;
  return obj;
}
