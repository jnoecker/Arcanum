import { describe, it, expect } from "vitest";
import {
  PRESETS,
  PRESET_ORDER,
  getPreset,
  getAllPresets,
  slugifyStoryTitle,
  suggestExportFilename,
  checkStoryFitsPreset,
  formatDuration,
  type ExportPresetId,
} from "../videoExportPresets";

// ─── Registry shape ──────────────────────────────────────────────

describe("preset registry", () => {
  it("exports the five documented presets", () => {
    expect(PRESET_ORDER).toEqual([
      "showcase",
      "social_vertical",
      "social_square",
      "in_game",
      "archive",
    ]);
  });

  it("every preset ID in PRESET_ORDER has a matching entry in PRESETS", () => {
    for (const id of PRESET_ORDER) {
      expect(PRESETS[id]).toBeDefined();
      expect(PRESETS[id].id).toBe(id);
    }
  });

  it("getAllPresets returns presets in PRESET_ORDER", () => {
    const all = getAllPresets();
    expect(all.map((p) => p.id)).toEqual(PRESET_ORDER);
  });

  it("getPreset returns the matching preset", () => {
    expect(getPreset("showcase").id).toBe("showcase");
    expect(getPreset("in_game").label).toContain("In-Game");
  });
});

// ─── Preset invariants ───────────────────────────────────────────

describe("preset dimensions", () => {
  it("all dimensions are divisible by 2 (required by H.264 yuv420p)", () => {
    for (const preset of getAllPresets()) {
      expect(preset.width % 2).toBe(0);
      expect(preset.height % 2).toBe(0);
    }
  });

  it("every preset has a positive video and audio bitrate", () => {
    for (const preset of getAllPresets()) {
      expect(preset.videoBitrateKbps).toBeGreaterThan(0);
      expect(preset.audioBitrateKbps).toBeGreaterThan(0);
    }
  });

  it("every preset has a sensible frame rate (30 or 60)", () => {
    for (const preset of getAllPresets()) {
      expect([30, 60]).toContain(preset.fps);
    }
  });

  it("only the archive preset uses 60fps", () => {
    expect(getPreset("archive").fps).toBe(60);
    expect(getPreset("showcase").fps).toBe(30);
    expect(getPreset("social_vertical").fps).toBe(30);
  });

  it("only the archive preset uses the tts-1-hd model", () => {
    expect(getPreset("archive").ttsModel).toBe("tts-1-hd");
    expect(getPreset("showcase").ttsModel).toBe("tts-1");
    expect(getPreset("in_game").ttsModel).toBe("tts-1");
  });
});

describe("preset distribution targets", () => {
  it("showcase targets showcase-embed", () => {
    expect(getPreset("showcase").target).toBe("showcase-embed");
  });

  it("both social presets target social-feed", () => {
    expect(getPreset("social_vertical").target).toBe("social-feed");
    expect(getPreset("social_square").target).toBe("social-feed");
  });

  it("in_game targets in-game-asset", () => {
    expect(getPreset("in_game").target).toBe("in-game-asset");
  });

  it("archive targets personal-archive", () => {
    expect(getPreset("archive").target).toBe("personal-archive");
  });
});

describe("preset duration caps", () => {
  it("showcase has no cap", () => {
    expect(getPreset("showcase").maxDurationMs).toBeNull();
  });

  it("archive has no cap", () => {
    expect(getPreset("archive").maxDurationMs).toBeNull();
  });

  it("social presets cap at 60 seconds", () => {
    expect(getPreset("social_vertical").maxDurationMs).toBe(60_000);
    expect(getPreset("social_square").maxDurationMs).toBe(60_000);
  });

  it("in_game caps at 30 seconds", () => {
    expect(getPreset("in_game").maxDurationMs).toBe(30_000);
  });
});

describe("preset caption policies", () => {
  it("in_game does NOT burn captions (MUD renders its own text)", () => {
    expect(getPreset("in_game").burnedCaptions).toBe(false);
  });

  it("all other presets burn captions", () => {
    for (const id of PRESET_ORDER) {
      if (id === "in_game") continue;
      expect(PRESETS[id].burnedCaptions).toBe(true);
    }
  });

  it("social_vertical places captions in the upper third", () => {
    // Vertical video needs captions above the phone's bottom UI bar.
    expect(getPreset("social_vertical").captionPlacement).toBe("upper-third");
  });

  it("social presets use larger caption scale than showcase", () => {
    expect(getPreset("social_square").captionScale).toBeGreaterThan(
      getPreset("showcase").captionScale,
    );
    expect(getPreset("social_vertical").captionScale).toBeGreaterThan(
      getPreset("showcase").captionScale,
    );
  });
});

describe("preset audio policies", () => {
  it("in_game excludes music and ambient to avoid clashing with game audio", () => {
    const preset = getPreset("in_game");
    expect(preset.includeMusic).toBe(false);
    expect(preset.includeAmbient).toBe(false);
  });

  it("social presets include music but not ambient (keep it punchy)", () => {
    for (const id of ["social_vertical", "social_square"] as ExportPresetId[]) {
      const preset = getPreset(id);
      expect(preset.includeMusic).toBe(true);
      expect(preset.includeAmbient).toBe(false);
    }
  });

  it("showcase and archive include music and ambient", () => {
    for (const id of ["showcase", "archive"] as ExportPresetId[]) {
      const preset = getPreset(id);
      expect(preset.includeMusic).toBe(true);
      expect(preset.includeAmbient).toBe(true);
    }
  });
});

describe("preset background fit", () => {
  it("social presets use fill (crop) since 9:16 / 1:1 ≠ source aspect", () => {
    expect(getPreset("social_vertical").backgroundFit).toBe("fill");
    expect(getPreset("social_square").backgroundFit).toBe("fill");
  });

  it("16:9 presets use fit (native source aspect matches)", () => {
    for (const id of ["showcase", "in_game", "archive"] as ExportPresetId[]) {
      expect(getPreset(id).backgroundFit).toBe("fit");
    }
  });
});

// ─── slugifyStoryTitle ───────────────────────────────────────────

describe("slugifyStoryTitle", () => {
  it("converts a plain title", () => {
    expect(slugifyStoryTitle("Fall of the Cathedral")).toBe("fall-of-the-cathedral");
  });

  it("collapses punctuation and whitespace to hyphens", () => {
    expect(slugifyStoryTitle("Act I: The Descent!")).toBe("act-i-the-descent");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugifyStoryTitle("  ---Begin---  ")).toBe("begin");
  });

  it("returns 'story' for an empty title", () => {
    expect(slugifyStoryTitle("")).toBe("story");
  });

  it("returns 'story' for a title of only punctuation", () => {
    expect(slugifyStoryTitle("!!!???")).toBe("story");
  });

  it("caps length at 60 characters", () => {
    const long = "a".repeat(100);
    expect(slugifyStoryTitle(long).length).toBe(60);
  });

  it("handles unicode by stripping it", () => {
    expect(slugifyStoryTitle("Chrönïcles")).toBe("chr-n-cles");
  });
});

// ─── suggestExportFilename ───────────────────────────────────────

describe("suggestExportFilename", () => {
  it("combines the slug and preset suffix", () => {
    expect(suggestExportFilename("Fall of the Cathedral", "showcase")).toBe(
      "fall-of-the-cathedral-showcase.mp4",
    );
  });

  it("uses each preset's distinct suffix", () => {
    const title = "My Story";
    expect(suggestExportFilename(title, "showcase")).toContain("-showcase.mp4");
    expect(suggestExportFilename(title, "social_vertical")).toContain("-vertical.mp4");
    expect(suggestExportFilename(title, "social_square")).toContain("-square.mp4");
    expect(suggestExportFilename(title, "in_game")).toContain("-intro.mp4");
    expect(suggestExportFilename(title, "archive")).toContain("-archive.mp4");
  });

  it("falls back to 'story' for empty titles", () => {
    expect(suggestExportFilename("", "showcase")).toBe("story-showcase.mp4");
  });
});

// ─── checkStoryFitsPreset ────────────────────────────────────────

describe("checkStoryFitsPreset", () => {
  it("unlimited presets always fit", () => {
    const result = checkStoryFitsPreset(600_000, getPreset("showcase")); // 10 min
    expect(result.fits).toBe(true);
    expect(result.warning).toBe("");
  });

  it("stories under the cap fit social presets", () => {
    const result = checkStoryFitsPreset(45_000, getPreset("social_vertical"));
    expect(result.fits).toBe(true);
    expect(result.warning).toBe("");
  });

  it("stories exactly at the cap fit", () => {
    const result = checkStoryFitsPreset(60_000, getPreset("social_square"));
    expect(result.fits).toBe(true);
  });

  it("stories over the cap produce a warning", () => {
    const result = checkStoryFitsPreset(75_000, getPreset("social_square"));
    expect(result.fits).toBe(false);
    expect(result.capMs).toBe(60_000);
    expect(result.overshootMs).toBe(15_000);
    expect(result.warning).toMatch(/15s longer/);
    expect(result.warning).toMatch(/60s cap/);
  });

  it("in_game cap is stricter than social", () => {
    const story = checkStoryFitsPreset(45_000, getPreset("in_game"));
    expect(story.fits).toBe(false);
    expect(story.capMs).toBe(30_000);
    expect(story.overshootMs).toBe(15_000);
  });

  it("passes through the story duration for the UI", () => {
    const result = checkStoryFitsPreset(42_000, getPreset("social_vertical"));
    expect(result.storyDurationMs).toBe(42_000);
  });
});

// ─── formatDuration ──────────────────────────────────────────────

describe("formatDuration", () => {
  it("formats zero as 0:00", () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it("formats seconds-only durations", () => {
    expect(formatDuration(5_000)).toBe("0:05");
    expect(formatDuration(45_000)).toBe("0:45");
  });

  it("formats minute:second durations", () => {
    expect(formatDuration(60_000)).toBe("1:00");
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatDuration(130_000)).toBe("2:10");
  });

  it("rounds to the nearest second", () => {
    expect(formatDuration(65_500)).toBe("1:06"); // rounds up
    expect(formatDuration(65_400)).toBe("1:05"); // rounds down
  });

  it("clamps negative durations to 0:00", () => {
    expect(formatDuration(-1000)).toBe("0:00");
  });

  it("handles long durations", () => {
    expect(formatDuration(3_600_000)).toBe("60:00"); // 1 hour
  });
});
