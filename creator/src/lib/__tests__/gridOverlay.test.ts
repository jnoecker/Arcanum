import { describe, it, expect } from "vitest";
import {
  cellRangeToPixelBox,
  chooseGridSpec,
  colIndex,
  colLabel,
  type GridSpec,
} from "../gridOverlay";

describe("colLabel / colIndex", () => {
  it("round-trips A-Z", () => {
    for (let i = 0; i < 26; i++) {
      expect(colIndex(colLabel(i))).toBe(i);
    }
  });

  it("handles AA, AB", () => {
    expect(colLabel(26)).toBe("AA");
    expect(colLabel(27)).toBe("AB");
    expect(colIndex("AA")).toBe(26);
  });

  it("returns -1 for invalid input", () => {
    expect(colIndex("1")).toBe(-1);
    expect(colIndex("?")).toBe(-1);
  });
});

describe("chooseGridSpec", () => {
  it("returns a roughly square grid for square images", () => {
    const spec = chooseGridSpec(1000, 1000);
    expect(spec.cols).toBeGreaterThanOrEqual(6);
    expect(spec.cols).toBeLessThanOrEqual(12);
    expect(Math.abs(spec.cols - spec.rows)).toBeLessThanOrEqual(1);
  });

  it("scales with aspect ratio for wide images", () => {
    const spec = chooseGridSpec(2000, 1000);
    expect(spec.cols).toBeGreaterThanOrEqual(spec.rows);
  });

  it("scales with aspect ratio for tall images", () => {
    const spec = chooseGridSpec(1000, 2000);
    expect(spec.rows).toBeGreaterThanOrEqual(spec.cols);
  });

  it("clamps to 6-12 cells per axis", () => {
    const wide = chooseGridSpec(10000, 1000);
    expect(wide.cols).toBeLessThanOrEqual(12);
    expect(wide.rows).toBeGreaterThanOrEqual(6);
  });
});

describe("cellRangeToPixelBox", () => {
  const spec: GridSpec = {
    cols: 10,
    rows: 8,
    imageWidth: 1000,
    imageHeight: 800,
  };

  it("translates a single cell to a single-cell pixel box", () => {
    const box = cellRangeToPixelBox(
      { colStart: "A", colEnd: "A", rowStart: 1, rowEnd: 1 },
      spec,
    );
    expect(box).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });

  it("translates a multi-cell range", () => {
    // B..D = cols 1..3 (inclusive) → 3 cells × 100 = 300 wide, starting at x=100
    // rows 2..4 → 3 cells × 100 = 300 tall, starting at y=100
    const box = cellRangeToPixelBox(
      { colStart: "B", colEnd: "D", rowStart: 2, rowEnd: 4 },
      spec,
    );
    expect(box).toEqual({ x: 100, y: 100, w: 300, h: 300 });
  });

  it("handles bottom-right corner", () => {
    const box = cellRangeToPixelBox(
      { colStart: "J", colEnd: "J", rowStart: 8, rowEnd: 8 },
      spec,
    );
    expect(box).toEqual({ x: 900, y: 700, w: 100, h: 100 });
  });

  it("clamps cells past the grid edge", () => {
    const box = cellRangeToPixelBox(
      { colStart: "A", colEnd: "Z", rowStart: 1, rowEnd: 99 },
      spec,
    );
    expect(box?.x).toBe(0);
    expect(box?.y).toBe(0);
    expect(box?.w).toBe(1000);
    expect(box?.h).toBe(800);
  });

  it("normalizes reversed ranges", () => {
    const box = cellRangeToPixelBox(
      { colStart: "D", colEnd: "B", rowStart: 4, rowEnd: 2 },
      spec,
    );
    expect(box).toEqual({ x: 100, y: 100, w: 300, h: 300 });
  });

  it("returns null for unparseable column labels", () => {
    expect(
      cellRangeToPixelBox(
        { colStart: "?", colEnd: "?", rowStart: 1, rowEnd: 1 },
        spec,
      ),
    ).toBeNull();
  });
});
