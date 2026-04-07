import { useCallback, useEffect, useRef, useState } from "react";
import { CinematicOverlay } from "./CinematicOverlay";
import { CinematicRenderer } from "./CinematicRenderer";
import { ModeSwitcher } from "./ModeSwitcher";
import { PlayerControlBar } from "./PlayerControlBar";
import { ScrollModeContainer } from "./ScrollModeContainer";
import type { PlayerMode } from "./ModeSwitcher";
import type { ShowcaseStory } from "@/types/showcase";

interface StoryPlayerProps {
  story: ShowcaseStory;
}

export function StoryPlayer({ story }: StoryPlayerProps) {
  const scenes = story.scenes;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<PlayerMode>("click");
  const [autoInterval, setAutoInterval] = useState(10000);
  const [autoTimerActive, setAutoTimerActive] = useState(false);
  const [showCinematic, setShowCinematic] = useState(false);

  const goNext = useCallback(() => {
    if (currentIndex < scenes.length - 1) {
      setCurrentIndex((index) => index + 1);
      setPlaying(true);
    }
  }, [currentIndex, scenes.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((index) => index - 1);
      setPlaying(false);
    }
  }, [currentIndex]);

  const handlePlayPause = useCallback(() => {
    setPlaying((value) => !value);
  }, []);

  useEffect(() => {
    if (mode === "auto" && playing && currentIndex < scenes.length - 1) {
      setAutoTimerActive(true);
      const timeout = setTimeout(goNext, autoInterval);
      return () => {
        clearTimeout(timeout);
        setAutoTimerActive(false);
      };
    }

    setAutoTimerActive(false);
    return undefined;
  }, [autoInterval, currentIndex, goNext, mode, playing, scenes.length]);

  const handleModeChange = useCallback((nextMode: PlayerMode) => {
    setMode(nextMode);
    setPlaying(false);
    setAutoTimerActive(false);
  }, []);

  const progressBarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = progressBarRef.current;
    if (!element || !autoTimerActive || mode !== "auto") {
      return;
    }

    element.style.transform = "scaleX(0)";
    element.style.transition = "none";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        element.style.transition = `transform ${autoInterval}ms linear`;
        element.style.transform = "scaleX(1)";
      });
    });
  }, [autoInterval, autoTimerActive, currentIndex, mode]);

  const handleViewportKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (mode === "scroll") return;

      switch (event.key) {
        case "ArrowRight":
        case " ":
        case "Enter":
          event.preventDefault();
          goNext();
          break;
        case "ArrowLeft":
          event.preventDefault();
          goPrev();
          break;
      }
    },
    [goNext, goPrev, mode],
  );

  const currentScene = scenes[currentIndex];
  const modeDescription =
    mode === "click"
      ? "Advance scene by scene."
      : mode === "auto"
        ? `Advance automatically every ${Math.round(autoInterval / 1000)} seconds.`
        : "Scroll through the full sequence at your own pace.";

  return (
    <div className="space-y-4">
      <div className="rounded-[1.45rem] border border-[var(--color-aurum)]/20 bg-[linear-gradient(180deg,rgba(18,18,28,0.88),rgba(10,10,18,0.96))] px-4 py-4 shadow-[var(--shadow-section)] sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[0.68rem] uppercase tracking-[0.3em] text-[var(--color-aurum)]/80">Projection controls</p>
            <h3 className="mt-2 break-words font-display text-2xl text-[var(--color-aurum-pale)]">
              {currentScene?.title ?? story.title}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-text-secondary">
              Scene {currentIndex + 1} of {scenes.length}. {modeDescription}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {story.cinematicUrl ? (
              <button
                type="button"
                onClick={() => setShowCinematic(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--color-aurum)]/35 bg-[var(--color-aurum)]/10 px-4 py-2 font-display text-[0.72rem] uppercase tracking-[0.16em] text-[var(--color-aurum-pale)] transition-colors hover:bg-[var(--color-aurum)]/18 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-aurum)]/35"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                  <path d="M2.5 1v10l8-5z" />
                </svg>
                Watch cinematic
              </button>
            ) : null}
            <div className="inline-flex min-h-11 items-center rounded-full border border-border-muted/30 bg-bg-secondary/45 px-4 py-2 text-[0.72rem] uppercase tracking-[0.18em] text-text-muted">
              {mode === "scroll" ? "Exhibition mode" : playing ? "Projection live" : "Projection paused"}
            </div>
          </div>
        </div>
      </div>

      {mode !== "scroll" ? (
        <div className="rounded-[1.6rem] border border-border-muted/35 bg-[linear-gradient(180deg,rgba(18,18,28,0.92),rgba(10,10,18,0.98))] p-3 shadow-[var(--shadow-deep)] sm:p-4">
          <div className="relative overflow-hidden rounded-[1.2rem] border border-border-muted/20">
            <div
              onClick={goNext}
              onKeyDown={handleViewportKeyDown}
              role="group"
              tabIndex={0}
              aria-label="Story playback viewport"
              className="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-aurum)]/35"
            >
              <CinematicRenderer
                scenes={scenes}
                currentIndex={currentIndex}
                playing={playing}
                narrationSpeed={story.narrationSpeed}
                onComplete={() => setPlaying(false)}
              />
            </div>

            {autoTimerActive && mode === "auto" ? (
              <div className="absolute inset-x-6 bottom-4 z-40 h-1 overflow-hidden rounded-full bg-black/35">
                <div
                  key={currentIndex}
                  ref={progressBarRef}
                  className="h-full origin-left scale-x-0 rounded-full bg-[linear-gradient(90deg,var(--color-aurum),var(--color-aurum-pale))]"
                />
              </div>
            ) : null}
          </div>

          <div className="mt-4">
            <PlayerControlBar
              currentIndex={currentIndex}
              totalScenes={scenes.length}
              currentSceneTitle={currentScene?.title}
              playing={playing}
              mode={mode}
              autoInterval={autoInterval}
              onPrev={goPrev}
              onNext={goNext}
              onPlayPause={handlePlayPause}
              onModeChange={handleModeChange}
              onIntervalChange={setAutoInterval}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-[1.6rem] border border-border-muted/35 bg-[linear-gradient(180deg,rgba(18,18,28,0.92),rgba(10,10,18,0.98))] p-4 shadow-[var(--shadow-deep)]">
          <div className="mb-4 flex flex-col gap-3 border-b border-border-muted/25 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[0.68rem] uppercase tracking-[0.3em] text-[var(--color-aurum)]/80">Scroll exhibition</p>
              <p className="mt-2 text-sm leading-7 text-text-secondary">
                The full story opens as a vertical sequence of staged scenes and notes.
              </p>
            </div>
            <ModeSwitcher mode={mode} onChange={handleModeChange} />
          </div>
          <ScrollModeContainer story={story} />
        </div>
      )}

      {showCinematic && story.cinematicUrl ? (
        <CinematicOverlay src={story.cinematicUrl} title={story.title} onClose={() => setShowCinematic(false)} />
      ) : null}
    </div>
  );
}
