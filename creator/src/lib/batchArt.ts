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
  musicBoxKeepsakePrompt,
  musicBoxKeepsakeContext,
} from "@/lib/entityPrompts";
import type { AudioTrackMeta } from "@/lib/audioLibrary";
import {
  getNegativePrompt,
  getEnhanceSystemPrompt,
  getStyleSuffix,
  type ArtStyle,
} from "@/lib/arcanumPrompts";
import type { GeneratedImage } from "@/types/assets";
import { ENTITY_DIMENSIONS, requestsTransparentBackground, resolveImageModel, modelNativelyTransparent } from "@/types/assets";
import { generateAssetImage } from "@/lib/imageGen";
import { removeBgFromFileAndSave, shouldRemoveBg } from "@/lib/useBackgroundRemoval";
import { AI_ENABLED } from "@/lib/featureFlags";
import { applyReferences, buildReferenceBlock, expandReferences } from "@/lib/referenceTokens";
import type { ReferenceSubject } from "@/types/reference";
import { useReferenceStore } from "@/stores/referenceStore";

export function assetTypeForKind(kind: string): string {
  if (kind === "room") return "background";
  if (kind === "mob") return "mob";
  if (kind === "item") return "item";
  if (kind === "gatheringNode") return "gathering_node";
  if (kind === "shop") return "background";
  if (kind === "dungeon") return "background";
  if (kind === "dungeonRoom") return "background";
  if (kind === "musicBoxKeepsake") return "item";
  return "background";
}

export interface BatchTarget {
  kind: string;
  id: string;
  label: string;
  checked: boolean;
  hasExisting: boolean;
  status: "pending" | "generating" | "done" | "error";
  error?: string;
  /** For `musicBoxKeepsake` targets: the song the lyric-sheet commemorates,
   *  resolved from the audio library at collect time (the prompt needs it, and
   *  an in-editor music box is a bare `{ file }` until save-time enrichment). */
  song?: { title: string; artist?: string };
}

export function collectTargets(
  world: WorldFile,
  audioMeta?: Map<string, AudioTrackMeta>,
): BatchTarget[] {
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

  for (const [id, room] of Object.entries(world.rooms)) {
    const box = room.musicBox;
    if (!box?.file?.trim()) continue;
    const meta = audioMeta?.get(box.file);
    const title = meta?.name ?? box.title ?? "";
    const songLabel = title.trim() || box.file;
    const hasImage = !!box.image;
    targets.push({
      kind: "musicBoxKeepsake",
      id,
      label: `Keepsake: ${songLabel}`,
      checked: !hasImage,
      hasExisting: hasImage,
      status: "pending",
      song: { title, artist: meta?.artist ?? box.artist },
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

/**
 * Return a new WorldFile with the generated image filename assigned to the
 * entity addressed by `kind`/`id`. Pure — no mutation. Applied incrementally
 * against the live zone data so a backgrounded batch never clobbers concurrent
 * edits to other fields. A no-op (returns the same world) if the target is gone.
 */
export function applyImageToWorld(
  world: WorldFile,
  kind: string,
  id: string,
  fileName: string,
): WorldFile {
  if (kind === "room") {
    const room = world.rooms[id];
    if (!room) return world;
    return { ...world, rooms: { ...world.rooms, [id]: { ...room, image: fileName } } };
  }
  if (kind === "musicBoxKeepsake") {
    const room = world.rooms[id];
    if (!room?.musicBox) return world;
    return {
      ...world,
      rooms: {
        ...world.rooms,
        [id]: { ...room, musicBox: { ...room.musicBox, image: fileName } },
      },
    };
  }
  if (kind === "dungeon" && world.dungeon) {
    return { ...world, dungeon: { ...world.dungeon, image: fileName } };
  }
  if (kind === "dungeonRoom" && world.dungeon) {
    const [category, idxStr] = id.split(":");
    const idx = parseInt(idxStr!, 10);
    const templates = world.dungeon.roomTemplates?.[category!];
    if (!templates?.[idx]) return world;
    const updatedTemplates = [...templates];
    updatedTemplates[idx] = { ...templates[idx]!, image: fileName };
    return {
      ...world,
      dungeon: {
        ...world.dungeon,
        roomTemplates: { ...world.dungeon.roomTemplates, [category!]: updatedTemplates },
      },
    };
  }
  const collection = collectionForKind(kind);
  const entities = (world as unknown as Record<string, unknown>)[collection] as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!entities?.[id]) return world;
  return {
    ...world,
    [collection]: { ...entities, [id]: { ...entities[id], image: fileName } },
  };
}

function fileNameFromPath(filePath: string, fallback: string): string {
  return filePath.split(/[\\/]/).pop() ?? fallback;
}

export function getTargetPrompt(
  target: BatchTarget,
  world: WorldFile,
  style: ArtStyle,
  zoneVibe?: string | null,
): string {
  const { kind, id } = target;
  if (kind === "room") {
    return roomPrompt(id, world.rooms[id]!, style, zoneVibe);
  }
  if (kind === "musicBoxKeepsake") {
    return musicBoxKeepsakePrompt(target.song?.title ?? "", target.song?.artist, style, zoneVibe);
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
  return entityPrompt(kind, id, entity, style, zoneVibe);
}

export function getTargetContext(
  target: BatchTarget,
  world: WorldFile,
): string {
  const { kind, id } = target;
  if (kind === "room") {
    return roomContext(id, world.rooms[id]!);
  }
  if (kind === "musicBoxKeepsake") {
    return musicBoxKeepsakeContext(target.song?.title ?? "", target.song?.artist);
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

/**
 * Assemble the LLM enhancement user-prompt for one batch target. Expands any
 * `@token` references in the entity context and base prompt to their canonical
 * subject, and appends a canonical-appearance block so referenced subjects
 * render consistently — parity with the single-entity path (`EntityArtGenerator`).
 * With an empty resolver this reproduces the prior raw-context prompt verbatim.
 */
export function buildBatchUserPrompt(
  context: string,
  basePrompt: string,
  resolver: Map<string, ReferenceSubject>,
): string {
  const used: ReferenceSubject[] = [];
  const collect = (subs: ReferenceSubject[]) => {
    for (const s of subs) if (!used.some((u) => u.id === s.id)) used.push(s);
  };

  const parts: string[] = [];
  if (context) {
    const ctx = expandReferences(context, resolver);
    collect(ctx.used);
    const base = expandReferences(basePrompt, resolver);
    collect(base.used);
    parts.push(`Generate an image prompt for this entity:\n${ctx.text}`);
    parts.push(`\nReference style template (adapt but prioritize the entity description above):\n${base.text}`);
  } else {
    const base = expandReferences(basePrompt, resolver);
    collect(base.used);
    parts.push(base.text);
  }

  const block = buildReferenceBlock(used);
  if (block) parts.push(`\n${block}`);
  return parts.join("\n");
}

export interface ArtGenerationCallbacks {
  onTargetUpdate: (idx: number, update: Partial<BatchTarget>) => void;
  /**
   * Assign a freshly generated image filename to one entity. Called once per
   * image (and again after background removal swaps in the bg-free variant).
   * Implementations apply it against the *current* zone data so the write is
   * safe even while the batch runs in the background and the user edits on.
   */
  applyImage: (kind: string, id: string, fileName: string) => void;
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
): Promise<void> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");

  // Collect background removal promises so we can await them before saving
  const pendingBgRemovals: { promise: ReturnType<typeof removeBgFromFileAndSave>; kind: string; id: string }[] = [];

  const checkedTargets = targets.filter((t) => t.checked);
  const queue = checkedTargets.map((t) =>
    targets.findIndex((tt) => tt.kind === t.kind && tt.id === t.id),
  );

  const model = resolveImageModel(imageProvider, configuredModel);
  const nativeTransparency = modelNativelyTransparent(imageProvider, model?.id);
  const styleSuffix = getStyleSuffix("worldbuilding");
  const resolver = useReferenceStore.getState().resolver();

  const worker = async () => {
    while (queue.length > 0 && !abortRef.current) {
      const idx = queue.shift();
      if (idx === undefined) break;
      const target = targets[idx];
      if (!target) continue;

      callbacks.onTargetUpdate(idx, { status: "generating" });

      try {
        const basePrompt = getTargetPrompt(target, world, artStyle, vibe);
        const context = getTargetContext(target, world);
        const batchAssetType = assetTypeForKind(target.kind);

        // Reference-expanded base prompt is the fallback when LLM enhancement
        // is unavailable or fails — raw `@tokens` must never reach the model.
        let finalPrompt = applyReferences(basePrompt, resolver).prompt;
        try {
          const systemPrompt = getEnhanceSystemPrompt(artStyle, batchAssetType, "worldbuilding", nativeTransparency);
          const userPrompt = buildBatchUserPrompt(context, basePrompt, resolver);
          finalPrompt = await invoke<string>("llm_complete", {
            systemPrompt,
            userPrompt,
          });
        } catch {
          // Fall back to the reference-expanded base prompt
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

        callbacks.onTargetUpdate(idx, { status: "done" });

        // Keepsakes share the per-room music-box editor's manifest identity
        // (entity_type "item", entity_id "musicbox:<roomId>") so variants from
        // either authoring path land in the same group.
        const batchContext =
          target.kind === "musicBoxKeepsake"
            ? { zone: zoneId, entity_type: "item", entity_id: `musicbox:${target.id}` }
            : { zone: zoneId, entity_type: target.kind, entity_id: target.id };
        const variantGroup = `${batchContext.entity_type}:${zoneId}:${batchContext.entity_id}`;
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
        if (autoRemoveBg && shouldRemoveBg(batchAssetType) && image.file_path && !skipBgRemoval) {
          pendingBgRemovals.push({
            promise: removeBgFromFileAndSave(image.file_path, batchAssetType, batchContext, variantGroup),
            kind: target.kind,
            id: target.id,
          });
        }

        callbacks.applyImage(
          target.kind,
          target.id,
          fileNameFromPath(image.file_path, image.hash),
        );
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
        callbacks.applyImage(kind, id, entry.file_name);
      }
    } catch {
      // bg removal failed; keep original image
    }
    removalsComplete++;
    callbacks.onBgRemovalProgress?.(removalsComplete, totalRemovals);
  }
}
