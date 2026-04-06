import { useMemo } from "react";
import { AnimatePresence, LazyMotion } from "motion/react";
import { loadMotionFeatures } from "@/lib/motionFeatures";
import { CinematicScene } from "./CinematicScene";
import type { ShowcaseScene } from "@/types/showcase";
import type { NarrationSpeed } from "@/lib/narrationSpeed";
import type { SceneEntity } from "@/types/story";

// ─── Props ─────────────────────────────────────────────────────────

interface CinematicRendererProps {
  scenes: ShowcaseScene[];
  currentIndex: number;
  playing: boolean;
  onComplete?: () => void;
  onSceneChange?: (index: number) => void;
  narrationSpeed?: NarrationSpeed;
}

// ─── CinematicRenderer ─────────────────────────────────────────────

export function CinematicRenderer({
  scenes,
  currentIndex,
  playing,
  onComplete,
  narrationSpeed,
}: CinematicRendererProps) {
  // ─── Current scene ─────────────────────────────────────────────

  const scene = scenes[currentIndex];
  if (!scene) return null;

  // ─── Transition config ─────────────────────────────────────────

  const transition = scene.transition ?? { type: "crossfade" as const };

  // ─── AnimatePresence mode ──────────────────────────────────────

  const presenceMode = transition.type === "crossfade" ? "sync" : "wait";

  // ─── Effective narration speed ─────────────────────────────────

  const effectiveSpeed: NarrationSpeed = scene.narrationSpeed ?? narrationSpeed ?? "normal";

  // ─── Resolve showcase scene data to renderer format ────────────

  const resolvedEntities = useMemo(
    () =>
      scene.entities.map((e) => ({
        entity: {
          id: e.id,
          entityType: e.entityType,
          entityId: e.entityId,
          slot: e.slot as SceneEntity["slot"],
          position: e.position,
          entrancePath: e.entrancePath,
          exitPath: e.exitPath,
        } satisfies SceneEntity,
        name: e.name,
        imageSrc: e.imageUrl,
      })),
    [scene.entities],
  );

  // ─── Build a minimal Scene-like object for CinematicScene ─────

  const sceneData = useMemo(
    () => ({
      id: scene.id,
      title: scene.title,
      sortOrder: scene.sortOrder,
      narration: scene.narration,
      transition: scene.transition ? { type: scene.transition.type } : undefined,
      narrationSpeed: scene.narrationSpeed as NarrationSpeed | undefined,
    }),
    [scene],
  );

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-lg bg-black"
      role="region"
      aria-label="Scene playback"
    >
      {/* Scene announcement for accessibility */}
      <span className="sr-only" aria-live="assertive">
        Scene {currentIndex + 1} of {scenes.length}: {scene.title}
      </span>

      <LazyMotion features={loadMotionFeatures} strict>
        <AnimatePresence mode={presenceMode}>
          <CinematicScene
            key={scene.id}
            scene={sceneData}
            playing={playing}
            transition={transition}
            narrationSpeed={effectiveSpeed}
            resolvedEntities={resolvedEntities}
            roomImageSrc={scene.roomImageUrl}
            onAnimationsComplete={onComplete}
          />
        </AnimatePresence>
      </LazyMotion>
    </div>
  );
}
