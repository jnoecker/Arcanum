// ─── DmNotesOverlay ────────────────────────────────────────────────
// Toggle-able DM notes bottom bar for presentation mode.
// Returns null when notes is empty (D-07).

interface DmNotesOverlayProps {
  notes: string;
  visible: boolean;
}

export function DmNotesOverlay({ notes, visible }: DmNotesOverlayProps) {
  // D-07: no render at all if notes is empty
  if (!notes) return null;

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[50]"
      style={{
        background: "var(--bg-scrim-heavy)",
        borderTop: "1px solid rgb(var(--text-rgb) / 0.08)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(100%)",
        transition: visible
          ? "all 300ms cubic-bezier(0.16, 1, 0.3, 1)"
          : "all 250ms cubic-bezier(0.7, 0, 0.84, 0)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div className="max-w-[960px] mx-auto px-4 py-4">
        <p className="text-[15px] leading-relaxed text-text-secondary">
          {notes}
        </p>
      </div>
    </div>
  );
}
