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
  | "zone_map";

/** Mirrors the Rust Settings struct */
export interface Settings {
  deepinfra_api_key: string;
  image_model: string;
  enhance_model: string;
}

export const IMAGE_MODELS = [
  {
    id: "black-forest-labs/FLUX-1-schnell",
    label: "FLUX Schnell",
    description: "Fast, ~$0.0005/image",
    defaultSteps: 4,
  },
  {
    id: "black-forest-labs/FLUX-1-dev",
    label: "FLUX Dev",
    description: "Quality, ~$0.012/image",
    defaultSteps: 28,
    defaultGuidance: 3.5,
  },
] as const;
