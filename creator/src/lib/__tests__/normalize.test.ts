import { describe, it, expect } from "vitest";
import { normalizeId, localPart } from "@/lib/normalize";

describe("normalizeId", () => {
  it("should prefix unqualified IDs with zone", () => {
    expect(normalizeId("swamp", "edge")).toBe("swamp:edge");
  });

  it("should leave qualified IDs as-is", () => {
    expect(normalizeId("swamp", "forest:trailhead")).toBe("forest:trailhead");
  });

  it("should trim whitespace", () => {
    expect(normalizeId("swamp", "  edge  ")).toBe("swamp:edge");
  });

  it("should return null for blank strings", () => {
    expect(normalizeId("swamp", "")).toBeNull();
    expect(normalizeId("swamp", "   ")).toBeNull();
  });

  it("should handle IDs with multiple colons", () => {
    expect(normalizeId("swamp", "zone:sub:id")).toBe("zone:sub:id");
  });
});

describe("localPart", () => {
  it("should extract part after last colon", () => {
    expect(localPart("swamp:silver_coin")).toBe("silver_coin");
  });

  it("should return the full string if no colon", () => {
    expect(localPart("silver_coin")).toBe("silver_coin");
  });

  it("should handle multiple colons", () => {
    expect(localPart("zone:sub:item")).toBe("item");
  });
});
