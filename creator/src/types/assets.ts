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
  r2_account_id: string;
  r2_access_key_id: string;
  r2_secret_access_key: string;
  r2_bucket: string;
  r2_custom_domain: string;
  github_pat: string;
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
  r2_account_id: string;
  r2_access_key_id: string;
  r2_secret_access_key: string;
  r2_bucket: string;
  r2_custom_domain: string;
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

/** Asset types that benefit from provider-native transparent backgrounds. */
export function requestsTransparentBackground(assetType?: AssetType | string | null): boolean {
  switch (assetType) {
    case "player_sprite":
    case "ability_icon":
    case "status_effect_icon":
    case "ability_sprite":
      return true;
    default:
      return false;
  }
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
