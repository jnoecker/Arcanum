import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  resolveTtsSpeed,
  synthesizeNarration,
  synthesizeSceneNarration,
  OPENAI_TTS_VOICES,
} from "../narrationSynthesis";

// ─── Mock @tauri-apps/api/core ───────────────────────────────────

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

// ─── Helpers ─────────────────────────────────────────────────────

function tiptapDoc(...paragraphs: string[]): string {
  return JSON.stringify({
    type: "doc",
    content: paragraphs.map((p) => ({
      type: "paragraph",
      content: [{ type: "text", text: p }],
    })),
  });
}

const SAMPLE_AUDIO = {
  filePath: "/tmp/test.mp3",
  hash: "abc123",
  sizeBytes: 1234,
  cached: false,
};

beforeEach(() => {
  invokeMock.mockReset();
});

afterEach(() => {
  invokeMock.mockReset();
});

// ─── resolveTtsSpeed ─────────────────────────────────────────────

describe("resolveTtsSpeed", () => {
  it("returns undefined for undefined input", () => {
    expect(resolveTtsSpeed(undefined)).toBeUndefined();
  });

  it("maps slow preset to 0.85", () => {
    expect(resolveTtsSpeed("slow")).toBe(0.85);
  });

  it("maps normal preset to 1.0", () => {
    expect(resolveTtsSpeed("normal")).toBe(1.0);
  });

  it("maps fast preset to 1.15", () => {
    expect(resolveTtsSpeed("fast")).toBe(1.15);
  });

  it("passes through numeric values unchanged", () => {
    expect(resolveTtsSpeed(1.3)).toBe(1.3);
    expect(resolveTtsSpeed(0.5)).toBe(0.5);
  });
});

// ─── synthesizeNarration ─────────────────────────────────────────

describe("synthesizeNarration", () => {
  it("calls openai_tts_generate with defaults", async () => {
    invokeMock.mockResolvedValue(SAMPLE_AUDIO);
    const result = await synthesizeNarration({ text: "Hello world" });
    expect(invokeMock).toHaveBeenCalledWith("openai_tts_generate", {
      text: "Hello world",
      voice: "onyx",
      model: "tts-1",
      speed: undefined,
    });
    expect(result).toEqual(SAMPLE_AUDIO);
  });

  it("passes through voice, model, and resolved speed", async () => {
    invokeMock.mockResolvedValue(SAMPLE_AUDIO);
    await synthesizeNarration({
      text: "Hello",
      voice: "nova",
      model: "tts-1-hd",
      speed: "fast",
    });
    expect(invokeMock).toHaveBeenCalledWith("openai_tts_generate", {
      text: "Hello",
      voice: "nova",
      model: "tts-1-hd",
      speed: 1.15,
    });
  });

  it("trims whitespace before calling the backend", async () => {
    invokeMock.mockResolvedValue(SAMPLE_AUDIO);
    await synthesizeNarration({ text: "   padded   " });
    expect(invokeMock).toHaveBeenCalledWith(
      "openai_tts_generate",
      expect.objectContaining({ text: "padded" }),
    );
  });

  it("throws on empty text without calling the backend", async () => {
    await expect(synthesizeNarration({ text: "" })).rejects.toThrow(
      /empty text/,
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("throws on whitespace-only text", async () => {
    await expect(synthesizeNarration({ text: "   " })).rejects.toThrow(
      /empty text/,
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });
});

// ─── synthesizeSceneNarration ────────────────────────────────────

describe("synthesizeSceneNarration", () => {
  it("extracts TipTap plain text and synthesizes it", async () => {
    invokeMock.mockResolvedValue(SAMPLE_AUDIO);
    const narrationJson = tiptapDoc("First line.", "Second line.");
    const result = await synthesizeSceneNarration({ narrationJson });
    expect(invokeMock).toHaveBeenCalledWith("openai_tts_generate", {
      text: "First line.\nSecond line.",
      voice: "onyx",
      model: "tts-1",
      speed: undefined,
    });
    expect(result).toEqual(SAMPLE_AUDIO);
  });

  it("returns null for scenes with no narration", async () => {
    const result = await synthesizeSceneNarration({ narrationJson: undefined });
    expect(result).toBeNull();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("returns null for scenes with empty narration", async () => {
    const result = await synthesizeSceneNarration({ narrationJson: "" });
    expect(result).toBeNull();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("returns null for TipTap doc with only whitespace", async () => {
    const narrationJson = tiptapDoc("  ", "\n", "\t");
    const result = await synthesizeSceneNarration({ narrationJson });
    expect(result).toBeNull();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("forwards voice/model/speed overrides", async () => {
    invokeMock.mockResolvedValue(SAMPLE_AUDIO);
    const narrationJson = tiptapDoc("Test.");
    await synthesizeSceneNarration({
      narrationJson,
      voice: "shimmer",
      model: "tts-1-hd",
      speed: "slow",
    });
    expect(invokeMock).toHaveBeenCalledWith("openai_tts_generate", {
      text: "Test.",
      voice: "shimmer",
      model: "tts-1-hd",
      speed: 0.85,
    });
  });

  it("propagates backend errors", async () => {
    invokeMock.mockRejectedValue(new Error("API key not configured"));
    await expect(
      synthesizeSceneNarration({ narrationJson: tiptapDoc("Test.") }),
    ).rejects.toThrow(/API key not configured/);
  });
});

// ─── Constants sanity ────────────────────────────────────────────

describe("OPENAI_TTS_VOICES constant", () => {
  it("includes the documented six voices in expected order", () => {
    expect(OPENAI_TTS_VOICES).toEqual([
      "alloy",
      "echo",
      "fable",
      "onyx",
      "nova",
      "shimmer",
    ]);
  });
});
