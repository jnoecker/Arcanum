import { describe, it, expect } from "vitest";
import {
  STAT_CAP,
  TIER_MULTIPLIERS,
  ARCHETYPE_SPLITS,
  DEFAULT_POINT_COSTS,
  DEFAULT_SLOT_BASE_BUDGETS,
  FALLBACK_SLOT_BASE,
  ACCESSORY_SLOTS,
  ITEM_TIERS,
  resolveSlotBase,
  effectiveArchetypeForSlot,
  itemTotalBudget,
  splitItemBudget,
  distributeStats,
  deriveItemStats,
} from "@/lib/tuning/itemBudget";

describe("calibration constants", () => {
  it("stat cap is in place", () => {
    expect(STAT_CAP).toBe(100);
  });

  it("tier curve places Legendary at +5 common levels", () => {
    expect(TIER_MULTIPLIERS.legendary).toBeCloseTo(Math.pow(1.1, 5), 1);
    expect(TIER_MULTIPLIERS.common).toBe(1.0);
    expect(TIER_MULTIPLIERS.trash).toBeLessThan(1.0);
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
  // The server treats item.damage and item.armor as flat authored values;
  // level scaling lives in the combat formula. Item budgets are therefore
  // flat across levels — tier is the only multiplier.
  it("equals slotBase × tierMult, flat across levels", () => {
    // Common weapon = 100 × 1 = 100
    expect(itemTotalBudget("weapon", "common")).toBe(100);
    // Rare weapon = 100 × 1.27
    expect(itemTotalBudget("weapon", "rare")).toBeCloseTo(
      100 * TIER_MULTIPLIERS.rare,
      3,
    );
  });

  it("respects per-world slot overrides", () => {
    expect(itemTotalBudget("weapon", "common", { weapon: 200 })).toBe(200);
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
  it("defaults all three slots to archetypal keys when no overrides given", () => {
    const out = distributeStats(100);
    expect(out.PRIMARY).toBe(Math.round(50 / DEFAULT_POINT_COSTS.statPointCost));
    expect(out.SECONDARY).toBe(Math.round(30 / DEFAULT_POINT_COSTS.statPointCost));
    expect(out.TERTIARY).toBe(Math.round(20 / DEFAULT_POINT_COSTS.statPointCost));
  });

  it("primary override pins slot 0 to a concrete stat, leaves others adaptive", () => {
    const out = distributeStats(100, "STR");
    expect(out.STR).toBe(Math.round(50 / DEFAULT_POINT_COSTS.statPointCost));
    expect(out.SECONDARY).toBe(Math.round(30 / DEFAULT_POINT_COSTS.statPointCost));
    expect(out.TERTIARY).toBe(Math.round(20 / DEFAULT_POINT_COSTS.statPointCost));
    expect(out.PRIMARY).toBeUndefined();
  });

  it("two overrides leave only tertiary adaptive", () => {
    const out = distributeStats(100, "STR", "DEX");
    expect(out.STR).toBe(Math.round(50 / DEFAULT_POINT_COSTS.statPointCost));
    expect(out.DEX).toBe(Math.round(30 / DEFAULT_POINT_COSTS.statPointCost));
    expect(out.TERTIARY).toBe(Math.round(20 / DEFAULT_POINT_COSTS.statPointCost));
  });

  it("all three overrides produce a fully concrete distribution", () => {
    const out = distributeStats(100, "STR", "DEX", "CON");
    expect(out.STR).toBe(Math.round(50 / DEFAULT_POINT_COSTS.statPointCost));
    expect(out.DEX).toBe(Math.round(30 / DEFAULT_POINT_COSTS.statPointCost));
    expect(out.CON).toBe(Math.round(20 / DEFAULT_POINT_COSTS.statPointCost));
    expect(out.PRIMARY).toBeUndefined();
    expect(out.SECONDARY).toBeUndefined();
    expect(out.TERTIARY).toBeUndefined();
  });

  it("weights are fixed regardless of override count", () => {
    // 1 override: same primary weight as 3 overrides.
    const one = distributeStats(100, "STR");
    const three = distributeStats(100, "STR", "DEX", "CON");
    expect(one.STR).toBe(three.STR);
  });

  it("returns empty when statBudget is zero", () => {
    expect(distributeStats(0, "STR", "DEX")).toEqual({});
  });

  it("respects custom statPointCost", () => {
    const out = distributeStats(100, "STR", undefined, undefined, 10);
    // 50% * 100 / 10 = 5 for the primary override
    expect(out.STR).toBe(5);
    // SECONDARY / TERTIARY also recomputed against the custom cost
    expect(out.SECONDARY).toBe(3);
    expect(out.TERTIARY).toBe(2);
  });

  it("stacks when the same stat ID is used in multiple slots", () => {
    const out = distributeStats(100, "STR", "STR", "STR");
    // All three slots → same key: (50 + 30 + 20) / 5 = 20
    expect(out.STR).toBe(20);
  });
});

describe("deriveItemStats", () => {
  it("worked example: rare damage weapon (STR/DEX/CON)", () => {
    const out = deriveItemStats({
      slot: "weapon",
      tier: "rare",
      archetype: "damage",
      primaryStat: "STR",
      secondaryStat: "DEX",
      tertiaryStat: "CON",
    });
    // Total = 100 × 1.27 = 127
    // Damage budget = 60% × 127 ≈ 76.2 → /20 = 3.81 → round to 4
    // Stat budget   = 40% × 127 ≈ 50.8
    //   STR = 50% × 50.8 / 5 ≈ 5.08 → 5
    //   DEX = 30% × 50.8 / 5 ≈ 3.05 → 3
    //   CON = 20% × 50.8 / 5 ≈ 2.03 → 2
    expect(out.effectiveArchetype).toBe("damage");
    expect(out.budget.totalBudget).toBeCloseTo(100 * 1.27, 3);
    expect(out.damage).toBe(4);
    expect(out.armor).toBe(0);
    expect(out.stats.STR).toBe(5);
    expect(out.stats.DEX).toBe(3);
    expect(out.stats.CON).toBe(2);
  });

  it("accessory slot forces archetype to stat", () => {
    const out = deriveItemStats({
      slot: "ring",
      tier: "common",
      archetype: "damage", // requested damage but slot can't carry it
      primaryStat: "INT",
    });
    expect(out.effectiveArchetype).toBe("stat");
    expect(out.damage).toBe(0);
    expect(out.armor).toBe(0);
    // Ring common: base 40 × 1 = 40, all stat
    //   INT = 50% × 40 / 5 = 4 (primary override)
    //   SECONDARY = 30% × 40 / 5 ≈ 2
    //   TERTIARY  = 20% × 40 / 5 ≈ 2
    expect(out.stats.INT).toBe(4);
    expect(out.stats.SECONDARY).toBe(2);
    expect(out.stats.TERTIARY).toBe(2);
  });

  it("balanced shield writes both damage and armor", () => {
    const out = deriveItemStats({
      slot: "shield",
      tier: "common",
      archetype: "balanced",
      primaryStat: "CON",
    });
    // Shield base 70 × 1 = 70
    // Damage 30% × 70 / 20 = 1.05 → 1
    // Armor  30% × 70 / 10 = 2.1 → 2
    // Stats  40% × 70 = 28 stat budget:
    //   CON       = 50% × 28 / 5 ≈ 3 (primary override)
    //   SECONDARY = 30% × 28 / 5 ≈ 2
    //   TERTIARY  = 20% × 28 / 5 ≈ 1
    expect(out.damage).toBe(1);
    expect(out.armor).toBe(2);
    expect(out.stats.CON).toBe(3);
    expect(out.stats.SECONDARY).toBe(2);
    expect(out.stats.TERTIARY).toBe(1);
  });

  it("no overrides given yields fully adaptive stat map", () => {
    const out = deriveItemStats({
      slot: "weapon",
      tier: "common",
      archetype: "damage",
    });
    // Damage = 60/20 = 3, stat budget = 40
    //   PRIMARY   = 50% × 40 / 5 = 4
    //   SECONDARY = 30% × 40 / 5 ≈ 2
    //   TERTIARY  = 20% × 40 / 5 ≈ 2
    expect(out.damage).toBe(3);
    expect(out.stats.PRIMARY).toBe(4);
    expect(out.stats.SECONDARY).toBe(2);
    expect(out.stats.TERTIARY).toBe(2);
  });

  it("respects custom point costs", () => {
    const out = deriveItemStats({
      slot: "weapon",
      tier: "common",
      archetype: "damage",
      primaryStat: "STR",
      pointCosts: { damagePointCost: 10, statPointCost: 2 },
    });
    // Damage budget = 60, divided by 10 → 6
    // Stat budget = 40 with statPointCost=2:
    //   STR       = 50% × 40 / 2 = 10
    //   SECONDARY = 30% × 40 / 2 = 6
    //   TERTIARY  = 20% × 40 / 2 = 4
    expect(out.damage).toBe(6);
    expect(out.stats.STR).toBe(10);
    expect(out.stats.SECONDARY).toBe(6);
    expect(out.stats.TERTIARY).toBe(4);
  });
});

describe("flat-budget invariant", () => {
  it("budget is independent of any 'level' input — level lives in the combat formula", () => {
    // Spot-check: a common weapon's budget is 100 regardless of context.
    // The combat formula's meleeLevelScalingRate handles per-level growth.
    const common = itemTotalBudget("weapon", "common");
    const legendary = itemTotalBudget("weapon", "legendary");
    expect(common).toBe(100);
    expect(legendary).toBeCloseTo(100 * TIER_MULTIPLIERS.legendary, 3);
  });
});
