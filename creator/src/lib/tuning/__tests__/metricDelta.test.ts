import { describe, it, expect } from "vitest";
import { pctDelta, deltaDirection, deltaColor } from "@/lib/tuning/deltaUtils";

// ─── pctDelta ─────────────────────────────────────────────────────

describe("pctDelta", () => {
  it("formats positive delta with up arrow", () => {
    expect(pctDelta(10, 12)).toBe("▲ 20.0%");
  });
  it("formats negative delta with down arrow", () => {
    expect(pctDelta(10, 8)).toBe("▼ 20.0%");
  });
  it("returns dash for identical values", () => {
    expect(pctDelta(10, 10)).toBe("—");
  });
  it("returns +new when old is zero and new is positive", () => {
    expect(pctDelta(0, 5)).toBe("+new");
  });
  it("returns -new when old is zero and new is negative", () => {
    expect(pctDelta(0, -3)).toBe("-new");
  });
  it("returns dash when both are zero", () => {
    expect(pctDelta(0, 0)).toBe("—");
  });
  it("formats decimal precision to 1 digit", () => {
    expect(pctDelta(100, 115.6)).toBe("▲ 15.6%");
  });
  it("formats decrease with positive percentage", () => {
    expect(pctDelta(200, 170)).toBe("▼ 15.0%");
  });
});

// ─── deltaDirection ───────────────────────────────────────────────

describe("deltaDirection", () => {
  it("returns up for increase", () => {
    expect(deltaDirection(10, 12)).toBe("up");
  });
  it("returns down for decrease", () => {
    expect(deltaDirection(10, 8)).toBe("down");
  });
  it("returns same for equal", () => {
    expect(deltaDirection(10, 10)).toBe("same");
  });
  it("returns up for zero to positive", () => {
    expect(deltaDirection(0, 5)).toBe("up");
  });
});

// ─── deltaColor ───────────────────────────────────────────────────

describe("deltaColor", () => {
  it("returns success for up", () => {
    expect(deltaColor("up")).toBe("text-status-success");
  });
  it("returns error for down", () => {
    expect(deltaColor("down")).toBe("text-status-error");
  });
  it("returns muted for same", () => {
    expect(deltaColor("same")).toBe("text-text-muted");
  });
});
