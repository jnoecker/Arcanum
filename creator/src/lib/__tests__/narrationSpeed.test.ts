import { describe, it, expect } from "vitest";
import { NARRATION_TIMING } from "../narrationSpeed";

// ─── Narration Speed tests ───────────────────────────────────────

describe("NARRATION_TIMING", () => {
  it("has entries for slow, normal, and fast", () => {
    expect(NARRATION_TIMING).toHaveProperty("slow");
    expect(NARRATION_TIMING).toHaveProperty("normal");
    expect(NARRATION_TIMING).toHaveProperty("fast");
  });

  it("normal speed has wordDuration=0.15 and wordGap=0.08", () => {
    expect(NARRATION_TIMING.normal.wordDuration).toBe(0.15);
    expect(NARRATION_TIMING.normal.wordGap).toBe(0.08);
  });

  it("slow speed has wordDuration=0.2 and wordGap=0.12", () => {
    expect(NARRATION_TIMING.slow.wordDuration).toBe(0.2);
    expect(NARRATION_TIMING.slow.wordGap).toBe(0.12);
  });

  it("fast speed has wordDuration=0.1 and wordGap=0.05", () => {
    expect(NARRATION_TIMING.fast.wordDuration).toBe(0.1);
    expect(NARRATION_TIMING.fast.wordGap).toBe(0.05);
  });
});
