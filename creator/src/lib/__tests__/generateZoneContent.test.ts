import { describe, it, expect } from "vitest";
import { __test__ } from "@/lib/generateZoneContent";

const {
  repairExitGraph,
  applyHandTopology,
  extractJson,
  parseGeneratedContent,
  renameRoomsByTitle,
  slugifyTitle,
} = __test__;

// ─── applyHandTopology ──────────────────────────────────────────────

describe("applyHandTopology", () => {
  it("produces no exits for a single room", () => {
    const rooms = [{ id: "r1", title: "R1", description: "." }];
    const result = applyHandTopology(rooms);
    expect(result["r1"]?.exits).toEqual({});
  });

  it("chains three rooms north-south with bidirectional exits", () => {
    const rooms = [
      { id: "a", title: "A", description: "." },
      { id: "b", title: "B", description: "." },
      { id: "c", title: "C", description: "." },
    ];
    const result = applyHandTopology(rooms);
    expect(result["a"]?.exits?.n).toBe("b");
    expect(result["b"]?.exits?.s).toBe("a");
    expect(result["b"]?.exits?.n).toBe("c");
    expect(result["c"]?.exits?.s).toBe("b");
  });

  it("connects 8 rooms fully so every room is reachable", () => {
    const rooms = Array.from({ length: 8 }, (_, i) => ({
      id: `r${i}`,
      title: `R${i}`,
      description: ".",
    }));
    const result = applyHandTopology(rooms);

    // BFS from r0 should visit all rooms
    const visited = new Set<string>(["r0"]);
    const queue: string[] = ["r0"];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const exits = result[current]?.exits ?? {};
      for (const target of Object.values(exits)) {
        const targetId = typeof target === "string" ? target : target.to;
        if (!visited.has(targetId)) {
          visited.add(targetId);
          queue.push(targetId);
        }
      }
    }
    expect(visited.size).toBe(8);
  });
});

// ─── repairExitGraph ────────────────────────────────────────────────

describe("repairExitGraph", () => {
  it("copies valid bidirectional exits unchanged", () => {
    const result = repairExitGraph([
      { id: "a", title: "A", description: ".", exits: { e: "b" } },
      { id: "b", title: "B", description: ".", exits: { w: "a" } },
    ]);
    expect(result["a"]?.exits?.e).toBe("b");
    expect(result["b"]?.exits?.w).toBe("a");
  });

  it("drops exits pointing to non-existent rooms", () => {
    const result = repairExitGraph([
      { id: "a", title: "A", description: ".", exits: { e: "ghost", n: "b" } },
      { id: "b", title: "B", description: ".", exits: { s: "a" } },
    ]);
    expect(result["a"]?.exits?.e).toBeUndefined();
    expect(result["a"]?.exits?.n).toBe("b");
  });

  it("auto-fills the reverse exit when only one side is present", () => {
    const result = repairExitGraph([
      { id: "a", title: "A", description: ".", exits: { e: "b" } },
      { id: "b", title: "B", description: ".", exits: {} },
    ]);
    expect(result["a"]?.exits?.e).toBe("b");
    expect(result["b"]?.exits?.w).toBe("a");
  });

  it("drops self-loops", () => {
    const result = repairExitGraph([
      { id: "a", title: "A", description: ".", exits: { e: "a" } },
    ]);
    expect(result["a"]?.exits).toEqual({});
  });

  it("ignores unknown directions but still keeps rooms connected", () => {
    // The "sideways" exit is invalid and gets dropped. Room b becomes orphaned,
    // so the orphan-attachment pass reattaches it via a real cardinal.
    const result = repairExitGraph([
      { id: "a", title: "A", description: ".", exits: { sideways: "b" } },
      { id: "b", title: "B", description: ".", exits: {} },
    ]);
    const aExits = Object.entries(result["a"]?.exits ?? {});
    expect(aExits).toHaveLength(1);
    expect(aExits[0]?.[0]).not.toBe("sideways");
    expect(aExits[0]?.[1]).toBe("b");
  });

  it("attaches orphan rooms to the connected subgraph", () => {
    // a-b is connected; c is an orphan
    const result = repairExitGraph([
      { id: "a", title: "A", description: ".", exits: { e: "b" } },
      { id: "b", title: "B", description: ".", exits: { w: "a" } },
      { id: "c", title: "C", description: ".", exits: {} },
    ]);

    // BFS from `a` should reach all three rooms
    const visited = new Set<string>(["a"]);
    const queue: string[] = ["a"];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const exits = result[current]?.exits ?? {};
      for (const target of Object.values(exits)) {
        const targetId = typeof target === "string" ? target : target.to;
        if (!visited.has(targetId)) {
          visited.add(targetId);
          queue.push(targetId);
        }
      }
    }
    expect(visited.size).toBe(3);
    expect(visited.has("c")).toBe(true);
  });

  it("handles large connected graphs from the LLM", () => {
    // 12-room graph with mixed connectivity — some rooms only in one direction
    const rooms = Array.from({ length: 12 }, (_, i) => ({
      id: `r${i}`,
      title: `R${i}`,
      description: ".",
      exits: i < 11 ? { e: `r${i + 1}` } : {},
    }));
    const result = repairExitGraph(rooms);

    // Every room should be reachable from r0
    const visited = new Set<string>(["r0"]);
    const queue: string[] = ["r0"];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const exits = result[current]?.exits ?? {};
      for (const target of Object.values(exits)) {
        const targetId = typeof target === "string" ? target : target.to;
        if (!visited.has(targetId)) {
          visited.add(targetId);
          queue.push(targetId);
        }
      }
    }
    expect(visited.size).toBe(12);
  });

  it("drops exits that would produce geometrically impossible placements", () => {
    // The LLM claims a→n→b and a→n→c (both north of a). Only one can survive.
    // Whichever wins, the other's room must still end up connected as an orphan.
    const result = repairExitGraph([
      { id: "a", title: "A", description: ".", exits: { n: "b" } },
      { id: "b", title: "B", description: ".", exits: { s: "a", n: "c" } },
      // c claims to be west of a (at (-1,0)) AND north of b (at (0,-2))
      // — these are inconsistent.
      { id: "c", title: "C", description: ".", exits: { e: "a", s: "b" } },
    ]);

    const pos: Record<string, [number, number]> = { a: [0, 0] };
    const DIR: Record<string, [number, number]> = {
      n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0],
    };
    // Walk accepted exits; verify no room gets two different positions.
    const queue = ["a"];
    const seen = new Set<string>(["a"]);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const [dir, target] of Object.entries(result[cur]?.exits ?? {})) {
        const t = typeof target === "string" ? target : target.to;
        const off = DIR[dir];
        if (!off) continue;
        const expected: [number, number] = [pos[cur]![0] + off[0], pos[cur]![1] + off[1]];
        if (pos[t]) {
          expect(pos[t]).toEqual(expected);
        } else {
          pos[t] = expected;
        }
        if (!seen.has(t)) { seen.add(t); queue.push(t); }
      }
    }
    // Every room present, reachable, and geometrically consistent.
    expect(seen.size).toBe(3);
  });

  it("doesn't overwrite existing bidi pairs with conflicting claims", () => {
    // Three rooms where both b and c claim to be east of a.
    // Whichever wins, a only has one east exit.
    const result = repairExitGraph([
      { id: "a", title: "A", description: ".", exits: { e: "b" } },
      { id: "b", title: "B", description: ".", exits: { w: "a" } },
      { id: "c", title: "C", description: ".", exits: { w: "a" } },
    ]);
    expect(result["a"]?.exits?.e).toBe("b");
    // c should be attached as an orphan, not overwrite a's east
    expect(Object.values(result["a"]?.exits ?? {})).toContain("c");
  });
});

// ─── renameRoomsByTitle ─────────────────────────────────────────────

describe("slugifyTitle", () => {
  it("lowercases and snake-cases a title", () => {
    expect(slugifyTitle("The Shattered Bell Tower")).toBe("the_shattered_bell_tower");
  });
  it("strips punctuation and collapses whitespace", () => {
    expect(slugifyTitle("Eldra's Ruin — South Gate!")).toBe("eldra_s_ruin_south_gate");
  });
  it("returns empty string for a title with no alphanumerics", () => {
    expect(slugifyTitle("— !?")).toBe("");
  });
});

describe("renameRoomsByTitle", () => {
  it("rewrites room IDs to match their titles and remaps exits", () => {
    const out = renameRoomsByTitle({
      zone: "Z",
      startRoom: "room_0",
      rooms: {
        room_0: { title: "Crystal Lagoon", description: ".", exits: { e: "room_1" } },
        room_1: { title: "Obsidian Path", description: ".", exits: { w: "room_0" } },
      },
      mobs: { slime: { name: "Slime", description: ".", tier: "weak", spawns: [{ room: "room_1" }] } },
      items: { blade: { displayName: "Blade", description: ".", room: "room_0" } },
      shops: {},
      quests: {},
      gatheringNodes: {},
      recipes: {},
    });

    expect(out.rooms["crystal_lagoon"]).toBeDefined();
    expect(out.rooms["obsidian_path"]).toBeDefined();
    expect(out.rooms["room_0"]).toBeUndefined();
    expect(out.startRoom).toBe("crystal_lagoon");
    expect(out.rooms["crystal_lagoon"]?.exits?.e).toBe("obsidian_path");
    expect(out.rooms["obsidian_path"]?.exits?.w).toBe("crystal_lagoon");
    expect(out.mobs?.slime?.spawns?.[0]?.room).toBe("obsidian_path");
    expect(out.items?.blade?.room).toBe("crystal_lagoon");
  });

  it("disambiguates duplicate titles with numeric suffixes", () => {
    const out = renameRoomsByTitle({
      zone: "Z",
      startRoom: "a",
      rooms: {
        a: { title: "Misty Hollow", description: ".", exits: {} },
        b: { title: "Misty Hollow", description: ".", exits: {} },
      },
      mobs: {}, items: {}, shops: {}, quests: {}, gatheringNodes: {}, recipes: {},
    });
    expect(out.rooms["misty_hollow"]).toBeDefined();
    expect(out.rooms["misty_hollow_2"]).toBeDefined();
  });

  it("keeps the original id when the title slugifies to empty", () => {
    const out = renameRoomsByTitle({
      zone: "Z",
      startRoom: "room_0",
      rooms: {
        room_0: { title: "!!", description: ".", exits: {} },
      },
      mobs: {}, items: {}, shops: {}, quests: {}, gatheringNodes: {}, recipes: {},
    });
    expect(out.rooms["room_0"]).toBeDefined();
  });

  it("preserves cross-zone exit targets untouched", () => {
    const out = renameRoomsByTitle({
      zone: "Z",
      startRoom: "r0",
      rooms: {
        r0: { title: "Gate", description: ".", exits: { n: "other_zone:lobby" } },
      },
      mobs: {}, items: {}, shops: {}, quests: {}, gatheringNodes: {}, recipes: {},
    });
    expect(out.rooms["gate"]?.exits?.n).toBe("other_zone:lobby");
  });
});

// ─── extractJson ────────────────────────────────────────────────────

describe("extractJson", () => {
  it("extracts a bare JSON object", () => {
    expect(extractJson('{"a": 1}')).toBe('{"a": 1}');
  });

  it("strips markdown code fences", () => {
    const raw = '```json\n{"rooms": []}\n```';
    expect(extractJson(raw).trim()).toBe('{"rooms": []}');
  });

  it("handles trailing commas", () => {
    const raw = '{"a": 1, "b": 2,}';
    expect(extractJson(raw)).toBe('{"a": 1, "b": 2}');
  });

  it("extracts the first top-level object from a preamble", () => {
    const raw = 'Here is the zone:\n{"rooms": [{"id": "a"}]}';
    expect(extractJson(raw)).toContain('"rooms"');
  });

  it("handles quoted braces in strings", () => {
    const raw = '{"description": "a room with { in it"}';
    expect(extractJson(raw)).toBe('{"description": "a room with { in it"}');
  });
});

// ─── parseGeneratedContent ──────────────────────────────────────────

describe("parseGeneratedContent", () => {
  it("parses a minimal valid response", () => {
    const raw = JSON.stringify({
      rooms: [{ id: "a", title: "A", description: "." }],
    });
    const result = parseGeneratedContent(raw);
    expect(result.rooms).toHaveLength(1);
    expect(result.mobs).toEqual([]);
    expect(result.items).toEqual([]);
  });

  it("preserves exits on rooms when provided", () => {
    const raw = JSON.stringify({
      rooms: [
        { id: "a", title: "A", description: ".", exits: { e: "b" } },
        { id: "b", title: "B", description: ".", exits: { w: "a" } },
      ],
    });
    const result = parseGeneratedContent(raw);
    expect(result.rooms[0]?.exits).toEqual({ e: "b" });
  });

  it("throws on missing rooms", () => {
    const raw = JSON.stringify({ mobs: [] });
    expect(() => parseGeneratedContent(raw)).toThrow();
  });

  it("throws on empty rooms array", () => {
    const raw = JSON.stringify({ rooms: [] });
    expect(() => parseGeneratedContent(raw)).toThrow();
  });
});
