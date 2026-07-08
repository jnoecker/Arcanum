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
  display_name: string;
  description: string;
  artist: string;
  lyrics: string;
  duration_seconds: number;
  /** Fingerprint of the entity render context this asset was generated from.
   *  Empty/absent for art rendered before change-detection was introduced. */
  source_hash?: string;
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
  | "racial_ability_icon"
  | "zone_map"
  | "splash_hero"
  | "loading_vignette"
  | "panel_header"
  | "room"
  | "mob"
  | "pet"
  | "item"
  | "gathering_node"
  | "lever_plate"
  | "lever_handle"
  | "door_frame"
  | "door_leaf"
  | "player_sprite"
  | "race_portrait"
  | "class_portrait"
  | "faction_emblem"
  | "lore_character"
  | "lore_location"
  | "lore_organization"
  | "lore_species"
  | "lore_item"
  | "lore_event"
  | "lore_map"
  | "showcase_banner"
  | "showcase_favicon"
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
  elevenlabs_api_key: string;
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
  voyage_api_key?: string;
  openai_image_quality: string;
  openai_image_quality_overrides: Record<string, string>;
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
  openai_image_quality: string;
  openai_image_quality_overrides: Record<string, string>;
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

/** Mirrors the Rust MigrationReport struct */
export interface MigrationReport {
  totalAssets: number;
  affected: number;
  bytesBefore: number;
  bytesAfter: number;
  estimated: boolean;
  referencesUpdated: number;
  cancelled: boolean;
  remaining: number;
  errors: string[];
}

/** Payload of the `asset-migration-progress` event */
export interface MigrationProgress {
  stage: string;
  current: number;
  total: number;
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
    id: "openai:gpt-image@2",
    label: "GPT Image 2",
    description: "OpenAI gpt-image-2, strong prompt fidelity + layout",
    provider: "openai" as const,
    defaultSteps: 1,
  },
  {
    id: "openai:gpt-image@2",
    label: "GPT Image 2 (Runware)",
    description: "gpt-image-2 via Runware, token-priced",
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
 *  Currently always false — native transparency is disabled because v1 of
 *  GPT Image produced degraded output in transparent mode, and v2 dropped
 *  the provider-level `background` field entirely. */
export function modelNativelyTransparent(_provider: string, _modelId?: string): boolean {
  return false;
}

/** Whether to request native transparent background from the image provider.
 *  Disabled: GPT Image v2 removed the provider-level transparency toggle,
 *  and v1 produced degraded output in transparent mode. Client-side
 *  bg-removal handles transparency after generation instead. */
export function requestsTransparentBackground(_assetType?: AssetType | string | null): boolean {
  return false;
}

/** Default image dimensions per entity type.
 *  Sizes match GPT Image 2's three native canvases (1024×1024, 1024×1536,
 *  1536×1024) so nothing gets upscaled or snap-shifted by the provider —
 *  a known cause of "bubble-wrap" texture artifacts at low quality. */
export const ENTITY_DIMENSIONS: Record<string, { width: number; height: number; label: string }> = {
  room: { width: 1536, height: 1024, label: "1536×1024 (Landscape)" },
  mob: { width: 1024, height: 1024, label: "1024×1024 (Portrait)" },
  pet: { width: 1024, height: 1024, label: "1024×1024 (Portrait)" },
  item: { width: 1024, height: 1024, label: "1024×1024 (Icon)" },
  musicBoxKeepsake: { width: 1024, height: 1024, label: "1024×1024 (Icon)" },
  gathering_node: { width: 1024, height: 1024, label: "1024×1024 (Sprite)" },
  lever_plate: { width: 1024, height: 1024, label: "1024×1024 (Sprite)" },
  lever_handle: { width: 1024, height: 1024, label: "1024×1024 (Sprite)" },
  door_frame: { width: 1024, height: 1536, label: "1024×1536 (Portrait)" },
  door_leaf: { width: 1024, height: 1536, label: "1024×1536 (Portrait)" },
  container_bg: { width: 1536, height: 1024, label: "1536×1024 (Landscape)" },
  sign_bg: { width: 1536, height: 1024, label: "1536×1024 (Landscape)" },
  lever_bg: { width: 1024, height: 1536, label: "1024×1536 (Portrait)" },
  puzzle_bg: { width: 1536, height: 1024, label: "1536×1024 (Landscape)" },
  ability: { width: 1024, height: 1024, label: "1024×1024 (Icon)" },
  racial_ability: { width: 1024, height: 1024, label: "1024×1024 (Icon)" },
  shop: { width: 1536, height: 1024, label: "1536×1024 (Landscape)" },
  dungeon: { width: 1536, height: 1024, label: "1536×1024 (Landscape)" },
  dungeonRoom: { width: 1536, height: 1024, label: "1536×1024 (Landscape)" },
  housing_room: { width: 1536, height: 1024, label: "1536×1024 (Landscape)" },
  player_sprite: { width: 1024, height: 1024, label: "1024×1024 (Portrait)" },
  race_portrait: { width: 1536, height: 1024, label: "1536×1024 (Landscape)" },
  class_portrait: { width: 1536, height: 1024, label: "1536×1024 (Landscape)" },
  // Editor generators look up by entity_type ("race" / "class"), not asset type.
  race: { width: 1536, height: 1024, label: "1536×1024 (Landscape)" },
  class: { width: 1536, height: 1024, label: "1536×1024 (Landscape)" },
  lore_character: { width: 1024, height: 1536, label: "1024×1536 (Portrait)" },
  lore_location: { width: 1536, height: 1024, label: "1536×1024 (Landscape)" },
  lore_organization: { width: 1024, height: 1024, label: "1024×1024 (Banner)" },
  lore_species: { width: 1024, height: 1024, label: "1024×1024 (Portrait)" },
  lore_item: { width: 1024, height: 1024, label: "1024×1024 (Icon)" },
  lore_event: { width: 1536, height: 1024, label: "1536×1024 (Scene)" },
  showcase_banner: { width: 1536, height: 1024, label: "1536×1024 (Banner)" },
  showcase_favicon: { width: 1024, height: 1024, label: "1024×1024 (Icon)" },
};

/** Common dimension presets for override dropdown.
 *  All entries match GPT Image 2 native sizes — see ENTITY_DIMENSIONS. */
export const DIMENSION_PRESETS = [
  { width: 1024, height: 1024, label: "1024×1024 (Square)" },
  { width: 1024, height: 1536, label: "1024×1536 (Portrait)" },
  { width: 1536, height: 1024, label: "1536×1024 (Landscape)" },
] as const;
