import { describe, it, expect } from "vitest";
import {
  computeStoryTimeline,
  estimateNarrationDurationMs,
  extractParagraphs,
} from "../storyTiming";
import { NARRATION_TIMING } from "../narrationSpeed";
import type { Story, Scene } from "@/types/story";

// ─── Fixture helpers ─────────────────────────────────────────────

/** Build a TipTap JSON doc with the given paragraphs. */
function tiptapDoc(...paragraphs: string[]): string {
  return JSON.stringify({
    type: "doc",
    content: paragraphs.map((p) => ({
      type: "paragraph",
      content: [{ type: "text", text: p }],
    })),
  });
}

function scene(overrides: Partial<Scene> & { id: string; sortOrder: number }): Scene {
  return {
    title: overrides.id,
    entities: [],
    ...overrides,
  };
}

function story(scenes: Scene[], narrationSpeed: Story["narrationSpeed"] = "normal"): Story {
  return {
    id: "test-story",
    title: "Test Story",
    zoneId: "test-zone",
    scenes,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    narrationSpeed,
  };
}

// ─── extractParagraphs ───────────────────────────────────────────

describe("extractParagraphs", () => {
  it("returns empty array for empty input", () => {
    expect(extractParagraphs("")).toEqual([]);
  });

  it("splits TipTap doc into paragraph blocks", () => {
    const doc = tiptapDoc("First line.", "Second line.", "Third line.");
    expect(extractParagraphs(doc)).toEqual([
      "First line.",
      "Second line.",
      "Third line.",
    ]);
  });

  it("trims whitespace and drops empty paragraphs", () => {
    const doc = JSON.stringify({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "  padded  " }] },
        { type: "paragraph", content: [{ type: "text", text: "" }] },
        { type: "paragraph", content: [{ type: "text", text: "kept" }] },
      ],
    });
    expect(extractParagraphs(doc)).toEqual(["padded", "kept"]);
  });

  it("falls back to newline split for invalid JSON", () => {
    expect(extractParagraphs("plain\nline\ntwo")).toEqual(["plain", "line", "two"]);
  });

  it("returns empty array when parsing fails and no fallback text", () => {
    expect(extractParagraphs("")).toEqual([]);
  });
});

// ─── estimateNarrationDurationMs ─────────────────────────────────

describe("estimateNarrationDurationMs", () => {
  it("returns 0 for zero words", () => {
    expect(estimateNarrationDurationMs(0, "normal")).toBe(0);
  });

  it("scales linearly with word count", () => {
    const oneWord = estimateNarrationDurationMs(1, "normal");
    const tenWords = estimateNarrationDurationMs(10, "normal");
    expect(tenWords).toBe(oneWord * 10);
  });

  it("matches NARRATION_TIMING for each speed", () => {
    const timing = NARRATION_TIMING.normal;
    const expected = Math.round((timing.wordDuration + timing.wordGap) * 1000 * 5);
    expect(estimateNarrationDurationMs(5, "normal")).toBe(expected);
  });

  it("fast speed is shorter than slow speed for same word count", () => {
    const slow = estimateNarrationDurationMs(20, "slow");
    const fast = estimateNarrationDurationMs(20, "fast");
    expect(fast).toBeLessThan(slow);
  });
});

// ─── computeStoryTimeline: empty / edge ──────────────────────────

describe("computeStoryTimeline - edge cases", () => {
  it("returns empty timeline for a story with no scenes", () => {
    const result = computeStoryTimeline(story([]));
    expect(result.scenes).toEqual([]);
    expect(result.totalDurationMs).toBe(0);
  });

  it("applies the minSceneDurationMs for scenes with no narration", () => {
    const s = scene({ id: "empty", sortOrder: 0 });
    const result = computeStoryTimeline(story([s]), { minSceneDurationMs: 4000 });
    expect(result.scenes).toHaveLength(1);
    expect(result.scenes[0]!.durationMs).toBe(4000);
  });

  it("clamps to maxSceneDurationMs for very long narration", () => {
    // 500 words at normal speed is way longer than 5000ms
    const longNarration = tiptapDoc(Array(500).fill("word").join(" "));
    const s = scene({ id: "long", sortOrder: 0, narration: longNarration });
    const result = computeStoryTimeline(story([s]), { maxSceneDurationMs: 5000 });
    expect(result.scenes[0]!.durationMs).toBe(5000);
  });
});

// ─── computeStoryTimeline: single scene timing ───────────────────

describe("computeStoryTimeline - single scene", () => {
  it("scene duration = leadIn + narration + hold", () => {
    const narration = tiptapDoc("Ten word narration here one two three four five six.");
    const s = scene({ id: "s1", sortOrder: 0, narration });
    const result = computeStoryTimeline(story([s]), {
      narrationLeadInMs: 200,
      postNarrationHoldMs: 1500,
      minSceneDurationMs: 0,
    });

    const narrationDuration = estimateNarrationDurationMs(10, "normal");
    expect(result.scenes[0]!.durationMs).toBe(200 + narrationDuration + 1500);
    expect(result.scenes[0]!.narrationStartMs).toBe(200);
    expect(result.scenes[0]!.narrationEndMs).toBe(200 + narrationDuration);
    expect(result.scenes[0]!.holdMs).toBe(1500);
  });

  it("first scene starts at 0", () => {
    const s = scene({ id: "s1", sortOrder: 0 });
    const result = computeStoryTimeline(story([s]));
    expect(result.scenes[0]!.startMs).toBe(0);
  });

  it("totalDurationMs matches the single scene's end time", () => {
    const s = scene({ id: "s1", sortOrder: 0 });
    const result = computeStoryTimeline(story([s]));
    expect(result.totalDurationMs).toBe(result.scenes[0]!.durationMs);
  });
});

// ─── computeStoryTimeline: narration speeds ──────────────────────

describe("computeStoryTimeline - narration speed", () => {
  const narration = tiptapDoc("one two three four five six seven eight nine ten");

  it("respects story-level narration speed", () => {
    const s = scene({ id: "s1", sortOrder: 0, narration });
    const slow = computeStoryTimeline(story([s], "slow"));
    const fast = computeStoryTimeline(story([s], "fast"));
    expect(fast.scenes[0]!.durationMs).toBeLessThan(slow.scenes[0]!.durationMs);
  });

  it("per-scene narration speed overrides story speed", () => {
    const slowScene = scene({
      id: "slow",
      sortOrder: 0,
      narration,
      narrationSpeed: "slow",
    });
    const fastScene = scene({
      id: "fast",
      sortOrder: 1,
      narration,
      narrationSpeed: "fast",
    });
    const result = computeStoryTimeline(story([slowScene, fastScene], "normal"));
    expect(result.scenes[0]!.durationMs).toBeGreaterThan(result.scenes[1]!.durationMs);
  });
});

// ─── computeStoryTimeline: multi-scene chaining ──────────────────

describe("computeStoryTimeline - multi-scene", () => {
  it("scenes are sorted by sortOrder before computation", () => {
    const a = scene({ id: "a", sortOrder: 2 });
    const b = scene({ id: "b", sortOrder: 0 });
    const c = scene({ id: "c", sortOrder: 1 });
    const result = computeStoryTimeline(story([a, b, c]));
    expect(result.scenes.map((s) => s.sceneId)).toEqual(["b", "c", "a"]);
    expect(result.scenes.map((s) => s.sceneIndex)).toEqual([0, 1, 2]);
  });

  it("scene start times chain correctly with crossfade overlap", () => {
    const s1 = scene({
      id: "s1",
      sortOrder: 0,
      transition: { type: "crossfade" },
    });
    const s2 = scene({
      id: "s2",
      sortOrder: 1,
      transition: { type: "crossfade" },
    });
    const result = computeStoryTimeline(story([s1, s2]), {
      crossfadeMs: 500,
      minSceneDurationMs: 3000,
    });

    // s1 starts at 0, lasts 3000ms → s2 starts at 3000 - 500 = 2500
    expect(result.scenes[0]!.startMs).toBe(0);
    expect(result.scenes[0]!.durationMs).toBe(3000);
    expect(result.scenes[1]!.startMs).toBe(2500);
  });

  it("fade_black transitions also overlap correctly", () => {
    const s1 = scene({
      id: "s1",
      sortOrder: 0,
      transition: { type: "fade_black" },
    });
    const s2 = scene({ id: "s2", sortOrder: 1 });
    const result = computeStoryTimeline(story([s1, s2]), {
      fadeBlackMs: 300,
      minSceneDurationMs: 2000,
    });
    expect(result.scenes[1]!.startMs).toBe(2000 - 300);
  });

  it("final scene has transitionOut = null", () => {
    const s1 = scene({ id: "s1", sortOrder: 0 });
    const s2 = scene({ id: "s2", sortOrder: 1 });
    const result = computeStoryTimeline(story([s1, s2]));
    expect(result.scenes[0]!.transitionOut).not.toBeNull();
    expect(result.scenes[1]!.transitionOut).toBeNull();
  });

  it("totalDurationMs = last scene's absolute end time", () => {
    const s1 = scene({ id: "s1", sortOrder: 0 });
    const s2 = scene({ id: "s2", sortOrder: 1 });
    const result = computeStoryTimeline(story([s1, s2]), {
      minSceneDurationMs: 2000,
      crossfadeMs: 500,
    });
    // s1: 0-2000, s2: 1500-3500 → total 3500
    expect(result.totalDurationMs).toBe(3500);
  });
});

// ─── computeStoryTimeline: narration chunks ──────────────────────

describe("computeStoryTimeline - narration chunks", () => {
  it("produces one chunk per TipTap paragraph", () => {
    const narration = tiptapDoc("First.", "Second.", "Third.");
    const s = scene({ id: "s1", sortOrder: 0, narration });
    const result = computeStoryTimeline(story([s]));
    expect(result.scenes[0]!.narrationChunks).toHaveLength(3);
    expect(result.scenes[0]!.narrationChunks.map((c) => c.text)).toEqual([
      "First.",
      "Second.",
      "Third.",
    ]);
  });

  it("chunks are offset by narrationStartMs (lead-in)", () => {
    const narration = tiptapDoc("Only paragraph.");
    const s = scene({ id: "s1", sortOrder: 0, narration });
    const result = computeStoryTimeline(story([s]), { narrationLeadInMs: 200 });
    expect(result.scenes[0]!.narrationChunks[0]!.startMs).toBe(200);
  });

  it("chunk durations are proportional to word count", () => {
    const narration = tiptapDoc("one", "two three four five");
    const s = scene({ id: "s1", sortOrder: 0, narration });
    const result = computeStoryTimeline(story([s]));
    const chunks = result.scenes[0]!.narrationChunks;
    const first = chunks[0]!;
    const second = chunks[1]!;
    // Second paragraph has 4× the words, so its duration should be roughly 4× the first
    const firstDuration = first.endMs - first.startMs;
    const secondDuration = second.endMs - second.startMs;
    expect(secondDuration).toBeGreaterThan(firstDuration * 3);
  });

  it("returns empty chunks for scenes with no narration", () => {
    const s = scene({ id: "s1", sortOrder: 0 });
    const result = computeStoryTimeline(story([s]));
    expect(result.scenes[0]!.narrationChunks).toEqual([]);
  });
});

// ─── computeStoryTimeline: narration words ───────────────────────

describe("computeStoryTimeline - narration words", () => {
  it("produces one entry per word", () => {
    const narration = tiptapDoc("one two three");
    const s = scene({ id: "s1", sortOrder: 0, narration });
    const result = computeStoryTimeline(story([s]));
    expect(result.scenes[0]!.narrationWords).toHaveLength(3);
    expect(result.scenes[0]!.narrationWords.map((w) => w.text)).toEqual([
      "one",
      "two",
      "three",
    ]);
  });

  it("word times are monotonic and non-overlapping", () => {
    const narration = tiptapDoc("alpha beta gamma delta epsilon");
    const s = scene({ id: "s1", sortOrder: 0, narration });
    const result = computeStoryTimeline(story([s]));
    const words = result.scenes[0]!.narrationWords;
    for (let i = 1; i < words.length; i++) {
      expect(words[i]!.startMs).toBeGreaterThanOrEqual(words[i - 1]!.endMs - 1);
    }
  });

  it("word times are offset by narrationStartMs", () => {
    const narration = tiptapDoc("hello");
    const s = scene({ id: "s1", sortOrder: 0, narration });
    const result = computeStoryTimeline(story([s]), { narrationLeadInMs: 500 });
    expect(result.scenes[0]!.narrationWords[0]!.startMs).toBe(500);
  });
});

// ─── computeStoryTimeline: narration duration overrides ──────────

describe("computeStoryTimeline - narration duration overrides", () => {
  it("override replaces the word-count estimate", () => {
    const narration = tiptapDoc("one two three four five");
    const s = scene({ id: "s1", sortOrder: 0, narration });

    const withoutOverride = computeStoryTimeline(story([s]));
    const withOverride = computeStoryTimeline(story([s]), {
      narrationDurationOverrides: { s1: 10_000 },
    });

    expect(withOverride.scenes[0]!.durationMs).not.toBe(
      withoutOverride.scenes[0]!.durationMs,
    );
    expect(withOverride.scenes[0]!.narrationEndMs).toBe(
      withOverride.scenes[0]!.narrationStartMs + 10_000,
    );
  });

  it("override scales word timing to the new duration", () => {
    const narration = tiptapDoc("one two three four five");
    const s = scene({ id: "s1", sortOrder: 0, narration });
    const result = computeStoryTimeline(story([s]), {
      narrationDurationOverrides: { s1: 5000 },
      narrationLeadInMs: 0,
    });
    const words = result.scenes[0]!.narrationWords;
    // Last word should end near 5000ms
    expect(words[words.length - 1]!.endMs).toBeGreaterThan(4900);
    expect(words[words.length - 1]!.endMs).toBeLessThanOrEqual(5001);
  });

  it("scenes without an override still use estimated duration", () => {
    const narration = tiptapDoc("one two three");
    const s1 = scene({ id: "s1", sortOrder: 0, narration });
    const s2 = scene({ id: "s2", sortOrder: 1, narration });
    const result = computeStoryTimeline(story([s1, s2]), {
      narrationDurationOverrides: { s1: 10_000 },
    });
    expect(result.scenes[0]!.narrationEndMs - result.scenes[0]!.narrationStartMs).toBe(
      10_000,
    );
    expect(result.scenes[1]!.narrationEndMs - result.scenes[1]!.narrationStartMs).toBe(
      estimateNarrationDurationMs(3, "normal"),
    );
  });

  it("override of 0 produces a scene at the minimum duration", () => {
    const narration = tiptapDoc("hello world");
    const s = scene({ id: "s1", sortOrder: 0, narration });
    const result = computeStoryTimeline(story([s]), {
      narrationDurationOverrides: { s1: 0 },
      minSceneDurationMs: 3000,
    });
    expect(result.scenes[0]!.durationMs).toBe(3000);
  });
});
