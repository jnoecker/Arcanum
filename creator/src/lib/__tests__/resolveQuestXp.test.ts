import { describe, it, expect } from "vitest";
import { resolveQuestXp } from "../resolveQuestXp";
import type { QuestFile } from "@/types/world";
import type { QuestXpConfig } from "@/types/config";

const DEFAULT_CONFIG: QuestXpConfig = {
  baseline: { baseXp: 50, xpPerLevel: 20 },
  tiers: { trivial: 0.25, easy: 0.5, standard: 1.0, hard: 1.75, epic: 3.0 },
};

function quest(overrides: Partial<QuestFile> = {}): QuestFile {
  return { name: "Test", giver: "giver", ...overrides };
}

const ANCHORED_CONFIG: QuestXpConfig = {
  baseline: { baseXp: 338, xpPerLevel: 450 },
  tiers: { trivial: 0.5, standard: 1.0 },
  xpAnchors: { "1": 100, "5": 1600, "10": 3200 },
};

describe("resolveQuestXp with xpAnchors", () => {
  it("pays the anchor on an anchor level and scales it by the tier", () => {
    expect(resolveQuestXp(quest({ difficulty: "standard", level: 5 }), ANCHORED_CONFIG).computed).toBe(1600);
    expect(resolveQuestXp(quest({ difficulty: "trivial", level: 5 }), ANCHORED_CONFIG).computed).toBe(800);
  });

  it("interpolates geometrically between anchors and extrapolates along the last segment", () => {
    // 100 -> 1600 over 1 -> 5: level 3 is 100 x 16^0.5 = 400
    expect(resolveQuestXp(quest({ difficulty: "standard", level: 3 }), ANCHORED_CONFIG).computed).toBe(400);
    // 1600 -> 3200 over 5 -> 10: level 15 continues the x2 per five levels
    expect(resolveQuestXp(quest({ difficulty: "standard", level: 15 }), ANCHORED_CONFIG).computed).toBe(6400);
  });

  it("falls back to the linear baseline without anchors", () => {
    const linear: QuestXpConfig = { ...ANCHORED_CONFIG, xpAnchors: undefined };
    expect(resolveQuestXp(quest({ difficulty: "standard", level: 10 }), linear).computed).toBe(338 + 450 * 9);
  });
});
describe("resolveQuestXp", () => {
  it("returns zero with no data when neither difficulty nor authored xp are set", () => {
    const result = resolveQuestXp(quest(), DEFAULT_CONFIG);
    expect(result).toEqual({
      effective: 0,
      computed: null,
      authored: null,
      overridden: false,
      reason: "no-data",
    });
  });

  it("uses the authored value when no difficulty is set", () => {
    const result = resolveQuestXp(quest({ rewards: { xp: 123 } }), DEFAULT_CONFIG);
    expect(result.effective).toBe(123);
    expect(result.reason).toBe("authored-no-tier");
    expect(result.overridden).toBe(false);
  });

  it("computes from difficulty when xp is absent", () => {
    const result = resolveQuestXp(quest({ difficulty: "standard", level: 5 }), DEFAULT_CONFIG);
    // baseline at level 5 = 50 + 20*4 = 130, × standard 1.0 = 130
    expect(result.computed).toBe(130);
    expect(result.effective).toBe(130);
    expect(result.reason).toBe("computed");
    expect(result.overridden).toBe(false);
  });

  it("applies the tier multiplier", () => {
    expect(
      resolveQuestXp(quest({ difficulty: "epic", level: 10 }), DEFAULT_CONFIG).effective,
    ).toBe(690); // (50 + 20*9) * 3.0
    expect(
      resolveQuestXp(quest({ difficulty: "trivial", level: 1 }), DEFAULT_CONFIG).effective,
    ).toBe(13); // 50 * 0.25 rounded
  });

  it("authored xp overrides the computed tier value", () => {
    const result = resolveQuestXp(
      quest({ difficulty: "standard", level: 5, rewards: { xp: 42 } }),
      DEFAULT_CONFIG,
    );
    expect(result.effective).toBe(42);
    expect(result.computed).toBe(130);
    expect(result.authored).toBe(42);
    expect(result.overridden).toBe(true);
    expect(result.reason).toBe("override");
  });

  it("falls back to built-in defaults when config is missing", () => {
    const result = resolveQuestXp(quest({ difficulty: "standard", level: 3 }), undefined);
    expect(result.computed).toBe(50 + 20 * 2); // = 90
    expect(result.reason).toBe("computed");
  });

  it("clamps level to 1 when missing", () => {
    expect(
      resolveQuestXp(quest({ difficulty: "standard" }), DEFAULT_CONFIG).computed,
    ).toBe(50);
  });

  it("ignores rewards.xp when it is zero", () => {
    const result = resolveQuestXp(
      quest({ difficulty: "easy", level: 5, rewards: { xp: 0 } }),
      DEFAULT_CONFIG,
    );
    expect(result.reason).toBe("computed");
    expect(result.effective).toBe(65); // 130 * 0.5
  });
});
