import { useMemo, useState } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { PlusIcon, SearchIcon, ChevronRightIcon } from "./icons";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

interface EntityListProps<T> {
  title: string;
  items: Record<string, T>;
  selected: string | null;
  searchPlaceholder: string;
  addLabel: string;
  viewAllLabel: string;
  visibleLimit?: number;
  getDisplayName: (item: T) => string;
  getSubtitle: (item: T) => string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function EntityList<T>({
  title,
  items,
  selected,
  searchPlaceholder,
  addLabel,
  viewAllLabel,
  visibleLimit = 5,
  getDisplayName,
  getSubtitle,
  onSelect,
  onAdd,
}: EntityListProps<T>) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const ids = Object.keys(items);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ids.filter((id) => {
      if (!q) return true;
      const item = items[id]!;
      return (
        id.toLowerCase().includes(q) ||
        getDisplayName(item).toLowerCase().includes(q)
      );
    });
  }, [ids, query, items, getDisplayName]);

  const showCollapsed = !expanded && !query.trim();
  const displayed = showCollapsed ? filtered.slice(0, visibleLimit) : filtered;
  const overflowCount = filtered.length - displayed.length;

  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-2">
          <span>{title}</span>
          <span className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-1.5 py-0.5 font-mono text-[0.55rem] text-text-muted">
            {ids.length}
          </span>
        </span>
      }
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="ornate-input flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5">
            <SearchIcon className="text-text-muted/70" />
            <input
              className="min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted/60"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20"
          >
            <PlusIcon />
            {addLabel}
          </button>
        </div>

        <ul className="flex flex-col gap-1.5">
          {displayed.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-6 text-center text-2xs italic text-text-muted/70">
              {ids.length === 0 ? `Nothing yet — click ${addLabel}.` : "No matches."}
            </li>
          ) : (
            displayed.map((id) => (
              <EntityRow
                key={id}
                id={id}
                title={getDisplayName(items[id]!)}
                subtitle={getSubtitle(items[id]!)}
                selected={selected === id}
                onSelect={() => onSelect(id)}
              />
            ))
          )}
        </ul>

        {showCollapsed && overflowCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="focus-ring -mx-1 inline-flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs text-text-muted transition hover:bg-[var(--chrome-fill-soft)] hover:text-accent"
          >
            <span>{viewAllLabel}</span>
            <span className="inline-flex items-center gap-1">
              <span className="font-mono text-2xs text-text-muted/70">
                +{overflowCount}
              </span>
              <ChevronRightIcon />
            </span>
          </button>
        )}
        {!showCollapsed && expanded && filtered.length > visibleLimit && !query.trim() && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="focus-ring -mx-1 inline-flex items-center justify-center gap-2 rounded-lg px-2.5 py-1 text-2xs text-text-muted transition hover:bg-[var(--chrome-fill-soft)] hover:text-accent"
          >
            Collapse list
          </button>
        )}
      </div>
    </SectionCard>
  );
}

interface EntityRowProps {
  id: string;
  title: string;
  subtitle: string;
  selected: boolean;
  onSelect: () => void;
}

function EntityRow({ id, title, subtitle, selected, onSelect }: EntityRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cx(
          "focus-ring group flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition",
          selected
            ? "selected-card"
            : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30 hover:bg-[var(--chrome-fill)]",
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-text-primary">
            {title || id}
          </p>
          <p className="truncate text-2xs text-text-muted/80">{subtitle}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-2xs">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-status-success"
            aria-hidden="true"
          />
          <span className="text-status-success">Active</span>
        </span>
        <ChevronRightIcon
          className={cx(
            "h-4 w-4 shrink-0 transition-colors",
            selected ? "text-accent" : "text-text-muted/40",
          )}
        />
      </button>
    </li>
  );
}
