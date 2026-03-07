import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { AssetEntry, GeneratedImage, Settings, SyncProgress } from "@/types/assets";
import type { ArtStyle } from "@/lib/arcanumPrompts";

interface AssetState {
  assets: AssetEntry[];
  assetsDir: string;
  settings: Settings | null;
  generatorOpen: boolean;
  galleryOpen: boolean;
  artStyle: ArtStyle;
  syncing: boolean;
  lastSyncResult: SyncProgress | null;

  loadSettings: () => Promise<void>;
  saveSettings: (settings: Settings) => Promise<void>;

  loadAssets: () => Promise<void>;
  acceptAsset: (image: GeneratedImage, assetType: string, enhancedPrompt?: string) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;

  syncToR2: () => Promise<SyncProgress>;
  getSyncStatus: () => Promise<SyncProgress>;

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
  syncing: false,
  lastSyncResult: null,

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
    // Delete from R2 first (best-effort — no-ops if R2 not configured)
    const asset = get().assets.find((a) => a.id === id);
    if (asset?.sync_status === "synced") {
      await invoke("delete_from_r2", { fileName: asset.file_name }).catch(() => {});
    }
    await invoke("delete_asset", { id });
    await get().loadAssets();
  },

  syncToR2: async () => {
    set({ syncing: true });
    try {
      const result = await invoke<SyncProgress>("sync_assets");
      set({ lastSyncResult: result, syncing: false });
      await get().loadAssets(); // refresh sync_status
      return result;
    } catch (e) {
      const err: SyncProgress = { total: 0, uploaded: 0, skipped: 0, failed: 0, errors: [String(e)] };
      set({ lastSyncResult: err, syncing: false });
      return err;
    }
  },

  getSyncStatus: async () => {
    const result = await invoke<SyncProgress>("get_sync_status");
    return result;
  },

  setArtStyle: (artStyle) => set({ artStyle }),
  openGenerator: () => set({ generatorOpen: true }),
  closeGenerator: () => set({ generatorOpen: false }),
  openGallery: () => set({ galleryOpen: true }),
  closeGallery: () => set({ galleryOpen: false }),
}));
