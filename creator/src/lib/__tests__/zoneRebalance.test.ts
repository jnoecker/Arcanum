import { describe, it, expect } from "vitest";
import {
  applyZoneRebalance,
  classifyMob,
  computeZoneRebalance,
  inferLevelBand,
  targetLevelForTier,
} from "@/lib/zoneRebalance";
import type { AppConfig } from "@/types/config";
import type { MobFile, WorldFile } from "@/types/world";

const TIER_CONFIG = {
  weak: { baseHp: 10, hpPerLevel: 3, baseMinDamage: 1, baseMaxDamage: 2, damagePerLevel: 0, baseArmor: 0, baseXpReward: 15, xpRewardPerLevel: 5, baseGoldMin: 1, baseGoldMax: 3, goldPerLevel: 1 },
  standard: { baseHp: 20, hpPerLevel: 5, baseMinDamage: 2, baseMaxDamage: 4, damagePerLevel: 1, baseArmor: 1, baseXpReward: 30, xpRewardPerLevel: 10, baseGoldMin: 3, baseGoldMax: 8, goldPerLevel: 2 },
  elite: { baseHp: 40, hpPerLevel: 8, baseMinDamage: 3, baseMaxDamage: 6, damagePerLevel: 1, baseArmor: 2, baseXpReward: 75, xpRewardPerLevel: 25, baseGoldMin: 10, baseGoldMax: 25, goldPerLevel: 5 },
  boss: { baseHp: 80, hpPerLevel: 15, baseMinDamage: 6, baseMaxDamage: 12, damagePerLevel: 2, baseArmor: 4, baseXpReward: 200, xpRewardPerLevel: 50, baseGoldMin: 30, baseGoldMax: 80, goldPerLevel: 15 },
};

const MOCK_CONFIG = { mobTiers: TIER_CONFIG } as unknown as AppConfig;

function mob(overrides: Partial<MobFile> = {}): MobFile {
  return {
    name: "Test Mob",
    room: "room_1",
    tier: "weak",
    ...overrides,
  };
}

function zoneWith(mobs: Record<string, MobFile>): WorldFile {
  return {
    zone: "test_zone",
    startRoom: "room_1",
    rooms: { room_1: { description: "" } as never },
    mobs,
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

describe("computeZoneRebalance", () => {
  it("classifies trash separately from named and sorts named first", () => {
    const zone = zoneWith({
      goblin: mob({ tier: "weak" }),
      boss_fight: mob({ tier: "boss" }),
      shopkeep: mob({ tier: "standard", quests: ["q1"] }),
    });
    const diff = computeZoneRebalance(zone, MOCK_CONFIG, {
      levelBand: { min: 3, max: 7 },
    });
    const ids = diff.mobs.map((m) => m.mobId);
    expect(ids.slice(0, 2).sort()).toEqual(["boss_fight", "shopkeep"]);
    expect(ids[2]).toBe("goblin");
    expect(diff.mobs.find((m) => m.mobId === "goblin")?.classification).toBe("trash");
    expect(diff.mobs.find((m) => m.mobId === "boss_fight")?.classification).toBe("named");
  });

  it("flags level changes when current differs from target", () => {
    const zone = zoneWith({ goblin: mob({ tier: "weak", level: 12 }) });
    const diff = computeZoneRebalance(zone, MOCK_CONFIG, {
      levelBand: { min: 3, max: 7 },
    });
    const goblin = diff.mobs[0]!;
    expect(goblin.targetLevel).toBe(3);
    expect(goblin.levelChanged).toBe(true);
  });

  it("marks within-tolerance overrides as 'drop' and divergent as 'flag'", () => {
    // weak tier @ L3: hp = 10 + (3 - 1)*3 = 16, xpReward = 15 + (3 - 1)*5 = 25
    const zone = zoneWith({
      close: mob({ tier: "weak", hp: 17 }),
      far: mob({ tier: "weak", hp: 200 }),
      authoredXp: mob({ tier: "weak", xpReward: 9999 }),
    });
    const diff = computeZoneRebalance(zone, MOCK_CONFIG, {
      levelBand: { min: 3, max: 3 },
    });
    const close = diff.mobs.find((m) => m.mobId === "close")!;
    const far = diff.mobs.find((m) => m.mobId === "far")!;
    const authored = diff.mobs.find((m) => m.mobId === "authoredXp")!;
    expect(close.overrideChanges[0]?.action).toBe("drop");
    expect(far.overrideChanges[0]?.action).toBe("flag");
    expect(authored.overrideChanges[0]?.action).toBe("flag");
  });

  it("skips mobs whose tier is not in config", () => {
    const zone = zoneWith({ mystery: mob({ tier: "phantom" }) });
    const diff = computeZoneRebalance(zone, MOCK_CONFIG, {
      levelBand: { min: 3, max: 7 },
    });
    expect(diff.mobs).toEqual([]);
    expect(diff.skippedMobIds).toEqual(["mystery"]);
  });
});

describe("applyZoneRebalance", () => {
  it("sets level on accepted mobs, leaves un-accepted alone, persists levelBand", () => {
    const zone = zoneWith({
      goblin: mob({ tier: "weak", level: 1 }),
      brute: mob({ tier: "standard", level: 1 }),
    });
    const diff = computeZoneRebalance(zone, MOCK_CONFIG, {
      levelBand: { min: 5, max: 9 },
      difficultyHint: "standard",
    });
    const next = applyZoneRebalance(zone, diff, {
      acceptedMobIds: new Set(["goblin"]),
    });

    expect(next.levelBand).toEqual({ min: 5, max: 9 });
    expect(next.difficultyHint).toBe("standard");
    expect(next.mobs?.goblin?.level).toBe(5);
    expect(next.mobs?.brute?.level).toBe(1);
  });

  it("drops within-tolerance overrides and keeps flagged ones by default", () => {
    const zone = zoneWith({
      goblin: mob({ tier: "weak", hp: 17, xpReward: 9999 }),
    });
    const diff = computeZoneRebalance(zone, MOCK_CONFIG, {
      levelBand: { min: 3, max: 3 },
    });
    const next = applyZoneRebalance(zone, diff, {
      acceptedMobIds: new Set(["goblin"]),
    });
    expect(next.mobs?.goblin?.hp).toBeUndefined();
    expect(next.mobs?.goblin?.xpReward).toBe(9999);
  });

  it("respects per-field overrides (drop -> keep)", () => {
    const zone = zoneWith({ goblin: mob({ tier: "weak", hp: 17 }) });
    const diff = computeZoneRebalance(zone, MOCK_CONFIG, {
      levelBand: { min: 3, max: 3 },
    });
    const next = applyZoneRebalance(zone, diff, {
      acceptedMobIds: new Set(["goblin"]),
      overrideOverrides: new Map([["goblin", new Map([["hp", "keep"]])]]),
    });
    expect(next.mobs?.goblin?.hp).toBe(17);
  });

  it("clears difficultyHint when the new target omits it", () => {
    const zone = zoneWith({ goblin: mob({ tier: "weak", level: 1 }) });
    zone.difficultyHint = "challenging";
    const diff = computeZoneRebalance(zone, MOCK_CONFIG, {
      levelBand: { min: 5, max: 5 },
    });
    const next = applyZoneRebalance(zone, diff, {
      acceptedMobIds: new Set(["goblin"]),
    });
    expect(next.difficultyHint).toBeUndefined();
  });

  it("does not mutate the input zone", () => {
    const zone = zoneWith({ goblin: mob({ tier: "weak", level: 1 }) });
    const before = JSON.stringify(zone);
    const diff = computeZoneRebalance(zone, MOCK_CONFIG, { levelBand: { min: 5, max: 5 } });
    applyZoneRebalance(zone, diff, { acceptedMobIds: new Set(["goblin"]) });
    expect(JSON.stringify(zone)).toBe(before);
  });
});
