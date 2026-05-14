import { describe, expect, it } from "vitest";
import { evaluateItemBudget } from "../itemBudget";
import type { ItemFile } from "@/types/world";
import { DEFAULT_ITEM_BUDGET } from "@/types/config";

function weapon(overrides: Partial<ItemFile> = {}): ItemFile {
  return { displayName: "Test Weapon", slot: "weapon", ...overrides };
}

describe("evaluateItemBudget", () => {
  it("skips when item has neither level nor rarity", () => {
    const result = evaluateItemBudget("sword", weapon({ damage: 4 }), DEFAULT_ITEM_BUDGET);
    expect(result).toBeNull();
  });

  it("skips when config is disabled", () => {
    const config = { ...DEFAULT_ITEM_BUDGET, enabled: false };
    const result = evaluateItemBudget("sword", weapon({ damage: 4, level: 5 }), config);
    expect(result).toBeNull();
  });

  it("skips when item has no slot", () => {
    const result = evaluateItemBudget(
      "trinket",
      { displayName: "X", level: 5, damage: 4 },
      DEFAULT_ITEM_BUDGET,
    );
    expect(result).toBeNull();
  });

  it("flags a level-1 common weapon with damage 4 as over budget", () => {
    const result = evaluateItemBudget(
      "sword",
      weapon({ damage: 4, level: 1 }),
      DEFAULT_ITEM_BUDGET,
    );
    expect(result).not.toBeNull();
    expect(result!.spent).toBeCloseTo(20, 5);
    expect(result!.budget).toBeCloseTo(8, 5);
    expect(result!.overBudget).toBe(true);
    expect(result!.rarity).toBe("common");
    expect(result!.level).toBe(1);
  });

  it("passes a level-5 rare weapon with damage 4", () => {
    const result = evaluateItemBudget(
      "sword",
      weapon({ damage: 4, level: 5, rarity: "rare" }),
      DEFAULT_ITEM_BUDGET,
    );
    expect(result).not.toBeNull();
    expect(result!.spent).toBeCloseTo(20, 5);
    expect(result!.budget).toBeCloseTo(24, 5);
    expect(result!.overBudget).toBe(false);
  });

  it("breakdown lists all non-zero contributions", () => {
    const result = evaluateItemBudget(
      "armor",
      {
        displayName: "Ringmail",
        slot: "body",
        level: 5,
        rarity: "common",
        armor: 2,
        stats: { STR: 2, DEX: 1 },
      },
      DEFAULT_ITEM_BUDGET,
    );
    expect(result).not.toBeNull();
    expect(result!.breakdown).toEqual(["armor 2=4.0pt", "stats 3=3.0pt"]);
  });

  it("defaults rarity to config.defaultRarity when only level set", () => {
    const result = evaluateItemBudget(
      "sword",
      weapon({ damage: 1, level: 3 }),
      DEFAULT_ITEM_BUDGET,
    );
    expect(result).not.toBeNull();
    expect(result!.rarity).toBe(DEFAULT_ITEM_BUDGET.defaultRarity);
  });

  it("coerces level below 1 up to 1", () => {
    const result = evaluateItemBudget(
      "sword",
      weapon({ damage: 1, level: 0, rarity: "common" }),
      DEFAULT_ITEM_BUDGET,
    );
    expect(result).not.toBeNull();
    expect(result!.level).toBe(1);
  });

  it("throws when rarity is unknown", () => {
    expect(() =>
      evaluateItemBudget(
        "sword",
        weapon({ damage: 1, level: 1, rarity: "mythic" as unknown as ItemFile["rarity"] }),
        DEFAULT_ITEM_BUDGET,
      ),
    ).toThrow(/mythic/);
  });

  it("throws when slot is unknown", () => {
    expect(() =>
      evaluateItemBudget(
        "sword",
        { displayName: "X", slot: "tail", level: 1 },
        DEFAULT_ITEM_BUDGET,
      ),
    ).toThrow(/tail/);
  });

  it("tolerance band: borderline weapon flagged at 5%, allowed at 20%", () => {
    // weapon at level 1 common: budget = (6 + 1*2) * 1.0 = 8.
    // damage 2 → spent = 10. 10 / 8 = 1.25 = 25% over.
    const item = weapon({ damage: 2, level: 1, rarity: "common" });

    const tight = evaluateItemBudget("sword", item, { ...DEFAULT_ITEM_BUDGET, tolerance: 0.05 });
    expect(tight!.overBudget).toBe(true);

    const lax = evaluateItemBudget("sword", item, { ...DEFAULT_ITEM_BUDGET, tolerance: 0.5 });
    expect(lax!.overBudget).toBe(false);
  });
});
