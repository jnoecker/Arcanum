import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WorldFile } from "@/types/world";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@/lib/loreGeneration", () => ({
  buildToneDirective: () => "",
}));

// Import AFTER mocks are registered.
import { rethemeZone, __test__ } from "../zoneRetheme";
const { collectRefs, applyRethemeValues, extractJsonArray } = __test__;

function world(): WorldFile {
  return {
    zone: "cathedral",
    startRoom: "nave",
    rooms: {
      nave: { title: "The Nave", description: "A vast hall.", exits: { n: "altar" } },
      altar: { title: "Altar", description: "A stone altar.", exits: { s: "nave" } },
    },
    mobs: {
      priest: { name: "Old Priest", description: "Bent with age.", room: "nave", hp: 40 },
    },
    items: {
      relic: { displayName: "Saint's Relic", description: "A bone.", room: "altar", damage: 2 },
    },
    shops: {},
    quests: {},
    gatheringNodes: {},
    recipes: {},
  };
}

beforeEach(() => {
  invokeMock.mockReset();
});

describe("collectRefs", () => {
  it("enumerates every text field with a stable ref id", () => {
    const refs = collectRefs(world());
    const roomRefs = refs.filter((r) => r.kind === "room");
    expect(roomRefs).toHaveLength(4); // 2 rooms × (title, description)
    expect(refs.find((r) => r.ref === "R0.title")).toBeDefined();
    expect(refs.find((r) => r.ref === "M0.name")).toBeDefined();
    expect(refs.find((r) => r.ref === "I0.displayName")).toBeDefined();
  });

  it("skips optional description fields that are undefined", () => {
    const w = world();
    delete (w.mobs!.priest as { description?: string }).description;
    const refs = collectRefs(w);
    expect(refs.some((r) => r.ref === "M0.description")).toBe(false);
    expect(refs.some((r) => r.ref === "M0.name")).toBe(true);
  });
});

describe("applyRethemeValues", () => {
  it("applies rewrites and preserves structure", () => {
    const w = world();
    const refs = collectRefs(w);
    const byRef = new Map<string, string>([
      ["R0.title", "The Coral Grotto"],
      ["R0.description", "Submerged arches."],
      ["M0.name", "Drowned Cleric"],
      ["I0.displayName", "Barnacle-Encrusted Bone"],
    ]);
    const result = applyRethemeValues(w, refs, byRef, 0);

    expect(result.world.rooms.nave!.title).toBe("The Coral Grotto");
    expect(result.world.rooms.nave!.description).toBe("Submerged arches.");
    expect(result.world.mobs!.priest!.name).toBe("Drowned Cleric");
    expect(result.world.items!.relic!.displayName).toBe("Barnacle-Encrusted Bone");
    // Untouched fields survive:
    expect(result.world.rooms.nave!.exits?.n).toBe("altar");
    expect(result.world.mobs!.priest!.hp).toBe(40);
    expect(result.world.items!.relic!.damage).toBe(2);
    // Ids unchanged:
    expect(Object.keys(result.world.rooms)).toEqual(["nave", "altar"]);
  });

  it("leaves source unchanged", () => {
    const src = world();
    const refs = collectRefs(src);
    applyRethemeValues(src, refs, new Map([["R0.title", "X"]]), 0);
    expect(src.rooms.nave!.title).toBe("The Nave");
  });

  it("counts only changed fields, not unchanged ones", () => {
    const w = world();
    const refs = collectRefs(w);
    const byRef = new Map<string, string>([
      ["R0.title", "The Nave"],          // same as original — not a change
      ["R0.description", "Rewritten."],
    ]);
    const result = applyRethemeValues(w, refs, byRef, 0);
    expect(result.changedFieldCount).toBe(1);
  });
});

describe("extractJsonArray", () => {
  it("strips markdown fences", () => {
    expect(extractJsonArray('```json\n[{"ref":"R0.title","value":"X"}]\n```'))
      .toBe('[{"ref":"R0.title","value":"X"}]');
  });

  it("handles trailing commas", () => {
    expect(extractJsonArray('[{"ref":"R0.title","value":"X"},]'))
      .toBe('[{"ref":"R0.title","value":"X"}]');
  });

  it("throws on missing array brackets", () => {
    expect(() => extractJsonArray("no json here")).toThrow(/JSON array/);
  });
});

describe("rethemeZone (integration with mocked LLM)", () => {
  it("round-trips a successful LLM response", async () => {
    invokeMock.mockResolvedValueOnce(
      JSON.stringify([
        { ref: "R0.title", value: "Coral Grotto" },
        { ref: "R0.description", value: "Submerged." },
        { ref: "R1.title", value: "Altar Stone" },
        { ref: "R1.description", value: "A sunken plinth." },
        { ref: "M0.name", value: "Drowned Cleric" },
        { ref: "M0.description", value: "Bent by the deep." },
        { ref: "I0.displayName", value: "Barnacle Bone" },
        { ref: "I0.description", value: "Encrusted." },
      ]),
    );

    const result = await rethemeZone({
      world: world(),
      newTheme: "sunken cathedral",
    });

    expect(result.world.rooms.nave!.title).toBe("Coral Grotto");
    expect(result.world.mobs!.priest!.name).toBe("Drowned Cleric");
    expect(result.changedFieldCount).toBe(8);
    expect(result.unmatchedRefCount).toBe(0);
  });

  it("ignores unknown refs in the LLM response and counts them", async () => {
    invokeMock.mockResolvedValueOnce(
      JSON.stringify([
        { ref: "R0.title", value: "New Title" },
        { ref: "R99.title", value: "ghost ref" },
        { ref: "X.y", value: "malformed" },
      ]),
    );
    const result = await rethemeZone({
      world: world(),
      newTheme: "x",
    });
    expect(result.world.rooms.nave!.title).toBe("New Title");
    expect(result.unmatchedRefCount).toBe(2);
  });

  it("propagates LLM errors", async () => {
    invokeMock.mockRejectedValueOnce(new Error("boom"));
    await expect(
      rethemeZone({ world: world(), newTheme: "x" }),
    ).rejects.toThrow(/boom/);
  });
});
