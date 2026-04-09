import { describe, it, expect } from "vitest";
import { buildTooltipContent } from "@/lib/tuning/deltaUtils";
import type { FieldMeta } from "@/lib/tuning/types";
import { TuningSection } from "@/lib/tuning/types";

function makeMeta(overrides: Partial<FieldMeta>): FieldMeta {
  return {
    label: "Test Field",
    description: "Default description",
    section: TuningSection.CombatStats,
    impact: "low",
    ...overrides,
  };
}

// ─── buildTooltipContent ──────────────────────────────────────────

describe("buildTooltipContent", () => {
  it("includes description text", () => {
    const html = buildTooltipContent(makeMeta({ description: "Base XP value" }));
    expect(html).toContain("Base XP value");
  });

  it("includes HIGH IMPACT badge with correct color for high impact", () => {
    const html = buildTooltipContent(makeMeta({ impact: "high" }));
    expect(html).toContain("HIGH IMPACT");
    expect(html).toContain("#d9756b");
  });

  it("includes MEDIUM IMPACT badge with correct color", () => {
    const html = buildTooltipContent(makeMeta({ impact: "medium" }));
    expect(html).toContain("MEDIUM IMPACT");
    expect(html).toContain("#ff9d3d");
  });

  it("includes LOW IMPACT badge with correct color", () => {
    const html = buildTooltipContent(makeMeta({ impact: "low" }));
    expect(html).toContain("LOW IMPACT");
    expect(html).toContain("#ad9d88");
  });

  it("includes interaction note when present", () => {
    const html = buildTooltipContent(makeMeta({ interactionNote: "affects combat damage" }));
    expect(html).toContain("Interacts with:");
    expect(html).toContain("affects combat damage");
  });

  it("omits interaction note when undefined", () => {
    const html = buildTooltipContent(makeMeta({ interactionNote: undefined }));
    expect(html).not.toContain("Interacts with:");
  });

  it("returns HTML string containing at least one tag", () => {
    const html = buildTooltipContent(makeMeta({}));
    expect(html).toMatch(/<[a-z]/);
  });
});
