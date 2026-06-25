import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GeneratedImage } from "@/types/assets";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

// Import AFTER the mock is registered.
import { useAssetStore } from "@/stores/assetStore";

function image(): GeneratedImage {
  return {
    id: "img1",
    hash: "abc123",
    file_path: "/assets/images/abc123.png",
    data_url: "",
    width: 1024,
    height: 1024,
    prompt: "a cozy parlor",
    model: "flux",
  };
}

function commandsCalled(): string[] {
  return invokeMock.mock.calls.map((c) => c[0] as string);
}

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue([]);
});

describe("acceptAsset — manifest reload control", () => {
  it("reloads the manifest by default (single-image paths stay live)", async () => {
    await useAssetStore.getState().acceptAsset(image(), "background");
    expect(commandsCalled()).toEqual(["accept_asset", "list_assets"]);
  });

  it("skips the per-image reload when reload=false (batch path)", async () => {
    // Batch art generation accepts every image with reload=false so a big zone
    // doesn't trigger an O(n²) full-manifest reload that OOMs the WebView.
    await useAssetStore
      .getState()
      .acceptAsset(image(), "background", undefined, undefined, undefined, true, false);
    const calls = commandsCalled();
    expect(calls).toContain("accept_asset");
    expect(calls).not.toContain("list_assets");
  });
});
