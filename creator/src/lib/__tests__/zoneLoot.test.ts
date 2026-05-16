import { describe, it, expect } from "vitest";
import { ensureLootComposition, DEFAULT_LOOT_RULES } from "@/lib/zoneLoot";
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
  return { name: "Test Mob", spawns: [{ room: "room_1" }], tier: "weak", ...overrides };
}

function makeWorld(
  mobs: Record<string, MobFile> = {},
  items: Record<string, ItemFile> = {},
  band = { min: 1, max: 5 },
): WorldFile {
  return {
    zone: "test_zone",
    startRoom: "room_1",
    rooms: { room_1: { description: "" } as never },
    mobs,
    items,
    levelBand: band,
  };
}

const CLASSES = ["WARRIOR", "MAGE", "ROGUE"];

describe("ensureLootComposition", () => {
  it("generates one epic per class when none exist", () => {
    const world = makeWorld({
      boss_a: mob({ tier: "boss" }),
      elite_a: mob({ tier: "elite" }),
      grunt_a: mob({ tier: "standard" }),
      rat_a: mob({ tier: "weak" }),
    });
    const { world: out, summary } = ensureLootComposition(world, MOCK_CONFIG, CLASSES);

    expect(summary.epicAdded).toBe(3);
    const epicItems = Object.entries(out.items ?? {}).filter(([, it]) => it.tier === "epic");
    expect(epicItems).toHaveLength(3);
    const classSet = new Set<string>();
    for (const [, it] of epicItems) {
      expect(it.classes).toHaveLength(1);
      classSet.add(it.classes![0]!);
    }
    expect(classSet).toEqual(new Set(CLASSES));
  });

  it("skips classes that already have an epic", () => {
    const world = makeWorld(
      { boss_a: mob({ tier: "boss" }) },
      {
        legendary_blade: {
          displayName: "Warlord's Blade",
          slot: "weapon",
          tier: "epic",
          classes: ["WARRIOR"],
        },
      },
    );
    const { summary } = ensureLootComposition(world, MOCK_CONFIG, CLASSES);
    expect(summary.epicAdded).toBe(2); // mage + rogue only
  });

  it("fills the uncommon + common pools and skips per-class duplicates", () => {
    const world = makeWorld({
      grunt: mob({ tier: "standard" }),
      rat: mob({ tier: "weak" }),
    });
    const { world: out, summary } = ensureLootComposition(world, MOCK_CONFIG, [], {
      perClassByTier: { epic: 0, rare: 0 },
      poolByTier: { uncommon: 3, common: 4 },
    });

    expect(summary.uncommonAdded).toBe(3);
    expect(summary.commonAdded).toBe(4);
    expect(summary.itemsAdded).toBe(7);

    const tiers = Object.values(out.items ?? {}).map((it) => it.tier);
    expect(tiers.filter((t) => t === "uncommon")).toHaveLength(3);
    expect(tiers.filter((t) => t === "common")).toHaveLength(4);
  });

  it("drops epics on bosses and rares on elites", () => {
    const world = makeWorld({
      big_bad: mob({ tier: "boss" }),
      lieutenant: mob({ tier: "elite" }),
      lieutenant_b: mob({ tier: "elite" }),
      grunt: mob({ tier: "standard" }),
    });
    const { world: out } = ensureLootComposition(world, MOCK_CONFIG, ["WARRIOR"]);

    const bossDrops = out.mobs!.big_bad.drops ?? [];
    const epicDrop = bossDrops.find((d) => d.itemId.startsWith("gen_epic_"));
    expect(epicDrop).toBeDefined();
    expect(epicDrop!.chance).toBeLessThanOrEqual(0.2);

    const eliteIds = ["lieutenant", "lieutenant_b"];
    const rareDrops = eliteIds.flatMap((id) => out.mobs![id]!.drops ?? []).filter((d) =>
      d.itemId.startsWith("gen_rare_"),
    );
    expect(rareDrops.length).toBeGreaterThan(0);
  });

  it("falls back to any combat mob when no preferred tier is present", () => {
    const world = makeWorld({
      rat: mob({ tier: "weak" }),
    });
    const { world: out, summary } = ensureLootComposition(world, MOCK_CONFIG, ["WARRIOR"]);

    expect(summary.epicAdded).toBe(1);
    // No boss or elite → drop lands on the weak mob (fallback).
    const ratDrops = out.mobs!.rat.drops ?? [];
    expect(ratDrops.some((d) => d.itemId.startsWith("gen_epic_"))).toBe(true);
  });

  it("does not drop on non-combat mobs", () => {
    const world = makeWorld({
      shopkeeper: mob({ tier: "standard", role: "vendor" }),
      rat: mob({ tier: "weak" }),
    });
    const { world: out } = ensureLootComposition(world, MOCK_CONFIG, ["WARRIOR"]);
    expect(out.mobs!.shopkeeper.drops ?? []).toHaveLength(0);
  });

  it("preserves existing items untouched", () => {
    const sword: ItemFile = {
      displayName: "Hand-authored Sword",
      slot: "weapon",
      tier: "rare",
      classes: ["WARRIOR"],
      damage: 42,
    };
    const world = makeWorld({ boss_a: mob({ tier: "boss" }) }, { authored_sword: sword });
    const { world: out } = ensureLootComposition(world, MOCK_CONFIG, ["WARRIOR"]);
    expect(out.items!.authored_sword).toBe(sword);
  });

  it("is idempotent — running twice on a balanced zone adds nothing", () => {
    const world = makeWorld({
      boss_a: mob({ tier: "boss" }),
      elite_a: mob({ tier: "elite" }),
      grunt: mob({ tier: "standard" }),
      rat: mob({ tier: "weak" }),
    });
    const first = ensureLootComposition(world, MOCK_CONFIG, CLASSES);
    const second = ensureLootComposition(first.world, MOCK_CONFIG, CLASSES);
    expect(second.summary.itemsAdded).toBe(0);
    expect(Object.keys(second.world.items ?? {}).length).toBe(
      Object.keys(first.world.items ?? {}).length,
    );
  });

  it("is a no-op for player-scaled zones", () => {
    const world = makeWorld({ rat: mob() });
    world.scaling = { mode: "player" };
    const { world: out, summary } = ensureLootComposition(world, MOCK_CONFIG, CLASSES);
    expect(out).toBe(world);
    expect(summary.playerScaledNoOp).toBe(true);
    expect(summary.itemsAdded).toBe(0);
  });

  it("DEFAULT_LOOT_RULES yields one epic and two rares per class", () => {
    const world = makeWorld({
      big_bad: mob({ tier: "boss" }),
      elite_a: mob({ tier: "elite" }),
      elite_b: mob({ tier: "elite" }),
      grunt: mob({ tier: "standard" }),
      rat: mob({ tier: "weak" }),
    });
    const { summary } = ensureLootComposition(world, MOCK_CONFIG, ["WARRIOR"], DEFAULT_LOOT_RULES);
    expect(summary.epicAdded).toBe(1);
    expect(summary.rareAdded).toBe(2);
    expect(summary.uncommonAdded).toBe(DEFAULT_LOOT_RULES.poolByTier.uncommon);
    expect(summary.commonAdded).toBe(DEFAULT_LOOT_RULES.poolByTier.common);
  });
});
