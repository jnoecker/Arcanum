import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { parseDocument, stringify } from "yaml";
import { normalizeConfigAssetRefs, normalizeGlobalAssetMap } from "@/lib/assetRefs";
import { useConfigStore } from "@/stores/configStore";
import type { Project } from "@/types/project";
import {
  mapEntries,
  abilityToPlain,
  statusEffectToPlain,
  classToPlain,
  raceToPlain,
  housingToPlain,
  petToPlain,
  enchantmentToPlain,
  buildMonolithicConfigObject,
  loadSlotPositions,
  normalizeLotteryConfig,
  normalizeGamblingConfig,
  normalizeRespecConfig,
  normalizeCurrenciesConfig,
  normalizeDailyQuestsConfig,
  normalizeAutoQuestsConfig,
  normalizeGlobalQuestsConfig,
  normalizeGuildHallsConfig,
} from "@/lib/exportMud";
import type { AppConfig } from "@/types/config";

const YAML_OPTS = {
  lineWidth: 120,
  defaultKeyType: "PLAIN" as const,
  defaultStringType: "PLAIN" as const,
};

function sanitizeAdminConfigForSave(admin: AppConfig["admin"]): AppConfig["admin"] {
  return {
    ...admin,
    token: "",
  };
}

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
  const config = state.config ? normalizeConfigAssetRefs(state.config) : state.config;
  if (!config) throw new Error("No config loaded");

  const resourcesDir = `${mudDir}/src/main/resources`;
  const basePath = `${resourcesDir}/application.yaml`;

  const slotPositions = await loadSlotPositions(mudDir);

  // Always write to application.yaml — Arcanum is the primary config editor.
  // The -local overlay pattern is for manual dev overrides, not Arcanum output.
  const content = await readTextFile(basePath);
  const doc = parseDocument(content);

  doc.set("ambonmud", buildMonolithicConfigObject(config, undefined, slotPositions));

  await writeTextFile(basePath, doc.toString());

  // Achievements live in a separate world file in legacy format
  const achievementsPath = `${resourcesDir}/world/achievements.yaml`;
  await writeTextFile(
    achievementsPath,
    stringify({ achievements: config.achievementDefs }, YAML_OPTS),
  );

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
  const config = state.config ? normalizeConfigAssetRefs(state.config) : state.config;
  if (!config) throw new Error("No config loaded");

  const slotPositions = await loadSlotPositions(projectDir);

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
      slots: mapEntries(config.equipmentSlots, (s, id) => {
        const pos = slotPositions[id];
        return {
          displayName: s.displayName,
          order: s.order,
          x: pos?.x ?? 50,
          y: pos?.y ?? 50,
        };
      }),
    }),

    write("combat", {
      combat: config.combat,
      mob: {
        minActionDelayMillis: config.mobActionDelay.minActionDelayMillis,
        maxActionDelayMillis: config.mobActionDelay.maxActionDelayMillis,
        tiers: config.mobTiers,
      },
      skillPoints: { interval: config.skillPoints.interval },
      multiclass: {
        minLevel: config.multiclass.minLevel,
        goldCost: config.multiclass.goldCost,
      },
    }),

    write("crafting", cleanObj({
      ...config.crafting,
      skills: config.craftingSkills,
      stationTypes: config.craftingStationTypes,
      enchanting: Object.keys(config.enchanting.definitions).length > 0 || config.enchanting.maxEnchantmentsPerItem !== 1
        ? {
            maxEnchantmentsPerItem: config.enchanting.maxEnchantmentsPerItem,
            definitions: mapEntries(config.enchanting.definitions, enchantmentToPlain),
          }
        : undefined,
    })),

    write("progression", {
      progression: config.progression,
      economy: config.economy,
      regen: config.regen,
    }),

    write("world", cleanObj({
      server: config.server,
      admin: sanitizeAdminConfigForSave(config.admin),
      observability: config.observability,
      logging: cleanObj({
        level: config.logging.level,
        packageLevels: Object.keys(config.logging.packageLevels).length > 0
          ? config.logging.packageLevels
          : undefined,
      }),
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
      emotePresets: config.emotePresets.presets.length > 0 ? config.emotePresets : undefined,
      achievementCategories: { categories: config.achievementCategories },
      achievementCriterionTypes: { types: config.achievementCriterionTypes },
      questObjectiveTypes: { types: config.questObjectiveTypes },
      questCompletionTypes: { types: config.questCompletionTypes },
      housing: (config.housing.enabled || Object.keys(config.housing.templates).length > 0)
        ? housingToPlain(config.housing) : undefined,
      bank: config.bank.maxItems !== 50 ? config.bank : undefined,
      worldTime: config.worldTime,
      weather: config.weather,
      worldEvents: Object.keys(config.worldEvents.definitions).length > 0
        ? config.worldEvents : undefined,
      lottery: normalizeLotteryConfig(config.lottery),
      gambling: normalizeGamblingConfig(config.gambling),
      respec: normalizeRespecConfig(config.respec),
      prestige: config.prestige,
      dailyQuests: normalizeDailyQuestsConfig(config.dailyQuests),
      autoQuests: normalizeAutoQuestsConfig(config.autoQuests),
      globalQuests: normalizeGlobalQuestsConfig(config.globalQuests),
      guildHalls: normalizeGuildHallsConfig(config.guildHalls),
      factions: config.factions,
      leaderboard: config.leaderboard,
      currencies: normalizeCurrenciesConfig(config.currencies),
    })),

    write("assets", cleanObj({
      images: cleanObj({
        ...config.images,
        globalAssets: Object.keys(config.globalAssets).length > 0 ? normalizeGlobalAssetMap(config.globalAssets) : undefined,
      }),
      playerTiers: config.playerTiers && Object.keys(config.playerTiers).length > 0 ? config.playerTiers : undefined,
    })),

    write("pets", Object.keys(config.pets ?? {}).length > 0
      ? { definitions: mapEntries(config.pets, petToPlain) }
      : {}),

    // achievements.yaml lives at project root (not in config/)
    writeTextFile(
      `${projectDir}/achievements.yaml`,
      stringify({ achievements: config.achievementDefs }, YAML_OPTS),
    ),
  ]);

  state.markClean();
}
