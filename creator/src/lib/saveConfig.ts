import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { exists } from "@tauri-apps/plugin-fs";
import { parseDocument, stringify, YAMLMap } from "yaml";
import { useConfigStore } from "@/stores/configStore";
import type { Project } from "@/types/project";
import {
  mapEntries,
  abilityToPlain,
  statusEffectToPlain,
  classToPlain,
  raceToPlain,
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
 * Reads the local override file (or creates it from the base), patches
 * known sections in-place, and writes back. The base application.yaml
 * is never modified.
 */
export async function saveConfig(mudDir: string): Promise<void> {
  const state = useConfigStore.getState();
  const config = state.config;
  if (!config) throw new Error("No config loaded");

  const resourcesDir = `${mudDir}/src/main/resources`;
  const basePath = `${resourcesDir}/application.yaml`;
  const localPath = `${resourcesDir}/application-local.yaml`;

  // Read local override file if it exists, otherwise start from the base
  const sourcePath = await exists(localPath) ? localPath : basePath;
  const content = await readTextFile(sourcePath);
  const doc = parseDocument(content);

  // Navigate to the ambonmud root node
  const root = doc.get("ambonmud", true) as any;
  if (!root) throw new Error("Missing 'ambonmud' root in application.yaml");

  // ─── Server ─────────────────────────────────────────────────
  setIn(root, ["server", "telnetPort"], config.server.telnetPort);
  setIn(root, ["server", "webPort"], config.server.webPort);

  // ─── World ──────────────────────────────────────────────────
  if (config.world.startRoom) {
    setIn(root, ["world", "startRoom"], config.world.startRoom);
  }
  setIn(root, ["world", "resources"], config.world.resources);

  // ─── Engine sections ────────────────────────────────────────
  const engine = root.get("engine", true);
  if (engine) {
    // Combat
    setIn(engine, ["combat", "maxCombatsPerTick"], config.combat.maxCombatsPerTick);
    setIn(engine, ["combat", "tickMillis"], config.combat.tickMillis);
    setIn(engine, ["combat", "minDamage"], config.combat.minDamage);
    setIn(engine, ["combat", "maxDamage"], config.combat.maxDamage);
    setIn(engine, ["combat", "feedback", "enabled"], config.combat.feedback.enabled);
    setIn(engine, ["combat", "feedback", "roomBroadcastEnabled"], config.combat.feedback.roomBroadcastEnabled);

    // Mob action delay
    setIn(engine, ["mob", "minActionDelayMillis"], config.mobActionDelay.minActionDelayMillis);
    setIn(engine, ["mob", "maxActionDelayMillis"], config.mobActionDelay.maxActionDelayMillis);

    // Mob tiers
    for (const tier of ["weak", "standard", "elite", "boss"] as const) {
      const t = config.mobTiers[tier];
      for (const [key, val] of Object.entries(t)) {
        setIn(engine, ["mob", "tiers", tier, key], val);
      }
    }

    // Economy
    setIn(engine, ["economy", "buyMultiplier"], config.economy.buyMultiplier);
    setIn(engine, ["economy", "sellMultiplier"], config.economy.sellMultiplier);

    // Regen
    setIn(engine, ["regen", "maxPlayersPerTick"], config.regen.maxPlayersPerTick);
    setIn(engine, ["regen", "baseIntervalMillis"], config.regen.baseIntervalMillis);
    setIn(engine, ["regen", "minIntervalMillis"], config.regen.minIntervalMillis);
    setIn(engine, ["regen", "regenAmount"], config.regen.regenAmount);
    setIn(engine, ["regen", "mana", "baseIntervalMillis"], config.regen.mana.baseIntervalMillis);
    setIn(engine, ["regen", "mana", "minIntervalMillis"], config.regen.mana.minIntervalMillis);
    setIn(engine, ["regen", "mana", "regenAmount"], config.regen.mana.regenAmount);

    // Crafting
    setIn(engine, ["crafting", "maxSkillLevel"], config.crafting.maxSkillLevel);
    setIn(engine, ["crafting", "baseXpPerLevel"], config.crafting.baseXpPerLevel);
    setIn(engine, ["crafting", "xpExponent"], config.crafting.xpExponent);
    setIn(engine, ["crafting", "gatherCooldownMs"], config.crafting.gatherCooldownMs);
    setIn(engine, ["crafting", "stationBonusQuantity"], config.crafting.stationBonusQuantity);

    // Navigation
    setIn(engine, ["navigation", "recall", "cooldownMs"], config.navigation.recall.cooldownMs);
    const rm = config.navigation.recall.messages;
    for (const [key, val] of Object.entries(rm)) {
      setIn(engine, ["navigation", "recall", "messages", key], val);
    }

    // Commands
    if (Object.keys(config.commands).length > 0) {
      saveMapSection(engine, ["commands", "entries"], config.commands,
        (cmd) => {
          const obj: Record<string, unknown> = {
            usage: cmd.usage,
            category: cmd.category,
            staff: cmd.staff,
          };
          return obj;
        },
      );
    }

    // Group
    setIn(engine, ["group", "maxSize"], config.group.maxSize);
    setIn(engine, ["group", "inviteTimeoutMs"], config.group.inviteTimeoutMs);
    setIn(engine, ["group", "xpBonusPerMember"], config.group.xpBonusPerMember);

    // Stats
    saveMapSection(engine, ["stats", "definitions"], config.stats.definitions,
      (def) => ({
        displayName: def.displayName,
        abbreviation: def.abbreviation,
        description: def.description,
        baseStat: def.baseStat,
      }),
    );
    const b = config.stats.bindings;
    for (const [key, val] of Object.entries(b)) {
      setIn(engine, ["stats", "bindings", key], val);
    }

    // Abilities
    saveMapSection(engine, ["abilities", "definitions"], config.abilities,
      (a) => {
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
      },
    );

    // Status Effects
    saveMapSection(engine, ["statusEffects", "definitions"], config.statusEffects,
      (e) => {
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
        if (e.statMods && Object.keys(e.statMods).length > 0)
          obj.statMods = e.statMods;
        return obj;
      },
    );

    // Classes
    saveMapSection(engine, ["classes", "definitions"], config.classes,
      (cls) => {
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
      },
    );

    // Races
    saveMapSection(engine, ["races", "definitions"], config.races,
      (race) => {
        const obj: Record<string, unknown> = {
          displayName: race.displayName,
        };
        if (race.description) obj.description = race.description;
        if (race.backstory) obj.backstory = race.backstory;
        if (race.traits && race.traits.length > 0) obj.traits = race.traits;
        if (race.abilities && race.abilities.length > 0) obj.abilities = race.abilities;
        if (race.image) obj.image = race.image;
        if (race.statMods && Object.keys(race.statMods).length > 0)
          obj.statMods = race.statMods;
        return obj;
      },
    );

    // Equipment Slots
    saveMapSection(engine, ["equipment", "slots"], config.equipmentSlots,
      (slot) => ({ displayName: slot.displayName, order: slot.order }),
    );

    // Genders
    saveMapSection(engine, ["genders"], config.genders,
      (g) => {
        const obj: Record<string, unknown> = { displayName: g.displayName };
        if (g.spriteCode) obj.spriteCode = g.spriteCode;
        return obj;
      },
    );

    // Achievement Categories
    saveMapSection(engine, ["achievementCategories"], config.achievementCategories,
      (c) => ({ displayName: c.displayName }),
    );

    // Achievement Criterion Types
    saveMapSection(engine, ["achievementCriterionTypes"], config.achievementCriterionTypes,
      (c) => {
        const obj: Record<string, unknown> = { displayName: c.displayName };
        if (c.progressFormat) obj.progressFormat = c.progressFormat;
        return obj;
      },
    );

    // Quest Objective Types
    saveMapSection(engine, ["questObjectiveTypes"], config.questObjectiveTypes,
      (t) => ({ displayName: t.displayName }),
    );

    // Quest Completion Types
    saveMapSection(engine, ["questCompletionTypes"], config.questCompletionTypes,
      (t) => ({ displayName: t.displayName }),
    );

    // Status Effect Types
    saveMapSection(engine, ["effectTypes", "types"], config.statusEffectTypes,
      (t) => {
        const obj: Record<string, unknown> = { displayName: t.displayName };
        if (t.ticksDamage) obj.ticksDamage = true;
        if (t.ticksHealing) obj.ticksHealing = true;
        if (t.modifiesStats) obj.modifiesStats = true;
        if (t.absorbsDamage) obj.absorbsDamage = true;
        if (t.preventsActions) obj.preventsActions = true;
        if (t.preventsMovement) obj.preventsMovement = true;
        return obj;
      },
    );

    // Stack Behaviors
    saveMapSection(engine, ["stackBehaviors", "behaviors"], config.stackBehaviors,
      (b) => ({ displayName: b.displayName }),
    );

    // Ability Target Types
    saveMapSection(engine, ["targetTypes", "types"], config.abilityTargetTypes,
      (t) => ({ displayName: t.displayName }),
    );

    // Crafting Skills
    saveMapSection(engine, ["craftingSkills", "skills"], config.craftingSkills,
      (s) => ({ displayName: s.displayName, type: s.type }),
    );

    // Crafting Station Types
    saveMapSection(engine, ["craftingStationTypes", "stationTypes"], config.craftingStationTypes,
      (s) => ({ displayName: s.displayName }),
    );

    // Guild settings
    setIn(engine, ["guildRanks", "founderRank"], config.guild.founderRank);
    setIn(engine, ["guildRanks", "defaultRank"], config.guild.defaultRank);

    // Guild Ranks
    saveMapSection(engine, ["guildRanks", "ranks"], config.guildRanks,
      (r) => {
        const obj: Record<string, unknown> = { displayName: r.displayName, level: r.level };
        if (r.permissions && r.permissions.length > 0) obj.permissions = r.permissions;
        return obj;
      },
    );

    // Character Creation
    setIn(engine, ["characterCreation", "startingGold"], config.characterCreation.startingGold);

    // Friends
    setIn(engine, ["friends", "maxFriends"], config.friends.maxFriends);

    // Class Start Rooms
    if (Object.keys(config.classStartRooms).length > 0) {
      setIn(engine, ["classStartRooms"], config.classStartRooms);
    }
  }

  // ─── Images ────────────────────────────────────────────────
  setIn(root, ["images", "baseUrl"], config.images.baseUrl);
  setIn(root, ["images", "spriteLevelTiers"], config.images.spriteLevelTiers);

  // ─── Global Assets ────────────────────────────────────────
  if (Object.keys(config.globalAssets).length > 0) {
    setIn(root, ["globalAssets"], config.globalAssets);
  }

  // ─── Progression ────────────────────────────────────────────
  setIn(root, ["progression", "maxLevel"], config.progression.maxLevel);
  setIn(root, ["progression", "xp", "baseXp"], config.progression.xp.baseXp);
  setIn(root, ["progression", "xp", "exponent"], config.progression.xp.exponent);
  setIn(root, ["progression", "xp", "linearXp"], config.progression.xp.linearXp);
  setIn(root, ["progression", "xp", "multiplier"], config.progression.xp.multiplier);
  setIn(root, ["progression", "xp", "defaultKillXp"], config.progression.xp.defaultKillXp);
  setIn(root, ["progression", "rewards", "hpPerLevel"], config.progression.rewards.hpPerLevel);
  setIn(root, ["progression", "rewards", "manaPerLevel"], config.progression.rewards.manaPerLevel);
  setIn(root, ["progression", "rewards", "fullHealOnLevelUp"], config.progression.rewards.fullHealOnLevelUp);
  setIn(root, ["progression", "rewards", "fullManaOnLevelUp"], config.progression.rewards.fullManaOnLevelUp);
  setIn(root, ["progression", "rewards", "baseHp"], config.progression.rewards.baseHp);
  setIn(root, ["progression", "rewards", "baseMana"], config.progression.rewards.baseMana);

  await writeTextFile(localPath, doc.toString());
  state.markClean();
}

/**
 * Replace a map section (like abilities.definitions) wholesale.
 * Navigates to the parent, then sets the definitions map to a plain JS object
 * which the YAML library serializes as a mapping.
 */
function saveMapSection<T>(
  node: any,
  path: string[],
  data: Record<string, T>,
  toPlain: (item: T) => Record<string, unknown>,
): void {
  const plain: Record<string, unknown> = {};
  for (const [id, item] of Object.entries(data)) {
    plain[id] = toPlain(item);
  }
  setIn(node, path, plain);
}

/**
 * Set a value at a nested YAML path, creating intermediate maps if needed.
 * Works with the yaml library's Document/YAMLMap nodes.
 */
function setIn(node: any, path: string[], value: unknown): void {
  let current = node;
  for (let i = 0; i < path.length - 1; i++) {
    let child = current.get(path[i], true);
    if (!child) {
      current.set(path[i], new YAMLMap());
      child = current.get(path[i], true);
    }
    current = child;
  }
  current.set(path[path.length - 1], value);
}

// ─── Split config saver ─────────────────────────────────────────────

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
    // classes.yaml
    write("classes", {
      definitions: mapEntries(config.classes, classToPlain),
    }),

    // races.yaml
    write("races", {
      definitions: mapEntries(config.races, raceToPlain),
    }),

    // abilities.yaml
    write("abilities", {
      definitions: mapEntries(config.abilities, abilityToPlain),
    }),

    // status-effects.yaml
    write("status-effects", {
      definitions: mapEntries(config.statusEffects, statusEffectToPlain),
      effectTypes: config.statusEffectTypes,
      stackBehaviors: config.stackBehaviors,
      targetTypes: config.abilityTargetTypes,
    }),

    // stats.yaml
    write("stats", {
      definitions: mapEntries(config.stats.definitions, (def) => ({
        displayName: def.displayName,
        abbreviation: def.abbreviation,
        description: def.description,
        baseStat: def.baseStat,
      })),
      bindings: config.stats.bindings,
    }),

    // equipment.yaml
    write("equipment", {
      slots: mapEntries(config.equipmentSlots, (s) => ({
        displayName: s.displayName,
        order: s.order,
      })),
    }),

    // combat.yaml
    write("combat", {
      combat: config.combat,
      mob: {
        minActionDelayMillis: config.mobActionDelay.minActionDelayMillis,
        maxActionDelayMillis: config.mobActionDelay.maxActionDelayMillis,
        tiers: config.mobTiers,
      },
    }),

    // crafting.yaml
    write("crafting", {
      ...config.crafting,
      skills: config.craftingSkills,
      stationTypes: config.craftingStationTypes,
    }),

    // progression.yaml
    write("progression", {
      progression: config.progression,
      economy: config.economy,
      regen: config.regen,
    }),

    // world.yaml
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
      achievementCategories: Object.keys(config.achievementCategories).length > 0 ? config.achievementCategories : undefined,
      achievementCriterionTypes: Object.keys(config.achievementCriterionTypes).length > 0 ? config.achievementCriterionTypes : undefined,
      questObjectiveTypes: Object.keys(config.questObjectiveTypes).length > 0 ? config.questObjectiveTypes : undefined,
      questCompletionTypes: Object.keys(config.questCompletionTypes).length > 0 ? config.questCompletionTypes : undefined,
    })),

    // assets.yaml
    write("assets", cleanObj({
      images: config.images,
      globalAssets: Object.keys(config.globalAssets).length > 0 ? config.globalAssets : undefined,
    })),
  ]);

  state.markClean();
}
