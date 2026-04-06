// ─── ScrollModeContainer ──────────────────────────────────────────
// Vertical scroll-snap container with IntersectionObserver for animation triggers.
// Scenes that have been viewed show their final state on revisit (no re-animation).

import { useRef, useState, useEffect, useCallback } from "react";
import { LazyMotion } from "motion/react";
import { loadMotionFeatures } from "@/lib/motionFeatures";
import { CinematicScene } from "./CinematicScene";
import type { ShowcaseStory } from "@/types/showcase";
import type { SceneEntity, TransitionConfig } from "@/types/story";
import type { NarrationSpeed } from "@/lib/narrationSpeed";

// ─── Props ────────────────────────────────────────────────────────

interface ScrollModeContainerProps {
  story: ShowcaseStory;
}

// ─── ScrollModeContainer ──────────────────────────────────────────

export function ScrollModeContainer({ story }: ScrollModeContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timeoutRefs = useRef<number[]>([]);

  // ─── Animation tracking (two-phase system) ──────────────────────
  // playingScenes: scenes currently animating (entrance animations active)
  // completedRef: scenes that have finished animating (show final state)

  const [playingScenes, setPlayingScenes] = useState<Set<string>>(new Set());
  const completedRef = useRef<Set<string>>(new Set());
  const [, setActiveSceneId] = useState<string | null>(story.scenes[0]?.id ?? null);

  // ─── IntersectionObserver callback ──────────────────────────────

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const sceneId = entry.target.getAttribute("data-scene-id");
        if (sceneId) {
          setActiveSceneId(sceneId);

          if (!completedRef.current.has(sceneId)) {
            setPlayingScenes((prev) => new Set(prev).add(sceneId));

            // Mark as completed after animations finish (generous 2s buffer)
            const timeout = window.setTimeout(() => {
              completedRef.current.add(sceneId);
              setPlayingScenes((prev) => {
                const next = new Set(prev);
                next.delete(sceneId);
                return next;
              });
            }, 2000);

            timeoutRefs.current.push(timeout);
          }
        }
      }
    }
  }, []);

  // ─── Setup IntersectionObserver ─────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(handleIntersection, {
      root: container,
      threshold: 0.5,
    });

    for (const el of sceneRefs.current) {
      if (el) observer.observe(el);
    }

    return () => {
      observer.disconnect();
      // Clear all pending timeouts on unmount
      for (const t of timeoutRefs.current) {
        window.clearTimeout(t);
      }
      timeoutRefs.current = [];
    };
  }, [handleIntersection, story.scenes.length]);

  // ─── Render scenes ──────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="overflow-y-auto snap-y snap-mandatory rounded-lg"
      style={{ height: "calc(100vh - 200px)", scrollBehavior: "smooth" }}
    >
      {story.scenes.map((scene, i) => {
        // Resolve entities to the format CinematicScene expects
        const resolvedEntities = scene.entities.map((e) => ({
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
        }));

        const transition: TransitionConfig = scene.transition
          ? { type: scene.transition.type }
          : { type: "crossfade" };

        const narrationSpeed: NarrationSpeed =
          (scene.narrationSpeed as NarrationSpeed | undefined) ??
          (story.narrationSpeed as NarrationSpeed | undefined) ??
          "normal";

        const isPlaying = playingScenes.has(scene.id);

        // Build minimal scene-like object for CinematicScene
        const sceneData = {
          id: scene.id,
          title: scene.title,
          sortOrder: scene.sortOrder,
          narration: scene.narration,
          transition: scene.transition ? { type: scene.transition.type } : undefined,
          narrationSpeed: scene.narrationSpeed as NarrationSpeed | undefined,
        };

        return (
          <div
            key={scene.id}
            data-scene-id={scene.id}
            ref={(el) => { sceneRefs.current[i] = el; }}
            className="snap-start aspect-video w-full rounded-lg overflow-hidden relative bg-black mb-2"
          >
            <LazyMotion features={loadMotionFeatures} strict>
              <CinematicScene
                scene={sceneData}
                playing={isPlaying}
                transition={transition}
                narrationSpeed={narrationSpeed}
                resolvedEntities={resolvedEntities}
                roomImageSrc={scene.roomImageUrl}
              />
            </LazyMotion>
          </div>
        );
      })}

      {/* Subtle scroll indicator */}
      <div className="h-0.5 bg-accent/20 w-full" aria-hidden="true" />
    </div>
  );
}
