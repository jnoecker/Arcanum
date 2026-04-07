// ─── StoryPlayer ──────────────────────────────────────────────────
// Player orchestrator with three modes: click-through, auto-play, and scroll.

import { useState, useEffect, useCallback, useRef } from "react";
import { CinematicRenderer } from "./CinematicRenderer";
import { CinematicOverlay } from "./CinematicOverlay";
import { PlayerControlBar } from "./PlayerControlBar";
import { ScrollModeContainer } from "./ScrollModeContainer";
import { ModeSwitcher } from "./ModeSwitcher";
import type { PlayerMode } from "./ModeSwitcher";
import type { ShowcaseStory } from "@/types/showcase";

// ─── Props ────────────────────────────────────────────────────────

interface StoryPlayerProps {
  story: ShowcaseStory;
}

// ─── StoryPlayer ──────────────────────────────────────────────────

export function StoryPlayer({ story }: StoryPlayerProps) {
  const scenes = story.scenes;

  // ─── State ──────────────────────────────────────────────────────

  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<PlayerMode>("click");
  const [autoInterval, setAutoInterval] = useState(10000);
  const [autoTimerActive, setAutoTimerActive] = useState(false);
  const [showCinematic, setShowCinematic] = useState(false);

  // ─── Navigation ─────────────────────────────────────────────────

  const goNext = useCallback(() => {
    if (currentIndex < scenes.length - 1) {
      setCurrentIndex((i) => i + 1);
      setPlaying(true);
    }
  }, [currentIndex, scenes.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setPlaying(false);
    }
  }, [currentIndex]);

  const handlePlayPause = useCallback(() => {
    setPlaying((p) => !p);
  }, []);

  // ─── Keyboard navigation ───────────────────────────────────────

  useEffect(() => {
    if (mode === "scroll") return;

    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case " ":
        case "Enter":
          e.preventDefault();
          goNext();
          break;
        case "ArrowLeft":
          e.preventDefault();
          goPrev();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, goNext, goPrev]);

  // ─── Auto-play timer ───────────────────────────────────────────

  useEffect(() => {
    if (mode === "auto" && playing && currentIndex < scenes.length - 1) {
      setAutoTimerActive(true);
      const timeout = setTimeout(goNext, autoInterval);
      return () => {
        clearTimeout(timeout);
        setAutoTimerActive(false);
      };
    } else {
      setAutoTimerActive(false);
    }
    return undefined;
  }, [mode, currentIndex, autoInterval, playing, scenes.length, goNext]);

  // ─── Mode switching ─────────────────────────────────────────────

  const handleModeChange = useCallback((newMode: PlayerMode) => {
    setMode(newMode);
    setPlaying(false);
    setAutoTimerActive(false);
  }, []);

  // ─── Auto-play progress bar ref ─────────────────────────────────

  const progressBarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = progressBarRef.current;
    if (!el || !autoTimerActive || mode !== "auto") return;
    // Start at 0%, then animate to 100%
    el.style.width = "0%";
    el.style.transition = "none";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = `width ${autoInterval}ms linear`;
        el.style.width = "100%";
      });
    });
  }, [autoTimerActive, autoInterval, mode, currentIndex]);

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div>
      {/* Watch cinematic button — only when an exported MP4 exists */}
      {story.cinematicUrl && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => setShowCinematic(true)}
            className="flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 font-display text-xs uppercase tracking-[0.12em] text-accent transition-colors hover:border-accent hover:bg-accent/20"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
              <path d="M2.5 1v10l8-5z" />
            </svg>
            Watch as cinematic
          </button>
        </div>
      )}

      {mode !== "scroll" ? (
        <div className="relative">
          {/* Clickable renderer area for click-through and auto modes */}
          <div
            onClick={goNext}
            onKeyDown={undefined}
            role="presentation"
            className="cursor-pointer"
          >
            <CinematicRenderer
              scenes={scenes}
              currentIndex={currentIndex}
              playing={playing}
              narrationSpeed={story.narrationSpeed}
              onComplete={() => setPlaying(false)}
            />
          </div>

          {/* Auto-play progress bar */}
          {autoTimerActive && mode === "auto" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 z-40 rounded-b-lg overflow-hidden">
              <div
                key={currentIndex}
                ref={progressBarRef}
                className="h-full bg-accent/60"
              />
            </div>
          )}
        </div>
      ) : (
        <ScrollModeContainer story={story} />
      )}

      {/* Control bar (hidden in scroll mode) */}
      {mode !== "scroll" && (
        <div className="mt-4">
          <PlayerControlBar
            currentIndex={currentIndex}
            totalScenes={scenes.length}
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
      )}

      {/* Standalone mode switcher in scroll mode */}
      {mode === "scroll" && (
        <div className="mt-4 flex justify-end">
          <ModeSwitcher mode={mode} onChange={handleModeChange} />
        </div>
      )}

      {/* Cinematic video overlay */}
      {showCinematic && story.cinematicUrl && (
        <CinematicOverlay
          src={story.cinematicUrl}
          title={story.title}
          onClose={() => setShowCinematic(false)}
        />
      )}
    </div>
  );
}
