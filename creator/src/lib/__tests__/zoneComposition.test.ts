import { describe, it, expect } from "vitest";
import { analyzeZoneComposition } from "@/lib/zoneComposition";
import type { WorldFile, MobFile } from "@/types/world";

function world(mobs: Record<string, Partial<MobFile>>, levelBand?: { min: number; max: number }): WorldFile {
  const fullMobs: Record<string, MobFile> = {};
  for (const [id, m] of Object.entries(mobs)) {
    fullMobs[id] = { name: id, spawns: [{ room: "r1" }], ...m } as MobFile;
  }
  return {
    zone: "test",
    startRoom: "r1",
    rooms: { r1: { title: "Room 1", description: "" } },
    mobs: fullMobs,
    levelBand,
  };
}

describe("analyzeZoneComposition", () => {
  it("returns empty shape when there are no combatant mobs", () => {
    const out = analyzeZoneComposition(world({}));
    expect(out.shape).toBe("empty");
    expect(out.totalMobs).toBe(0);
    expect(out.buckets).toEqual([]);
    expect(out.summary).toMatch(/no combatant/i);
  });

  it("ignores non-combat role mobs", () => {
    const out = analyzeZoneComposition(
      world({
        questGiver: { role: "quest_giver" as MobFile["role"], level: 5 },
        boss: { level: 10 },
      }),
    );
    expect(out.totalMobs).toBe(1);
    expect(out.buckets).toEqual([{ level: 10, count: 1, percent: 100 }]);
  });

  it("classifies anchor zone (100% at one level)", () => {
    const out = analyzeZoneComposition(
      world({
        a: { level: 5 },
        b: { level: 5 },
        c: { level: 5 },
      }),
    );
    expect(out.shape).toBe("anchor");
    expect(out.inferredTarget).toBe(5);
    expect(out.inferredBridgeTo).toBeNull();
    expect(out.summary).toMatch(/anchor zone for level 5/i);
  });

  it("classifies a 75/25 bridge zone", () => {
    const out = analyzeZoneComposition(
      world({
        a: { level: 5 },
        b: { level: 5 },
        c: { level: 5 },
        d: { level: 6 },
      }),
    );
    expect(out.shape).toBe("bridge");
    expect(out.inferredTarget).toBe(5);
    expect(out.inferredBridgeTo).toBe(6);
    expect(out.summary).toMatch(/bridge zone: mostly L5, partial L6/i);
  });

  it("classifies a 50/50 split as wide, not bridge", () => {
    const out = analyzeZoneComposition(
      world({
        a: { level: 5 },
        b: { level: 6 },
      }),
    );
    expect(out.shape).toBe("wide");
  });

  it("classifies non-adjacent two-level composition as wide", () => {
    const out = analyzeZoneComposition(
      world({
        a: { level: 5 },
        b: { level: 5 },
        b2: { level: 5 },
        c: { level: 7 },
      }),
    );
    // Levels 5 and 7 are not adjacent (span > 1), > 2 distinct? No, 2 distinct.
    // Span is 2, classified "wide".
    expect(out.shape).toBe("wide");
    expect(out.inferredTarget).toBe(5);
  });

  it("classifies far-spread distribution as off-spec", () => {
    const out = analyzeZoneComposition(
      world({
        a: { level: 5 },
        b: { level: 5 },
        c: { level: 8 },
        d: { level: 12 },
      }),
    );
    expect(out.shape).toBe("off-spec");
    expect(out.inferredTarget).toBe(5);
  });

  it("counts mobs missing a level explicitly", () => {
    const out = analyzeZoneComposition(
      world({
        a: { level: 5 },
        b: { level: 5 },
        c: {},
      }),
    );
    expect(out.totalMobs).toBe(3);
    expect(out.missingLevelCount).toBe(1);
  });

  it("emits warnings for mobs far outside the zone band", () => {
    const out = analyzeZoneComposition(
      world(
        {
          inBand: { level: 5 },
          spike: { level: 9 },
          low: { level: 1 },
        },
        { min: 5, max: 5 },
      ),
    );
    const warnLevels = out.warnings.map((w) => w.mobLevel).sort();
    expect(warnLevels).toEqual([1, 9]);
    expect(out.warnings[0]!.message).toMatch(/intentional spike/i);
  });

  it("emits no warnings when mobs are within ±1 of the band", () => {
    const out = analyzeZoneComposition(
      world(
        {
          a: { level: 5 },
          b: { level: 4 },
          c: { level: 6 },
        },
        { min: 5, max: 5 },
      ),
    );
    expect(out.warnings).toEqual([]);
  });

  it("computes per-bucket percentages correctly", () => {
    const out = analyzeZoneComposition(
      world({
        a: { level: 5 },
        b: { level: 5 },
        c: { level: 5 },
        d: { level: 6 },
      }),
    );
    const five = out.buckets.find((b) => b.level === 5)!;
    const six = out.buckets.find((b) => b.level === 6)!;
    expect(five.percent).toBe(75);
    expect(six.percent).toBe(25);
  });
});
