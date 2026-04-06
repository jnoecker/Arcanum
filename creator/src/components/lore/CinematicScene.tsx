import { useState, useEffect } from "react";
import { m } from "motion/react";
import { isBackRow } from "@/lib/sceneLayout";
import { AnimatedEntity } from "./AnimatedEntity";
import { TypewriterNarration } from "./TypewriterNarration";
import type { Scene, SceneEntity, TransitionConfig } from "@/types/story";
import type { NarrationSpeed } from "@/lib/narrationSpeed";

// ─── Props ─────────────────────────────────────────────────────────

interface CinematicSceneProps {
  scene: Scene;
  playing: boolean;
  transition: TransitionConfig;
  narrationSpeed: NarrationSpeed;
  resolvedEntities: Array<{
    entity: SceneEntity;
    name: string;
    imageSrc?: string;
  }>;
  roomImageSrc?: string;
  onAnimationsComplete?: () => void;
}

// ─── Easing ────────────────────────────────────────────────────────

const EASE_COSMIC: [number, number, number, number] = [0.4, 0, 0.2, 1];

// ─── CinematicScene ────────────────────────────────────────────────

export function CinematicScene({
  scene,
  playing,
  transition,
  narrationSpeed,
  resolvedEntities,
  roomImageSrc,
  onAnimationsComplete: _onAnimationsComplete,
}: CinematicSceneProps) {
  // ─── Transition duration ───────────────────────────────────────

  const transitionDuration = transition.type === "crossfade" ? 0.5 : 0.3;

  // ─── Narration delay (200ms after playing starts) ──────────────

  const [narrationPlaying, setNarrationPlaying] = useState(false);

  useEffect(() => {
    if (!playing) {
      setNarrationPlaying(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setNarrationPlaying(true);
    }, 200);

    return () => window.clearTimeout(timer);
  }, [playing]);

  // ─── Entity layer separation ───────────────────────────────────

  const backRowEntities = resolvedEntities.filter((r) => isBackRow(r.entity.slot));
  const frontRowEntities = resolvedEntities.filter((r) => !isBackRow(r.entity.slot));

  // ─── Narration text ────────────────────────────────────────────

  const narrationJson = scene.narration ?? "";

  // ─── Render ────────────────────────────────────────────────────

  return (
    <m.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: transitionDuration, ease: EASE_COSMIC }}
    >
      {/* Layer 0: Room background (z-0) */}
      {roomImageSrc ? (
        <img
          src={roomImageSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-black" />
      )}

      {/* Layer 1: Back-row animated entities (z-10) */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
        {backRowEntities.map((resolved) => (
          <AnimatedEntity
            key={resolved.entity.id}
            entity={resolved.entity}
            entityName={resolved.name}
            imageSrc={resolved.imageSrc}
            playing={playing}
            exiting={false}
          />
        ))}
      </div>

      {/* Layer 2: Front-row animated entities (z-20) */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
        {frontRowEntities.map((resolved) => (
          <AnimatedEntity
            key={resolved.entity.id}
            entity={resolved.entity}
            entityName={resolved.name}
            imageSrc={resolved.imageSrc}
            playing={playing}
            exiting={false}
          />
        ))}
      </div>

      {/* Layer 3: Narration overlay (z-30) */}
      {narrationJson && (
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{ zIndex: 30 }}
        >
          <div className="bg-gradient-to-t from-black/60 to-transparent">
            <TypewriterNarration
              narrationJson={narrationJson}
              playing={narrationPlaying}
              speed={narrationSpeed}
            />
          </div>
        </div>
      )}
    </m.div>
  );
}
