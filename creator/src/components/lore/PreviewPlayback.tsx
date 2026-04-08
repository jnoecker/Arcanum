// ─── Props ─────────────────────────────────────────────────────────

interface PreviewPlaybackProps {
  playing: boolean;
  onToggle: () => void;
}

// ─── Reduced motion check ──────────────────────────────────────────

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ─── PreviewPlayback ───────────────────────────────────────────────

export function PreviewPlayback({ playing, onToggle }: PreviewPlaybackProps) {
  const idleLabel = prefersReducedMotion ? "Preview (reduced motion)" : "Preview";

  return (
    <div className="absolute top-2 right-2 z-40">
      <button
        type="button"
        className={[
          "h-9 backdrop-blur-sm border rounded-md px-3 flex items-center gap-2",
          "transition-[color,background-color,border-color,box-shadow,opacity] duration-[180ms]",
          "opacity-70 hover:opacity-100",
          playing
            ? "bg-bg-elevated/80 border-border-default shadow-[0_0_12px_rgba(200,164,106,0.4)] animate-pulse"
            : "bg-bg-elevated/80 border-border-muted hover:bg-bg-elevated hover:border-border-default hover:shadow-[0_0_8px_rgba(168,151,210,0.3)]",
        ].join(" ")}
        onClick={onToggle}
        aria-label={playing ? "Stop scene animation" : "Preview scene animation"}
      >
        {playing ? (
          <>
            {/* Stop square icon */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className="text-warm">
              <rect x="2" y="2" width="10" height="10" rx="1" />
            </svg>
            <span className="font-body text-xs uppercase tracking-[0.18em] text-warm">
              Stop
            </span>
          </>
        ) : (
          <>
            {/* Play triangle icon */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className="text-accent">
              <path d="M3 1.5v11l9-5.5z" />
            </svg>
            <span className="font-body text-xs uppercase tracking-[0.18em] text-accent">
              {idleLabel}
            </span>
          </>
        )}
      </button>
    </div>
  );
}
