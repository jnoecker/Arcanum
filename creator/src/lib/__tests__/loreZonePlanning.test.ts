import { describe, it, expect } from "vitest";
import {
  parseZoneResponse,
  repairZonePlanSuggestions,
  suggestionsToZonePlans,
  type ZonePlanSuggestion,
} from "../loreZonePlanning";
import type { LoreMap } from "@/types/lore";

const MAP: LoreMap = {
  id: "m1",
  title: "Test World",
  imageAsset: "abc.png",
  width: 1000,
  height: 800,
  pins: [],
};

const DIMS = { width: MAP.width, height: MAP.height };

function makeSuggestion(
  partial: Partial<ZonePlanSuggestion> & { name: string },
): ZonePlanSuggestion {
  return {
    tempId: `t_${partial.name}`,
    name: partial.name,
    blurb: partial.blurb ?? "",
    hooks: partial.hooks ?? [],
    region: partial.region ?? { x: 0, y: 0, w: 100, h: 100 },
    borderNames: partial.borderNames ?? [],
  };
}

// ─── parseZoneResponse ──────────────────────────────────────────────

describe("parseZoneResponse", () => {
  it("parses a well-formed JSON object response", () => {
    const json = JSON.stringify({
      zones: [
        { name: "North", blurb: "cold", x: 0, y: 0, w: 500, h: 400, borders: ["South"] },
        { name: "South", blurb: "warm", x: 0, y: 400, w: 500, h: 400, borders: ["North"] },
      ],
    });
    const result = parseZoneResponse(json, MAP);
    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe("North");
    expect(result[0]?.borderNames).toEqual(["South"]);
  });

  it("strips markdown fences", () => {
    const wrapped = "```json\n" + JSON.stringify({ zones: [{ name: "A", x: 0, y: 0, w: 10, h: 10 }] }) + "\n```";
    expect(parseZoneResponse(wrapped, MAP)).toHaveLength(1);
  });

  it("converts top-left y to CRS.Simple lat (height - y - h)", () => {
    const json = JSON.stringify({
      zones: [{ name: "TopLeft", x: 0, y: 0, w: 100, h: 50 }],
    });
    const [s] = parseZoneResponse(json, MAP);
    // top-left (0,0) of width 100, height 50 → CRS.Simple y = 800 - 0 - 50 = 750
    expect(s?.region.y).toBe(750);
  });

  it("returns empty array for non-JSON", () => {
    expect(parseZoneResponse("hello world", MAP)).toEqual([]);
  });

  it("extracts JSON from prose-wrapped output", () => {
    const messy = 'Here is the result:\n{"zones":[{"name":"X","x":0,"y":0,"w":10,"h":10}]}\nHope that helps!';
    expect(parseZoneResponse(messy, MAP)).toHaveLength(1);
  });

  it("drops zones with empty names", () => {
    const json = JSON.stringify({
      zones: [
        { name: "", x: 0, y: 0, w: 10, h: 10 },
        { name: "Real", x: 0, y: 0, w: 10, h: 10 },
      ],
    });
    expect(parseZoneResponse(json, MAP)).toHaveLength(1);
  });
});

// ─── repairZonePlanSuggestions ──────────────────────────────────────

describe("repairZonePlanSuggestions: deduplication", () => {
  it("merges duplicate names case-insensitively, preferring longer fields", () => {
    const input = [
      makeSuggestion({ name: "Forest", blurb: "short", hooks: ["one"] }),
      makeSuggestion({
        name: "FOREST",
        blurb: "a much longer description",
        hooks: ["one", "two", "three"],
        borderNames: ["Mountains"],
      }),
    ];
    const { suggestions, warnings } = repairZonePlanSuggestions(input, DIMS);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.name).toBe("Forest");
    expect(suggestions[0]?.blurb).toBe("a much longer description");
    expect(suggestions[0]?.hooks).toHaveLength(3);
    expect(warnings.some((w) => w.includes("duplicate"))).toBe(true);
  });
});

describe("repairZonePlanSuggestions: reciprocal borders", () => {
  it("makes A→B imply B→A", () => {
    const input = [
      makeSuggestion({ name: "A", borderNames: ["B"] }),
      makeSuggestion({ name: "B", borderNames: [] }),
    ];
    const { suggestions, warnings } = repairZonePlanSuggestions(input, DIMS);
    const b = suggestions.find((s) => s.name === "B");
    expect(b?.borderNames).toEqual(["A"]);
    expect(warnings.some((w) => w.includes("reciprocal"))).toBe(true);
  });

  it("does not double-add already-reciprocal borders", () => {
    const input = [
      makeSuggestion({ name: "A", borderNames: ["B"] }),
      makeSuggestion({ name: "B", borderNames: ["A"] }),
    ];
    const { warnings } = repairZonePlanSuggestions(input, DIMS);
    expect(warnings.find((w) => w.includes("reciprocal"))).toBeUndefined();
  });

  it("drops borders pointing at non-existent zones", () => {
    const input = [
      makeSuggestion({ name: "A", borderNames: ["Ghost", "B"] }),
      makeSuggestion({ name: "B" }),
    ];
    const { suggestions, warnings } = repairZonePlanSuggestions(input, DIMS);
    const a = suggestions.find((s) => s.name === "A");
    expect(a?.borderNames).toEqual(["B"]);
    expect(warnings.some((w) => w.includes("unresolved"))).toBe(true);
  });

  it("strips self-borders", () => {
    const input = [makeSuggestion({ name: "A", borderNames: ["A", "a"] })];
    const { suggestions } = repairZonePlanSuggestions(input, DIMS);
    expect(suggestions[0]?.borderNames).toEqual([]);
  });
});

describe("repairZonePlanSuggestions: bbox clipping", () => {
  it("clips regions that extend past the map", () => {
    const input = [
      makeSuggestion({
        name: "Overflow",
        region: { x: 900, y: 700, w: 500, h: 500 },
      }),
    ];
    const { suggestions } = repairZonePlanSuggestions(input, DIMS);
    const r = suggestions[0]!.region;
    expect(r.x).toBe(900);
    expect(r.y).toBe(700);
    expect(r.x + r.w).toBeLessThanOrEqual(DIMS.width);
    expect(r.y + r.h).toBeLessThanOrEqual(DIMS.height);
  });
});

describe("repairZonePlanSuggestions: coverage warning", () => {
  it("warns when zones cover less than 55% of the map", () => {
    const input = [
      makeSuggestion({
        name: "Tiny",
        region: { x: 0, y: 0, w: 100, h: 100 },
      }),
    ];
    const { warnings } = repairZonePlanSuggestions(input, DIMS);
    expect(warnings.some((w) => w.includes("cover only"))).toBe(true);
  });

  it("does not warn when coverage is sufficient", () => {
    const input = [
      makeSuggestion({
        name: "Big",
        region: { x: 0, y: 0, w: 1000, h: 800 },
      }),
    ];
    const { warnings } = repairZonePlanSuggestions(input, DIMS);
    expect(warnings.find((w) => w.includes("cover only"))).toBeUndefined();
  });
});

describe("repairZonePlanSuggestions: overlap detection", () => {
  it("warns when two zones heavily overlap", () => {
    const input = [
      makeSuggestion({ name: "A", region: { x: 0, y: 0, w: 500, h: 500 } }),
      makeSuggestion({ name: "B", region: { x: 50, y: 50, w: 500, h: 500 } }),
    ];
    const { warnings } = repairZonePlanSuggestions(input, DIMS);
    expect(warnings.some((w) => w.includes("overlap"))).toBe(true);
  });

  it("does not warn for adjacent non-overlapping zones", () => {
    const input = [
      makeSuggestion({ name: "A", region: { x: 0, y: 0, w: 500, h: 800 } }),
      makeSuggestion({ name: "B", region: { x: 500, y: 0, w: 500, h: 800 } }),
    ];
    const { warnings } = repairZonePlanSuggestions(input, DIMS);
    expect(warnings.find((w) => w.includes("overlap"))).toBeUndefined();
  });
});

// ─── suggestionsToZonePlans ─────────────────────────────────────────

describe("suggestionsToZonePlans", () => {
  it("resolves border names to ids within the batch", () => {
    const input = [
      makeSuggestion({ name: "Alpha", borderNames: ["Beta"] }),
      makeSuggestion({ name: "Beta", borderNames: ["Alpha"] }),
    ];
    const plans = suggestionsToZonePlans(input, "m1");
    expect(plans).toHaveLength(2);
    const [a, b] = plans;
    expect(a?.borders).toContain(b?.id);
    expect(b?.borders).toContain(a?.id);
  });

  it("filters out border references with no matching zone", () => {
    const input = [makeSuggestion({ name: "Lonely", borderNames: ["Nobody"] })];
    const plans = suggestionsToZonePlans(input, "m1");
    expect(plans[0]?.borders).toBeUndefined();
  });

  it("attaches the source map id", () => {
    const input = [makeSuggestion({ name: "Alpha" })];
    const plans = suggestionsToZonePlans(input, "world42");
    expect(plans[0]?.mapId).toBe("world42");
  });
});
