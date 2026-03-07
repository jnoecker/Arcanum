import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { WorldFile } from "@/types/world";
import { entityPrompt, roomPrompt } from "@/lib/entityPrompts";
import { ART_STYLE_LABELS, type ArtStyle } from "@/lib/arcanumPrompts";
import { useAssetStore } from "@/stores/assetStore";
import type { GeneratedImage } from "@/types/assets";
import { IMAGE_MODELS } from "@/types/assets";

function assetTypeForKind(kind: string): string {
  if (kind === "room") return "background";
  if (kind === "mob") return "entity_portrait";
  if (kind === "item") return "entity_portrait";
  if (kind === "shop") return "background";
  return "background";
}

interface BatchTarget {
  kind: string;
  id: string;
  label: string;
  status: "pending" | "generating" | "done" | "error";
  result?: GeneratedImage;
  error?: string;
}

interface BatchArtGeneratorProps {
  zoneId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
  onClose: () => void;
}

function collectTargets(world: WorldFile): BatchTarget[] {
  const targets: BatchTarget[] = [];

  // Rooms without images
  for (const [id, room] of Object.entries(world.rooms)) {
    if (!room.image) {
      targets.push({
        kind: "room",
        id,
        label: `Room: ${room.title}`,
        status: "pending",
      });
    }
  }

  // Mobs without images
  for (const [id, mob] of Object.entries(world.mobs ?? {})) {
    if (!mob.image) {
      targets.push({
        kind: "mob",
        id,
        label: `Mob: ${mob.name}`,
        status: "pending",
      });
    }
  }

  // Items without images
  for (const [id, item] of Object.entries(world.items ?? {})) {
    if (!item.image) {
      targets.push({
        kind: "item",
        id,
        label: `Item: ${item.displayName}`,
        status: "pending",
      });
    }
  }

  // Shops without images
  for (const [id, shop] of Object.entries(world.shops ?? {})) {
    if (!shop.image) {
      targets.push({
        kind: "shop",
        id,
        label: `Shop: ${shop.name}`,
        status: "pending",
      });
    }
  }

  return targets;
}

/** Get the prompt for a target using current world data and art style. */
function getTargetPrompt(target: BatchTarget, world: WorldFile, style: ArtStyle): string {
  const { kind, id } = target;
  if (kind === "room") {
    return roomPrompt(id, world.rooms[id]!, style);
  }
  const collection = kind === "mob" ? "mobs" : kind === "item" ? "items" : "shops";
  const entity = (world as unknown as Record<string, Record<string, unknown> | undefined>)[collection]?.[id];
  return entityPrompt(kind, id, entity, style);
}

export function BatchArtGenerator({
  zoneId,
  world,
  onWorldChange,
  onClose,
}: BatchArtGeneratorProps) {
  const artStyle = useAssetStore((s) => s.artStyle);
  const setArtStyle = useAssetStore((s) => s.setArtStyle);
  const [targets, setTargets] = useState(() => collectTargets(world));
  const [running, setRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const doneCount = targets.filter((t) => t.status === "done").length;
  const errorCount = targets.filter((t) => t.status === "error").length;

  const acceptAsset = useAssetStore((s) => s.acceptAsset);

  const handleRun = useCallback(async () => {
    setRunning(true);
    const model = IMAGE_MODELS[0]; // FLUX Schnell for batch
    let updatedWorld = { ...world };

    for (let i = 0; i < targets.length; i++) {
      setCurrentIndex(i);
      setTargets((prev) =>
        prev.map((t, j) => (j === i ? { ...t, status: "generating" } : t)),
      );

      try {
        const target = targets[i];
        if (!target) continue;
        const prompt = getTargetPrompt(target, updatedWorld, artStyle);
        const image = await invoke<GeneratedImage>("generate_image", {
          prompt,
          model: model.id,
          width: 1024,
          height: 1024,
          steps: model.defaultSteps,
          guidance: null,
        });

        setTargets((prev) =>
          prev.map((t, j) =>
            j === i ? { ...t, status: "done", result: image } : t,
          ),
        );

        // Save to asset manifest with context
        await acceptAsset(image, assetTypeForKind(target.kind), undefined, {
          zone: zoneId,
          entity_type: target.kind,
          entity_id: target.id,
        }).catch(() => {}); // best-effort

        // Update world with image path
        const { kind, id } = target;
        if (kind === "room") {
          updatedWorld = {
            ...updatedWorld,
            rooms: {
              ...updatedWorld.rooms,
              [id]: { ...updatedWorld.rooms[id]!, image: image.file_path },
            },
          };
        } else {
          const collection = kind === "mob" ? "mobs" : kind === "item" ? "items" : "shops";
          const entities = (updatedWorld as Record<string, unknown>)[collection] as Record<string, Record<string, unknown>> | undefined;
          if (entities?.[id]) {
            (updatedWorld as Record<string, unknown>)[collection] = {
              ...entities,
              [id]: { ...entities[id], image: image.file_path },
            };
          }
        }
      } catch (e) {
        setTargets((prev) =>
          prev.map((t, j) =>
            j === i ? { ...t, status: "error", error: String(e) } : t,
          ),
        );
      }
    }

    onWorldChange(updatedWorld);
    setRunning(false);
  }, [targets, world, onWorldChange, artStyle]);

  if (targets.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="mx-4 w-96 rounded-lg border border-border-default bg-bg-secondary shadow-xl">
          <div className="border-b border-border-default px-5 py-3">
            <h2 className="font-display text-sm tracking-wide text-text-primary">
              Batch Art Generation
            </h2>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm text-text-secondary">
              All entities in this zone already have images.
            </p>
          </div>
          <div className="flex justify-end border-t border-border-default px-5 py-3">
            <button
              onClick={onClose}
              className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border border-border-default bg-bg-secondary shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-5 py-3">
          <h2 className="font-display text-sm tracking-wide text-text-primary">
            Batch Art — {zoneId}
          </h2>
          <span className="text-xs text-text-muted">
            {targets.length} entities without art
          </span>
        </div>

        {/* Style selector */}
        {!running && doneCount === 0 && (
          <div className="border-b border-border-default px-5 py-2">
            <div className="flex gap-1 rounded bg-bg-primary p-0.5">
              {(Object.entries(ART_STYLE_LABELS) as [ArtStyle, string][]).map(
                ([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setArtStyle(key)}
                    className={`flex-1 rounded px-2 py-1 text-xs transition-colors ${
                      artStyle === key
                        ? "bg-accent/20 text-accent"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
          </div>
        )}

        {/* Progress */}
        {running && (
          <div className="border-b border-border-default px-5 py-2">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-text-secondary">
                Generating {currentIndex + 1} of {targets.length}...
              </span>
              <span className="text-text-muted">
                {doneCount} done{errorCount > 0 ? `, ${errorCount} errors` : ""}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-bg-primary">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${((doneCount + errorCount) / targets.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Target list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <div className="flex flex-col gap-1">
            {targets.map((target) => (
              <div
                key={`${target.kind}:${target.id}`}
                className="flex items-center gap-2 rounded px-2 py-1 text-xs"
              >
                <span className="w-4 shrink-0 text-center">
                  {target.status === "pending" && (
                    <span className="text-text-muted">&middot;</span>
                  )}
                  {target.status === "generating" && (
                    <span className="inline-block h-3 w-3 rounded-full border border-accent border-t-transparent animate-spin" />
                  )}
                  {target.status === "done" && (
                    <span className="text-status-success">&#x2713;</span>
                  )}
                  {target.status === "error" && (
                    <span className="text-status-error">&#x2717;</span>
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-text-secondary">
                  {target.label}
                </span>
                {target.error && (
                  <span className="truncate text-[10px] text-status-error" title={target.error}>
                    {target.error.slice(0, 40)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border-default px-5 py-3">
          <button
            onClick={onClose}
            className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
          >
            {running ? "Running..." : doneCount > 0 ? "Done" : "Cancel"}
          </button>
          {!running && doneCount === 0 && (
            <button
              onClick={handleRun}
              className="rounded bg-gradient-to-r from-accent-muted to-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition-all hover:shadow-[var(--glow-aurum)] hover:brightness-110"
            >
              Generate {targets.length} Images
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
