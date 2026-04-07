import { ModeSwitcher } from "./ModeSwitcher";
import { TimingDropdown } from "./TimingDropdown";
import type { PlayerMode } from "./ModeSwitcher";

function ChevronLeft() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 4l14 8-14 8z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

interface PlayerControlBarProps {
  currentIndex: number;
  totalScenes: number;
  currentSceneTitle?: string;
  playing: boolean;
  mode: PlayerMode;
  autoInterval: number;
  onPrev: () => void;
  onNext: () => void;
  onPlayPause: () => void;
  onModeChange: (mode: PlayerMode) => void;
  onIntervalChange: (interval: number) => void;
}

function controlButtonClassName(disabled?: boolean) {
  return `inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-aurum)]/35 ${
    disabled
      ? "border-border-muted/20 bg-bg-secondary/20 text-text-muted/40"
      : "border-border-muted/35 bg-bg-secondary/50 text-text-secondary hover:border-[var(--color-aurum)]/25 hover:text-[var(--color-aurum-pale)]"
  }`;
}

export function PlayerControlBar({
  currentIndex,
  totalScenes,
  currentSceneTitle,
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
    <div className="rounded-[1.35rem] border border-border-muted/30 bg-[linear-gradient(180deg,rgba(16,17,26,0.92),rgba(9,10,17,0.96))] px-4 py-4">
      <div className="grid gap-4 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:items-center">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={currentIndex === 0}
            aria-label="Previous scene"
            className={controlButtonClassName(currentIndex === 0)}
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            onClick={onPlayPause}
            aria-label={playing ? "Pause playback" : "Play playback"}
            className="inline-flex h-12 min-w-12 items-center justify-center rounded-full border border-[var(--color-aurum)]/35 bg-[var(--color-aurum)]/10 px-3 text-[var(--color-aurum-pale)] transition-colors duration-200 hover:bg-[var(--color-aurum)]/18 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-aurum)]/35"
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={currentIndex === totalScenes - 1}
            aria-label="Next scene"
            className={controlButtonClassName(currentIndex === totalScenes - 1)}
          >
            <ChevronRight />
          </button>
        </div>

        <div className="min-w-0 rounded-[1.1rem] border border-border-muted/25 bg-bg-secondary/35 px-4 py-3">
          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-text-muted">Current scene</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h4 className="min-w-0 flex-1 truncate font-display text-lg text-accent-emphasis">
              {currentSceneTitle ?? `Scene ${currentIndex + 1}`}
            </h4>
            <span aria-live="polite" className="rounded-full border border-border-muted/30 px-3 py-1 text-[0.72rem] uppercase tracking-[0.18em] text-text-muted">
              {currentIndex + 1} / {totalScenes}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:items-end">
          <ModeSwitcher mode={mode} onChange={onModeChange} />
          {mode === "auto" ? (
            <TimingDropdown interval={autoInterval} onChange={onIntervalChange} />
          ) : (
            <p className="text-[0.72rem] uppercase tracking-[0.18em] text-text-muted">
              {mode === "click" ? "Manual advance" : "Scroll sequence"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
