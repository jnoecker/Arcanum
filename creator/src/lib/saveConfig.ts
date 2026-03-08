import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { parseDocument, YAMLMap } from "yaml";
import { useConfigStore } from "@/stores/configStore";

/**
 * Save the current AppConfig back to application.yaml.
 * Reads the existing file, patches known sections in-place, and writes back.
 */
export async function saveConfig(mudDir: string): Promise<void> {
  const state = useConfigStore.getState();
  const config = state.config;
  if (!config) throw new Error("No config loaded");

  const configPath = `${mudDir}/src/main/resources/application.yaml`;
  const content = await readTextFile(configPath);
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
        if (a.classRestriction) obj.classRestriction = a.classRestriction;
        if (a.image) obj.image = a.image;
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
        if (e.shieldAmount != null) obj.shieldAmount = e.shieldAmount;
        if (e.stackBehavior) obj.stackBehavior = e.stackBehavior;
        if (e.maxStacks != null) obj.maxStacks = e.maxStacks;
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
        if (cls.primaryStat) obj.primaryStat = cls.primaryStat;
        if (cls.selectable != null) obj.selectable = cls.selectable;
        if (cls.startRoom) obj.startRoom = cls.startRoom;
        if (cls.threatMultiplier != null) obj.threatMultiplier = cls.threatMultiplier;
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
    saveMapSection(engine, ["statusEffects", "effectTypes"], config.statusEffectTypes,
      (t) => {
        const obj: Record<string, unknown> = { displayName: t.displayName };
        if (t.tickBehavior && t.tickBehavior !== "none") obj.tickBehavior = t.tickBehavior;
        if (t.preventsActions) obj.preventsActions = true;
        if (t.preventsMovement) obj.preventsMovement = true;
        if (t.absorbsDamage) obj.absorbsDamage = true;
        return obj;
      },
    );

    // Stack Behaviors
    saveMapSection(engine, ["statusEffects", "stackBehaviors"], config.stackBehaviors,
      (b) => ({ displayName: b.displayName }),
    );

    // Ability Target Types
    saveMapSection(engine, ["abilities", "targetTypes"], config.abilityTargetTypes,
      (t) => ({ displayName: t.displayName }),
    );

    // Crafting Skills
    saveMapSection(engine, ["crafting", "skills"], config.craftingSkills,
      (s) => ({ displayName: s.displayName, type: s.type }),
    );

    // Crafting Station Types
    saveMapSection(engine, ["crafting", "stationTypes"], config.craftingStationTypes,
      (s) => ({ displayName: s.displayName }),
    );

    // Guild Ranks
    saveMapSection(engine, ["guild", "ranks"], config.guildRanks,
      (r) => {
        const obj: Record<string, unknown> = { displayName: r.displayName, level: r.level };
        if (r.permissions && r.permissions.length > 0) obj.permissions = r.permissions;
        return obj;
      },
    );

    // Character Creation
    setIn(engine, ["characterCreation", "startingGold"], config.characterCreation.startingGold);

    // Class Start Rooms
    if (Object.keys(config.classStartRooms).length > 0) {
      setIn(engine, ["classStartRooms"], config.classStartRooms);
    }
  }

  // ─── Images ────────────────────────────────────────────────
  setIn(root, ["images", "baseUrl"], config.images.baseUrl);
  setIn(root, ["images", "spriteLevelTiers"], config.images.spriteLevelTiers);
  setIn(root, ["images", "staffSpriteTier"], config.images.staffSpriteTier);

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

  await writeTextFile(configPath, doc.toString());
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
