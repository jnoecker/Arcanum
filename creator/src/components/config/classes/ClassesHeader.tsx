import { CopyIcon, TrashIcon } from "../achievements/icons";

interface ClassesHeaderProps {
  classCount: number;
  selectedId: string | null;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function ClassesHeader({
  classCount,
  selectedId,
  onDuplicate,
  onDelete,
}: ClassesHeaderProps) {
  const hasSelection = selectedId !== null;

  return (
    <header className="panel-surface rounded-2xl px-5 py-4 shadow-section">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold text-text-primary">
            Class Designer
          </h2>
          <p className="mt-0.5 text-2xs leading-relaxed text-text-muted">
            Tune progression, identity, and presentation for each class.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2.5 rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-1.5">
            <span className="flex flex-col items-start leading-none">
              <span className="font-display text-sm font-bold text-text-primary">
                {classCount}
              </span>
              <span className="font-display text-[0.6rem] uppercase tracking-[0.18em] text-text-muted">
                Classes
              </span>
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDuplicate}
            disabled={!hasSelection}
            title="Duplicate the selected class"
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-accent/30 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CopyIcon />
            Duplicate
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={!hasSelection}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-status-error/40 bg-status-error/10 px-3 py-1.5 text-xs font-medium text-status-error transition hover:bg-status-error/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <TrashIcon />
            Delete
          </button>
        </div>
      </div>
    </header>
  );
}
