import { describe, expect, it } from "vitest";
import { buildVibeInput, VIBE_SYSTEM_PROMPT } from "../vibePrompts";
import type { WorldFile, RoomFile, MobFile, ItemFile } from "@/types/world";

function room(title: string, description?: string): RoomFile {
  return { title, description, exits: {} } as RoomFile;
}

function mob(name: string, description?: string): MobFile {
  return {
    name,
    description,
    spawns: [{ room: "room_1" }],
    tier: "weak",
  };
}

function item(displayName: string, description?: string): ItemFile {
  return { displayName, description, slot: "weapon" };
}

function worldWith(overrides: Partial<WorldFile>): WorldFile {
  return {
    zone: "test_zone",
    startRoom: "room_1",
    rooms: { room_1: room("starter") },
    ...overrides,
  } as WorldFile;
}

describe("VIBE_SYSTEM_PROMPT", () => {
  it("instructs the LLM to produce a hex-anchored palette", () => {
    expect(VIBE_SYSTEM_PROMPT).toMatch(/Palette:/);
    expect(VIBE_SYSTEM_PROMPT).toMatch(/hex code/i);
    expect(VIBE_SYSTEM_PROMPT).toMatch(/3.?5 named anchor colors/i);
  });

  it("treats world visual style as soft context, not a hard constraint", () => {
    // The old prompt hard-locked everything to Surreal Gentle Magic. Make sure
    // that constraint is gone — each zone owns its own micro-aesthetic.
    expect(VIBE_SYSTEM_PROMPT.toLowerCase()).not.toContain("surreal gentle magic");
    expect(VIBE_SYSTEM_PROMPT.toLowerCase()).not.toContain("surreal_softmagic");
    expect(VIBE_SYSTEM_PROMPT).toMatch(/broader register/i);
  });

  it("specifies the Markdown brief shape (paragraph + Palette + Light + Forbidden)", () => {
    expect(VIBE_SYSTEM_PROMPT).toMatch(/Atmosphere & Visual Identity/);
    expect(VIBE_SYSTEM_PROMPT).toMatch(/\*\*Palette:\*\*/);
    expect(VIBE_SYSTEM_PROMPT).toMatch(/\*\*Light:\*\*/);
    expect(VIBE_SYSTEM_PROMPT).toMatch(/\*\*Forbidden:\*\*/);
  });

  it("forbids generic fantasy filler so the brief stays concrete", () => {
    expect(VIBE_SYSTEM_PROMPT).toMatch(/generic fantasy filler/i);
    expect(VIBE_SYSTEM_PROMPT.toLowerCase()).toContain("magical");
  });

  it("rules out commentary so the output round-trips into the vibe field cleanly", () => {
    expect(VIBE_SYSTEM_PROMPT).toMatch(/no commentary/i);
    expect(VIBE_SYSTEM_PROMPT).toMatch(/Output ONLY/);
  });
});

describe("buildVibeInput", () => {
  it("includes the zone id", () => {
    const out = buildVibeInput(worldWith({ zone: "nightmare_alley" }));
    expect(out).toMatch(/Zone ID: nightmare_alley/);
  });

  it("includes full room descriptions, not just titles", () => {
    const out = buildVibeInput(worldWith({
      rooms: {
        padded_hall: room(
          "the padded hall",
          "A long quilted corridor of bruised purple velvet, lit by a sickly brass lamp.",
        ),
      },
    }));
    expect(out).toContain("quilted corridor of bruised purple velvet");
    expect(out).toContain("the padded hall");
  });

  it("includes mob descriptions when present", () => {
    const out = buildVibeInput(worldWith({
      mobs: {
        toy: mob("a tattered toy", "Stitched from waxed canvas, button eyes weeping rust."),
      },
    }));
    expect(out).toContain("waxed canvas");
    expect(out).toContain("a tattered toy");
  });

  it("includes item descriptions when present", () => {
    const out = buildVibeInput(worldWith({
      items: {
        block: item("Tarnished Block", "A wooden alphabet block; the letters have been gouged out."),
      },
    }));
    expect(out).toContain("gouged out");
  });

  it("caps room sampling and reports the total in the header", () => {
    const rooms: Record<string, RoomFile> = {};
    for (let i = 0; i < 20; i++) rooms[`r${i}`] = room(`room ${i}`, `desc ${i}`);
    const out = buildVibeInput(worldWith({ rooms }));
    // First 12 rooms in, the remaining 8 mentioned in the tail
    expect(out).toMatch(/Rooms \(20 total\)/);
    expect(out).toContain("room 0");
    expect(out).toContain("room 11");
    expect(out).not.toContain("room 12");
    expect(out).toMatch(/\.\.\.8 more/);
  });

  it("gracefully omits sections that are empty or absent", () => {
    const out = buildVibeInput(worldWith({
      mobs: undefined,
      items: undefined,
    }));
    expect(out).not.toMatch(/Mobs/);
    expect(out).not.toMatch(/Items/);
    // Still has zone id and rooms
    expect(out).toMatch(/Zone ID:/);
    expect(out).toMatch(/Rooms/);
  });

  it("handles missing titles/names by falling back to the entity id", () => {
    const out = buildVibeInput(worldWith({
      rooms: { weird_id: room("", "described but unnamed") },
    }));
    expect(out).toContain("weird_id: described but unnamed");
  });
});
