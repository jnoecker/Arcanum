import { CopyIcon, TrashIcon } from "../achievements/icons";

interface RacesHeaderProps {
  raceCount: number;
  selectedId: string | null;
  selectedName?: string;
  onDuplicate: () => void;
  onDelete: () => void;
  onSave?: () => void;
  saveDisabled?: boolean;
}

export function RacesHeader({
  raceCount,
  selectedId,
  selectedName,
  onDuplicate,
  onDelete,
  onSave,
  saveDisabled,
}: RacesHeaderProps) {
  const hasSelection = selectedId !== null;
  return (
    <header className="panel-surface rounded-2xl px-5 py-4 shadow-section">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-display text-[0.6rem] font-semibold uppercase tracking-[0.32em] text-text-muted">
            Races
            {selectedName && (
              <>
                <span className="mx-2 text-text-muted/50">›</span>
                <span className="text-accent">{selectedName.toUpperCase()}</span>
              </>
            )}
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-text-primary">
            Race Designer
          </h2>
          <p className="mt-0.5 text-2xs leading-relaxed text-text-muted">
            Lore, traits, body language, and stat identity for every playable race.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <RosterPill count={raceCount} />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDuplicate}
            disabled={!hasSelection}
            title="Duplicate the selected race"
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
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={saveDisabled}
              className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save Changes
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function RosterPill({ count }: { count: number }) {
  return (
    <span
      title="Total races"
      className="inline-flex items-center gap-2.5 rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-1.5"
    >
      <span className="flex flex-col items-start leading-none">
        <span className="font-display text-sm font-bold text-text-primary">
          {count}
        </span>
        <span className="font-display text-[0.6rem] uppercase tracking-[0.18em] text-text-muted">
          Roster
        </span>
      </span>
    </span>
  );
}
