import { describe, it, expect } from "vitest";
import {
  ENTRANCE_PRESETS,
  EXIT_PRESETS,
  getEntrancePreset,
  getExitPreset,
} from "../movementPresets";

// ─── Movement Presets tests ──────────────────────────────────────

describe("ENTRANCE_PRESETS", () => {
  it("has exactly 5 entries", () => {
    expect(ENTRANCE_PRESETS).toHaveLength(5);
  });

  it("has the correct preset IDs", () => {
    const ids = ENTRANCE_PRESETS.map((p) => p.id);
    expect(ids).toEqual([
      "enter-from-left",
      "enter-from-right",
      "enter-from-bottom",
      "rise-from-shadows",
      "fade-in-place",
    ]);
  });

  it("has unique IDs", () => {
    const ids = ENTRANCE_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every preset has a non-empty label and positive duration", () => {
    for (const preset of ENTRANCE_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.duration).toBeGreaterThan(0);
    }
  });

  it("non-fade presets have SVG paths starting with M", () => {
    const nonFade = ENTRANCE_PRESETS.filter((p) => p.id !== "fade-in-place");
    for (const preset of nonFade) {
      expect(preset.path).toMatch(/^M/);
    }
  });

  it("fade-in-place preset has empty path", () => {
    const fade = ENTRANCE_PRESETS.find((p) => p.id === "fade-in-place");
    expect(fade).toBeDefined();
    expect(fade!.path).toBe("");
  });
});

describe("EXIT_PRESETS", () => {
  it("has exactly 3 entries", () => {
    expect(EXIT_PRESETS).toHaveLength(3);
  });

  it("has the correct preset IDs", () => {
    const ids = EXIT_PRESETS.map((p) => p.id);
    expect(ids).toEqual([
      "exit-stage-left",
      "exit-stage-right",
      "fade-out",
    ]);
  });

  it("has unique IDs", () => {
    const ids = EXIT_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every preset has a non-empty label and positive duration", () => {
    for (const preset of EXIT_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.duration).toBeGreaterThan(0);
    }
  });

  it("non-fade presets have SVG paths starting with M", () => {
    const nonFade = EXIT_PRESETS.filter((p) => p.id !== "fade-out");
    for (const preset of nonFade) {
      expect(preset.path).toMatch(/^M/);
    }
  });

  it("fade-out preset has empty path", () => {
    const fade = EXIT_PRESETS.find((p) => p.id === "fade-out");
    expect(fade).toBeDefined();
    expect(fade!.path).toBe("");
  });
});

describe("getEntrancePreset", () => {
  it("returns preset by ID", () => {
    const preset = getEntrancePreset("enter-from-left");
    expect(preset).toBeDefined();
    expect(preset!.id).toBe("enter-from-left");
  });

  it("returns undefined for unknown ID", () => {
    expect(getEntrancePreset("nonexistent")).toBeUndefined();
  });

  it("returns undefined for undefined input", () => {
    expect(getEntrancePreset(undefined)).toBeUndefined();
  });
});

describe("getExitPreset", () => {
  it("returns preset by ID", () => {
    const preset = getExitPreset("exit-stage-left");
    expect(preset).toBeDefined();
    expect(preset!.id).toBe("exit-stage-left");
  });

  it("returns undefined for unknown ID", () => {
    expect(getExitPreset("nonexistent")).toBeUndefined();
  });

  it("returns undefined for undefined input", () => {
    expect(getExitPreset(undefined)).toBeUndefined();
  });
});
