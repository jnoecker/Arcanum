/** Mirrors the Rust GeneratedImage struct returned by generate_image command */
export interface GeneratedImage {
  id: string;
  hash: string;
  file_path: string;
  data_url: string;
  width: number;
  height: number;
  prompt: string;
  model: string;
}

/** Mirrors the Rust AssetEntry struct */
export interface AssetEntry {
  id: string;
  hash: string;
  prompt: string;
  enhanced_prompt: string;
  model: string;
  asset_type: AssetType;
  context: AssetContext;
  created_at: string;
  file_name: string;
  width: number;
  height: number;
  sync_status: string;
  variant_group: string;
  is_active: boolean;
}

export interface AssetContext {
  zone: string;
  entity_type: string;
  entity_id: string;
}

export type AssetType =
  | "background"
  | "ornament"
  | "status_art"
  | "empty_state"
  | "entity_portrait"
  | "ability_sprite"
  | "ability_icon"
  | "status_effect_icon"
  | "zone_map"
  | "splash_hero"
  | "loading_vignette"
  | "panel_header"
  | "room"
  | "mob"
  | "pet"
  | "item"
  | "gathering_node"
  | "player_sprite"
  | "race_portrait"
  | "class_portrait"
  | "lore_character"
  | "lore_location"
  | "lore_organization"
  | "lore_species"
  | "lore_item"
  | "lore_event"
  | "lore_map"
  | "music"
  | "ambient"
  | "audio"
  | "video";

export type SyncScope = "approved" | "all";

/** Background removal backend. "local" runs Imgly/ONNX in a Web Worker;
 *  "runware" calls Bria RMBG v2.0 via Runware (or the hub proxy). */
export type BgRemovalProvider = "local" | "runware";

/** Mirrors the Rust Settings struct */
export interface Settings {
  deepinfra_api_key: string;
  runware_api_key: string;
  anthropic_api_key: string;
  openrouter_api_key: string;
  openai_api_key: string;
  image_model: string;
  enhance_model: string;
  prompt_llm_provider: string;
  image_provider: string;
  video_model: string;
  batch_concurrency: number;
  auto_enhance_prompts: boolean;
  auto_remove_bg: boolean;
  bg_removal_provider: BgRemovalProvider;
  r2_account_id: string;
  r2_access_key_id: string;
  r2_secret_access_key: string;
  r2_bucket: string;
  r2_custom_domain: string;
  github_pat: string;
  hub_api_url: string;
  hub_api_key: string;
  use_hub_ai: boolean;
}

/** Project-level settings stored in <project_dir>/.arcanum/settings.json */
export interface ProjectSettings {
  image_model: string;
  enhance_model: string;
  prompt_llm_provider: string;
  image_provider: string;
  video_model: string;
  batch_concurrency: number;
  auto_enhance_prompts: boolean;
  auto_remove_bg: boolean;
  bg_removal_provider: BgRemovalProvider;
  r2_account_id: string;
  r2_access_key_id: string;
  r2_secret_access_key: string;
  r2_bucket: string;
  r2_custom_domain: string;
  hub_world_slug: string;
  hub_world_listed: boolean;
  hub_world_display_name: string;
  hub_world_tagline: string;
  autosave_enabled: boolean;
  autosave_interval_minutes: number;
  snapshot_enabled: boolean;
  snapshot_interval_minutes: number;
  snapshot_keep_count: number;
  snapshot_include_assets: boolean;
}

/** Mirrors the Rust HubPublishRequest struct */
export interface HubPublishRequest {
  showcase_json: string;
  slug: string;
  listed: boolean;
  display_name?: string | null;
  tagline?: string | null;
}

/** Mirrors the Rust HubPublishResult struct */
export interface HubPublishResult {
  slug: string;
  url: string;
  images_total: number;
  images_uploaded: number;
  images_reused: number;
  images_failed: number;
  bytes_uploaded: number;
  errors: string[];
}

export interface HubPublishProgress {
  phase: "collecting" | "encoding" | "uploading" | "manifest";
  current: number;
  total: number;
  label: string;
}

/** Mirrors the Rust SyncProgress struct */
export interface SyncProgress {
  total: number;
  uploaded: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export interface ExportResult {
  total: number;
  copied: number;
  skipped: number;
  errors: string[];
}

export const IMAGE_MODELS = [
  {
    id: "black-forest-labs/FLUX-1-schnell",
    label: "FLUX Schnell",
    description: "Fast, ~$0.0005/image",
    provider: "deepinfra" as const,
    defaultSteps: 4,
  },
  {
    id: "black-forest-labs/FLUX-1-dev",
    label: "FLUX Dev",
    description: "Quality, ~$0.012/image",
    provider: "deepinfra" as const,
    defaultSteps: 28,
    defaultGuidance: 3.5,
  },
  {
    id: "runware:100@1",
    label: "FLUX Schnell (Runware)",
    description: "Fast via Runware",
    provider: "runware" as const,
    defaultSteps: 4,
  },
  {
    id: "runware:101@1",
    label: "FLUX Dev (Runware)",
    description: "Quality via Runware",
    provider: "runware" as const,
    defaultSteps: 28,
    defaultGuidance: 3.5,
  },
  {
    id: "runware:400@2",
    label: "FLUX2 (Runware)",
    description: "FLUX2 via Runware",
    provider: "runware" as const,
    defaultSteps: 28,
    defaultGuidance: 3.5,
  },
  {
    id: "openai:4@1",
    label: "GPT Image 1.5",
    description: "OpenAI gpt-image-1, high quality",
    provider: "openai" as const,
    defaultSteps: 1,
  },
  {
    id: "openai:4@1",
    label: "GPT Image 1.5 (Runware)",
    description: "GPT-image-1 via Runware, ~$0.009/image",
    provider: "runware" as const,
    defaultSteps: 1,
  },
] as const;

/** Resolve the Tauri command name for a given image provider. */
/** Resolve the image model: prefer settings.image_model, fall back to first model for the provider. */
export function resolveImageModel(provider: string, configuredModel?: string) {
  const forProvider = IMAGE_MODELS.filter((m) => m.provider === provider);
  if (configuredModel) {
    const match = forProvider.find((m) => m.id === configuredModel);
    if (match) return match;
  }
  return forProvider[0];
}

/** Returns true if the model ID is a FLUX2 model (uses Redux for img2img instead of seedImage). */
export function isFlux2Model(modelId: string): boolean {
  return modelId.startsWith("runware:4");
}

/** FLUX Dev model ID — required as base model for Redux IP-Adapter (FLUX2 doesn't support ipAdapters). */
export const FLUX_DEV_MODEL = "runware:101@1";

export function imageGenerateCommand(provider: string): string {
  switch (provider) {
    case "runware": return "runware_generate_image";
    case "openai": return "openai_generate_image";
    default: return "generate_image";
  }
}

/** Returns true if the model natively generates transparent backgrounds,
 *  meaning client-side BG removal should be skipped to avoid double processing.
 *  Currently always false — native transparency is disabled because GPT Image 1.5
 *  produces degraded output in transparent mode. */
export function modelNativelyTransparent(_provider: string, _modelId?: string): boolean {
  return false;
}

/** Whether to request native transparent background from the image provider.
 *  Disabled: GPT Image 1.5's transparent mode degrades output quality
 *  (doll-like figures, wrong proportions). Client-side bg-removal handles
 *  transparency after generation instead. */
export function requestsTransparentBackground(_assetType?: AssetType | string | null): boolean {
  return false;
}

/** Default image dimensions per entity type */
export const ENTITY_DIMENSIONS: Record<string, { width: number; height: number; label: string }> = {
  room: { width: 1920, height: 1080, label: "1920×1080 (Landscape)" },
  mob: { width: 512, height: 512, label: "512×512 (Portrait)" },
  pet: { width: 512, height: 512, label: "512×512 (Portrait)" },
  item: { width: 256, height: 256, label: "256×256 (Icon)" },
  gathering_node: { width: 512, height: 512, label: "512×512 (Sprite)" },
  ability: { width: 256, height: 256, label: "256×256 (Icon)" },
  shop: { width: 1920, height: 1080, label: "1920×1080 (Landscape)" },
  dungeon: { width: 1920, height: 1080, label: "1920×1080 (Landscape)" },
  dungeonRoom: { width: 1920, height: 1080, label: "1920×1080 (Landscape)" },
  housing_room: { width: 1920, height: 1080, label: "1920×1080 (Landscape)" },
  player_sprite: { width: 512, height: 512, label: "512×512 (Portrait)" },
  race_portrait: { width: 512, height: 768, label: "512×768 (Portrait)" },
  lore_character: { width: 512, height: 768, label: "512×768 (Portrait)" },
  lore_location: { width: 1920, height: 1080, label: "1920×1080 (Landscape)" },
  lore_organization: { width: 512, height: 512, label: "512×512 (Banner)" },
  lore_species: { width: 512, height: 512, label: "512×512 (Portrait)" },
  lore_item: { width: 256, height: 256, label: "256×256 (Icon)" },
  lore_event: { width: 1920, height: 1080, label: "1920×1080 (Scene)" },
};

/** Common dimension presets for override dropdown */
export const DIMENSION_PRESETS = [
  { width: 256, height: 256, label: "256×256" },
  { width: 512, height: 512, label: "512×512" },
  { width: 1024, height: 1024, label: "1024×1024" },
  { width: 1920, height: 1080, label: "1920×1080" },
  { width: 1080, height: 1920, label: "1080×1920" },
] as const;
