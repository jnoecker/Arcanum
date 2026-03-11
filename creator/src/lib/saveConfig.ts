import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { parseDocument, stringify } from "yaml";
import { useConfigStore } from "@/stores/configStore";
import type { Project } from "@/types/project";
import {
  mapEntries,
  abilityToPlain,
  statusEffectToPlain,
  classToPlain,
  raceToPlain,
  buildMonolithicConfigObject,
} from "@/lib/exportMud";

const YAML_OPTS = {
  lineWidth: 120,
  defaultKeyType: "PLAIN" as const,
  defaultStringType: "PLAIN" as const,
};

/**
 * Save config using the appropriate strategy for the project format.
 */
export async function saveProjectConfig(project: Project): Promise<void> {
  return project.format === "standalone"
    ? saveSplitConfig(project.mudDir)
    : saveConfig(project.mudDir);
}

/**
 * Save the current AppConfig to application-local.yaml.
 * Reads the local override file (or creates it from the base), then writes
 * a fully explicit ambonmud tree so runtime behavior does not depend on an
 * unknown/stale checked-in base config.
 */
export async function saveConfig(mudDir: string): Promise<void> {
  const state = useConfigStore.getState();
  const config = state.config;
  if (!config) throw new Error("No config loaded");

  const resourcesDir = `${mudDir}/src/main/resources`;
  const basePath = `${resourcesDir}/application.yaml`;
  const localPath = `${resourcesDir}/application-local.yaml`;

  const sourcePath = await exists(localPath) ? localPath : basePath;
  const content = await readTextFile(sourcePath);
  const doc = parseDocument(content);

  doc.set("ambonmud", buildMonolithicConfigObject(config));

  await writeTextFile(localPath, doc.toString());
  state.markClean();
}

/** Filter out entries where all values are undefined/null. */
function cleanObj(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) result[k] = v;
  }
  return result;
}

/**
 * Save config to 11 separate YAML files in config/ directory.
 */
async function saveSplitConfig(projectDir: string): Promise<void> {
  const state = useConfigStore.getState();
  const config = state.config;
  if (!config) throw new Error("No config loaded");

  const dir = `${projectDir}/config`;
  const write = (name: string, data: unknown) =>
    writeTextFile(`${dir}/${name}.yaml`, stringify(data, YAML_OPTS));

  await Promise.all([
    write("classes", {
      definitions: mapEntries(config.classes, classToPlain),
    }),

    write("races", {
      definitions: mapEntries(config.races, raceToPlain),
    }),

    write("abilities", {
      definitions: mapEntries(config.abilities, abilityToPlain),
    }),

    write("status-effects", {
      definitions: mapEntries(config.statusEffects, statusEffectToPlain),
      effectTypes: config.statusEffectTypes,
      stackBehaviors: config.stackBehaviors,
      targetTypes: config.abilityTargetTypes,
    }),

    write("stats", {
      definitions: mapEntries(config.stats.definitions, (def) => ({
        displayName: def.displayName,
        abbreviation: def.abbreviation,
        description: def.description,
        baseStat: def.baseStat,
      })),
      bindings: config.stats.bindings,
    }),

    write("equipment", {
      slots: mapEntries(config.equipmentSlots, (s) => ({
        displayName: s.displayName,
        order: s.order,
      })),
    }),

    write("combat", {
      combat: config.combat,
      mob: {
        minActionDelayMillis: config.mobActionDelay.minActionDelayMillis,
        maxActionDelayMillis: config.mobActionDelay.maxActionDelayMillis,
        tiers: config.mobTiers,
      },
    }),

    write("crafting", {
      ...config.crafting,
      skills: config.craftingSkills,
      stationTypes: config.craftingStationTypes,
    }),

    write("progression", {
      progression: config.progression,
      economy: config.economy,
      regen: config.regen,
    }),

    write("world", cleanObj({
      server: config.server,
      world: config.world,
      classStartRooms: Object.keys(config.classStartRooms).length > 0 ? config.classStartRooms : undefined,
      navigation: config.navigation,
      commands: Object.keys(config.commands).length > 0 ? config.commands : undefined,
      group: config.group,
      guildRanks: {
        founderRank: config.guild.founderRank,
        defaultRank: config.guild.defaultRank,
        ranks: config.guildRanks,
      },
      friends: config.friends,
      genders: config.genders,
      characterCreation: config.characterCreation,
      achievementCategories: { categories: config.achievementCategories },
      achievementCriterionTypes: { types: config.achievementCriterionTypes },
      questObjectiveTypes: { types: config.questObjectiveTypes },
      questCompletionTypes: { types: config.questCompletionTypes },
    })),

    write("assets", cleanObj({
      images: config.images,
      globalAssets: Object.keys(config.globalAssets).length > 0 ? config.globalAssets : undefined,
      playerTiers: config.playerTiers && Object.keys(config.playerTiers).length > 0 ? config.playerTiers : undefined,
    })),
  ]);

  state.markClean();
}
