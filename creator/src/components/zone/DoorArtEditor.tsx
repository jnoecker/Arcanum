import { useState } from "react";
import type { DoorFile, WorldFile } from "@/types/world";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { useImageSrc } from "@/lib/useImageSrc";
import { composePrompt, getFormatForAssetType, type ArtStyle } from "@/lib/arcanumPrompts";
import { useConfigStore } from "@/stores/configStore";

/** Layered-door defaults — the renderer (and the MUD web client) fall back to
 *  these when a door omits the field. The leaf sprite swings on its `hinge`
 *  edge between closed (0°) and `openAngle`. */
export const DOOR_ART_DEFAULTS = {
  hinge: "left" as const,
  openAngle: 100,
  leafScale: 0.72,
  leafOffsetY: 0.04,
};

interface DoorArtEditorProps {
  world: WorldFile;
  roomId: string;
  direction: string;
  door: DoorFile;
  onPatch: (p: Partial<DoorFile>) => void;
}

type EditTarget = "leaf" | "frame";

/**
 * Appearance editor for an exit's door. A door is rendered as a static frame
 * with a leaf sprite that swings around its hinge edge — the same two-layer
 * model the MUD web client consumes (the "Warded Threshold"). This panel
 * generates each sprite, lets the author pick the hinge side + open angle, and
 * previews the swing live. The locked-state ward seal is a world-wide global
 * asset (`door_lock`), not per-door.
 */
export function DoorArtEditor({ world, roomId, direction, door, onPatch }: DoorArtEditorProps) {
  const [target, setTarget] = useState<EditTarget>("leaf");
  const [previewOpen, setPreviewOpen] = useState(false);

  const hinge = door.hinge ?? DOOR_ART_DEFAULTS.hinge;
  const openAngle = door.openAngle ?? DOOR_ART_DEFAULTS.openAngle;
  const leafScale = door.leafScale ?? DOOR_ART_DEFAULTS.leafScale;
  const leafOffsetY = door.leafOffsetY ?? DOOR_ART_DEFAULTS.leafOffsetY;

  // Fall back to the world-default door sprites (Global Assets) when this door
  // doesn't define its own — matches how the MUD renders it.
  const globalAssets = useConfigStore((s) => s.config?.globalAssets);
  const resolvedFrame = door.frameImage || globalAssets?.door_frame || undefined;
  const resolvedLeaf = door.leafImage || globalAssets?.door_leaf || undefined;
  const usingDefault = !door.leafImage && !!resolvedLeaf;

  const frameSrc = useImageSrc(resolvedFrame);
  const leafSrc = useImageSrc(resolvedLeaf);

  const angle = previewOpen ? (hinge === "left" ? -openAngle : openAngle) : 0;

  const assetType = target === "leaf" ? "door_leaf" : "door_frame";
  const field = target === "leaf" ? "leafImage" : "frameImage";
  const label = `${direction} door`;

  return (
    <details className="mt-1 rounded border border-border-muted bg-bg-secondary/40">
      <summary className="cursor-pointer select-none px-2 py-1.5 font-display text-2xs uppercase tracking-widest text-accent">
        Door appearance
      </summary>
      <div className="flex flex-col gap-3 p-2">
        <div className="flex gap-3">
          {/* Live preview */}
          <div className="flex flex-col items-center gap-1.5">
            <div
              className="relative h-44 w-32 overflow-hidden rounded-lg border border-border-muted bg-bg-tertiary/50"
              style={{ perspective: "600px" }}
              aria-label="Door preview"
            >
              {/* Frame drawn first so it sits behind the leaf — the door opens
                  toward the viewer, so the swinging leaf passes in front. */}
              {frameSrc && (
                <img
                  src={frameSrc}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                />
              )}
              {leafSrc ? (
                <div
                  className="pointer-events-none absolute"
                  style={{
                    left: "50%",
                    top: "50%",
                    width: `${leafScale * 100}%`,
                    height: `${leafScale * 100}%`,
                    transform: `translate(-50%, calc(-50% + ${leafOffsetY * 100}%))`,
                  }}
                >
                  <img
                    src={leafSrc}
                    alt=""
                    className="h-full w-full object-contain"
                    style={{
                      transformOrigin: hinge === "left" ? "left center" : "right center",
                      transform: `rotateY(${angle}deg)`,
                      transition: "transform 0.5s cubic-bezier(0.34, 1.2, 0.64, 1)",
                    }}
                  />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center px-2 text-center text-2xs italic text-text-muted">
                  No leaf art yet — generate below or set a world default in Global Assets
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPreviewOpen((o) => !o)}
              className="focus-ring rounded bg-bg-elevated px-2 py-1 text-2xs text-text-secondary hover:text-text-primary"
            >
              {previewOpen ? "Showing: Open ▸" : "Showing: Closed ▪"}
            </button>
            {usingDefault && (
              <span className="text-center text-2xs italic text-text-muted">
                Using world default
              </span>
            )}
          </div>

          {/* Tuning */}
          <div className="flex flex-1 flex-col gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-2xs text-text-muted">Hinge side</span>
              <div className="flex gap-1">
                {(["left", "right"] as const).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => onPatch({ hinge: h === DOOR_ART_DEFAULTS.hinge ? undefined : h })}
                    className={[
                      "focus-ring flex-1 rounded px-2 py-1 text-2xs font-display uppercase tracking-wider transition",
                      hinge === h
                        ? "bg-accent/20 text-accent"
                        : "text-text-muted hover:text-text-primary",
                    ].join(" ")}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </label>
            <AngleSlider
              label="Open angle"
              value={openAngle}
              min={30}
              max={160}
              onChange={(v) => onPatch({ openAngle: v })}
            />
            <AngleSlider
              label="Leaf size"
              value={leafScale}
              min={0.4}
              max={1}
              step={0.02}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => onPatch({ leafScale: v })}
            />
            <AngleSlider
              label="Leaf offset Y"
              value={leafOffsetY}
              min={-0.2}
              max={0.2}
              step={0.01}
              format={(v) => v.toFixed(2)}
              onChange={(v) => onPatch({ leafOffsetY: v })}
            />
            <button
              type="button"
              onClick={() =>
                onPatch({
                  hinge: undefined,
                  openAngle: undefined,
                  leafScale: undefined,
                  leafOffsetY: undefined,
                })
              }
              className="focus-ring self-start rounded px-1 text-2xs text-text-muted hover:text-text-primary"
            >
              ↺ Reset hinge, angle &amp; fit
            </button>
            <p className="text-2xs leading-snug text-text-muted">
              The locked-state ward seal is a world asset — set{" "}
              <span className="font-mono">door_lock</span> in Global Assets.
            </p>
          </div>
        </div>

        {/* Sprite generators */}
        <div className="flex gap-1">
          {(["leaf", "frame"] as EditTarget[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTarget(t)}
              className={[
                "focus-ring rounded px-2 py-1 text-2xs font-display uppercase tracking-wider transition",
                target === t
                  ? "bg-accent/20 text-accent"
                  : "text-text-muted hover:text-text-primary",
              ].join(" ")}
            >
              {t === "leaf" ? "Leaf sprite" : "Frame sprite"}
            </button>
          ))}
        </div>

        <EntityArtGenerator
          key={target}
          assetType={assetType}
          surface="worldbuilding"
          currentImage={door[field]}
          onAccept={(fileName) => onPatch({ [field]: fileName })}
          getPrompt={(style: ArtStyle) => composePrompt(assetType, style, label)}
          entityContext={`A ${label} — the ${target} sprite for a layered swinging door. ${
            target === "leaf"
              ? "Just the closed door panel, no surrounding frame."
              : "Just the empty doorway frame, the opening hollow, no door panel inside."
          }`}
          framingHint={getFormatForAssetType(assetType)}
          context={{
            zone: world.zone,
            entity_type: assetType,
            entity_id: `${roomId}:${direction}`,
          }}
        />
      </div>
    </details>
  );
}

interface AngleSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}

function AngleSlider({ label, value, min, max, step = 1, format, onChange }: AngleSliderProps) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="flex items-center justify-between text-2xs text-text-muted">
        <span>{label}</span>
        <span className="font-mono text-text-secondary">{format ? format(value) : `${value}°`}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-accent"
      />
    </label>
  );
}
