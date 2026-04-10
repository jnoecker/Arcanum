import { useEffect, useMemo, useState, type ReactNode } from "react";

export function DefinitionWorkbench<T>({
  title,
  countLabel,
  description,
  addPlaceholder,
  searchPlaceholder,
  emptyMessage,
  emptyTitle,
  emptyDescription,
  items,
  defaultItem,
  getDisplayName,
  renderSummary,
  renderBadges,
  renderListCard,
  renderDetail,
  renderDetailHeader,
  onItemsChange,
  onRename,
  searchFilter,
  idTransform = (raw) => raw.trim().toLowerCase().replace(/\s+/g, "_"),
}: {
  title: string;
  countLabel: string;
  description: string;
  addPlaceholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  emptyTitle?: string;
  emptyDescription?: string;
  items: Record<string, T>;
  defaultItem: (raw: string) => T;
  getDisplayName: (item: T) => string;
  renderSummary: (item: T) => string;
  renderBadges?: (item: T) => string[];
  /** Override the default list card content. Receives the id and item; return full card interior JSX. */
  renderListCard?: (id: string, item: T) => ReactNode;
  renderDetail: (id: string, item: T, patch: (p: Partial<T>) => void) => ReactNode;
  /** Custom header content rendered to the right of the title area (e.g. stat pills). */
  renderDetailHeader?: (id: string, item: T) => ReactNode;
  onItemsChange: (items: Record<string, T>) => void;
  /** When provided, enables a rename UI in the detail header. Called with (oldId, newId). */
  onRename?: (oldId: string, newId: string) => void;
  /** Custom search filter. When provided, overrides the default id + displayName matching. */
  searchFilter?: (id: string, item: T, query: string) => boolean;
  idTransform?: (raw: string) => string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newId, setNewId] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const itemIds = useMemo(
    () =>
      Object.keys(items).filter((id) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        if (searchFilter) return searchFilter(id, items[id]!, q);
        return id.toLowerCase().includes(q) || getDisplayName(items[id]!).toLowerCase().includes(q);
      }),
    [getDisplayName, items, search, searchFilter],
  );

  useEffect(() => {
    if (selectedId && items[selectedId]) return;
    setSelectedId(itemIds[0] ?? Object.keys(items)[0] ?? null);
  }, [itemIds, items, selectedId]);

  const selected = selectedId ? items[selectedId] ?? null : null;

  const addItem = () => {
    const id = idTransform(newId);
    if (!id || items[id]) return;
    onItemsChange({
      ...items,
      [id]: defaultItem(newId.trim()),
    });
    setSelectedId(id);
    setNewId("");
  };

  const patchItem = (id: string, patch: Partial<T>) => {
    onItemsChange({
      ...items,
      [id]: { ...items[id]!, ...patch },
    });
  };

  const deleteItem = (id: string) => {
    const next = { ...items };
    delete next[id];
    onItemsChange(next);
    if (selectedId === id) setSelectedId(null);
    setRenaming(false);
  };

  const commitRename = () => {
    if (!selectedId || !onRename) return;
    const nextId = idTransform(renameValue);
    if (!nextId || nextId === selectedId || items[nextId]) return;
    onRename(selectedId, nextId);
    setSelectedId(nextId);
    setRenaming(false);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="panel-surface-light rounded-3xl p-4">
        <div className="mb-4">
          <p className="text-2xs uppercase tracking-ui text-text-muted">{countLabel}</p>
          <h4 className="mt-2 font-display text-xl text-text-primary">{Object.keys(items).length} entries</h4>
        </div>

        <div className="flex gap-2">
          <input
            aria-label="New entry name"
            value={newId}
            onChange={(event) => setNewId(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addItem();
            }}
            placeholder={addPlaceholder}
            className="ornate-input min-w-0 flex-1 rounded-full px-4 py-2 text-xs text-text-primary"
          />
          <button
            onClick={addItem}
            aria-label="Add new entry"
            className="focus-ring shell-pill rounded-full px-4 py-2 text-xs text-text-primary"
          >
            Add
          </button>
        </div>

        <input
          aria-label="Search entries"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={searchPlaceholder}
          className="ornate-input mt-3 w-full rounded-full px-4 py-2 text-xs text-text-primary"
        />

        <div className="mt-4 flex max-h-[34rem] flex-col gap-2 overflow-y-auto pr-1">
          {itemIds.map((id) => {
            const item = items[id]!;
            const selectedCard = id === selectedId;
            return (
              <button
                key={id}
                onClick={() => { setSelectedId(id); setRenaming(false); }}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  selectedCard
                    ? "border-border-active bg-gradient-active"
                    : "border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] hover:bg-[var(--chrome-highlight-strong)]"
                }`}
              >
                {renderListCard ? renderListCard(id, item) : (() => {
                  const badges = renderBadges?.(item) ?? [];
                  return (
                    <>
                      <div className="min-w-0">
                        <div className="truncate font-display text-lg text-text-primary">{getDisplayName(item)}</div>
                        <div className="mt-1 truncate text-2xs text-text-muted">{id}</div>
                      </div>
                      {badges.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 text-2xs uppercase tracking-label text-text-muted">
                          {badges.map((badge) => (
                            <span key={badge}>{badge}</span>
                          ))}
                        </div>
                      )}
                      {(() => {
                        const summary = renderSummary(item);
                        return summary ? <div className="mt-3 text-xs text-text-secondary">{summary}</div> : null;
                      })()}
                    </>
                  );
                })()}
              </button>
            );
          })}
          {itemIds.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-highlight)] px-4 py-6 text-sm text-text-muted">
              {emptyMessage}
            </div>
          )}
        </div>
      </div>

      {selectedId && selected ? (
        <div className="panel-surface rounded-3xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--chrome-stroke)] pb-4">
            <div>
              <p className="text-2xs uppercase tracking-ui text-text-muted">{title}</p>
              <h4 className="mt-2 font-display text-3xl text-text-primary">{getDisplayName(selected)}</h4>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-text-secondary">{description}</p>
            </div>
            {renderDetailHeader ? renderDetailHeader(selectedId, selected) : (
              <button
                onClick={() => deleteItem(selectedId)}
                className="focus-ring rounded-full border border-status-danger/40 bg-status-danger/10 px-4 py-2 text-xs text-status-danger hover:bg-status-danger/15"
              >
                Delete
              </button>
            )}
          </div>

          {onRename && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {renaming ? (
                <>
                  <input
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") commitRename();
                      if (event.key === "Escape") setRenaming(false);
                    }}
                    className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight-strong)] px-4 py-2 text-xs text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
                  />
                  <button onClick={commitRename} title="Confirm rename" className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight-strong)] px-4 py-2 text-xs text-text-primary hover:bg-[var(--chrome-highlight-strong)]">
                    Rename
                  </button>
                  <button onClick={() => setRenaming(false)} title="Cancel rename" className="rounded-full border border-[var(--chrome-stroke)] bg-transparent px-4 py-2 text-xs text-text-secondary hover:bg-[var(--chrome-highlight-strong)]">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setRenameValue(selectedId);
                      setRenaming(true);
                    }}
                    className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight-strong)] px-4 py-2 text-xs text-text-primary hover:bg-[var(--chrome-highlight-strong)]"
                  >
                    Rename ID
                  </button>
                  <button
                    onClick={() => deleteItem(selectedId)}
                    className="rounded-full border border-status-danger/40 bg-status-danger/10 px-4 py-2 text-xs text-status-danger hover:bg-status-danger/15"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-1.5">
            {renderDetail(selectedId, selected, (patch) => patchItem(selectedId, patch))}
          </div>
        </div>
      ) : (
        <div className="panel-surface-light rounded-3xl border-dashed px-6 py-10 text-center">
          <p className="font-display text-base text-text-primary">{emptyTitle ?? "Select an entry"}</p>
          <p className="mx-auto mt-2 max-w-xs text-xs leading-6 text-text-muted">{emptyDescription ?? "Choose from the list or create a new one to begin."}</p>
        </div>
      )}
    </div>
  );
}
