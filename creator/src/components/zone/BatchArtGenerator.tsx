import { useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { WorldFile } from "@/types/world";
import { entityPrompt, entityContext, roomPrompt, roomContext } from "@/lib/entityPrompts";
import { ART_STYLE_LABELS, getEnhanceSystemPrompt, type ArtStyle } from "@/lib/arcanumPrompts";
import { useAssetStore } from "@/stores/assetStore";
import { useVibeStore } from "@/stores/vibeStore";
import type { GeneratedImage } from "@/types/assets";
import { ENTITY_DIMENSIONS } from "@/types/assets";

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
  checked: boolean;
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

  for (const [id, room] of Object.entries(world.rooms)) {
    if (!room.image) {
      targets.push({
        kind: "room", id, label: `Room: ${room.title}`,
        checked: true, status: "pending",
      });
    }
  }

  for (const [id, mob] of Object.entries(world.mobs ?? {})) {
    if (!mob.image) {
      targets.push({
        kind: "mob", id, label: `Mob: ${mob.name}`,
        checked: true, status: "pending",
      });
    }
  }

  for (const [id, item] of Object.entries(world.items ?? {})) {
    if (!item.image) {
      targets.push({
        kind: "item", id, label: `Item: ${item.displayName}`,
        checked: true, status: "pending",
      });
    }
  }

  for (const [id, shop] of Object.entries(world.shops ?? {})) {
    if (!shop.image) {
      targets.push({
        kind: "shop", id, label: `Shop: ${shop.name}`,
        checked: true, status: "pending",
      });
    }
  }

  return targets;
}

function getTargetPrompt(target: BatchTarget, world: WorldFile, style: ArtStyle): string {
  const { kind, id } = target;
  if (kind === "room") {
    return roomPrompt(id, world.rooms[id]!, style);
  }
  const collection = kind === "mob" ? "mobs" : kind === "item" ? "items" : "shops";
  const entity = (world as unknown as Record<string, Record<string, unknown> | undefined>)[collection]?.[id];
  return entityPrompt(kind, id, entity, style);
}

function getTargetContext(target: BatchTarget, world: WorldFile): string {
  const { kind, id } = target;
  if (kind === "room") {
    return roomContext(id, world.rooms[id]!);
  }
  const collection = kind === "mob" ? "mobs" : kind === "item" ? "items" : "shops";
  const entity = (world as unknown as Record<string, Record<string, unknown> | undefined>)[collection]?.[id];
  return entityContext(kind, id, entity);
}

export function BatchArtGenerator({
  zoneId,
  world,
  onWorldChange,
  onClose,
}: BatchArtGeneratorProps) {
  const artStyle = useAssetStore((s) => s.artStyle);
  const setArtStyle = useAssetStore((s) => s.setArtStyle);
  const settings = useAssetStore((s) => s.settings);
  const vibe = useVibeStore((s) => s.vibes.get(zoneId) ?? "");
  const [targets, setTargets] = useState(() => collectTargets(world));
  const [running, setRunning] = useState(false);
  const [concurrency, setConcurrency] = useState(settings?.batch_concurrency ?? 5);
  const abortRef = useRef(false);

  const checkedTargets = targets.filter((t) => t.checked);
  const doneCount = targets.filter((t) => t.status === "done").length;
  const errorCount = targets.filter((t) => t.status === "error").length;
  const imageProvider = settings?.image_provider ?? "deepinfra";

  const acceptAsset = useAssetStore((s) => s.acceptAsset);

  const toggleTarget = (idx: number) => {
    setTargets((prev) => prev.map((t, i) => (i === idx ? { ...t, checked: !t.checked } : t)));
  };

  const handleRun = useCallback(async () => {
    setRunning(true);
    abortRef.current = false;
    let updatedWorld = { ...world };

    const queue = checkedTargets.map((t) =>
      targets.findIndex((tt) => tt.kind === t.kind && tt.id === t.id),
    );

    const updateTarget = (idx: number, update: Partial<BatchTarget>) => {
      setTargets((prev) =>
        prev.map((t, i) => (i === idx ? { ...t, ...update } : t)),
      );
    };

    const worker = async () => {
      while (queue.length > 0 && !abortRef.current) {
        const idx = queue.shift();
        if (idx === undefined) break;
        const target = targets[idx];
        if (!target) continue;

        updateTarget(idx, { status: "generating" });

        try {
          const basePrompt = getTargetPrompt(target, updatedWorld, artStyle);
          const context = getTargetContext(target, updatedWorld);

          // Enhance with LLM + entity context + vibe
          let finalPrompt = basePrompt;
          try {
            const systemPrompt = getEnhanceSystemPrompt(artStyle);
            let userPrompt: string;
            if (context) {
              const parts = [`Generate an image prompt for this entity:\n${context}`];
              if (vibe) parts.push(`\nZone atmosphere/vibe:\n${vibe}`);
              parts.push(`\nReference style template (adapt but prioritize the entity description above):\n${basePrompt}`);
              userPrompt = parts.join("\n");
            } else {
              userPrompt = vibe ? `${basePrompt}\n\nZone atmosphere/vibe:\n${vibe}` : basePrompt;
            }
            finalPrompt = await invoke<string>("llm_complete", {
              systemPrompt,
              userPrompt,
            });
          } catch {
            // Fall back to base prompt
          }

          const dims = ENTITY_DIMENSIONS[target.kind] ?? { width: 1024, height: 1024 };
          const command = imageProvider === "runware" ? "runware_generate_image" : "generate_image";

          const image = await invoke<GeneratedImage>(command, {
            prompt: finalPrompt,
            width: dims.width,
            height: dims.height,
            steps: 4,
            guidance: null,
          });

          updateTarget(idx, { status: "done", result: image });

          // Save with variant group
          const variantGroup = `${target.kind}:${zoneId}:${target.id}`;
          await acceptAsset(image, assetTypeForKind(target.kind), finalPrompt, {
            zone: zoneId,
            entity_type: target.kind,
            entity_id: target.id,
          }, variantGroup, true).catch(() => {});

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
          updateTarget(idx, { status: "error", error: String(e) });
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrency, queue.length) },
      () => worker(),
    );
    await Promise.all(workers);

    onWorldChange(updatedWorld);
    setRunning(false);
  }, [targets, checkedTargets, world, onWorldChange, artStyle, vibe, imageProvider, concurrency, zoneId, acceptAsset]);

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
        <div className="flex items-center justify-between border-b border-border-default px-5 py-3">
          <h2 className="font-display text-sm tracking-wide text-text-primary">
            Batch Art — {zoneId}
          </h2>
          <span className="text-xs text-text-muted">
            {checkedTargets.length} of {targets.length} selected
          </span>
        </div>

        {/* Style selector + concurrency */}
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
            <div className="mt-2 flex items-center gap-2">
              <label className="text-[10px] text-text-muted">Concurrency:</label>
              <input
                type="range"
                min={1}
                max={10}
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                className="w-24 accent-accent"
              />
              <span className="text-[10px] text-text-secondary">{concurrency}</span>
              {vibe && (
                <span className="ml-auto text-[10px] text-accent" title={vibe}>
                  vibe active
                </span>
              )}
            </div>
          </div>
        )}

        {/* Progress */}
        {running && (
          <div className="border-b border-border-default px-5 py-2">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-text-secondary">
                {doneCount + errorCount} of {checkedTargets.length}
              </span>
              <span className="text-text-muted">
                {doneCount} done{errorCount > 0 ? `, ${errorCount} errors` : ""}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-bg-primary">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${((doneCount + errorCount) / checkedTargets.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Target list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <div className="flex flex-col gap-1">
            {targets.map((target, i) => (
              <label
                key={`${target.kind}:${target.id}`}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-bg-elevated"
              >
                {!running && doneCount === 0 && (
                  <input
                    type="checkbox"
                    checked={target.checked}
                    onChange={() => toggleTarget(i)}
                    className="accent-accent"
                  />
                )}
                <span className="w-4 shrink-0 text-center">
                  {target.status === "pending" && !running && (
                    <span className="text-text-muted">&middot;</span>
                  )}
                  {target.status === "pending" && running && (
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
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border-default px-5 py-3">
          {running ? (
            <button
              onClick={() => { abortRef.current = true; }}
              className="rounded border border-status-danger/40 px-4 py-1.5 text-xs text-status-danger hover:bg-status-danger/10"
            >
              Abort
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
              >
                {doneCount > 0 ? "Done" : "Cancel"}
              </button>
              {doneCount === 0 && (
                <button
                  onClick={handleRun}
                  disabled={checkedTargets.length === 0}
                  className="rounded bg-gradient-to-r from-accent-muted to-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition-all hover:shadow-[var(--glow-aurum)] hover:brightness-110 disabled:opacity-50"
                >
                  Generate {checkedTargets.length} Images
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
