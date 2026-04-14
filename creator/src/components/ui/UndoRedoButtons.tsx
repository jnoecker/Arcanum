import { ActionButton } from "./FormWidgets";

interface UndoRedoButtonsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Past-stack depth, surfaced in the tooltip. */
  undoDepth?: number;
  redoDepth?: number;
}

/**
 * Shared undo/redo button pair used by panel hosts and editor toolbars.
 * Consistent styling, icons, and tooltips across the app.
 */
export function UndoRedoButtons({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  undoDepth,
  redoDepth,
}: UndoRedoButtonsProps) {
  const undoTitle = canUndo
    ? `Undo (Ctrl+Z)${undoDepth ? ` — ${undoDepth} step${undoDepth === 1 ? "" : "s"}` : ""}`
    : "Nothing to undo";
  const redoTitle = canRedo
    ? `Redo (Ctrl+Shift+Z)${redoDepth ? ` — ${redoDepth} step${redoDepth === 1 ? "" : "s"}` : ""}`
    : "Nothing to redo";

  return (
    <div className="flex items-center gap-0.5">
      <ActionButton
        variant="ghost"
        size="icon"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Undo"
        title={undoTitle}
        className={!canUndo ? "opacity-45" : ""}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 7h8a3 3 0 0 1 0 6H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 4L4 7l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ActionButton>
      <ActionButton
        variant="ghost"
        size="icon"
        onClick={onRedo}
        disabled={!canRedo}
        aria-label="Redo"
        title={redoTitle}
        className={!canRedo ? "opacity-45" : ""}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M12 7H4a3 3 0 0 0 0 6h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ActionButton>
    </div>
  );
}
