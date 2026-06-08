import { useState } from "react";
import type { FeatureFile, WorldFile } from "@/types/world";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { useImageSrc } from "@/lib/useImageSrc";
import { composePrompt, getFormatForAssetType, type ArtStyle } from "@/lib/arcanumPrompts";
import { useConfigStore } from "@/stores/configStore";

/** Layered-lever defaults — the renderer (and the MUD web client) fall back to
 *  these when a feature omits the field. The handle sprite rotates around
 *  `pivot` between `upAngle` (ready) and `downAngle` (pulled). */
export const LEVER_ART_DEFAULTS = {
  pivot: { x: 0.5, y: 0.85 },
  upAngle: -28,
  downAngle: 28,
} as const;

interface LeverArtEditorProps {
  world: WorldFile;
  roomId: string;
  featureId: string;
  feature: FeatureFile;
  onPatch: (p: Partial<FeatureFile>) => void;
}

type EditTarget = "handle" | "plate";

/**
 * Appearance editor for LEVER features. A lever is rendered as a static base
 * plate with a handle sprite rotated around a pivot — the same two-layer model
 * the MUD web client consumes. This panel generates each sprite, lets the
 * author tune the pivot + swing angles, and previews the motion live.
 */
export function LeverArtEditor({ world, roomId, featureId, feature, onPatch }: LeverArtEditorProps) {
  const [target, setTarget] = useState<EditTarget>("handle");
  const [previewDown, setPreviewDown] = useState(false);

  const pivot = feature.leverPivot ?? LEVER_ART_DEFAULTS.pivot;
  const upAngle = feature.upAngle ?? LEVER_ART_DEFAULTS.upAngle;
  const downAngle = feature.downAngle ?? LEVER_ART_DEFAULTS.downAngle;

  // Fall back to the world-default lever sprites (Global Assets) when this
  // lever doesn't define its own — matches how the MUD renders it.
  const globalAssets = useConfigStore((s) => s.config?.globalAssets);
  const resolvedPlate = feature.plateImage || globalAssets?.lever_plate || undefined;
  const resolvedHandle = feature.handleImage || globalAssets?.lever_handle || undefined;
  const usingDefault = !feature.handleImage && !!resolvedHandle;

  const plateSrc = useImageSrc(resolvedPlate);
  const handleSrc = useImageSrc(resolvedHandle);
  const angle = previewDown ? downAngle : upAngle;

  const setPivot = (axis: "x" | "y", value: number) =>
    onPatch({ leverPivot: { ...pivot, [axis]: value } });

  const assetType = target === "handle" ? "lever_handle" : "lever_plate";
  const field = target === "handle" ? "handleImage" : "plateImage";
  const label = feature.displayName || "lever";

  return (
    <details className="mt-1 rounded border border-border-muted bg-bg-secondary/40">
      <summary className="cursor-pointer select-none px-2 py-1.5 font-display text-2xs uppercase tracking-widest text-accent">
        Lever appearance
      </summary>
      <div className="flex flex-col gap-3 p-2">
        <div className="flex gap-3">
          {/* Live preview */}
          <div className="flex flex-col items-center gap-1.5">
            <div
              className="relative h-44 w-36 overflow-hidden rounded-lg border border-border-muted bg-bg-tertiary/50"
              aria-label="Lever preview"
            >
              {plateSrc && (
                <img
                  src={plateSrc}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                />
              )}
              {handleSrc ? (
                <img
                  src={handleSrc}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                  style={{
                    transformOrigin: `${pivot.x * 100}% ${pivot.y * 100}%`,
                    transform: `translate(${(0.5 - pivot.x) * 100}%, ${(0.5 - pivot.y) * 100}%) rotate(${angle}deg)`,
                    transition: "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center px-2 text-center text-2xs italic text-text-muted">
                  No handle art yet — generate below or set a world default in Global Assets
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPreviewDown((d) => !d)}
              className="focus-ring rounded bg-bg-elevated px-2 py-1 text-2xs text-text-secondary hover:text-text-primary"
            >
              {previewDown ? "Showing: Pulled ▾" : "Showing: Ready ▴"}
            </button>
            {usingDefault && (
              <span className="text-center text-2xs italic text-text-muted">
                Using world default
              </span>
            )}
          </div>

          {/* Tuning */}
          <div className="flex flex-1 flex-col gap-2">
            <AngleSlider
              label="Up angle (ready)"
              value={upAngle}
              min={-90}
              max={20}
              onChange={(v) => onPatch({ upAngle: v })}
            />
            <AngleSlider
              label="Down angle (pulled)"
              value={downAngle}
              min={-20}
              max={90}
              onChange={(v) => onPatch({ downAngle: v })}
            />
            <AngleSlider
              label="Pivot X"
              value={pivot.x}
              min={0}
              max={1}
              step={0.01}
              format={(v) => v.toFixed(2)}
              onChange={(v) => setPivot("x", v)}
            />
            <AngleSlider
              label="Pivot Y"
              value={pivot.y}
              min={0}
              max={1}
              step={0.01}
              format={(v) => v.toFixed(2)}
              onChange={(v) => setPivot("y", v)}
            />
            <button
              type="button"
              onClick={() =>
                onPatch({
                  leverPivot: { ...LEVER_ART_DEFAULTS.pivot },
                  upAngle: LEVER_ART_DEFAULTS.upAngle,
                  downAngle: LEVER_ART_DEFAULTS.downAngle,
                })
              }
              className="focus-ring self-start rounded px-1 text-2xs text-text-muted hover:text-text-primary"
            >
              ↺ Reset pivot &amp; angles
            </button>
          </div>
        </div>

        {/* Sprite generators */}
        <div className="flex gap-1">
          {(["handle", "plate"] as EditTarget[]).map((t) => (
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
              {t === "handle" ? "Handle sprite" : "Plate sprite"}
            </button>
          ))}
        </div>

        <EntityArtGenerator
          key={target}
          assetType={assetType}
          surface="worldbuilding"
          currentImage={feature[field]}
          onAccept={(fileName) => onPatch({ [field]: fileName })}
          getPrompt={(style: ArtStyle) => composePrompt(assetType, style, label)}
          entityContext={`A ${label} — the ${target} sprite for a layered pull-lever puzzle device. ${
            target === "handle"
              ? "Just the handle arm in a neutral upright pose, no mounting plate."
              : "Just the mounting plate with a central pivot socket, no handle arm."
          }`}
          framingHint={getFormatForAssetType(assetType)}
          context={{
            zone: world.zone,
            entity_type: assetType,
            entity_id: `${roomId}:${featureId}`,
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
