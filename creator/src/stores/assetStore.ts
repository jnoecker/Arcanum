import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { AssetContext, AssetEntry, GeneratedImage, ProjectSettings, Settings, SyncProgress, SyncScope } from "@/types/assets";
import type { ArtStyle } from "@/lib/arcanumPrompts";
import { useProjectStore } from "@/stores/projectStore";

interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  errors: string[];
}

interface AssetState {
  assets: AssetEntry[];
  assetsDir: string;
  settings: Settings | null;
  projectSettings: ProjectSettings | null;
  generatorOpen: boolean;
  galleryOpen: boolean;
  artStyle: ArtStyle;
  syncing: boolean;
  lastSyncResult: SyncProgress | null;
  batchProgress: BatchProgress | null;

  loadSettings: () => Promise<void>;
  saveSettings: (settings: Settings) => Promise<void>;
  loadProjectSettings: (projectDir: string) => Promise<void>;
  saveProjectSettings: (projectDir: string, settings: ProjectSettings) => Promise<void>;

  loadAssets: () => Promise<void>;
  acceptAsset: (image: GeneratedImage, assetType: string, enhancedPrompt?: string, context?: AssetContext, variantGroup?: string, isActive?: boolean) => Promise<void>;
  importAsset: (
    sourcePath: string,
    assetType: string,
    context?: AssetContext,
    variantGroup?: string,
    isActive?: boolean,
  ) => Promise<AssetEntry>;
  deleteAsset: (id: string) => Promise<void>;

  setActiveVariant: (variantGroup: string, assetId: string) => Promise<void>;
  listVariants: (variantGroup: string) => Promise<AssetEntry[]>;

  syncToR2: (scope?: SyncScope) => Promise<SyncProgress>;
  getSyncStatus: () => Promise<SyncProgress>;

  startBatch: (progress: BatchProgress) => void;
  updateBatch: (update: Partial<BatchProgress>) => void;
  abortBatch: () => void;
  clearBatch: () => void;

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
  projectSettings: null,
  generatorOpen: false,
  galleryOpen: false,
  artStyle: "gentle_magic" as ArtStyle,
  syncing: false,
  lastSyncResult: null,
  batchProgress: null,

  loadSettings: async () => {
    const projectDir = useProjectStore.getState().project?.mudDir;
    const settings = projectDir
      ? await invoke<Settings>("get_merged_settings", { projectDir })
      : await invoke<Settings>("get_settings");
    const assetsDir = await invoke<string>("get_assets_dir");
    // Also load project settings separately for the settings UI
    let projectSettings: ProjectSettings | null = null;
    if (projectDir) {
      projectSettings = await invoke<ProjectSettings | null>("get_project_settings", { projectDir });
      if (!projectSettings) {
        const userSettings = await invoke<Settings>("get_settings");
        projectSettings = await invoke<ProjectSettings>("seed_project_settings", { projectDir, userSettings });
      }
    }
    set({ settings, assetsDir, projectSettings });
  },

  saveSettings: async (settings: Settings) => {
    await invoke("save_settings", { settings });
    set({ settings });
  },

  loadProjectSettings: async (projectDir: string) => {
    const ps = await invoke<ProjectSettings | null>("get_project_settings", { projectDir });
    set({ projectSettings: ps });
  },

  saveProjectSettings: async (projectDir: string, settings: ProjectSettings) => {
    await invoke("save_project_settings", { projectDir, settings });
    set({ projectSettings: settings });
    // Reload merged settings so the effective settings update
    await get().loadSettings();
  },

  loadAssets: async () => {
    const assets = await invoke<AssetEntry[]>("list_assets");
    set({ assets });
  },

  acceptAsset: async (image, assetType, enhancedPrompt, context, variantGroup, isActive) => {
    const fileName = image.file_path.split(/[\\/]/).pop() ?? image.hash;

    await invoke<AssetEntry>("accept_asset", {
      id: image.id,
      hash: image.hash,
      prompt: image.prompt,
      enhancedPrompt: enhancedPrompt ?? null,
      model: image.model,
      assetType,
      context: context ?? null,
      fileName,
      width: image.width,
      height: image.height,
      variantGroup: variantGroup ?? null,
      isActive: isActive ?? null,
    });
    await get().loadAssets();
  },

  importAsset: async (sourcePath, assetType, context, variantGroup, isActive) => {
    const entry = await invoke<AssetEntry>("import_asset", {
      sourcePath,
      assetType,
      context: context ?? null,
      variantGroup: variantGroup ?? null,
      isActive: isActive ?? null,
    });
    await get().loadAssets();
    return entry;
  },

  deleteAsset: async (id: string) => {
    const asset = get().assets.find((a) => a.id === id);
    if (asset?.sync_status === "synced") {
      await invoke("delete_from_r2", { fileName: asset.file_name }).catch(() => {});
    }
    await invoke("delete_asset", { id });
    await get().loadAssets();
  },

  setActiveVariant: async (variantGroup, assetId) => {
    await invoke("set_active_variant", { variantGroup, assetId });
    await get().loadAssets();
  },

  listVariants: async (variantGroup) => {
    return invoke<AssetEntry[]>("list_variants", { variantGroup });
  },

  syncToR2: async (scope = "approved") => {
    set({ syncing: true });
    try {
      const result = await invoke<SyncProgress>("sync_assets", { scope });
      set({ lastSyncResult: result, syncing: false });
      await get().loadAssets();
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

  startBatch: (progress) => {
    set({ batchProgress: progress });
  },

  updateBatch: (update) => {
    const current = get().batchProgress;
    if (current) {
      set({ batchProgress: { ...current, ...update } });
    }
  },

  abortBatch: () => {
    set({ batchProgress: null });
  },

  clearBatch: () => {
    set({ batchProgress: null });
  },

  setArtStyle: (artStyle) => set({ artStyle }),
  openGenerator: () => set({ generatorOpen: true }),
  closeGenerator: () => set({ generatorOpen: false }),
  openGallery: () => set({ galleryOpen: true }),
  closeGallery: () => set({ galleryOpen: false }),
}));
