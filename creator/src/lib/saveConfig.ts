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
  hasPetsTopLevel,
  enchantmentToPlain,
  buildMonolithicConfigObject,
  normalizeLotteryConfig,
  normalizeGamblingConfig,
  normalizeStylistConfig,
  normalizeAkathavaeConfig,
  normalizeRespecConfig,
  normalizeCurrenciesConfig,
  normalizeDailyQuestsConfig,
  normalizeAutoQuestsConfig,
  normalizeGlobalQuestsConfig,
  normalizeGuildHallsConfig,
} from "@/lib/exportMud";
import type { AppConfig } from "@/types/config";
import { YAML_OPTS } from "@/lib/yamlOpts";
import { WORLD_POOL_FILES, WORLD_SECTION_HOMES, type WorldSectionKey } from "@/lib/projectPaths";

function sanitizeAdminConfigForSave(admin: AppConfig["admin"]): AppConfig["admin"] {
  return {
    ...admin,
    token: "OVERRIDE_ME_FROM_ENV",
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

  // Always write to application.yaml — Arcanum is the primary config editor.
  // The -local overlay pattern is for manual dev overrides, not Arcanum output.
  const content = await readTextFile(basePath);
  const doc = parseDocument(content);

  doc.set("ambonmud", buildMonolithicConfigObject(config));

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
 * Save config to the split YAML files in config/ directory. World-pool
 * sections are grouped into their canonical files per WORLD_SECTION_HOMES;
 * the Record<WorldSectionKey, unknown> type keeps the section list and the
 * homes map from drifting apart.
 */
async function saveSplitConfig(projectDir: string): Promise<void> {
  const state = useConfigStore.getState();
  const config = state.config ? normalizeConfigAssetRefs(state.config) : state.config;
  if (!config) throw new Error("No config loaded");

  const dir = `${projectDir}/config`;
  const write = (name: string, data: unknown) =>
    writeTextFile(`${dir}/${name}.yaml`, stringify(data, YAML_OPTS));

  const worldSections: Record<WorldSectionKey, unknown> = {
    mode: config.mode,
    server: config.server,
    admin: sanitizeAdminConfigForSave(config.admin),
    observability: config.observability,
    logging: cleanObj({
      level: config.logging.level,
      packageLevels: Object.keys(config.logging.packageLevels).length > 0
        ? config.logging.packageLevels
        : undefined,
    }),
    persistence: config.persistence,
    login: config.login,
    transport: config.transport,
    demo: config.demo,
    database: config.database,
    redis: config.redis,
    grpc: config.grpc,
    gateway: config.gateway,
    sharding: config.sharding,

    // Wrapped in `entries` to match the server's CommandsConfig shape, so
    // commands.yaml is drop-in interchangeable with the MUD side
    commands: Object.keys(config.commands).length > 0 ? { entries: config.commands } : undefined,

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

    bank: config.bank.maxItems !== 50 ? config.bank : undefined,
    currencies: normalizeCurrenciesConfig(config.currencies),
    lottery: normalizeLotteryConfig(config.lottery),
    gambling: normalizeGamblingConfig(config.gambling),
    stylist: normalizeStylistConfig(config.stylist),
    akathavae: normalizeAkathavaeConfig(config.akathavae),
    respec: normalizeRespecConfig(config.respec),
    housing: (config.housing.enabled || Object.keys(config.housing.templates).length > 0)
      ? housingToPlain(config.housing) : undefined,
    guildHalls: normalizeGuildHallsConfig(config.guildHalls),

    dailyQuests: normalizeDailyQuestsConfig(config.dailyQuests),
    autoQuests: normalizeAutoQuestsConfig(config.autoQuests),
    globalQuests: normalizeGlobalQuestsConfig(config.globalQuests),
    questObjectiveTypes: { types: config.questObjectiveTypes },
    questCompletionTypes: { types: config.questCompletionTypes },
    achievementCategories: { categories: config.achievementCategories },
    achievementCriterionTypes: { types: config.achievementCriterionTypes },

    world: config.world,
    classStartRooms: Object.keys(config.classStartRooms).length > 0 ? config.classStartRooms : undefined,
    navigation: config.navigation,
    death: config.death,
    worldTime: config.worldTime,
    season: config.season,
    weather: {
      minTransitionMs: config.weather.minTransitionMs,
      maxTransitionMs: config.weather.maxTransitionMs,
      ...(Object.keys(config.weather.types).length > 0 ? { types: config.weather.types } : {}),
    },
    mobVariants: {
      enabled: config.mobVariants.enabled,
      chance: config.mobVariants.chance,
      ...(Object.keys(config.mobVariants.variants).length > 0
        ? { variants: config.mobVariants.variants }
        : {}),
    },
    environment: (config.environment.defaultTheme.moteColors.length > 0 || Object.keys(config.environment.zones).length > 0)
      ? config.environment : undefined,
    worldEvents: Object.keys(config.worldEvents.definitions).length > 0
      ? config.worldEvents : undefined,
    factions: config.factions,
    prestige: config.prestige,
    leaderboard: config.leaderboard,
  };

  const poolWrites = WORLD_POOL_FILES.map((file) => {
    const out: Record<string, unknown> = {};
    for (const [key, home] of Object.entries(WORLD_SECTION_HOMES)) {
      if (home === file) out[key] = worldSections[key as WorldSectionKey];
    }
    return write(file, cleanObj(out));
  });

  await Promise.all([
    ...poolWrites,

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
        x: s.x ?? 50,
        y: s.y ?? 50,
      })),
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
        // Kotlin's MulticlassConfig.maxClasses is an Int (max 2_147_483_647).
        // Clamp on the way out so anything stored above that range (legacy
        // Number.MAX_SAFE_INTEGER from an earlier build, for example) doesn't
        // crash the server during Hoplite decode.
        maxClasses: Math.min(config.multiclass.maxClasses, 2147483647),
        goldCostMultiplier: config.multiclass.goldCostMultiplier,
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

    write("assets", cleanObj({
      images: cleanObj({
        ...config.images,
        globalAssets: Object.keys(config.globalAssets).length > 0 ? normalizeGlobalAssetMap(config.globalAssets) : undefined,
        defaultAssets: Object.keys(config.defaultAssets).length > 0 ? normalizeGlobalAssetMap(config.defaultAssets) : undefined,
      }),
    })),

    write("pets", (() => {
      const hasDefs = Object.keys(config.pets ?? {}).length > 0;
      const hasTop = hasPetsTopLevel(config.petsConfig);
      if (!hasDefs && !hasTop) return {};
      const out: Record<string, unknown> = {};
      if (config.petsConfig?.manualSkillGraceMs != null) {
        out.manualSkillGraceMs = config.petsConfig.manualSkillGraceMs;
      }
      if (config.petsConfig?.maxHpRatio != null) out.maxHpRatio = config.petsConfig.maxHpRatio;
      if (config.petsConfig?.maxDamageRatio != null) out.maxDamageRatio = config.petsConfig.maxDamageRatio;
      if (config.petsConfig?.maxArmorRatio != null) out.maxArmorRatio = config.petsConfig.maxArmorRatio;
      if (hasDefs) out.definitions = mapEntries(config.pets, petToPlain);
      return out;
    })()),

    // achievements.yaml lives at project root (not in config/)
    writeTextFile(
      `${projectDir}/achievements.yaml`,
      stringify({ achievements: config.achievementDefs }, YAML_OPTS),
    ),
  ]);

  state.markClean();
}
