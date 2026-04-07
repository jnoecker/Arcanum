import { useCallback, useEffect, useRef, useState } from "react";
import { LazyMotion } from "motion/react";
import { loadMotionFeatures } from "@/lib/motionFeatures";
import { CinematicScene } from "./CinematicScene";
import { SceneInfoBadges } from "./SceneInfoBadges";
import type { ShowcaseStory } from "@/types/showcase";
import type { NarrationSpeed } from "@/lib/narrationSpeed";
import type { SceneEntity, TransitionConfig } from "@/types/story";

interface ScrollModeContainerProps {
  story: ShowcaseStory;
}

export function ScrollModeContainer({ story }: ScrollModeContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timeoutRefs = useRef<number[]>([]);

  const [playingScenes, setPlayingScenes] = useState<Set<string>>(new Set());
  const [activeSceneId, setActiveSceneId] = useState<string | null>(story.scenes[0]?.id ?? null);
  const completedRef = useRef<Set<string>>(new Set());

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const sceneId = entry.target.getAttribute("data-scene-id");
        if (sceneId) {
          setActiveSceneId(sceneId);

          if (!completedRef.current.has(sceneId)) {
            setPlayingScenes((previous) => new Set(previous).add(sceneId));
            const timeout = window.setTimeout(() => {
              completedRef.current.add(sceneId);
              setPlayingScenes((previous) => {
                const next = new Set(previous);
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const observer = new IntersectionObserver(handleIntersection, {
      root: container,
      threshold: 0.5,
    });

    for (const element of sceneRefs.current) {
      if (element) {
        observer.observe(element);
      }
    }

    return () => {
      observer.disconnect();
      for (const timeout of timeoutRefs.current) {
        window.clearTimeout(timeout);
      }
      timeoutRefs.current = [];
    };
  }, [handleIntersection, story.scenes.length]);

  const activeSceneIndex = Math.max(
    0,
    story.scenes.findIndex((scene) => scene.id === activeSceneId),
  );

  return (
    <div
      ref={containerRef}
      className="overflow-y-auto rounded-[1.35rem] border border-border-muted/25 bg-bg-abyss/45 p-3"
      style={{ height: "calc(100vh - 240px)", scrollBehavior: "smooth" }}
    >
      <div className="mb-5 rounded-[1.2rem] border border-[var(--color-aurum)]/18 bg-[linear-gradient(180deg,rgba(17,17,27,0.78),rgba(10,10,18,0.92))] px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.3em] text-[var(--color-aurum)]/80">Sequence ledger</p>
            <p className="mt-2 text-sm leading-7 text-text-secondary">
              Scene {activeSceneIndex + 1} of {story.scenes.length} is currently in view.
            </p>
          </div>
          <div className="rounded-full border border-border-muted/30 bg-bg-secondary/35 px-4 py-2 text-[0.72rem] uppercase tracking-[0.18em] text-text-muted">
            Scroll to activate scenes
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {story.scenes.map((scene, index) => {
          const resolvedEntities = scene.entities.map((entity) => ({
            entity: {
              id: entity.id,
              entityType: entity.entityType,
              entityId: entity.entityId,
              slot: entity.slot as SceneEntity["slot"],
              position: entity.position,
              entrancePath: entity.entrancePath,
              exitPath: entity.exitPath,
            } satisfies SceneEntity,
            name: entity.name,
            imageSrc: entity.imageUrl,
          }));

          const transition: TransitionConfig = scene.transition
            ? { type: scene.transition.type }
            : { type: "crossfade" };

          const narrationSpeed: NarrationSpeed =
            (scene.narrationSpeed as NarrationSpeed | undefined) ??
            (story.narrationSpeed as NarrationSpeed | undefined) ??
            "normal";

          const isPlaying = playingScenes.has(scene.id);

          const sceneData = {
            id: scene.id,
            title: scene.title,
            sortOrder: scene.sortOrder,
            narration: scene.narration,
            transition: scene.transition ? { type: scene.transition.type } : undefined,
            narrationSpeed: scene.narrationSpeed as NarrationSpeed | undefined,
          };

          return (
            <section key={scene.id} className="snap-start">
              <div
                data-scene-id={scene.id}
                ref={(element) => {
                  sceneRefs.current[index] = element;
                }}
                className="overflow-hidden rounded-[1.35rem] border border-border-muted/25 bg-black shadow-[var(--shadow-section)]"
              >
                <div className="relative aspect-video w-full">
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
                  <SceneInfoBadges scene={scene} />
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-3 px-1 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[0.68rem] uppercase tracking-[0.24em] text-[var(--color-aurum)]/80">Scene {index + 1}</p>
                  <h4 className="mt-1 break-words font-display text-xl text-accent-emphasis">{scene.title}</h4>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {scene.narration ? (
                    <span className="rounded-full border border-border-muted/30 bg-bg-secondary/35 px-3 py-1 text-[0.72rem] uppercase tracking-[0.18em] text-text-muted">
                      Narrated
                    </span>
                  ) : null}
                  {scene.entities.length > 0 ? (
                    <span className="rounded-full border border-border-muted/30 bg-bg-secondary/35 px-3 py-1 text-[0.72rem] uppercase tracking-[0.18em] text-text-muted">
                      {scene.entities.length} entities
                    </span>
                  ) : null}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
