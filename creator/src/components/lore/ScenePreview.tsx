import { useState, useEffect, useCallback, useRef } from "react";
import { LazyMotion } from "motion/react";
import { useZoneStore } from "@/stores/zoneStore";
import { useStoryStore } from "@/stores/storyStore";
import { useImageSrc } from "@/lib/useImageSrc";
import { loadMotionFeatures } from "@/lib/motionFeatures";
import { isBackRow, extractPlainText } from "@/lib/sceneLayout";
import { EntityOverlay } from "./EntityOverlay";
import { AnimatedEntity } from "./AnimatedEntity";
import { TypewriterNarration } from "./TypewriterNarration";
import { PreviewPlayback } from "./PreviewPlayback";
import type { Scene, SceneEntity } from "@/types/story";
import type { ZoneState } from "@/stores/zoneStore";

// ─── Props ─────────────────────────────────────────────────────────

interface ScenePreviewProps {
  scene: Scene;
  storyId: string;
  zoneId: string;
}

// ─── Entity info resolution ────────────────────────────────────────

function resolveEntityInfo(
  entity: SceneEntity,
  zoneState: ZoneState | undefined,
): { name: string; image?: string } {
  if (!zoneState) return { name: entity.entityId };

  if (entity.entityType === "mob" || entity.entityType === "npc") {
    const mob = zoneState.data.mobs?.[entity.entityId];
    if (mob) return { name: mob.name, image: mob.image };
    return { name: entity.entityId };
  }

  if (entity.entityType === "item") {
    const item = zoneState.data.items?.[entity.entityId];
    if (item) return { name: item.displayName, image: item.image };
    return { name: entity.entityId };
  }

  return { name: entity.entityId };
}

// ─── Animated entity wrapper (resolves image via hook) ─────────────

function AnimatedEntityWithImage({
  entity,
  entityName,
  entityImage,
  playing,
  exiting,
}: {
  entity: SceneEntity;
  entityName: string;
  entityImage?: string;
  playing: boolean;
  exiting: boolean;
}) {
  const src = useImageSrc(entityImage);
  return (
    <AnimatedEntity
      entity={entity}
      entityName={entityName}
      imageSrc={src ?? undefined}
      playing={playing}
      exiting={exiting}
    />
  );
}

// ─── ScenePreview ──────────────────────────────────────────────────

export function ScenePreview({ scene, storyId, zoneId }: ScenePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const zones = useZoneStore((s) => s.zones);
  const updateScene = useStoryStore((s) => s.updateScene);

  const zoneState = zones.get(zoneId);
  const room = scene.roomId ? zoneState?.data.rooms[scene.roomId] : undefined;
  const roomSrc = useImageSrc(room?.image);

  // ─── Selection state ─────────────────────────────────────────

  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // ─── Preview playback state ─────────────────────────────────

  const [previewPlaying, setPreviewPlaying] = useState(false);

  const handlePreviewToggle = useCallback(() => {
    setPreviewPlaying((prev) => !prev);
  }, []);

  // Reset selection and preview when scene changes
  useEffect(() => {
    setSelectedEntityId(null);
    setPreviewPlaying(false);
  }, [scene.id]);

  // Delete key handler for selected entity
  useEffect(() => {
    if (!selectedEntityId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        handleRemoveEntity(selectedEntityId);
        setSelectedEntityId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEntityId, scene.entities, storyId, scene.id]);

  // ─── Entity callbacks ────────────────────────────────────────

  const handleReposition = useCallback(
    (entityId: string, newPosition: { x: number; y: number }) => {
      const entities = scene.entities ?? [];
      const updated = entities.map((ent) =>
        ent.id === entityId
          ? { ...ent, position: newPosition, slot: undefined }
          : ent,
      );
      updateScene(storyId, scene.id, { entities: updated });
    },
    [scene.entities, scene.id, storyId, updateScene],
  );

  const handleRemoveEntity = useCallback(
    (entityId: string) => {
      const entities = scene.entities ?? [];
      const filtered = entities.filter((ent) => ent.id !== entityId);
      updateScene(storyId, scene.id, { entities: filtered });
    },
    [scene.entities, scene.id, storyId, updateScene],
  );

  const handleSelect = useCallback((entityId: string) => {
    setSelectedEntityId((prev) => (prev === entityId ? null : entityId));
  }, []);

  // ─── Deselect on background click ────────────────────────────

  const handleContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        setSelectedEntityId(null);
      }
    },
    [],
  );

  // ─── Entity layer separation ─────────────────────────────────

  const entities = scene.entities ?? [];
  const backRowEntities = entities.filter((ent) => isBackRow(ent.slot));
  const frontRowEntities = entities.filter((ent) => !isBackRow(ent.slot));

  // ─── Narration overlay ───────────────────────────────────────

  const narrationText = extractPlainText(scene.narration ?? "");

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="relative aspect-video w-full overflow-hidden rounded-lg border border-border-default bg-black"
      onClick={handleContainerClick}
    >
      {/* Layer 0: Room background */}
      {scene.roomId && room?.image && roomSrc ? (
        <img
          src={roomSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      ) : scene.roomId && room?.image && !roomSrc ? (
        /* Loading skeleton */
        <div className="absolute inset-0 animate-pulse bg-bg-tertiary/30" />
      ) : null}

      {/* Empty state -- no room selected */}
      {!scene.roomId && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-border-default"
          role="status"
        >
          <p className="text-sm text-text-muted font-body">
            Select a room to set the background
          </p>
          <p className="mt-1 text-xs text-text-muted/70 font-body flex items-center gap-1">
            Browse rooms in the Entity Picker to choose a backdrop for this scene.
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="text-text-muted/50"
            >
              <path
                d="M6 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </p>
        </div>
      )}

      {/* Preview playback button (z-40) */}
      <PreviewPlayback playing={previewPlaying} onToggle={handlePreviewToggle} />

      {previewPlaying ? (
        /* ─── Animated preview mode ────────────────────────────── */
        <LazyMotion features={loadMotionFeatures} strict>
          {/* Layer 1: Back-row animated entities (z-10) */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
            {backRowEntities.map((entity) => {
              const info = resolveEntityInfo(entity, zoneState);
              return (
                <AnimatedEntityWithImage
                  key={entity.id}
                  entity={entity}
                  entityName={info.name}
                  entityImage={info.image}
                  playing={previewPlaying}
                  exiting={false}
                />
              );
            })}
          </div>

          {/* Layer 2: Front-row animated entities (z-20) */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
            {frontRowEntities.map((entity) => {
              const info = resolveEntityInfo(entity, zoneState);
              return (
                <AnimatedEntityWithImage
                  key={entity.id}
                  entity={entity}
                  entityName={info.name}
                  entityImage={info.image}
                  playing={previewPlaying}
                  exiting={false}
                />
              );
            })}
          </div>

          {/* Layer 3: Animated narration overlay (z-30) */}
          {scene.narration && (
            <div
              className="absolute inset-x-0 bottom-0 pointer-events-none"
              style={{ zIndex: 30 }}
            >
              <div className="bg-gradient-to-t from-black/60 to-transparent">
                <TypewriterNarration
                  narrationJson={scene.narration}
                  playing={previewPlaying}
                  speed={scene.narrationSpeed ?? "normal"}
                />
              </div>
            </div>
          )}
        </LazyMotion>
      ) : (
        /* ─── Static edit mode ─────────────────────────────────── */
        <>
          {/* Layer 1: Back-row entities (z-10) */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
            {backRowEntities.map((entity) => {
              const info = resolveEntityInfo(entity, zoneState);
              return (
                <EntityOverlay
                  key={entity.id}
                  entity={entity}
                  entityName={info.name}
                  entityImage={info.image}
                  containerRef={containerRef}
                  selected={selectedEntityId === entity.id}
                  onSelect={handleSelect}
                  onReposition={handleReposition}
                  onRemove={handleRemoveEntity}
                />
              );
            })}
          </div>

          {/* Layer 2: Front-row entities (z-20) */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
            {frontRowEntities.map((entity) => {
              const info = resolveEntityInfo(entity, zoneState);
              return (
                <EntityOverlay
                  key={entity.id}
                  entity={entity}
                  entityName={info.name}
                  entityImage={info.image}
                  containerRef={containerRef}
                  selected={selectedEntityId === entity.id}
                  onSelect={handleSelect}
                  onReposition={handleReposition}
                  onRemove={handleRemoveEntity}
                />
              );
            })}
          </div>

          {/* Layer 3: Narration overlay (z-30) */}
          {narrationText && (
            <div
              className="absolute inset-x-0 bottom-0 pointer-events-none"
              style={{ zIndex: 30 }}
            >
              <div className="bg-gradient-to-t from-black/60 to-transparent px-6 py-4">
                <p
                  className="font-body text-sm text-white leading-relaxed line-clamp-3"
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
                >
                  {narrationText}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
