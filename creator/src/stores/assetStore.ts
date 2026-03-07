import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { AssetEntry, GeneratedImage, Settings } from "@/types/assets";
import type { ArtStyle } from "@/lib/arcanumPrompts";

interface AssetState {
  assets: AssetEntry[];
  assetsDir: string;
  settings: Settings | null;
  generatorOpen: boolean;
  galleryOpen: boolean;
  artStyle: ArtStyle;

  loadSettings: () => Promise<void>;
  saveSettings: (settings: Settings) => Promise<void>;

  loadAssets: () => Promise<void>;
  acceptAsset: (image: GeneratedImage, assetType: string, enhancedPrompt?: string) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;

  setArtStyle: (style: ArtStyle) => void;
  openGenerator: () => void;
  closeGenerator: () => void;
  openGallery: () => void;
  closeGallery: () => void;
}

export const useAssetStore = create<AssetState>((set, get) => ({
  assets: [],
  assetsDir: "",
  settings: null,
  generatorOpen: false,
  galleryOpen: false,
  artStyle: "gentle_magic" as ArtStyle,

  loadSettings: async () => {
    const settings = await invoke<Settings>("get_settings");
    const assetsDir = await invoke<string>("get_assets_dir");
    set({ settings, assetsDir });
  },

  saveSettings: async (settings: Settings) => {
    await invoke("save_settings", { settings });
    set({ settings });
  },

  loadAssets: async () => {
    const assets = await invoke<AssetEntry[]>("list_assets");
    set({ assets });
  },

  acceptAsset: async (image, assetType, enhancedPrompt) => {
    // Extract just the filename from the full path
    const fileName = image.file_path.split(/[\\/]/).pop() ?? image.hash;

    await invoke<AssetEntry>("accept_asset", {
      id: image.id,
      hash: image.hash,
      prompt: image.prompt,
      enhancedPrompt: enhancedPrompt ?? null,
      model: image.model,
      assetType,
      context: null,
      fileName,
      width: image.width,
      height: image.height,
    });
    await get().loadAssets();
  },

  deleteAsset: async (id: string) => {
    await invoke("delete_asset", { id });
    await get().loadAssets();
  },

  setArtStyle: (artStyle) => set({ artStyle }),
  openGenerator: () => set({ generatorOpen: true }),
  closeGenerator: () => set({ generatorOpen: false }),
  openGallery: () => set({ galleryOpen: true }),
  closeGallery: () => set({ galleryOpen: false }),
}));
