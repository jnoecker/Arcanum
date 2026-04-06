import { invoke } from "@tauri-apps/api/core";
import type { WorldFile } from "@/types/world";
import {
  entityPrompt,
  entityContext,
  roomPrompt,
  roomContext,
} from "@/lib/entityPrompts";
import {
  UNIVERSAL_NEGATIVE,
  getEnhanceSystemPrompt,
  type ArtStyle,
} from "@/lib/arcanumPrompts";
import type { GeneratedImage } from "@/types/assets";
import { ENTITY_DIMENSIONS, imageGenerateCommand, resolveImageModel, requestsTransparentBackground } from "@/types/assets";
import { removeBgAndSave, shouldRemoveBg } from "@/lib/useBackgroundRemoval";

export function assetTypeForKind(kind: string): string {
  if (kind === "room") return "background";
  if (kind === "mob") return "mob";
  if (kind === "item") return "item";
  if (kind === "shop") return "background";
  return "background";
}

export interface BatchTarget {
  kind: string;
  id: string;
  label: string;
  checked: boolean;
  hasExisting: boolean;
  status: "pending" | "generating" | "done" | "error";
  result?: GeneratedImage;
  error?: string;
}

export function collectTargets(world: WorldFile): BatchTarget[] {
  const targets: BatchTarget[] = [];

  for (const [id, room] of Object.entries(world.rooms)) {
    const hasImage = !!room.image;
    targets.push({
      kind: "room",
      id,
      label: `Room: ${room.title}`,
      checked: !hasImage,
      hasExisting: hasImage,
      status: "pending",
    });
  }

  for (const [id, mob] of Object.entries(world.mobs ?? {})) {
    const hasImage = !!mob.image;
    targets.push({
      kind: "mob",
      id,
      label: `Mob: ${mob.name}`,
      checked: !hasImage,
      hasExisting: hasImage,
      status: "pending",
    });
  }

  for (const [id, item] of Object.entries(world.items ?? {})) {
    const hasImage = !!item.image;
    targets.push({
      kind: "item",
      id,
      label: `Item: ${item.displayName}`,
      checked: !hasImage,
      hasExisting: hasImage,
      status: "pending",
    });
  }

  for (const [id, shop] of Object.entries(world.shops ?? {})) {
    const hasImage = !!shop.image;
    targets.push({
      kind: "shop",
      id,
      label: `Shop: ${shop.name}`,
      checked: !hasImage,
      hasExisting: hasImage,
      status: "pending",
    });
  }

  return targets;
}

export function getTargetPrompt(
  target: BatchTarget,
  world: WorldFile,
  style: ArtStyle,
): string {
  const { kind, id } = target;
  if (kind === "room") {
    return roomPrompt(id, world.rooms[id]!, style);
  }
  const collection =
    kind === "mob" ? "mobs" : kind === "item" ? "items" : "shops";
  const entity = (
    world as unknown as Record<string, Record<string, unknown> | undefined>
  )[collection]?.[id];
  return entityPrompt(kind, id, entity, style);
}

export function getTargetContext(
  target: BatchTarget,
  world: WorldFile,
): string {
  const { kind, id } = target;
  if (kind === "room") {
    return roomContext(id, world.rooms[id]!);
  }
  const collection =
    kind === "mob" ? "mobs" : kind === "item" ? "items" : "shops";
  const entity = (
    world as unknown as Record<string, Record<string, unknown> | undefined>
  )[collection]?.[id];
  return entityContext(kind, id, entity);
}

export interface ArtGenerationCallbacks {
  onTargetUpdate: (idx: number, update: Partial<BatchTarget>) => void;
  onWorldUpdate: (world: WorldFile) => void;
  onBgRemovalProgress?: (done: number, total: number) => void;
  acceptAsset: (
    image: GeneratedImage,
    assetType: string,
    enhancedPrompt: string,
    context: { zone: string; entity_type: string; entity_id: string },
    variantGroup: string,
    isActive: boolean,
  ) => Promise<void>;
}

export async function runBatchArtGeneration(
  targets: BatchTarget[],
  world: WorldFile,
  zoneId: string,
  artStyle: ArtStyle,
  vibe: string,
  imageProvider: string,
  configuredModel: string | undefined,
  concurrency: number,
  abortRef: { current: boolean },
  callbacks: ArtGenerationCallbacks,
  autoRemoveBg?: boolean,
): Promise<WorldFile> {
  // Use a ref-like container so all workers always read/write the latest world
  const worldRef = { current: { ...world } };

  // Collect background removal promises so we can await them before saving
  const pendingBgRemovals: { promise: ReturnType<typeof removeBgAndSave>; kind: string; id: string }[] = [];

  const checkedTargets = targets.filter((t) => t.checked);
  const queue = checkedTargets.map((t) =>
    targets.findIndex((tt) => tt.kind === t.kind && tt.id === t.id),
  );

  const worker = async () => {
    while (queue.length > 0 && !abortRef.current) {
      const idx = queue.shift();
      if (idx === undefined) break;
      const target = targets[idx];
      if (!target) continue;

      callbacks.onTargetUpdate(idx, { status: "generating" });

      try {
        const basePrompt = getTargetPrompt(target, worldRef.current, artStyle);
        const context = getTargetContext(target, worldRef.current);

        let finalPrompt = basePrompt;
        try {
          const systemPrompt = getEnhanceSystemPrompt(artStyle, undefined, "worldbuilding");
          let userPrompt: string;
          if (context) {
            const parts = [
              `Generate an image prompt for this entity:\n${context}`,
            ];
            if (vibe)
              parts.push(`\nZone atmosphere/vibe:\n${vibe}`);
            parts.push(
              `\nReference style template (adapt but prioritize the entity description above):\n${basePrompt}`,
            );
            userPrompt = parts.join("\n");
          } else {
            userPrompt = vibe
              ? `${basePrompt}\n\nZone atmosphere/vibe:\n${vibe}`
              : basePrompt;
          }
          finalPrompt = await invoke<string>("llm_complete", {
            systemPrompt,
            userPrompt,
          });
        } catch {
          // Fall back to base prompt
        }

        const dims = ENTITY_DIMENSIONS[target.kind] ?? {
          width: 1024,
          height: 1024,
        };
        const command = imageGenerateCommand(imageProvider);
        const model = resolveImageModel(imageProvider, configuredModel);
        const batchAssetType = assetTypeForKind(target.kind);

        const image = await invoke<GeneratedImage>(command, {
          prompt: finalPrompt,
          negativePrompt: UNIVERSAL_NEGATIVE,
          model: model?.id,
          width: dims.width,
          height: dims.height,
          steps: model?.defaultSteps ?? 4,
          guidance: model && "defaultGuidance" in model ? model.defaultGuidance : null,
          assetType: batchAssetType,
          autoEnhance: false,
          transparentBackground: imageProvider === "openai" && requestsTransparentBackground(batchAssetType),
        });

        callbacks.onTargetUpdate(idx, { status: "done", result: image });

        const variantGroup = `${target.kind}:${zoneId}:${target.id}`;
        const batchContext = {
          zone: zoneId,
          entity_type: target.kind,
          entity_id: target.id,
        };
        await callbacks
          .acceptAsset(
            image,
            batchAssetType,
            finalPrompt,
            batchContext,
            variantGroup,
            true,
          )
          .catch(() => {});

        // Queue background removal — we'll await all of them before saving
        if (autoRemoveBg && shouldRemoveBg(batchAssetType) && image.data_url) {
          pendingBgRemovals.push({
            promise: removeBgAndSave(image.data_url, batchAssetType, batchContext, variantGroup),
            kind: target.kind,
            id: target.id,
          });
        }

        // Update worldRef atomically — always read current value to avoid lost updates
        const { kind, id } = target;
        const cur = worldRef.current;
        if (kind === "room") {
          const fileName = image.file_path.split(/[\\/]/).pop() ?? image.hash;
          worldRef.current = {
            ...cur,
            rooms: {
              ...cur.rooms,
              [id]: { ...cur.rooms[id]!, image: fileName },
            },
          };
        } else {
          const collection =
            kind === "mob"
              ? "mobs"
              : kind === "item"
                ? "items"
                : "shops";
          const entities = (cur as Record<string, unknown>)[
            collection
          ] as Record<string, Record<string, unknown>> | undefined;
          if (entities?.[id]) {
            const fileName = image.file_path.split(/[\\/]/).pop() ?? image.hash;
            worldRef.current = {
              ...cur,
              [collection]: {
                ...entities,
                [id]: { ...entities[id], image: fileName },
              },
            };
          }
        }
      } catch (e) {
        callbacks.onTargetUpdate(idx, {
          status: "error",
          error: String(e),
        });
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, queue.length) },
    () => worker(),
  );
  await Promise.all(workers);

  // Await all background removals and update worldRef with bg-free filenames
  const totalRemovals = pendingBgRemovals.length;
  if (totalRemovals > 0) {
    callbacks.onBgRemovalProgress?.(0, totalRemovals);
  }
  let removalsComplete = 0;
  for (const { promise, kind, id } of pendingBgRemovals) {
    try {
      const entry = await promise;
      if (entry) {
        const cur = worldRef.current;
        const collection =
          kind === "mob" ? "mobs" : kind === "item" ? "items" : kind === "shop" ? "shops" : null;
        if (collection) {
          const entities = (cur as Record<string, unknown>)[collection] as
            Record<string, Record<string, unknown>> | undefined;
          if (entities?.[id]) {
            worldRef.current = {
              ...cur,
              [collection]: {
                ...entities,
                [id]: { ...entities[id], image: entry.file_name },
              },
            };
          }
        }
      }
    } catch {
      // bg removal failed; keep original image
    }
    removalsComplete++;
    callbacks.onBgRemovalProgress?.(removalsComplete, totalRemovals);
  }

  callbacks.onWorldUpdate(worldRef.current);
  return worldRef.current;
}
