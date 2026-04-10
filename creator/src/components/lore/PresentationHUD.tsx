// ─── PresentationHUD ───────────────────────────────────────────────
// Auto-hiding scene counter pill overlay for presentation mode.

interface PresentationHUDProps {
  currentIndex: number;
  totalScenes: number;
  visible: boolean;
}

export function PresentationHUD({ currentIndex, totalScenes, visible }: PresentationHUDProps) {
  return (
    <div
      className="absolute top-8 right-8 z-[50] rounded-full bg-surface-scrim px-3 py-1.5"
      style={{
        opacity: visible ? 1 : 0,
        transition: visible
          ? "opacity 200ms cubic-bezier(0.16, 1, 0.3, 1)"
          : "opacity 400ms cubic-bezier(0.7, 0, 0.84, 0)",
        pointerEvents: visible ? "auto" : "none",
      }}
      role="status"
      aria-label={`Scene ${currentIndex + 1} of ${totalScenes}`}
    >
      <span className="text-sm font-sans text-text-primary">
        {currentIndex + 1} / {totalScenes}
      </span>
    </div>
  );
}
