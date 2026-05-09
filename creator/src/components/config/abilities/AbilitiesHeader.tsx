import { CopyIcon, TrashIcon } from "../achievements/icons";

interface AbilitiesHeaderProps {
  total: number;
  filtered: number;
  selectedId: string | null;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function AbilitiesHeader({
  total,
  filtered,
  selectedId,
  onDuplicate,
  onDelete,
}: AbilitiesHeaderProps) {
  const hasSelection = selectedId !== null;
  return (
    <header className="panel-surface rounded-2xl px-5 py-4 shadow-section">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold text-text-primary">
            Ability Designer
          </h2>
          <p className="mt-0.5 text-2xs leading-relaxed text-text-muted">
            Target rules, class access, effects, and icon identity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatPill count={filtered} label={filtered === total ? "Visible" : `of ${total}`} />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDuplicate}
            disabled={!hasSelection}
            title="Duplicate the selected ability"
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

function StatPill({ count, label }: { count: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-2.5 rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-1.5">
      <span className="flex flex-col items-start leading-none">
        <span className="font-display text-sm font-bold text-text-primary">
          {count}
        </span>
        <span className="font-display text-[0.6rem] uppercase tracking-[0.18em] text-text-muted">
          {label}
        </span>
      </span>
    </span>
  );
}
