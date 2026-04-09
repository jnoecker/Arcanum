import { describe, expect, it } from "vitest";
import {
  regionContainsPoint,
  regionToLeafletBounds,
  regionToPercentRect,
  translateRegionToAbsolute,
  translateRegionToLocal,
} from "../zoneRegionGeometry";

describe("regionToPercentRect", () => {
  it("converts CRS.Simple regions into top-down percentage boxes", () => {
    const rect = regionToPercentRect(
      { x: 250, y: 150, w: 500, h: 200 },
      1000,
      800,
    );

    expect(rect.left).toBe(25);
    expect(rect.top).toBe(56.25);
    expect(rect.width).toBe(50);
    expect(rect.height).toBe(25);
  });

  it("returns a zero rect for invalid map dimensions", () => {
    expect(regionToPercentRect({ x: 1, y: 2, w: 3, h: 4 }, 0, 100)).toEqual({
      left: 0,
      top: 0,
      width: 0,
      height: 0,
    });
  });
});

describe("regionToLeafletBounds", () => {
  it("maps region dimensions to south-west / north-east bounds", () => {
    expect(regionToLeafletBounds({ x: 120, y: 80, w: 300, h: 140 })).toEqual({
      south: 80,
      west: 120,
      north: 220,
      east: 420,
    });
  });
});

describe("region translation helpers", () => {
  it("translates regions between absolute and local parent space", () => {
    const parent = { x: 120, y: 80, w: 500, h: 300 };
    const child = { x: 180, y: 130, w: 140, h: 90 };

    expect(translateRegionToLocal(child, parent)).toEqual({
      x: 60,
      y: 50,
      w: 140,
      h: 90,
    });

    expect(
      translateRegionToAbsolute({ x: 60, y: 50, w: 140, h: 90 }, parent),
    ).toEqual(child);
  });

  it("checks whether a point lies inside a region", () => {
    const region = { x: 10, y: 20, w: 50, h: 40 };
    expect(regionContainsPoint(region, 25, 40)).toBe(true);
    expect(regionContainsPoint(region, 5, 40)).toBe(false);
  });
});
