import { describe, it, expect } from "vitest";
import {
  TOUGHNESS_STEPS,
  TOUGHNESS_PROFILES,
  inferToughness,
  toughnessPatch,
} from "@/lib/mobToughness";
import type { MobFile } from "@/types/world";

function mob(overrides: Partial<MobFile> = {}): MobFile {
  return { name: "Test", spawns: [{ room: "r1" }], ...overrides };
}

describe("toughness profiles", () => {
  it("step 0 is the tier baseline", () => {
    const p = TOUGHNESS_PROFILES[0];
    expect(p.hpMult).toBe(1.0);
    expect(p.dmgMult).toBe(1.0);
    expect(p.xpMult).toBe(1.0);
    expect(p.goldMult).toBe(1.0);
  });

  it("steps ascend monotonically across all mults", () => {
    let prev = 0;
    for (const step of TOUGHNESS_STEPS) {
      const p = TOUGHNESS_PROFILES[step];
      expect(p.hpMult).toBeGreaterThan(prev);
      prev = p.hpMult;
      expect(p.dmgMult).toBe(p.hpMult);
      expect(p.xpMult).toBe(p.hpMult);
      expect(p.goldMult).toBe(p.hpMult);
    }
  });
});

describe("inferToughness", () => {
  it("returns 0 for mobs with no mults set", () => {
    expect(inferToughness(mob())).toBe(0);
  });

  it("returns 0 when all mults are 1.0", () => {
    expect(
      inferToughness(mob({ hpMult: 1, dmgMult: 1, xpMult: 1, goldMult: 1 })),
    ).toBe(0);
  });

  it("infers the matching step from mults alone", () => {
    expect(
      inferToughness(mob({ hpMult: 1.6, dmgMult: 1.6, xpMult: 1.6, goldMult: 1.6 })),
    ).toBe(2);
    expect(
      inferToughness(mob({ hpMult: 0.6, dmgMult: 0.6, xpMult: 0.6, goldMult: 0.6 })),
    ).toBe(-2);
  });

  it("respects authored toughness when mults agree", () => {
    expect(
      inferToughness(
        mob({ toughness: 1, hpMult: 1.25, dmgMult: 1.25, xpMult: 1.25, goldMult: 1.25 }),
      ),
    ).toBe(1);
  });

  it("returns null when authored toughness disagrees with mults", () => {
    expect(
      inferToughness(
        mob({ toughness: 1, hpMult: 2.0, dmgMult: 1.0, xpMult: 1.0, goldMult: 1.0 }),
      ),
    ).toBeNull();
  });

  it("returns null when mults are hand-tuned away from any profile", () => {
    expect(
      inferToughness(mob({ hpMult: 1.5, dmgMult: 1.0, xpMult: 1.0, goldMult: 1.0 })),
    ).toBeNull();
  });
});

describe("toughnessPatch", () => {
  it("clears mults at step 0", () => {
    const patch = toughnessPatch(0);
    expect(patch.toughness).toBeUndefined();
    expect(patch.hpMult).toBeUndefined();
    expect(patch.dmgMult).toBeUndefined();
    expect(patch.xpMult).toBeUndefined();
    expect(patch.goldMult).toBeUndefined();
  });

  it("sets toughness + all four mults at non-zero step", () => {
    const patch = toughnessPatch(2);
    expect(patch.toughness).toBe(2);
    expect(patch.hpMult).toBe(1.6);
    expect(patch.dmgMult).toBe(1.6);
    expect(patch.xpMult).toBe(1.6);
    expect(patch.goldMult).toBe(1.6);
  });
});
