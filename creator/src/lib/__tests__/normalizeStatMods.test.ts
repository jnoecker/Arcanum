import { describe, it, expect } from "vitest";
import { normalizeStatMods, normalizeRaceStatMods } from "@/lib/loader";
import type { AppConfig } from "@/types/config";

const statDefs: AppConfig["stats"]["definitions"] = {
  STR: { id: "STR", displayName: "Strength", abbreviation: "STR", description: "", baseStat: 10 },
  DEX: { id: "DEX", displayName: "Dexterity", abbreviation: "DEX", description: "", baseStat: 10 },
  CON: { id: "CON", displayName: "Constitution", abbreviation: "CON", description: "", baseStat: 10 },
  INT: { id: "INT", displayName: "Intelligence", abbreviation: "INT", description: "", baseStat: 10 },
  WIS: { id: "WIS", displayName: "Wisdom", abbreviation: "WIS", description: "", baseStat: 10 },
  CHA: { id: "CHA", displayName: "Charisma", abbreviation: "CHA", description: "", baseStat: 10 },
};

describe("normalizeStatMods", () => {
  it("returns undefined for undefined input", () => {
    expect(normalizeStatMods(undefined, statDefs)).toBeUndefined();
  });

  it("keeps canonical stat ids unchanged", () => {
    expect(normalizeStatMods({ STR: 1, DEX: -1 }, statDefs)).toEqual({ STR: 1, DEX: -1 });
  });

  it("remaps full-displayName lowercase keys to canonical ids", () => {
    expect(normalizeStatMods({ strength: 1, intelligence: -1 }, statDefs)).toEqual({
      STR: 1,
      INT: -1,
    });
  });

  it("sums colliding aliases for the same canonical stat", () => {
    // user has `constitution: -1` from LLM + `CON: -2` from the editor;
    // both should collapse onto CON.
    expect(normalizeStatMods({ constitution: -1, CON: -2 }, statDefs)).toEqual({ CON: -3 });
  });

  it("drops keys whose summed value is zero", () => {
    expect(normalizeStatMods({ strength: 1, STR: -1 }, statDefs)).toBeUndefined();
  });

  it("preserves unknown keys verbatim", () => {
    expect(normalizeStatMods({ luck: 1 }, statDefs)).toEqual({ luck: 1 });
  });

  it("matches the abbreviation field case-insensitively", () => {
    expect(normalizeStatMods({ str: 2 }, statDefs)).toEqual({ STR: 2 });
  });
});

describe("normalizeRaceStatMods", () => {
  it("normalizes statMods on every race and leaves other fields alone", () => {
    const out = normalizeRaceStatMods(
      {
        aetherae: {
          displayName: "Aetherae",
          statMods: { intelligence: 1, wisdom: 1, dexterity: 1, constitution: -1, CON: -2 },
        },
        archae: {
          displayName: "Archae",
          // already canonical
          statMods: { STR: 1, DEX: 1 },
        },
      },
      statDefs,
    );
    expect(out.aetherae?.statMods).toEqual({ INT: 1, WIS: 1, DEX: 1, CON: -3 });
    expect(out.aetherae?.displayName).toBe("Aetherae");
    expect(out.archae?.statMods).toEqual({ STR: 1, DEX: 1 });
  });

  it("leaves races without statMods untouched", () => {
    const out = normalizeRaceStatMods(
      { ghost: { displayName: "Ghost" } },
      statDefs,
    );
    expect(out.ghost?.statMods).toBeUndefined();
  });
});
