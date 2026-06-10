import { useCallback } from "react";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { getFormatForAssetType, type ArtStyle } from "@/lib/arcanumPrompts";
import {
  spriteBasePrompt,
  spriteContext,
  resolveSpriteDimensions,
  spritePromptNotes,
} from "@/lib/spritePromptGen";
import type { AssetContext } from "@/types/assets";
import type { SpriteDefinition } from "@/types/sprites";

interface SpriteArtGeneratorProps {
  /** Sprite definition key — also the asset variant-group key. */
  id: string;
  def: SpriteDefinition;
  /** Currently-associated asset file name, if any. */
  currentImage?: string;
}

/**
 * The full art studio (prompt editing, enhance, conjure, pick/sketch/gallery,
 * variant rerolls) wired for a single player sprite. Reuses the standard
 * sprite prompt pipeline (`spriteBasePrompt` fallback + `spriteContext` for the
 * LLM enhancer) and pins the asset variant group to `player_sprite:<id>` so the
 * R2 deploy can resolve the canonical `player_sprites/<id>.png` path.
 */
export function SpriteArtGenerator({ id, def, currentImage }: SpriteArtGeneratorProps) {
  const getPrompt = useCallback(
    (style: ArtStyle) => spriteBasePrompt(resolveSpriteDimensions(def), style, spritePromptNotes(def)),
    [def],
  );

  const context: AssetContext = { zone: "sprites", entity_type: "player_sprite", entity_id: id };

  return (
    <EntityArtGenerator
      getPrompt={getPrompt}
      entityContext={spriteContext(def.displayName, resolveSpriteDimensions(def), spritePromptNotes(def))}
      framingHint={getFormatForAssetType("player_sprite")}
      currentImage={currentImage}
      onAccept={() => {}}
      assetType="player_sprite"
      context={context}
      variantGroupOverride={`player_sprite:${id}`}
      surface="worldbuilding"
    />
  );
}
