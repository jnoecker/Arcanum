import type { FeatureFile, WorldFile } from "@/types/world";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { useImageSrc } from "@/lib/useImageSrc";
import type { ArtStyle } from "@/lib/arcanumPrompts";
import { featureBackgroundContext } from "@/lib/entityPrompts";
import { useConfigStore } from "@/stores/configStore";
import { useVibeStore } from "@/stores/vibeStore";
import type { FeatureType } from "@/lib/zoneEdits";

interface FeatureBackgroundEditorProps {
  world: WorldFile;
  roomId: string;
  featureId: string;
  type: FeatureType;
  feature: FeatureFile;
  onPatch: (p: Partial<FeatureFile>) => void;
}

/** The world-default global asset key each feature type falls back to. */
const GLOBAL_KEY: Record<FeatureType, string> = {
  CONTAINER: "container_bg",
  SIGN: "sign_bg",
  LEVER: "lever_bg",
};

/** Composition guidance per feature type. */
const BACKDROP_FRAMING: Record<FeatureType, string> = {
  CONTAINER:
    "Wide landscape backdrop, the open interior cavity occupying the lower ~55% as a clear flat area for an items list to overlay on top, no items inside, no readable text.",
  SIGN:
    "Wide landscape backdrop with a clean flat central writable area for sign text to overlay, decorative frame around the edges, blank face, no readable text, no letters.",
  LEVER:
    "Portrait backdrop box with an open uncluttered center where the lever mechanism mounts on top, ornate framing around the edges, no lever, no handle, no readable text.",
};

/**
 * Appearance editor for a feature's optional full-card background. Works on
 * every feature type — the container's contents, the sign's text, or the
 * lever's plate+handle render on top of it in the web client. Falls back to
 * the world-default `<type>_bg` global asset, then a CSS panel, when unset.
 */
export function FeatureBackgroundEditor({
  world,
  roomId,
  featureId,
  type,
  feature,
  onPatch,
}: FeatureBackgroundEditorProps) {
  const globalAssets = useConfigStore((s) => s.config?.globalAssets);
  const vibe = useVibeStore((s) => s.getVibe(world.zone));
  const globalKey = GLOBAL_KEY[type];
  const resolved = feature.backgroundImage || globalAssets?.[globalKey] || undefined;
  const usingDefault = !feature.backgroundImage && !!resolved;
  const previewSrc = useImageSrc(resolved);

  const framing = BACKDROP_FRAMING[type];
  const entityKey = globalKey; // drives generation dimensions (landscape/portrait)

  return (
    <details className="mt-1 rounded border border-border-muted bg-bg-secondary/40">
      <summary className="cursor-pointer select-none px-2 py-1.5 font-display text-2xs uppercase tracking-widest text-accent">
        Background appearance
      </summary>
      <div className="flex flex-col gap-3 p-2">
        <div className="flex flex-col items-center gap-1.5">
          <div
            className={[
              "relative w-full overflow-hidden rounded-lg border border-border-muted bg-bg-tertiary/50",
              type === "LEVER" ? "aspect-[2/3] max-w-[10rem]" : "aspect-[3/2]",
            ].join(" ")}
            aria-label="Feature background preview"
          >
            {previewSrc ? (
              <img
                src={previewSrc}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center px-2 text-center text-2xs italic text-text-muted">
                No background art — generate below, set a world default in Global Assets, or leave blank for the CSS fallback
              </div>
            )}
          </div>
          {usingDefault && (
            <span className="text-center text-2xs italic text-text-muted">
              Using world default ({globalKey})
            </span>
          )}
        </div>

        <EntityArtGenerator
          assetType="background"
          surface="worldbuilding"
          currentImage={feature.backgroundImage}
          onAccept={(fileName) => onPatch({ backgroundImage: fileName })}
          getPrompt={(_style: ArtStyle) => framing}
          entityContext={featureBackgroundContext(world, roomId, type, feature, vibe)}
          framingHint={framing}
          context={{
            zone: world.zone,
            entity_type: entityKey,
            entity_id: `${roomId}:${featureId}`,
          }}
        />
      </div>
    </details>
  );
}
