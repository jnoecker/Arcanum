import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PlusIcon, SearchIcon, TrashIcon } from "./icons";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function defaultIdTransform(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

interface TaxonomyWorkbenchProps<T> {
  /** Plural noun shown above the list count — e.g. "Categories". */
  listTitle: string;
  /** Singular noun shown above the detail editor — e.g. "Category". */
  detailKicker: string;
  addPlaceholder: string;
  searchPlaceholder: string;
  emptyListMessage: string;
  emptyDetailTitle: string;
  emptyDetailDescription: string;

  items: Record<string, T>;
  defaultItem: (raw: string) => T;
  getDisplayName: (item: T) => string;
  /** Optional one-line summary rendered under each list row. */
  renderRowSummary?: (id: string, item: T) => ReactNode;
  renderDetail: (id: string, item: T, patch: (p: Partial<T>) => void) => ReactNode;
  onItemsChange: (next: Record<string, T>) => void;
  idTransform?: (raw: string) => string;
}

/**
 * Compact left-list / right-detail workbench used by the Achievement
 * categories and criterion-type tabs. Visual language matches the Builder
 * (panel-surface cards, accent-pill action buttons, ornate-input search).
 */
export function TaxonomyWorkbench<T>({
  listTitle,
  detailKicker,
  addPlaceholder,
  searchPlaceholder,
  emptyListMessage,
  emptyDetailTitle,
  emptyDetailDescription,
  items,
  defaultItem,
  getDisplayName,
  renderRowSummary,
  renderDetail,
  onItemsChange,
  idTransform = defaultIdTransform,
}: TaxonomyWorkbenchProps<T>) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [newId, setNewId] = useState("");

  const ids = useMemo(() => Object.keys(items), [items]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ids;
    return ids.filter((id) => {
      const name = getDisplayName(items[id]!).toLowerCase();
      return id.toLowerCase().includes(q) || name.includes(q);
    });
  }, [ids, items, query, getDisplayName]);

  useEffect(() => {
    if (selectedId && items[selectedId]) return;
    setSelectedId(ids[0] ?? null);
  }, [ids, items, selectedId]);

  const selected = selectedId ? items[selectedId] ?? null : null;

  const addItem = () => {
    const id = idTransform(newId);
    if (!id || items[id]) return;
    onItemsChange({ ...items, [id]: defaultItem(newId.trim()) });
    setSelectedId(id);
    setNewId("");
  };

  const patchItem = (id: string, patch: Partial<T>) => {
    onItemsChange({ ...items, [id]: { ...items[id]!, ...patch } });
  };

  const deleteItem = (id: string) => {
    const next = { ...items };
    delete next[id];
    onItemsChange(next);
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <aside className="panel-surface flex flex-col gap-3 rounded-2xl p-4 shadow-section xl:col-span-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
            {listTitle}
          </h3>
          <span className="font-mono text-2xs text-text-muted/70">
            {ids.length}
          </span>
        </div>

        <div className="ornate-input flex items-center gap-2 px-2.5 py-1.5">
          <SearchIcon className="text-text-muted/70" />
          <input
            className="min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted/60"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            aria-label="New entry id"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addItem();
            }}
            placeholder={addPlaceholder}
            className="ornate-input min-w-0 flex-1 px-2.5 py-1.5 text-xs text-text-primary"
          />
          <button
            type="button"
            onClick={addItem}
            disabled={!newId.trim() || !!items[idTransform(newId)]}
            title="Add entry"
            className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <PlusIcon />
            Add
          </button>
        </div>

        <ul className="-mx-1 flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto px-1 pb-1">
          {filtered.length === 0 ? (
            <li>
              <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-6 text-center text-2xs italic text-text-muted/70">
                {ids.length === 0 ? emptyListMessage : `No matches for "${query}".`}
              </div>
            </li>
          ) : (
            filtered.map((id) => {
              const item = items[id]!;
              const isSelected = selectedId === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(id)}
                    aria-pressed={isSelected}
                    className={cx(
                      "focus-ring flex w-full flex-col gap-0.5 rounded-xl border p-2.5 text-left transition",
                      isSelected
                        ? "border-accent/60 bg-accent/[0.07] shadow-[0_0_28px_-12px_rgb(var(--accent-rgb)/0.7)]"
                        : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30 hover:bg-[var(--chrome-fill)]",
                    )}
                  >
                    <span className="truncate font-display text-sm font-semibold text-text-primary">
                      {getDisplayName(item) || id}
                    </span>
                    <span className="truncate font-mono text-2xs text-text-muted/70">
                      {id}
                    </span>
                    {renderRowSummary && (
                      <span className="mt-0.5 truncate text-2xs text-text-muted/80">
                        {renderRowSummary(id, item)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </aside>

      <section className="xl:col-span-8">
        {selectedId && selected ? (
          <div className="panel-surface flex flex-col gap-4 rounded-2xl p-4 shadow-section">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--chrome-stroke)] pb-3">
              <div className="min-w-0 flex-1">
                <p className="font-display text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                  {detailKicker}
                </p>
                <h3 className="mt-1 truncate font-display text-xl font-semibold text-text-primary">
                  {getDisplayName(selected) || selectedId}
                </h3>
                <p className="mt-0.5 font-mono text-2xs text-text-muted/70">
                  {selectedId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => deleteItem(selectedId)}
                className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-status-error/40 bg-status-error/10 px-3 py-1.5 text-2xs font-medium text-status-error transition hover:bg-status-error/20"
              >
                <TrashIcon />
                Delete
              </button>
            </header>
            {renderDetail(selectedId, selected, (p) => patchItem(selectedId, p))}
          </div>
        ) : (
          <div className="panel-surface flex flex-col items-center justify-center gap-2 rounded-2xl px-6 py-12 text-center shadow-section">
            <p className="font-display text-base text-text-primary">
              {emptyDetailTitle}
            </p>
            <p className="max-w-xs text-2xs text-text-muted/80">
              {emptyDetailDescription}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
