// ─── PlayerControlBar ─────────────────────────────────────────────
// Bottom control bar: prev/next, scene counter, play/pause, mode switcher, timing dropdown.

import { ModeSwitcher } from "./ModeSwitcher";
import { TimingDropdown } from "./TimingDropdown";
import type { PlayerMode } from "./ModeSwitcher";

// ─── SVG Icons (inline, no icon library) ─────────────────────────

function ChevronLeft() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 4l14 8-14 8z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────

interface PlayerControlBarProps {
  currentIndex: number;
  totalScenes: number;
  playing: boolean;
  mode: PlayerMode;
  autoInterval: number;
  onPrev: () => void;
  onNext: () => void;
  onPlayPause: () => void;
  onModeChange: (mode: PlayerMode) => void;
  onIntervalChange: (interval: number) => void;
}

// ─── PlayerControlBar ─────────────────────────────────────────────

export function PlayerControlBar({
  currentIndex,
  totalScenes,
  playing,
  mode,
  autoInterval,
  onPrev,
  onNext,
  onPlayPause,
  onModeChange,
  onIntervalChange,
}: PlayerControlBarProps) {
  return (
    <div className="bg-bg-secondary/80 backdrop-blur-md rounded-lg border border-border-muted/40 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      {/* Left group: navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={onPrev}
          disabled={currentIndex === 0}
          aria-label="Previous scene"
          className="p-2 text-text-muted disabled:opacity-30 hover:text-text-primary transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:rounded"
        >
          <ChevronLeft />
        </button>

        <span
          aria-live="polite"
          className="text-[12px] font-display tracking-[0.12em] text-text-secondary"
        >
          Scene <span className="text-accent">{currentIndex + 1}</span> / {totalScenes}
        </span>

        <button
          onClick={onNext}
          disabled={currentIndex === totalScenes - 1}
          aria-label="Next scene"
          className="p-2 text-text-muted disabled:opacity-30 hover:text-text-primary transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:rounded"
        >
          <ChevronRight />
        </button>
      </div>

      {/* Center: play/pause */}
      <button
        onClick={onPlayPause}
        aria-label={playing ? "Pause" : "Play"}
        className="p-2 text-accent hover:text-accent-emphasis transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:rounded"
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      {/* Right group: mode + timing */}
      <div className="flex items-center gap-3 sm:ml-auto">
        <ModeSwitcher mode={mode} onChange={onModeChange} />
        {mode === "auto" && (
          <TimingDropdown interval={autoInterval} onChange={onIntervalChange} />
        )}
      </div>
    </div>
  );
}
