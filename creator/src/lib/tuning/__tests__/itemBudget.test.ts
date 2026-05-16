import { describe, it, expect } from "vitest";
import {
  LEVEL_SCALING_RATE,
  STAT_CAP,
  XP_LEVEL_MULTIPLIER,
  TIER_MULTIPLIERS,
  ARCHETYPE_SPLITS,
  DEFAULT_POINT_COSTS,
  DEFAULT_SLOT_BASE_BUDGETS,
  FALLBACK_SLOT_BASE,
  ACCESSORY_SLOTS,
  ITEM_TIERS,
  levelBudgetMultiplier,
  resolveSlotBase,
  effectiveArchetypeForSlot,
  itemTotalBudget,
  splitItemBudget,
  distributeStats,
  deriveItemStats,
} from "@/lib/tuning/itemBudget";

describe("calibration constants", () => {
  it("matches docs/DERIVED_STATS.md anchors", () => {
    expect(LEVEL_SCALING_RATE).toBe(1.1);
    expect(STAT_CAP).toBe(100);
    expect(XP_LEVEL_MULTIPLIER).toBe(1.5);
  });

  it("tier curve places Legendary at +5 common levels", () => {
    // Legendary multiplier should equal 1.1^5 ≈ 1.61.
    expect(TIER_MULTIPLIERS.legendary).toBeCloseTo(Math.pow(1.1, 5), 1);
    expect(TIER_MULTIPLIERS.common).toBe(1.0);
    expect(TIER_MULTIPLIERS.trash).toBeLessThan(1.0);
    // Tiers strictly ascending.
    let prev = 0;
    for (const tier of ITEM_TIERS) {
      expect(TIER_MULTIPLIERS[tier]).toBeGreaterThan(prev);
      prev = TIER_MULTIPLIERS[tier];
    }
  });

  it("archetype splits sum to 1.0", () => {
    for (const [name, split] of Object.entries(ARCHETYPE_SPLITS)) {
      const total = split.damage + split.armor + split.stats;
      expect(total, `archetype ${name}`).toBeCloseTo(1.0, 5);
    }
  });
});

describe("levelBudgetMultiplier", () => {
  it("is 1.0 at level 1", () => {
    expect(levelBudgetMultiplier(1)).toBe(1);
  });

  it("is 1.1^(level-1)", () => {
    expect(levelBudgetMultiplier(5)).toBeCloseTo(Math.pow(1.1, 4), 5);
    expect(levelBudgetMultiplier(30)).toBeCloseTo(Math.pow(1.1, 29), 5);
  });

  it("clamps levels below 1 to multiplier 1", () => {
    expect(levelBudgetMultiplier(0)).toBe(1);
    expect(levelBudgetMultiplier(-3)).toBe(1);
  });
});

describe("resolveSlotBase", () => {
  it("returns the default for known slots", () => {
    expect(resolveSlotBase("weapon")).toBe(DEFAULT_SLOT_BASE_BUDGETS.weapon);
    expect(resolveSlotBase("ring")).toBe(DEFAULT_SLOT_BASE_BUDGETS.ring);
  });

  it("respects per-world overrides", () => {
    expect(resolveSlotBase("weapon", { weapon: 200 })).toBe(200);
  });

  it("falls back when slot is unknown", () => {
    expect(resolveSlotBase("unknown_slot")).toBe(FALLBACK_SLOT_BASE);
  });

  it("ignores zero / negative overrides", () => {
    expect(resolveSlotBase("weapon", { weapon: 0 })).toBe(
      DEFAULT_SLOT_BASE_BUDGETS.weapon,
    );
    expect(resolveSlotBase("weapon", { weapon: -1 })).toBe(
      DEFAULT_SLOT_BASE_BUDGETS.weapon,
    );
  });
});

describe("effectiveArchetypeForSlot", () => {
  it("forces accessories to stat", () => {
    for (const slot of ACCESSORY_SLOTS) {
      expect(effectiveArchetypeForSlot(slot, "damage")).toBe("stat");
      expect(effectiveArchetypeForSlot(slot, "balanced")).toBe("stat");
    }
  });

  it("passes through for weapon / body slots", () => {
    expect(effectiveArchetypeForSlot("weapon", "damage")).toBe("damage");
    expect(effectiveArchetypeForSlot("body", "armor")).toBe("armor");
    expect(effectiveArchetypeForSlot("shield", "balanced")).toBe("balanced");
  });
});

describe("itemTotalBudget", () => {
  it("equals slotBase × levelMult × tierMult", () => {
    // L1 common weapon = 100 × 1 × 1 = 100
    expect(itemTotalBudget("weapon", 1, "common")).toBe(100);
    // L5 rare weapon = 100 × 1.1^4 × 1.27 ≈ 185.9
    expect(itemTotalBudget("weapon", 5, "rare")).toBeCloseTo(
      100 * Math.pow(1.1, 4) * TIER_MULTIPLIERS.rare,
      3,
    );
  });

  it("respects per-world slot overrides", () => {
    expect(itemTotalBudget("weapon", 1, "common", { weapon: 200 })).toBe(200);
  });
});

describe("splitItemBudget", () => {
  it("splits damage archetype 60/0/40", () => {
    const out = splitItemBudget(100, "damage");
    expect(out.damageBudget).toBeCloseTo(60);
    expect(out.armorBudget).toBe(0);
    expect(out.statBudget).toBeCloseTo(40);
  });

  it("splits balanced 30/30/40", () => {
    const out = splitItemBudget(100, "balanced");
    expect(out.damageBudget).toBeCloseTo(30);
    expect(out.armorBudget).toBeCloseTo(30);
    expect(out.statBudget).toBeCloseTo(40);
  });

  it("stat archetype puts 100% into stats", () => {
    const out = splitItemBudget(100, "stat");
    expect(out.damageBudget).toBe(0);
    expect(out.armorBudget).toBe(0);
    expect(out.statBudget).toBe(100);
  });
});

describe("distributeStats", () => {
  it("returns empty map when no stats picked", () => {
    expect(distributeStats(100)).toEqual({});
  });

  it("puts 100% into primary when only one stat is picked", () => {
    const out = distributeStats(100, "STR");
    expect(out).toEqual({ STR: Math.round(100 / DEFAULT_POINT_COSTS.statPointCost) });
  });

  it("splits 60/40 across primary/secondary", () => {
    const out = distributeStats(100, "STR", "DEX");
    expect(out.STR).toBe(Math.round(60 / DEFAULT_POINT_COSTS.statPointCost));
    expect(out.DEX).toBe(Math.round(40 / DEFAULT_POINT_COSTS.statPointCost));
  });

  it("splits 50/30/20 across all three", () => {
    const out = distributeStats(100, "STR", "DEX", "CON");
    expect(out.STR).toBe(Math.round(50 / DEFAULT_POINT_COSTS.statPointCost));
    expect(out.DEX).toBe(Math.round(30 / DEFAULT_POINT_COSTS.statPointCost));
    expect(out.CON).toBe(Math.round(20 / DEFAULT_POINT_COSTS.statPointCost));
  });

  it("returns empty when statBudget is zero", () => {
    expect(distributeStats(0, "STR", "DEX")).toEqual({});
  });

  it("respects custom statPointCost", () => {
    const out = distributeStats(100, "STR", undefined, undefined, 10);
    expect(out).toEqual({ STR: 10 });
  });
});

describe("deriveItemStats", () => {
  it("worked example: L5 rare damage weapon (STR/DEX/CON)", () => {
    const out = deriveItemStats({
      slot: "weapon",
      level: 5,
      tier: "rare",
      archetype: "damage",
      primaryStat: "STR",
      secondaryStat: "DEX",
      tertiaryStat: "CON",
    });
    // Total = 100 × 1.1^4 × 1.27 ≈ 185.9
    // Damage budget = 60% × 185.9 ≈ 111.5 → /20 = 5.6 → round to 6
    // Stat budget   = 40% × 185.9 ≈ 74.4
    //   STR = 50% × 74.4 / 5 ≈ 7.4 → 7
    //   DEX = 30% × 74.4 / 5 ≈ 4.5 → 4 or 5 (Math.round of 4.46 is 4)
    //   CON = 20% × 74.4 / 5 ≈ 2.97 → 3
    expect(out.effectiveArchetype).toBe("damage");
    expect(out.budget.totalBudget).toBeCloseTo(100 * Math.pow(1.1, 4) * 1.27, 3);
    expect(out.damage).toBe(6);
    expect(out.armor).toBe(0);
    expect(out.stats.STR).toBe(7);
    expect(out.stats.DEX).toBe(4);
    expect(out.stats.CON).toBe(3);
  });

  it("accessory slot forces archetype to stat", () => {
    const out = deriveItemStats({
      slot: "ring",
      level: 1,
      tier: "common",
      archetype: "damage", // requested damage but slot can't carry it
      primaryStat: "INT",
    });
    expect(out.effectiveArchetype).toBe("stat");
    expect(out.damage).toBe(0);
    expect(out.armor).toBe(0);
    // Ring at L1 common: base 40, all stat → INT = 40/5 = 8
    expect(out.stats.INT).toBe(8);
  });

  it("balanced shield writes both damage and armor", () => {
    const out = deriveItemStats({
      slot: "shield",
      level: 1,
      tier: "common",
      archetype: "balanced",
      primaryStat: "CON",
    });
    // Shield base 70 × 1 × 1 = 70
    // Damage 30% × 70 / 20 = 1.05 → 1
    // Armor  30% × 70 / 10 = 2.1 → 2
    // Stats  40% × 70 / 5  = 5.6 → 6 (single stat = 100%)
    expect(out.damage).toBe(1);
    expect(out.armor).toBe(2);
    expect(out.stats.CON).toBe(6);
  });

  it("no stats picked yields empty stat map", () => {
    const out = deriveItemStats({
      slot: "weapon",
      level: 1,
      tier: "common",
      archetype: "damage",
    });
    expect(out.damage).toBe(3); // 60/20 = 3
    expect(out.stats).toEqual({});
  });

  it("respects custom point costs", () => {
    const out = deriveItemStats({
      slot: "weapon",
      level: 1,
      tier: "common",
      archetype: "damage",
      primaryStat: "STR",
      pointCosts: { damagePointCost: 10, statPointCost: 2 },
    });
    expect(out.damage).toBe(6); // 60/10 = 6
    expect(out.stats.STR).toBe(20); // 40/2 = 20
  });
});

describe("L30 ceiling sanity check", () => {
  it("L30 common weapon budget ~15× L1 common weapon", () => {
    const l1 = itemTotalBudget("weapon", 1, "common");
    const l30 = itemTotalBudget("weapon", 30, "common");
    // 1.1^29 ≈ 15.86
    expect(l30 / l1).toBeCloseTo(Math.pow(1.1, 29), 2);
    expect(l30 / l1).toBeGreaterThan(15);
    expect(l30 / l1).toBeLessThan(17);
  });

  it("legendary L1 ≈ common L6", () => {
    const legL1 = itemTotalBudget("weapon", 1, "legendary");
    const commonL6 = itemTotalBudget("weapon", 6, "common");
    // 1.61 vs 1.1^5 ≈ 1.61
    expect(legL1).toBeCloseTo(commonL6, 0);
  });
});
