import { describe, it, expect } from "vitest";
import {
  PRESET_SLOTS,
  SLOT_ORDER,
  getNextSlot,
  resolveEntityPosition,
  isBackRow,
  getEntityScale,
  clampPosition,
  extractPlainText,
  extractWords,
} from "../sceneLayout";
import type { SceneEntity } from "@/types/story";

// ─── Scene layout utility tests ───────────────────────────────────

describe("getNextSlot", () => {
  it("returns front-center when no slots are occupied", () => {
    expect(getNextSlot([])).toBe("front-center");
  });

  it("returns front-left when front-center is occupied", () => {
    expect(getNextSlot(["front-center"])).toBe("front-left");
  });

  it("returns front-right when front-center and front-left are occupied", () => {
    expect(getNextSlot(["front-center", "front-left"])).toBe("front-right");
  });

  it("switches to back-center after all front slots are occupied", () => {
    expect(
      getNextSlot(["front-center", "front-left", "front-right"]),
    ).toBe("back-center");
  });

  it("returns front-center as fallback when all six slots are occupied", () => {
    expect(
      getNextSlot([
        "front-center",
        "front-left",
        "front-right",
        "back-center",
        "back-left",
        "back-right",
      ]),
    ).toBe("front-center");
  });
});

describe("resolveEntityPosition", () => {
  it("returns custom position when entity.position is set", () => {
    const entity: SceneEntity = {
      id: "e1",
      entityType: "mob",
      entityId: "goblin",
      slot: "back-left",
      position: { x: 33, y: 77 },
    };
    expect(resolveEntityPosition(entity)).toEqual({ x: 33, y: 77 });
  });

  it("returns preset slot position when entity has slot but no custom position", () => {
    const entity: SceneEntity = {
      id: "e2",
      entityType: "item",
      entityId: "sword",
      slot: "back-left",
    };
    expect(resolveEntityPosition(entity)).toEqual(PRESET_SLOTS["back-left"]);
  });

  it("returns front-center fallback when entity has neither position nor slot", () => {
    const entity: SceneEntity = {
      id: "e3",
      entityType: "npc",
      entityId: "merchant",
    };
    expect(resolveEntityPosition(entity)).toEqual(PRESET_SLOTS["front-center"]);
  });
});

describe("isBackRow / getEntityScale", () => {
  it("isBackRow returns true for back-left", () => {
    expect(isBackRow("back-left")).toBe(true);
  });

  it("isBackRow returns false for front-center", () => {
    expect(isBackRow("front-center")).toBe(false);
  });

  it("isBackRow returns false for undefined", () => {
    expect(isBackRow(undefined)).toBe(false);
  });

  it("getEntityScale returns 0.78 for back-row entity", () => {
    const entity: SceneEntity = {
      id: "e1",
      entityType: "mob",
      entityId: "goblin",
      slot: "back-center",
    };
    expect(getEntityScale(entity)).toBe(0.78);
  });

  it("getEntityScale returns 1.0 for front-row entity", () => {
    const entity: SceneEntity = {
      id: "e2",
      entityType: "mob",
      entityId: "orc",
      slot: "front-left",
    };
    expect(getEntityScale(entity)).toBe(1.0);
  });

  it("getEntityScale returns 1.0 for entity with custom position and no slot", () => {
    const entity: SceneEntity = {
      id: "e3",
      entityType: "item",
      entityId: "potion",
      position: { x: 10, y: 90 },
    };
    expect(getEntityScale(entity)).toBe(1.0);
  });
});

describe("clampPosition", () => {
  it("clamps negative and out-of-range values to 0-100", () => {
    expect(clampPosition({ x: -5, y: 110 })).toEqual({ x: 0, y: 100 });
  });

  it("leaves valid values unchanged", () => {
    expect(clampPosition({ x: 50, y: 50 })).toEqual({ x: 50, y: 50 });
  });
});

describe("extractPlainText", () => {
  it("returns empty string for empty input", () => {
    expect(extractPlainText("")).toBe("");
  });

  it("extracts text from valid TipTap JSON with paragraphs", () => {
    const json = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Second line" }],
        },
      ],
    });
    expect(extractPlainText(json)).toBe("Hello world\nSecond line");
  });

  it("returns empty string for invalid JSON", () => {
    expect(extractPlainText("invalid json")).toBe("");
  });

  it("strips marks and returns plain text", () => {
    const json = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "Bold" },
            { type: "text", text: " text" },
          ],
        },
      ],
    });
    expect(extractPlainText(json)).toBe("Bold text");
  });
});

describe("extractWords", () => {
  it("returns empty array for empty input", () => {
    expect(extractWords("")).toEqual([]);
  });

  it("returns array of individual words from valid TipTap JSON", () => {
    const json = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello brave world" }],
        },
      ],
    });
    expect(extractWords(json)).toEqual(["Hello", "brave", "world"]);
  });

  it("filters out empty strings from whitespace-only content", () => {
    const json = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "  word  " }],
        },
      ],
    });
    const words = extractWords(json);
    expect(words).toEqual(["word"]);
    expect(words.every((w) => w.length > 0)).toBe(true);
  });

  it("returns empty array for invalid JSON", () => {
    expect(extractWords("not valid json")).toEqual([]);
  });
});
