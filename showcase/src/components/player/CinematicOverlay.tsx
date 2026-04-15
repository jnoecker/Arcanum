// ─── CinematicOverlay ────────────────────────────────────────────
// Full-screen <video> player for the exported story cinematic MP4.
// Opened from StoryPlayer when the story has a `cinematicUrl`.
//
// Uses the browser's native video controls for timeline scrubbing,
// volume, and fullscreen — nothing custom. A backdrop click or the
// Escape key closes the overlay.

import { useEffect, useRef } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";

interface CinematicOverlayProps {
  /** Public MP4 URL on R2. */
  src: string;
  /** Story title, shown in the header for context. */
  title: string;
  /** Called when the user closes the overlay. */
  onClose: () => void;
}

export function CinematicOverlay({ src, title, onClose }: CinematicOverlayProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  // Close on Escape.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Lock body scroll while the overlay is mounted so the interactive
  // player below doesn't scroll in the background.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Attempt autoplay; most browsers require the video to be muted or
  // the user to have interacted with the page for this to succeed.
  // Native video controls let the user unmute + replay if autoplay
  // is blocked.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {
      // Autoplay blocked — user will click play. Nothing to do.
    });
  }, []);

  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cinematic-overlay-title"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-bg-abyss/95"
      onClick={(e) => {
        // Click on the backdrop (not the video itself) closes.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Header with title + close */}
      <div className="absolute top-0 left-0 right-0 flex items-start justify-between gap-4 px-6 py-4 text-text-primary">
        <h2
          id="cinematic-overlay-title"
          className="min-w-0 flex-1 text-pretty break-words font-display text-lg tracking-wide"
        >
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close cinematic"
          title="Close cinematic"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border-muted/40 bg-bg-abyss/60 text-text-primary transition-colors hover:bg-bg-secondary/40"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path
              d="M4 4l10 10M14 4L4 14"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Video */}
      <video
        ref={videoRef}
        src={src}
        controls
        playsInline
        className="max-h-[85vh] max-w-[95vw] rounded-lg shadow-2xl"
      >
        Your browser does not support HTML5 video. You can{" "}
        <a href={src} className="text-accent underline">
          download the file
        </a>{" "}
        instead.
      </video>

      {/* Footer hint */}
      <p className="absolute bottom-6 left-0 right-0 text-center text-xs text-text-muted">
        Press Esc or click the backdrop to return to the interactive player.
      </p>
    </div>
  );
}
