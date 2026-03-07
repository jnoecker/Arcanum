import { describe, it, expect } from "vitest";
import { validateConfig } from "../validateConfig";
import type { AppConfig } from "@/types/config";

/** Minimal valid config for tests to spread over */
const BASE_CONFIG: AppConfig = {
  server: { telnetPort: 4000, webPort: 8080 },
  stats: {
    definitions: {
      STR: { id: "STR", displayName: "Strength", abbreviation: "STR", description: "", baseStat: 10 },
      DEX: { id: "DEX", displayName: "Dexterity", abbreviation: "DEX", description: "", baseStat: 10 },
      INT: { id: "INT", displayName: "Intelligence", abbreviation: "INT", description: "", baseStat: 10 },
      CON: { id: "CON", displayName: "Constitution", abbreviation: "CON", description: "", baseStat: 10 },
      WIS: { id: "WIS", displayName: "Wisdom", abbreviation: "WIS", description: "", baseStat: 10 },
      CHA: { id: "CHA", displayName: "Charisma", abbreviation: "CHA", description: "", baseStat: 10 },
    },
    bindings: {
      meleeDamageStat: "STR",
      meleeDamageDivisor: 3,
      dodgeStat: "DEX",
      dodgePerPoint: 2,
      maxDodgePercent: 30,
      spellDamageStat: "INT",
      spellDamageDivisor: 3,
      hpScalingStat: "CON",
      hpScalingDivisor: 5,
      manaScalingStat: "INT",
      manaScalingDivisor: 5,
      hpRegenStat: "CON",
      hpRegenMsPerPoint: 200,
      manaRegenStat: "WIS",
      manaRegenMsPerPoint: 200,
      xpBonusStat: "CHA",
      xpBonusPerPoint: 0.005,
    },
  },
  abilities: {},
  statusEffects: {},
  combat: {
    maxCombatsPerTick: 20,
    tickMillis: 2000,
    minDamage: 1,
    maxDamage: 4,
    feedback: { enabled: false, roomBroadcastEnabled: false },
  },
  mobTiers: {
    weak: { baseHp: 10, hpPerLevel: 3, baseMinDamage: 1, baseMaxDamage: 4, damagePerLevel: 1, baseArmor: 0, baseXpReward: 30, xpRewardPerLevel: 10, baseGoldMin: 0, baseGoldMax: 0, goldPerLevel: 0 },
    standard: { baseHp: 20, hpPerLevel: 5, baseMinDamage: 2, baseMaxDamage: 6, damagePerLevel: 1, baseArmor: 0, baseXpReward: 50, xpRewardPerLevel: 15, baseGoldMin: 0, baseGoldMax: 0, goldPerLevel: 0 },
    elite: { baseHp: 40, hpPerLevel: 8, baseMinDamage: 4, baseMaxDamage: 10, damagePerLevel: 2, baseArmor: 2, baseXpReward: 100, xpRewardPerLevel: 25, baseGoldMin: 0, baseGoldMax: 0, goldPerLevel: 0 },
    boss: { baseHp: 100, hpPerLevel: 15, baseMinDamage: 8, baseMaxDamage: 20, damagePerLevel: 3, baseArmor: 5, baseXpReward: 300, xpRewardPerLevel: 50, baseGoldMin: 0, baseGoldMax: 0, goldPerLevel: 0 },
  },
  progression: {
    maxLevel: 50,
    xp: { baseXp: 100, exponent: 2, linearXp: 0, multiplier: 1, defaultKillXp: 50 },
    rewards: { hpPerLevel: 2, manaPerLevel: 5, fullHealOnLevelUp: true, fullManaOnLevelUp: true },
  },
  economy: { buyMultiplier: 1.0, sellMultiplier: 0.5 },
  regen: {
    maxPlayersPerTick: 50,
    baseIntervalMillis: 5000,
    minIntervalMillis: 1000,
    regenAmount: 1,
    mana: { baseIntervalMillis: 3000, minIntervalMillis: 1000, regenAmount: 1 },
  },
  crafting: { maxSkillLevel: 100, baseXpPerLevel: 50, xpExponent: 1.5, gatherCooldownMs: 3000, stationBonusQuantity: 1 },
  group: { maxSize: 5, inviteTimeoutMs: 60000, xpBonusPerMember: 0.1 },
  classes: {},
  races: {},
  rawSections: {},
};

describe("validateConfig", () => {
  it("returns no issues for a valid config", () => {
    expect(validateConfig(BASE_CONFIG)).toEqual([]);
  });

  // ─── Server ─────────────────────────────────────────────────
  it("flags telnet port out of range", () => {
    const cfg = { ...BASE_CONFIG, server: { telnetPort: 0, webPort: 8080 } };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({ entity: "server", severity: "error", message: expect.stringContaining("Telnet port") }),
    );
  });

  it("flags web port out of range", () => {
    const cfg = { ...BASE_CONFIG, server: { telnetPort: 4000, webPort: 70000 } };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({ entity: "server", severity: "error", message: expect.stringContaining("Web port") }),
    );
  });

  it("flags duplicate ports", () => {
    const cfg = { ...BASE_CONFIG, server: { telnetPort: 4000, webPort: 4000 } };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({ entity: "server", message: expect.stringContaining("different") }),
    );
  });

  // ─── Stat bindings ──────────────────────────────────────────
  it("flags binding referencing unknown stat", () => {
    const cfg = {
      ...BASE_CONFIG,
      stats: {
        ...BASE_CONFIG.stats,
        bindings: { ...BASE_CONFIG.stats.bindings, meleeDamageStat: "MISSING" },
      },
    };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({
        entity: "stats.bindings",
        severity: "error",
        message: expect.stringContaining("MISSING"),
      }),
    );
  });

  it("skips binding checks when no stats defined", () => {
    const cfg = {
      ...BASE_CONFIG,
      stats: {
        definitions: {},
        bindings: { ...BASE_CONFIG.stats.bindings, meleeDamageStat: "ANYTHING" },
      },
    };
    const issues = validateConfig(cfg);
    expect(issues.filter((i) => i.entity === "stats.bindings")).toEqual([]);
  });

  // ─── Abilities ──────────────────────────────────────────────
  it("flags ability referencing unknown status effect", () => {
    const cfg = {
      ...BASE_CONFIG,
      abilities: {
        poison_strike: {
          displayName: "Poison Strike",
          manaCost: 5,
          cooldownMs: 0,
          levelRequired: 1,
          targetType: "ENEMY",
          effect: { type: "APPLY_STATUS", statusEffectId: "nonexistent" },
        },
      },
    };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({
        entity: "ability:poison_strike",
        severity: "error",
        message: expect.stringContaining("nonexistent"),
      }),
    );
  });

  it("passes when ability references valid status effect", () => {
    const cfg = {
      ...BASE_CONFIG,
      statusEffects: {
        poison: { displayName: "Poison", effectType: "DOT", durationMs: 10000 },
      },
      abilities: {
        poison_strike: {
          displayName: "Poison Strike",
          manaCost: 5,
          cooldownMs: 0,
          levelRequired: 1,
          targetType: "ENEMY",
          effect: { type: "APPLY_STATUS", statusEffectId: "poison" },
        },
      },
    };
    const issues = validateConfig(cfg);
    expect(issues.filter((i) => i.entity.startsWith("ability:"))).toEqual([]);
  });

  it("warns about ability with unknown required class", () => {
    const cfg = {
      ...BASE_CONFIG,
      classes: { WARRIOR: { displayName: "Warrior", hpPerLevel: 3, manaPerLevel: 1 } },
      abilities: {
        smite: {
          displayName: "Smite",
          manaCost: 5,
          cooldownMs: 0,
          levelRequired: 1,
          targetType: "ENEMY",
          requiredClass: "PALADIN",
          effect: { type: "DIRECT_DAMAGE", minDamage: 1, maxDamage: 5 },
        },
      },
    };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({
        entity: "ability:smite",
        severity: "warning",
        message: expect.stringContaining("PALADIN"),
      }),
    );
  });

  // ─── Status effects ─────────────────────────────────────────
  it("flags status effect stat mod referencing unknown stat", () => {
    const cfg = {
      ...BASE_CONFIG,
      statusEffects: {
        buff: {
          displayName: "Buff",
          effectType: "STAT_BUFF",
          durationMs: 60000,
          statMods: { FAKE: 5 },
        },
      },
    };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({
        entity: "statusEffect:buff",
        severity: "error",
        message: expect.stringContaining("FAKE"),
      }),
    );
  });

  // ─── Classes ────────────────────────────────────────────────
  it("warns about class with unknown primary stat", () => {
    const cfg = {
      ...BASE_CONFIG,
      classes: {
        MAGE: { displayName: "Mage", hpPerLevel: 1, manaPerLevel: 5, primaryStat: "NOPE" },
      },
    };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({
        entity: "class:MAGE",
        severity: "warning",
        message: expect.stringContaining("NOPE"),
      }),
    );
  });

  // ─── Races ──────────────────────────────────────────────────
  it("warns about race stat mod referencing unknown stat", () => {
    const cfg = {
      ...BASE_CONFIG,
      races: {
        elf: { displayName: "Elf", statMods: { BOGUS: 2 } },
      },
    };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({
        entity: "race:elf",
        severity: "warning",
        message: expect.stringContaining("BOGUS"),
      }),
    );
  });

  // ─── Combat ─────────────────────────────────────────────────
  it("warns when min damage exceeds max damage", () => {
    const cfg = {
      ...BASE_CONFIG,
      combat: { ...BASE_CONFIG.combat, minDamage: 10, maxDamage: 3 },
    };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({ entity: "combat", severity: "warning" }),
    );
  });

  // ─── Progression ────────────────────────────────────────────
  it("flags max level below 1", () => {
    const cfg = {
      ...BASE_CONFIG,
      progression: { ...BASE_CONFIG.progression, maxLevel: 0 },
    };
    const issues = validateConfig(cfg);
    expect(issues).toContainEqual(
      expect.objectContaining({ entity: "progression", severity: "error" }),
    );
  });
});
