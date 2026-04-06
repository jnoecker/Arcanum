// ─── Narration Speed Configuration ───────────────────────────────
// Timing constants for typewriter-style narration text reveal.
// Standalone copy for showcase — no creator imports.

export type NarrationSpeed = "slow" | "normal" | "fast";

export const NARRATION_TIMING: Record<NarrationSpeed, { wordDuration: number; wordGap: number }> = {
  slow:   { wordDuration: 0.2,  wordGap: 0.12 },
  normal: { wordDuration: 0.15, wordGap: 0.08 },
  fast:   { wordDuration: 0.1,  wordGap: 0.05 },
};
