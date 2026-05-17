import { describe, it, expect } from "vitest";
import {
  bandAndDifficultyFromLevelMix,
  classifyMob,
  inferLevelBand,
  levelMixFromBandAndDifficulty,
  rebalanceZone,
  restatItem,
  restatMob,
  targetLevelForItemTier,
  targetLevelForTier,
} from "@/lib/zoneRebalance";
import type { AppConfig } from "@/types/config";
import type { ItemFile, MobFile, WorldFile } from "@/types/world";

const TIER_CONFIG = {
  weak: { baseHp: 10, hpScalingRate: 1.1, baseMinDamage: 1, baseMaxDamage: 2, damageScalingRate: 1.0, baseArmor: 0, baseXpReward: 15, xpScalingRate: 1.15, baseGoldMin: 1, baseGoldMax: 3, goldScalingRate: 1.1 },
  standard: { baseHp: 20, hpScalingRate: 1.1, baseMinDamage: 2, baseMaxDamage: 4, damageScalingRate: 1.1, baseArmor: 1, baseXpReward: 30, xpScalingRate: 1.15, baseGoldMin: 3, baseGoldMax: 8, goldScalingRate: 1.1 },
  elite: { baseHp: 40, hpScalingRate: 1.1, baseMinDamage: 3, baseMaxDamage: 6, damageScalingRate: 1.1, baseArmor: 2, baseXpReward: 75, xpScalingRate: 1.15, baseGoldMin: 10, baseGoldMax: 25, goldScalingRate: 1.1 },
  boss: { baseHp: 80, hpScalingRate: 1.1, baseMinDamage: 6, baseMaxDamage: 12, damageScalingRate: 1.1, baseArmor: 4, baseXpReward: 200, xpScalingRate: 1.15, baseGoldMin: 30, baseGoldMax: 80, goldScalingRate: 1.1 },
};

const MOCK_CONFIG = { mobTiers: TIER_CONFIG } as unknown as AppConfig;

function mob(overrides: Partial<MobFile> = {}): MobFile {
  return {
    name: "Test Mob",
    spawns: [{ room: "room_1" }],
    tier: "weak",
    ...overrides,
  };
}

function item(overrides: Partial<ItemFile> = {}): ItemFile {
  return {
    displayName: "Test Item",
    slot: "weapon",
    tier: "common",
    archetype: "damage",
    ...overrides,
  };
}

function zoneWith(
  mobs: Record<string, MobFile>,
  items: Record<string, ItemFile> = {},
): WorldFile {
  return {
    zone: "test_zone",
    startRoom: "room_1",
    rooms: { room_1: { description: "" } as never },
    mobs,
    items,
  };
}

describe("targetLevelForTier", () => {
  it("places weak at the floor and boss at the ceiling", () => {
    const band = { min: 3, max: 7 };
    expect(targetLevelForTier("weak", band)).toBe(3);
    expect(targetLevelForTier("standard", band)).toBe(5);
    expect(targetLevelForTier("elite", band)).toBe(6);
    expect(targetLevelForTier("boss", band)).toBe(7);
  });

  it("clamps elite to band floor for narrow bands", () => {
    expect(targetLevelForTier("elite", { min: 5, max: 5 })).toBe(5);
  });

  it("shifts standard and elite targets when difficulty changes", () => {
    const band = { min: 3, max: 7 };
    expect(targetLevelForTier("standard", band, "casual")).toBe(4);
    expect(targetLevelForTier("standard", band, "challenging")).toBe(6);
    expect(targetLevelForTier("elite", band, "casual")).toBe(5);
    expect(targetLevelForTier("elite", band, "challenging")).toBe(7);
  });

  it("keeps weak at the floor regardless of difficulty", () => {
    const band = { min: 3, max: 7 };
    expect(targetLevelForTier("weak", band, "casual")).toBe(3);
    expect(targetLevelForTier("weak", band, "standard")).toBe(3);
    expect(targetLevelForTier("weak", band, "challenging")).toBe(3);
  });
});

describe("bandAndDifficultyFromLevelMix", () => {
  it("easy → flat band at N, standard difficulty", () => {
    expect(bandAndDifficultyFromLevelMix(5, "easy")).toEqual({
      band: { min: 5, max: 5 },
      difficulty: "standard",
    });
  });

  it("medium → {N, N+1} casual: everything at N except the boss at N+1", () => {
    const { band, difficulty } = bandAndDifficultyFromLevelMix(5, "medium");
    expect(band).toEqual({ min: 5, max: 6 });
    expect(difficulty).toBe("casual");
    expect(targetLevelForTier("weak", band, difficulty)).toBe(5);
    expect(targetLevelForTier("standard", band, difficulty)).toBe(5);
    expect(targetLevelForTier("elite", band, difficulty)).toBe(5);
    expect(targetLevelForTier("boss", band, difficulty)).toBe(6);
  });

  it("hard → {N, N+1} challenging: weak at N, everything else at N+1", () => {
    const { band, difficulty } = bandAndDifficultyFromLevelMix(5, "hard");
    expect(band).toEqual({ min: 5, max: 6 });
    expect(difficulty).toBe("challenging");
    expect(targetLevelForTier("weak", band, difficulty)).toBe(5);
    expect(targetLevelForTier("standard", band, difficulty)).toBe(6);
    expect(targetLevelForTier("elite", band, difficulty)).toBe(6);
    expect(targetLevelForTier("boss", band, difficulty)).toBe(6);
  });

  it("clamps non-positive levels to 1", () => {
    expect(bandAndDifficultyFromLevelMix(0, "easy").band).toEqual({ min: 1, max: 1 });
    expect(bandAndDifficultyFromLevelMix(-5, "medium").band).toEqual({ min: 1, max: 2 });
  });
});

describe("levelMixFromBandAndDifficulty", () => {
  it("flat band → easy at the floor", () => {
    expect(levelMixFromBandAndDifficulty({ min: 5, max: 5 }, "standard")).toEqual({
      level: 5,
      mix: "easy",
    });
  });

  it("2-level band + casual/standard → medium", () => {
    expect(levelMixFromBandAndDifficulty({ min: 4, max: 5 }, "casual")).toEqual({
      level: 4,
      mix: "medium",
    });
    expect(levelMixFromBandAndDifficulty({ min: 4, max: 5 }, "standard")).toEqual({
      level: 4,
      mix: "medium",
    });
  });

  it("2-level band + challenging → hard", () => {
    expect(levelMixFromBandAndDifficulty({ min: 4, max: 5 }, "challenging")).toEqual({
      level: 4,
      mix: "hard",
    });
  });

  it("wide bands collapse to easy at the floor", () => {
    expect(levelMixFromBandAndDifficulty({ min: 3, max: 8 }, "standard")).toEqual({
      level: 3,
      mix: "easy",
    });
  });

  it("round-trips through bandAndDifficultyFromLevelMix", () => {
    for (const mix of ["easy", "medium", "hard"] as const) {
      const { band, difficulty } = bandAndDifficultyFromLevelMix(7, mix);
      expect(levelMixFromBandAndDifficulty(band, difficulty)).toEqual({ level: 7, mix });
    }
  });
});

describe("targetLevelForItemTier", () => {
  it("places rarer items higher in the band", () => {
    const band = { min: 3, max: 9 };
    expect(targetLevelForItemTier("trash", band)).toBe(3);
    expect(targetLevelForItemTier("common", band)).toBe(5); // mid - 1
    expect(targetLevelForItemTier("uncommon", band)).toBe(6); // mid
    expect(targetLevelForItemTier("rare", band)).toBe(7);    // mid + 1
    expect(targetLevelForItemTier("epic", band)).toBe(9);
    expect(targetLevelForItemTier("legendary", band)).toBe(9);
  });
});

describe("classifyMob", () => {
  it("classifies bare weak/standard mobs as trash", () => {
    expect(classifyMob(mob({ tier: "weak" }))).toBe("trash");
    expect(classifyMob(mob({ tier: "standard" }))).toBe("trash");
  });

  it("classifies bosses, elites, and quest-givers as named", () => {
    expect(classifyMob(mob({ tier: "boss" }))).toBe("named");
    expect(classifyMob(mob({ tier: "elite" }))).toBe("named");
    expect(classifyMob(mob({ tier: "weak", quests: ["q1"] }))).toBe("named");
    expect(classifyMob(mob({ tier: "standard", drops: [{ itemId: "i1", chance: 0.1 }] }))).toBe("named");
  });

  it("classifies non-combat roles as non-combat regardless of tier", () => {
    expect(classifyMob(mob({ role: "vendor" }))).toBe("non-combat");
    expect(classifyMob(mob({ role: "quest_giver", tier: "boss" }))).toBe("non-combat");
    expect(classifyMob(mob({ role: "dialog", drops: [{ itemId: "i1", chance: 1 }] }))).toBe("non-combat");
    expect(classifyMob(mob({ role: "prop" }))).toBe("non-combat");
  });
});

describe("inferLevelBand", () => {
  it("uses explicit levels when present", () => {
    const zone = zoneWith({
      a: mob({ level: 4 }),
      b: mob({ level: 9 }),
    });
    expect(inferLevelBand(zone)).toEqual({ min: 4, max: 9 });
  });

  it("falls back to tier-only heuristic when no levels are set", () => {
    const zone = zoneWith({
      a: mob({ tier: "weak" }),
      b: mob({ tier: "boss" }),
    });
    expect(inferLevelBand(zone)).toEqual({ min: 5, max: 10 });
  });

  it("returns the existing band when zone already has one", () => {
    const zone = zoneWith({ a: mob({ level: 4 }) });
    zone.levelBand = { min: 2, max: 8 };
    expect(inferLevelBand(zone)).toEqual({ min: 2, max: 8 });
  });
});

describe("restatMob", () => {
  it("sets the level and drops authored stat overrides", () => {
    const before = mob({
      tier: "weak",
      level: 1,
      hp: 999,
      minDamage: 50,
      maxDamage: 75,
      armor: 12,
      xpReward: 1000,
      goldMin: 100,
      goldMax: 200,
    });
    const after = restatMob(before, 5, TIER_CONFIG.weak);
    expect(after.level).toBe(5);
    expect(after.hp).toBeUndefined();
    expect(after.minDamage).toBeUndefined();
    expect(after.maxDamage).toBeUndefined();
    expect(after.armor).toBeUndefined();
    expect(after.xpReward).toBeUndefined();
    expect(after.goldMin).toBeUndefined();
    expect(after.goldMax).toBeUndefined();
  });

  it("preserves flavor knobs (toughness + mults) and graph fields", () => {
    const before = mob({
      tier: "elite",
      hp: 500,
      toughness: 2,
      hpMult: 1.5,
      dmgMult: 1.25,
      drops: [{ itemId: "shiny", chance: 0.5 }],
      dialogue: { greet: { text: "Hello." } as never },
      quests: ["q_first_blood"],
      faction: "lawful",
    });
    const after = restatMob(before, 8, TIER_CONFIG.elite);
    expect(after.toughness).toBe(2);
    expect(after.hpMult).toBe(1.5);
    expect(after.dmgMult).toBe(1.25);
    expect(after.drops).toEqual([{ itemId: "shiny", chance: 0.5 }]);
    expect(after.dialogue).toBeDefined();
    expect(after.quests).toEqual(["q_first_blood"]);
    expect(after.faction).toBe("lawful");
  });
});

describe("restatItem", () => {
  it("rebuilds damage and stats from the budget pipeline", () => {
    const before = item({
      slot: "weapon",
      tier: "rare",
      archetype: "damage",
      level: 1,
      damage: 1,        // wrong — should be rebuilt
      armor: 99,        // wrong for damage archetype — should be dropped
      primaryStat: "STR",
    });
    const after = restatItem(before, 6);
    expect(after.level).toBe(6);
    expect(after.tier).toBe("rare");
    expect(after.damage).toBeGreaterThan(0);
    // damage-archetype weapons get zero armor budget — should be dropped, not zero
    expect(after.armor).toBeUndefined();
    expect(after.displayName).toBe("Test Item");
    expect(after.slot).toBe("weapon");
    expect(after.stats).toBeDefined();
  });

  it("preserves class restrictions and authored slot/archetype", () => {
    const before = item({
      slot: "chest",
      tier: "epic",
      archetype: "armor",
      classes: ["WARRIOR"],
    });
    const after = restatItem(before, 10);
    expect(after.classes).toEqual(["WARRIOR"]);
    expect(after.slot).toBe("chest");
    expect(after.archetype).toBe("armor");
    expect(after.armor).toBeGreaterThan(0);
  });

  it("skips consumables and items without a slot", () => {
    const noSlot = item({ slot: undefined });
    expect(restatItem(noSlot, 5)).toBe(noSlot);
    const potion = item({ slot: undefined, consumable: true, onUse: { healHp: 20 } });
    expect(restatItem(potion, 5)).toBe(potion);
  });

  it("defaults missing tier to common and infers archetype from slot", () => {
    const before = item({ slot: "chest", tier: undefined, archetype: undefined });
    const after = restatItem(before, 4);
    expect(after.tier).toBe("common");
    // inferArchetypeFromSlot("chest") → "armor"
    expect(after.archetype).toBe("armor");
    expect(after.armor).toBeGreaterThan(0);
  });
});

describe("rebalanceZone", () => {
  it("restates every combatant mob and equippable item", () => {
    const zone = zoneWith(
      {
        wisp: mob({ tier: "weak", level: 1, hp: 999, minDamage: 99 }),
        captain: mob({ tier: "boss", level: 1, hp: 1, xpReward: 1 }),
        innkeeper: mob({ role: "vendor", tier: "standard" }),
      },
      {
        rusty_sword: item({ slot: "weapon", tier: "common", damage: 99 }),
        chain_vest: item({ slot: "chest", tier: "uncommon", archetype: "armor" }),
        healing_potion: item({ slot: undefined, consumable: true, onUse: { healHp: 25 } }),
      },
    );
    zone.levelBand = { min: 3, max: 8 };

    const { world, summary } = rebalanceZone(zone, MOCK_CONFIG);

    // Mobs
    expect(world.mobs!.wisp.level).toBe(3);   // weak → band.min
    expect(world.mobs!.wisp.hp).toBeUndefined();
    expect(world.mobs!.wisp.minDamage).toBeUndefined();
    expect(world.mobs!.captain.level).toBe(8); // boss → band.max
    expect(world.mobs!.captain.hp).toBeUndefined();
    expect(world.mobs!.captain.xpReward).toBeUndefined();
    // Non-combat mob untouched
    expect(world.mobs!.innkeeper).toBe(zone.mobs!.innkeeper);

    // Items
    expect(world.items!.rusty_sword.damage).toBeGreaterThan(0);
    expect(world.items!.rusty_sword.damage).not.toBe(99);
    expect(world.items!.chain_vest.armor).toBeGreaterThan(0);
    // Consumable untouched
    expect(world.items!.healing_potion).toBe(zone.items!.healing_potion);

    // Persisted band + difficulty
    expect(world.levelBand).toEqual({ min: 3, max: 8 });
    expect(world.difficultyHint).toBe("standard");

    // Summary
    expect(summary.mobsRestated).toBe(2);
    expect(summary.mobsSkippedNonCombat).toBe(1);
    expect(summary.itemsRestated).toBe(2);
    expect(summary.itemsSkipped).toBe(1);
    expect(summary.playerScaledNoOp).toBe(false);
  });

  it("is a no-op for player-scaled zones", () => {
    const zone = zoneWith({ a: mob({ hp: 1, level: 1 }) });
    zone.scaling = { mode: "player" };

    const { world, summary } = rebalanceZone(zone, MOCK_CONFIG);

    expect(world).toBe(zone);
    expect(summary.playerScaledNoOp).toBe(true);
    expect(summary.mobsRestated).toBe(0);
  });

  it("clamps the band to bounded scaling range", () => {
    const zone = zoneWith({ a: mob({ tier: "boss" }) });
    zone.levelBand = { min: 1, max: 100 };
    zone.scaling = { mode: "bounded", levelRange: [5, 10] };

    const { world, summary } = rebalanceZone(zone, MOCK_CONFIG);

    expect(world.levelBand).toEqual({ min: 5, max: 10 });
    expect(summary.bandClampedToScaling).toBe(true);
    expect(world.mobs!.a.level).toBe(10);
  });
});
