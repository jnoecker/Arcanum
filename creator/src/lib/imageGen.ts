import { invoke } from "@tauri-apps/api/core";
import type { AssetType, GeneratedImage } from "@/types/assets";
import { IMAGE_MODELS, imageGenerateCommand, requestsTransparentBackground } from "@/types/assets";
import { UNIVERSAL_NEGATIVE } from "@/lib/arcanumPrompts";

export type ImageModel = (typeof IMAGE_MODELS)[number];

export interface GenerateAssetImageArgs {
  provider: string;
  /** Either the resolved ImageModel (steps/guidance auto-filled) or the raw model id string. */
  model: ImageModel | string;
  prompt: string;
  width: number;
  height: number;
  assetType: AssetType | string | undefined;
  /** Override step count. Defaults to model.defaultSteps or 4. */
  steps?: number | null;
  /** Override CFG guidance. Defaults to model.defaultGuidance (if present) else null. */
  guidance?: number | null;
  autoEnhance?: boolean;
  negativePrompt?: string;
}

function resolveModelId(model: ImageModel | string): string {
  return typeof model === "string" ? model : model.id;
}

function resolveSteps(model: ImageModel | string, override?: number | null): number | null {
  if (override !== undefined) return override;
  if (typeof model === "string") return 4;
  return model.defaultSteps ?? 4;
}

function resolveGuidance(model: ImageModel | string, override?: number | null): number | null {
  if (override !== undefined) return override;
  if (typeof model === "string") return null;
  return "defaultGuidance" in model ? model.defaultGuidance : null;
}

/**
 * Dispatch a single image generation through the correct Tauri command for the
 * configured provider. Centralizes negative-prompt defaults, guidance/step
 * lookup, and transparent-background probing so callsites only supply what
 * actually varies.
 */
export async function generateAssetImage(args: GenerateAssetImageArgs): Promise<GeneratedImage> {
  return invoke<GeneratedImage>(imageGenerateCommand(args.provider), {
    prompt: args.prompt,
    negativePrompt: args.negativePrompt ?? UNIVERSAL_NEGATIVE,
    model: resolveModelId(args.model),
    width: args.width,
    height: args.height,
    steps: resolveSteps(args.model, args.steps),
    guidance: resolveGuidance(args.model, args.guidance),
    assetType: args.assetType,
    autoEnhance: args.autoEnhance ?? false,
    transparentBackground: args.provider === "openai" && requestsTransparentBackground(args.assetType),
  });
}

/**
 * Same as generateAssetImage but retries once after a short pause on failure.
 * Matches the pattern used by the primary entity art generator.
 */
export async function generateAssetImageWithRetry(args: GenerateAssetImageArgs): Promise<GeneratedImage> {
  try {
    return await generateAssetImage(args);
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
    return generateAssetImage(args);
  }
}
