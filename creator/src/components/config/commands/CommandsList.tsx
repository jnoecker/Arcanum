import { useMemo, useState } from "react";
import type { CommandEntryConfig } from "@/types/config";
import { SearchIcon, PlusIcon, MoreIcon } from "../achievements/icons";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

interface CommandsListProps {
  commands: Record<string, CommandEntryConfig>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

const ALL_CATEGORIES = "__all__";

export function CommandsList({
  commands,
  selectedId,
  onSelect,
  onAdd,
}: CommandsListProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORIES);
  const [moreOpen, setMoreOpen] = useState(false);

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

  const visibleChips = allCategories.slice(0, 3);
  const overflowChips = allCategories.slice(3);

  return (
    <aside className="panel-surface flex flex-col gap-3 rounded-2xl p-4 shadow-section">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
          Commands
        </h3>
        <span className="font-mono text-2xs text-text-muted/70">
          {Object.keys(commands).length} entries
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
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <CategoryChip
          active={activeCategory === ALL_CATEGORIES}
          onClick={() => setActiveCategory(ALL_CATEGORIES)}
        >
          All
        </CategoryChip>
        {visibleChips.map((cat) => (
          <CategoryChip
            key={cat}
            active={activeCategory === cat}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </CategoryChip>
        ))}
        {overflowChips.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-label="More categories"
              className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted transition hover:border-accent/30 hover:text-accent"
            >
              <MoreIcon />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-xl border border-[var(--chrome-stroke)] bg-bg-elevated shadow-lg">
                {overflowChips.map((cat) => {
                  const active = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setActiveCategory(cat);
                        setMoreOpen(false);
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

      <button
        type="button"
        onClick={onAdd}
        className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20"
      >
        <PlusIcon />
        New Command
      </button>

      <ul className="-mx-1 flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto px-1 pb-1">
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
  const displayName = cmd.usage.split(/\s/)[0] || id;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cx(
          "focus-ring group flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition",
          selected
            ? "border-accent/60 bg-accent/[0.07] shadow-[0_0_28px_-12px_rgb(var(--accent-rgb)/0.7)]"
            : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30 hover:bg-[var(--chrome-fill)]",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-sm font-semibold uppercase tracking-wide text-text-primary">
              {displayName}
            </span>
            {cmd.staff && (
              <span className="rounded-full border border-warm/40 bg-warm/10 px-1.5 py-0.5 font-display text-[0.55rem] uppercase tracking-[0.18em] text-warm">
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

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "focus-ring inline-flex items-center gap-1 rounded-full border px-2 py-1 font-display text-2xs transition",
        active
          ? "border-accent/60 bg-accent/15 text-accent"
          : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted hover:border-accent/30 hover:text-accent",
      )}
    >
      <span>{children}</span>
    </button>
  );
}
