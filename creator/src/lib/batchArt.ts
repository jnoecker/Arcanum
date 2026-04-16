import { invoke } from "@tauri-apps/api/core";
import type { WorldFile } from "@/types/world";
import {
  entityPrompt,
  entityContext,
  roomPrompt,
  roomContext,
  dungeonPrompt,
  dungeonContext,
  dungeonRoomTemplatePrompt,
  dungeonRoomTemplateContext,
} from "@/lib/entityPrompts";
import {
  getNegativePrompt,
  getEnhanceSystemPrompt,
  getStyleSuffix,
  type ArtStyle,
} from "@/lib/arcanumPrompts";
import type { GeneratedImage } from "@/types/assets";
import { ENTITY_DIMENSIONS, requestsTransparentBackground, resolveImageModel, modelNativelyTransparent } from "@/types/assets";
import { generateAssetImage } from "@/lib/imageGen";
import { removeBgAndSave, shouldRemoveBg } from "@/lib/useBackgroundRemoval";
import { AI_ENABLED } from "@/lib/featureFlags";

export function assetTypeForKind(kind: string): string {
  if (kind === "room") return "background";
  if (kind === "mob") return "mob";
  if (kind === "item") return "item";
  if (kind === "gatheringNode") return "gathering_node";
  if (kind === "shop") return "background";
  if (kind === "dungeon") return "background";
  if (kind === "dungeonRoom") return "background";
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

  for (const [id, node] of Object.entries(world.gatheringNodes ?? {})) {
    const hasImage = !!node.image;
    targets.push({
      kind: "gatheringNode",
      id,
      label: `Node: ${node.displayName}`,
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

  if (world.dungeon) {
    const d = world.dungeon;
    const hasHero = !!d.image;
    targets.push({
      kind: "dungeon",
      id: "main",
      label: `Dungeon: ${d.name}`,
      checked: !hasHero,
      hasExisting: hasHero,
      status: "pending",
    });

    for (const [category, templates] of Object.entries(d.roomTemplates ?? {})) {
      for (let i = 0; i < templates.length; i++) {
        const tpl = templates[i]!;
        const hasImage = !!tpl.image;
        targets.push({
          kind: "dungeonRoom",
          id: `${category}:${i}`,
          label: `Dungeon Room: ${tpl.title || category}`,
          checked: !hasImage,
          hasExisting: hasImage,
          status: "pending",
        });
      }
    }
  }

  return targets;
}

function collectionForKind(kind: string): string {
  switch (kind) {
    case "mob": return "mobs";
    case "item": return "items";
    case "gatheringNode": return "gatheringNodes";
    case "shop": return "shops";
    default: return "mobs";
  }
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
  if (kind === "dungeon" && world.dungeon) {
    return dungeonPrompt(world.dungeon, style);
  }
  if (kind === "dungeonRoom" && world.dungeon) {
    const [category, idxStr] = id.split(":");
    const idx = parseInt(idxStr!, 10);
    const tpl = world.dungeon.roomTemplates?.[category!]?.[idx];
    if (tpl) return dungeonRoomTemplatePrompt(category!, tpl, style);
  }
  const entity = (
    world as unknown as Record<string, Record<string, unknown> | undefined>
  )[collectionForKind(kind)]?.[id];
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
  if (kind === "dungeon" && world.dungeon) {
    return dungeonContext(world.dungeon, world.zone);
  }
  if (kind === "dungeonRoom" && world.dungeon) {
    const [category, idxStr] = id.split(":");
    const idx = parseInt(idxStr!, 10);
    const tpl = world.dungeon.roomTemplates?.[category!]?.[idx];
    if (tpl) return dungeonRoomTemplateContext(category!, tpl, world.dungeon);
  }
  const entity = (
    world as unknown as Record<string, Record<string, unknown> | undefined>
  )[collectionForKind(kind)]?.[id];
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
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");
  // Use a ref-like container so all workers always read/write the latest world
  const worldRef = { current: { ...world } };

  // Collect background removal promises so we can await them before saving
  const pendingBgRemovals: { promise: ReturnType<typeof removeBgAndSave>; kind: string; id: string }[] = [];

  const checkedTargets = targets.filter((t) => t.checked);
  const queue = checkedTargets.map((t) =>
    targets.findIndex((tt) => tt.kind === t.kind && tt.id === t.id),
  );

  const model = resolveImageModel(imageProvider, configuredModel);
  const nativeTransparency = modelNativelyTransparent(imageProvider, model?.id);
  const styleSuffix = getStyleSuffix("worldbuilding");

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
        const batchAssetType = assetTypeForKind(target.kind);

        let finalPrompt = basePrompt;
        try {
          const systemPrompt = getEnhanceSystemPrompt(artStyle, batchAssetType, "worldbuilding", nativeTransparency);
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

        // Append style suffix to ensure consistent aesthetic (matches individual path)
        if (!finalPrompt.includes(styleSuffix.slice(0, 40))) {
          finalPrompt = `${finalPrompt}\n\n${styleSuffix}`;
        }

        const dims = ENTITY_DIMENSIONS[target.kind] ?? {
          width: 1024,
          height: 1024,
        };
        const image = model
          ? await generateAssetImage({
              provider: imageProvider,
              model,
              prompt: finalPrompt,
              width: dims.width,
              height: dims.height,
              assetType: batchAssetType,
              negativePrompt: getNegativePrompt(batchAssetType),
            })
          : null;
        if (!image) {
          callbacks.onTargetUpdate(idx, { status: "error", error: `No model configured for provider ${imageProvider}` });
          continue;
        }

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

        // Queue background removal — skip if the model already produced native transparency
        const skipBgRemoval = nativeTransparency && requestsTransparentBackground(batchAssetType);
        if (autoRemoveBg && shouldRemoveBg(batchAssetType) && image.data_url && !skipBgRemoval) {
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
        } else if (kind === "dungeon" && cur.dungeon) {
          const fileName = image.file_path.split(/[\\/]/).pop() ?? image.hash;
          worldRef.current = {
            ...cur,
            dungeon: { ...cur.dungeon, image: fileName },
          };
        } else if (kind === "dungeonRoom" && cur.dungeon) {
          const [category, idxStr] = id.split(":");
          const idx = parseInt(idxStr!, 10);
          const templates = cur.dungeon.roomTemplates?.[category!];
          if (templates?.[idx]) {
            const fileName = image.file_path.split(/[\\/]/).pop() ?? image.hash;
            const updatedTemplates = [...templates];
            updatedTemplates[idx] = { ...templates[idx]!, image: fileName };
            worldRef.current = {
              ...cur,
              dungeon: {
                ...cur.dungeon,
                roomTemplates: {
                  ...cur.dungeon.roomTemplates,
                  [category!]: updatedTemplates,
                },
              },
            };
          }
        } else {
          const collection = collectionForKind(kind);
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
