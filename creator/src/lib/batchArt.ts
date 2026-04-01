import { invoke } from "@tauri-apps/api/core";
import type { WorldFile } from "@/types/world";
import {
  entityPrompt,
  entityContext,
  roomPrompt,
  roomContext,
} from "@/lib/entityPrompts";
import {
  getEnhanceSystemPrompt,
  type ArtStyle,
} from "@/lib/arcanumPrompts";
import type { GeneratedImage } from "@/types/assets";
import { ENTITY_DIMENSIONS, imageGenerateCommand } from "@/types/assets";
import { removeBgAndSave, shouldRemoveBg } from "@/lib/useBackgroundRemoval";

export function assetTypeForKind(kind: string): string {
  if (kind === "room") return "background";
  if (kind === "mob") return "entity_portrait";
  if (kind === "item") return "entity_portrait";
  if (kind === "shop") return "background";
  return "background";
}

export interface BatchTarget {
  kind: string;
  id: string;
  label: string;
  checked: boolean;
  status: "pending" | "generating" | "done" | "error";
  result?: GeneratedImage;
  error?: string;
}

export function collectTargets(world: WorldFile): BatchTarget[] {
  const targets: BatchTarget[] = [];

  for (const [id, room] of Object.entries(world.rooms)) {
    if (!room.image) {
      targets.push({
        kind: "room",
        id,
        label: `Room: ${room.title}`,
        checked: true,
        status: "pending",
      });
    }
  }

  for (const [id, mob] of Object.entries(world.mobs ?? {})) {
    if (!mob.image) {
      targets.push({
        kind: "mob",
        id,
        label: `Mob: ${mob.name}`,
        checked: true,
        status: "pending",
      });
    }
  }

  for (const [id, item] of Object.entries(world.items ?? {})) {
    if (!item.image) {
      targets.push({
        kind: "item",
        id,
        label: `Item: ${item.displayName}`,
        checked: true,
        status: "pending",
      });
    }
  }

  for (const [id, shop] of Object.entries(world.shops ?? {})) {
    if (!shop.image) {
      targets.push({
        kind: "shop",
        id,
        label: `Shop: ${shop.name}`,
        checked: true,
        status: "pending",
      });
    }
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
  concurrency: number,
  abortRef: { current: boolean },
  callbacks: ArtGenerationCallbacks,
  autoRemoveBg?: boolean,
): Promise<WorldFile> {
  // Use a ref-like container so all workers always read/write the latest world
  const worldRef = { current: { ...world } };

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
          const systemPrompt = getEnhanceSystemPrompt(artStyle);
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

        const image = await invoke<GeneratedImage>(command, {
          prompt: finalPrompt,
          width: dims.width,
          height: dims.height,
          steps: 4,
          guidance: null,
        });

        callbacks.onTargetUpdate(idx, { status: "done", result: image });

        const variantGroup = `${target.kind}:${zoneId}:${target.id}`;
        const batchAssetType = assetTypeForKind(target.kind);
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

        // Auto-remove background for sprite asset types
        if (autoRemoveBg && shouldRemoveBg(batchAssetType) && image.data_url) {
          removeBgAndSave(image.data_url, batchAssetType, batchContext, variantGroup).catch(() => {});
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

  callbacks.onWorldUpdate(worldRef.current);
  return worldRef.current;
}
