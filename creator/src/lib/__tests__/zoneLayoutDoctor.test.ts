import { describe, it, expect } from "vitest";
import { analyzeZoneLayout } from "../zoneLayoutDoctor";
import type { WorldFile } from "@/types/world";

function world(rooms: WorldFile["rooms"], startRoom?: string): WorldFile {
  return {
    zone: "test",
    startRoom: startRoom ?? Object.keys(rooms)[0]!,
    rooms,
    mobs: {},
    items: {},
    shops: {},
    quests: {},
    gatheringNodes: {},
    recipes: {},
  };
}

describe("detectTextRoomMismatches", () => {
  it("flags a description that claims a room is in the wrong direction", () => {
    const report = analyzeZoneLayout(
      world({
        gate: {
          title: "The Gate",
          description:
            "You stand at the gate. To the north is the drawbridge, heavy and dark.",
          exits: { e: "drawbridge" },
        },
        drawbridge: {
          title: "The Drawbridge",
          description: "A heavy drawbridge.",
          exits: { w: "gate" },
        },
      }),
    );

    const mismatch = report.issues.find((i) => i.kind === "text-room-mismatch");
    expect(mismatch).toBeDefined();
    expect(mismatch!.roomId).toBe("gate");
    expect(mismatch!.otherRoomId).toBe("drawbridge");
    expect(mismatch!.message).toMatch(/drawbridge/i);
    expect(mismatch!.message).toMatch(/north/i);
  });

  it("flags when the described direction has no exit at all", () => {
    const report = analyzeZoneLayout(
      world({
        gate: {
          title: "The Gate",
          description: "The drawbridge lies to the north, beyond the gate.",
          exits: {},
        },
        drawbridge: {
          title: "The Drawbridge",
          description: "A bridge.",
          exits: {},
        },
      }),
    );

    const mismatch = report.issues.find((i) => i.kind === "text-room-mismatch");
    expect(mismatch).toBeDefined();
    expect(mismatch!.message).toMatch(/no north exit/i);
  });

  it("does not flag when description and layout agree", () => {
    const report = analyzeZoneLayout(
      world({
        gate: {
          title: "The Gate",
          description: "The drawbridge lies to the north.",
          exits: { n: "drawbridge" },
        },
        drawbridge: {
          title: "The Drawbridge",
          description: "A bridge.",
          exits: { s: "gate" },
        },
      }),
    );

    expect(report.issues.some((i) => i.kind === "text-room-mismatch")).toBe(false);
  });

  it("ignores keywords shared between multiple rooms", () => {
    // Both "Old Garden" and "New Garden" include the keyword "garden" — when a
    // description mentions only "the garden", we can't tell which room is
    // meant, so the detector should stay quiet.
    const report = analyzeZoneLayout(
      world({
        foyer: {
          title: "Foyer",
          description: "The garden lies north.",
          exits: { e: "old_garden" },
        },
        old_garden: {
          title: "Old Garden",
          description: "Overgrown.",
          exits: { w: "foyer" },
        },
        new_garden: {
          title: "New Garden",
          description: "Freshly planted.",
          exits: {},
        },
      }),
    );

    expect(report.issues.some((i) => i.kind === "text-room-mismatch")).toBe(false);
  });

  it("only pairs a direction with a nearby room mention, not a distant one", () => {
    const report = analyzeZoneLayout(
      world({
        hub: {
          title: "Hub",
          description:
            "To the east lies a cliff you cannot safely descend. " +
            "Far across the valley, barely visible, the drawbridge waits to the north.",
          exits: { e: "cliff", n: "drawbridge" },
        },
        cliff: { title: "Cliff", description: ".", exits: { w: "hub" } },
        drawbridge: { title: "Drawbridge", description: ".", exits: { s: "hub" } },
      }),
    );

    // `east` is not close to `drawbridge` — no false positive. Both dir+room
    // pairs in this description are consistent with the layout.
    expect(report.issues.some((i) => i.kind === "text-room-mismatch")).toBe(false);
  });

  it("routes room-mismatch mismatches through textMismatches for LLM rewriting", () => {
    const report = analyzeZoneLayout(
      world({
        gate: {
          title: "The Gate",
          description: "The drawbridge lies to the north.",
          exits: { e: "drawbridge" },
        },
        drawbridge: {
          title: "The Drawbridge",
          description: ".",
          exits: { w: "gate" },
        },
      }),
    );
    const fromRoomMismatch = report.textMismatches.find((m) => m.problem);
    expect(fromRoomMismatch).toBeDefined();
    expect(fromRoomMismatch!.problem).toMatch(/drawbridge/i);
  });
});
