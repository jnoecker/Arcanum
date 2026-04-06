import { useMemo } from "react";
import { AnimatePresence, LazyMotion } from "motion/react";
import { loadMotionFeatures } from "@/lib/motionFeatures";
import { CinematicScene } from "./CinematicScene";
import type { Scene, SceneEntity, TransitionConfig } from "@/types/story";
import type { NarrationSpeed } from "@/lib/narrationSpeed";

// ─── Props ─────────────────────────────────────────────────────────

interface CinematicRendererProps {
  scenes: Scene[];
  currentIndex: number;
  playing: boolean;
  onComplete?: () => void;
  onSceneChange?: (index: number) => void;
  narrationSpeed?: NarrationSpeed;
  /** Render ambient lore badges (year, mini-map, article chips, title card) over the scene. */
  showBadges?: boolean;
  resolvedSceneData: Array<{
    sceneId: string;
    roomImageSrc?: string;
    entities: Array<{
      entity: SceneEntity;
      name: string;
      imageSrc?: string;
    }>;
  }>;
}

// ─── CinematicRenderer ─────────────────────────────────────────────

export function CinematicRenderer({
  scenes,
  currentIndex,
  playing,
  onComplete,
  narrationSpeed,
  showBadges,
  resolvedSceneData,
}: CinematicRendererProps) {
  // ─── Current scene ─────────────────────────────────────────────

  const scene = scenes[currentIndex];
  if (!scene) return null;

  // ─── Transition config ─────────────────────────────────────────

  const transition: TransitionConfig = scene.transition ?? { type: "crossfade" };

  // ─── AnimatePresence mode ──────────────────────────────────────

  const presenceMode = transition.type === "crossfade" ? "sync" : "wait";

  // ─── Effective narration speed ─────────────────────────────────

  const effectiveSpeed: NarrationSpeed = scene.narrationSpeed ?? narrationSpeed ?? "normal";

  // ─── Resolved data for current scene ───────────────────────────

  const resolved = useMemo(
    () => resolvedSceneData.find((d) => d.sceneId === scene.id),
    [resolvedSceneData, scene.id],
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
            scene={scene}
            playing={playing}
            transition={transition}
            narrationSpeed={effectiveSpeed}
            resolvedEntities={resolved?.entities ?? []}
            roomImageSrc={resolved?.roomImageSrc}
            onAnimationsComplete={onComplete}
            showBadges={showBadges}
          />
        </AnimatePresence>
      </LazyMotion>
    </div>
  );
}
