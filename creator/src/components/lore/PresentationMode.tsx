import { useState, useEffect, useCallback, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { CinematicRenderer } from "./CinematicRenderer";
import { PresentationHUD } from "./PresentationHUD";
import { DmNotesOverlay } from "./DmNotesOverlay";
import { useResolvedSceneData } from "@/lib/useResolvedSceneData";
import type { Scene } from "@/types/story";
import type { NarrationSpeed } from "@/lib/narrationSpeed";

// ─── Reduced motion detection ──────────────────────────────────────

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ─── Constants ─────────────────────────────────────────────────────

const HUD_TIMEOUT_MS = 3000;
const CURSOR_TIMEOUT_MS = 3000;

// ─── Props ─────────────────────────────────────────────────────────

interface PresentationModeProps {
  scenes: Scene[];
  initialSceneIndex: number;
  zoneId: string;
  narrationSpeed?: NarrationSpeed;
  onExit: (currentSceneId: string) => void;
}

// ─── PresentationMode ──────────────────────────────────────────────

export function PresentationMode({
  scenes,
  initialSceneIndex,
  zoneId,
  narrationSpeed,
  onExit,
}: PresentationModeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // ─── Local state ──────────────────────────────────────────────

  const [currentIndex, setCurrentIndex] = useState(initialSceneIndex);
  const [playing, setPlaying] = useState(true);
  const [dmNotesVisible, setDmNotesVisible] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [badgesVisible, setBadgesVisible] = useState(false);

  // ─── Timer refs ───────────────────────────────────────────────

  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Image resolution ─────────────────────────────────────────

  const resolvedSceneData = useResolvedSceneData(scenes, zoneId);

  // ─── HUD timer ────────────────────────────────────────────────

  const resetHudTimer = useCallback(() => {
    setHudVisible(true);
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => {
      setHudVisible(false);
    }, HUD_TIMEOUT_MS);
  }, []);

  // ─── Cursor timer ─────────────────────────────────────────────

  const resetCursorTimer = useCallback(() => {
    setCursorVisible(true);
    if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    cursorTimerRef.current = setTimeout(() => {
      setCursorVisible(false);
    }, CURSOR_TIMEOUT_MS);
  }, []);

  // ─── Exit handler ─────────────────────────────────────────────

  const handleExit = useCallback(() => {
    const currentScene = scenes[currentIndex];
    if (currentScene) {
      onExit(currentScene.id);
    }
  }, [scenes, currentIndex, onExit]);

  // ─── Navigation handlers ──────────────────────────────────────

  const advanceScene = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev < scenes.length - 1) {
        setPlaying(true);
        return prev + 1;
      }
      return prev;
    });
  }, [scenes.length]);

  const retreatScene = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev > 0) {
        setPlaying(false);
        return prev - 1;
      }
      return prev;
    });
  }, []);

  // ─── Mouse handlers ───────────────────────────────────────────

  const handleClick = useCallback(() => {
    advanceScene();
    resetHudTimer();
  }, [advanceScene, resetHudTimer]);

  const handleRightClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      retreatScene();
      resetHudTimer();
    },
    [retreatScene, resetHudTimer],
  );

  // ─── Animation complete handler ───────────────────────────────

  const handleAnimationComplete = useCallback(() => {
    // Scene animations finished -- no auto-advance, DM controls pacing
  }, []);

  // ─── Fullscreen lifecycle ─────────────────────────────────────

  useEffect(() => {
    // Enter fullscreen on mount
    (async () => {
      try {
        await getCurrentWindow().setFullscreen(true);
      } catch {
        // Fallback: continue without fullscreen (e.g. dev mode without Tauri)
      }
    })();

    return () => {
      // Exit fullscreen on unmount
      (async () => {
        try {
          await getCurrentWindow().setFullscreen(false);
        } catch {
          // Ignore
        }
      })();
    };
  }, []);

  // ─── Focus management ─────────────────────────────────────────

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // ─── Initialize timers ────────────────────────────────────────

  useEffect(() => {
    resetHudTimer();
    resetCursorTimer();

    return () => {
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    };
  }, [resetHudTimer, resetCursorTimer]);

  // ─── Keyboard handler ────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      resetHudTimer();

      switch (e.key) {
        case "ArrowRight":
        case " ":
        case "Enter":
          e.preventDefault();
          advanceScene();
          break;

        case "ArrowLeft":
          e.preventDefault();
          retreatScene();
          break;

        case "Escape":
        case "F5":
          e.preventDefault();
          handleExit();
          break;

        case "d":
        case "D":
        case "n":
        case "N": {
          e.preventDefault();
          const currentScene = scenes[currentIndex];
          if (currentScene?.dmNotes) {
            setDmNotesVisible((prev) => !prev);
          }
          break;
        }

        case "i":
        case "I": {
          e.preventDefault();
          setBadgesVisible((prev) => !prev);
          break;
        }

        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [advanceScene, retreatScene, handleExit, resetHudTimer, scenes, currentIndex]);

  // ─── Mouse move handler (cursor + HUD auto-hide) ─────────────

  useEffect(() => {
    const handleMouseMove = () => {
      resetCursorTimer();
      resetHudTimer();
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [resetCursorTimer, resetHudTimer]);

  // ─── Reset DM notes when scene changes ────────────────────────

  useEffect(() => {
    setDmNotesVisible(false);
  }, [currentIndex]);

  // ─── Effective playing state (reduced motion) ─────────────────

  const effectivePlaying = prefersReducedMotion ? false : playing;

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-bg-abyss"
      style={{ cursor: cursorVisible ? "default" : "none" }}
      onClick={handleClick}
      onContextMenu={handleRightClick}
      role="region"
      aria-label="Story presentation"
      tabIndex={-1}
    >
      {/* CinematicRenderer -- centered, fills viewport width, maintains 16:9 */}
      <div className="relative w-full max-h-full" style={{ aspectRatio: "16/9" }}>
        <CinematicRenderer
          scenes={scenes}
          currentIndex={currentIndex}
          playing={effectivePlaying}
          narrationSpeed={narrationSpeed}
          resolvedSceneData={resolvedSceneData}
          onComplete={handleAnimationComplete}
          showBadges={badgesVisible}
        />

        {/* HUD overlay -- inside renderer container for positioning */}
        <PresentationHUD
          currentIndex={currentIndex}
          totalScenes={scenes.length}
          visible={hudVisible}
        />

        {/* DM Notes overlay */}
        <DmNotesOverlay
          notes={scenes[currentIndex]?.dmNotes ?? ""}
          visible={dmNotesVisible}
        />
      </div>
    </div>
  );
}
