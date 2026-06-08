import { useMemo, useState } from "react";
import type { CommandEntryConfig } from "@/types/config";
import { SearchIcon, PlusIcon, MoreIcon, CopyIcon, TrashIcon } from "@/components/config/icons";
import { cx } from "@/components/ui/FormWidgets";

interface CommandsListProps {
  commands: Record<string, CommandEntryConfig>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const ALL_CATEGORIES = "__all__";

export function CommandsList({
  commands,
  selectedId,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
}: CommandsListProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORIES);
  const [filterOpen, setFilterOpen] = useState(false);
  const hasSelection = selectedId !== null;

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const cmd of Object.values(commands)) {
      if (cmd.category) set.add(cmd.category);
    }
    return [...set].sort();
  }, [commands]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(commands).filter(([id, cmd]) => {
      if (activeCategory !== ALL_CATEGORIES && cmd.category !== activeCategory) {
        return false;
      }
      if (!q) return true;
      return (
        id.toLowerCase().includes(q) ||
        cmd.usage.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q)
      );
    });
  }, [commands, query, activeCategory]);

  const activeCategoryLabel =
    activeCategory === ALL_CATEGORIES ? "All" : activeCategory;

  return (
    <aside className="panel-surface flex flex-col gap-2 rounded-2xl p-3 shadow-section">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
          Commands
        </h3>
        <span className="font-mono text-2xs text-text-muted/70">
          {Object.keys(commands).length}
        </span>
      </div>

      <div className="ornate-input flex items-center gap-2 px-2.5 py-1.5">
        <SearchIcon className="text-text-muted/70" />
        <input
          className="min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted/60"
          placeholder="Search commands…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {allCategories.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              title={`Filter by category · ${activeCategoryLabel}`}
              aria-label={`Filter by category, current: ${activeCategoryLabel}`}
              className={cx(
                "focus-ring inline-flex h-7 items-center gap-1 rounded-md border px-2 text-2xs uppercase tracking-wider transition",
                activeCategory === ALL_CATEGORIES
                  ? "border-[var(--chrome-stroke)] bg-transparent text-text-muted hover:border-accent/30 hover:text-accent"
                  : "border-accent/40 bg-accent/10 text-accent",
              )}
            >
              <MoreIcon className="h-3 w-3" />
              <span>{activeCategoryLabel}</span>
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-7 z-20 w-44 overflow-hidden rounded-xl border border-[var(--chrome-stroke)] bg-bg-elevated shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setActiveCategory(ALL_CATEGORIES);
                    setFilterOpen(false);
                  }}
                  className={cx(
                    "flex w-full items-center gap-2 border-b border-[var(--chrome-stroke)] px-3 py-2 text-left text-xs transition",
                    activeCategory === ALL_CATEGORIES
                      ? "bg-accent/10 text-accent"
                      : "text-text-secondary hover:bg-[var(--chrome-fill-soft)]",
                  )}
                >
                  All
                </button>
                {allCategories.map((cat) => {
                  const active = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setActiveCategory(cat);
                        setFilterOpen(false);
                      }}
                      className={cx(
                        "flex w-full items-center gap-2 border-b border-[var(--chrome-stroke)] px-3 py-2 text-left text-xs transition last:border-b-0",
                        active
                          ? "bg-accent/10 text-accent"
                          : "text-text-secondary hover:bg-[var(--chrome-fill-soft)]",
                      )}
                    >
                      <span className="truncate">{cat}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onAdd}
          className="focus-ring inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-2xs font-medium text-accent transition hover:bg-accent/20"
        >
          <PlusIcon />
          Add
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          disabled={!hasSelection}
          title="Duplicate the selected command"
          aria-label="Duplicate the selected command"
          className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted transition hover:border-accent/30 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
        >
          <CopyIcon />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={!hasSelection}
          title="Delete the selected command"
          aria-label="Delete the selected command"
          className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-lg border border-status-error/40 bg-status-error/10 text-status-error transition hover:bg-status-error/20 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <TrashIcon />
        </button>
      </div>

      <ul className="-mx-1 flex max-h-[64vh] flex-col gap-1.5 overflow-y-auto px-1 pb-1">
        {filtered.length === 0 ? (
          <li>
            <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-6 text-center text-2xs italic text-text-muted/70">
              No commands match your filters.
            </div>
          </li>
        ) : (
          filtered.map(([id, cmd]) => (
            <CommandRow
              key={id}
              id={id}
              cmd={cmd}
              selected={selectedId === id}
              onSelect={() => onSelect(id)}
            />
          ))
        )}
      </ul>
    </aside>
  );
}

interface CommandRowProps {
  id: string;
  cmd: CommandEntryConfig;
  selected: boolean;
  onSelect: () => void;
}

function CommandRow({ id, cmd, selected, onSelect }: CommandRowProps) {
  // usage comes from user-editable YAML and may be missing on malformed entries
  const displayName = cmd.usage?.split(/\s/)[0] || id;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cx(
          "focus-ring group flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition",
          selected
            ? "selected-card"
            : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30 hover:bg-[var(--chrome-fill)]",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-sm font-semibold uppercase tracking-wide text-text-primary">
              {displayName}
            </span>
            {cmd.staff && (
              <span className="rounded-full border border-warm/40 bg-warm/10 px-2 py-0.5 font-display text-2xs uppercase tracking-[0.18em] text-warm">
                Staff
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-2xs text-text-muted/80">
            <span className="truncate">{cmd.category || "—"}</span>
          </div>
        </div>
      </button>
    </li>
  );
}

