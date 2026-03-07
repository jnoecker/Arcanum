import { useState, useCallback, useMemo, type ReactNode } from "react";
import { Section, IconButton } from "@/components/ui/FormWidgets";

export interface RegistryPanelProps<T> {
  title: string;
  items: Record<string, T>;
  onItemsChange: (items: Record<string, T>) => void;
  /** Return a string to show in the collapsed header badge area. */
  renderSummary: (id: string, item: T) => string;
  /** Return JSX for the expanded detail form. */
  renderDetail: (
    id: string,
    item: T,
    patch: (p: Partial<T>) => void,
  ) => ReactNode;
  /** Create a default item from the raw user input string. */
  defaultItem: (rawInput: string) => T;
  /** Transform raw user input into an ID. Defaults to lowercase + underscores. */
  idTransform?: (raw: string) => string;
  /** Placeholder for the "new item" input. */
  placeholder?: string;
  /** Show search bar when item count exceeds this threshold (default: 3). */
  searchThreshold?: number;
  /** Return the display name from an item for search matching. */
  getDisplayName?: (item: T) => string;
}

export function RegistryPanel<T>({
  title,
  items,
  onItemsChange,
  renderSummary,
  renderDetail,
  defaultItem,
  idTransform = (raw) => raw.trim().toLowerCase().replace(/\s+/g, "_"),
  placeholder = "New item",
  searchThreshold = 3,
  getDisplayName,
}: RegistryPanelProps<T>) {
  const allIds = Object.keys(items);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newId, setNewId] = useState("");
  const [search, setSearch] = useState("");

  const filteredIds = useMemo(() => {
    if (!search.trim() || !getDisplayName) return allIds;
    const q = search.toLowerCase();
    return allIds.filter(
      (id) =>
        id.toLowerCase().includes(q) ||
        getDisplayName(items[id]!).toLowerCase().includes(q),
    );
  }, [items, search, allIds, getDisplayName]);

  const patch = useCallback(
    (id: string, p: Partial<T>) => {
      onItemsChange({ ...items, [id]: { ...items[id]!, ...p } });
    },
    [items, onItemsChange],
  );

  const deleteItem = useCallback(
    (id: string) => {
      const next = { ...items };
      delete next[id];
      onItemsChange(next);
      if (expanded === id) setExpanded(null);
    },
    [items, onItemsChange, expanded],
  );

  const addItem = useCallback(() => {
    const id = idTransform(newId);
    if (!id || items[id]) return;
    onItemsChange({ ...items, [id]: defaultItem(newId.trim()) });
    setNewId("");
    setExpanded(id);
  }, [newId, items, onItemsChange, idTransform, defaultItem]);

  return (
    <Section
      title={`${title} (${allIds.length})`}
      actions={
        <div className="flex items-center gap-1">
          <input
            className="w-28 rounded border border-border-default bg-bg-primary px-1.5 py-0.5 text-xs text-text-primary outline-none focus:border-accent/50"
            placeholder={placeholder}
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addItem();
            }}
          />
          <IconButton onClick={addItem} title={`Add ${title.toLowerCase()}`}>
            +
          </IconButton>
        </div>
      }
    >
      {allIds.length > searchThreshold && getDisplayName && (
        <input
          className="mb-2 w-full rounded border border-border-default bg-bg-primary px-1.5 py-0.5 text-xs text-text-primary outline-none focus:border-accent/50"
          placeholder={`Search ${title.toLowerCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      {filteredIds.length === 0 ? (
        <p className="text-xs text-text-muted">
          {allIds.length === 0
            ? `No ${title.toLowerCase()} defined`
            : "No matches"}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {filteredIds.map((id) => {
            const item = items[id]!;
            const isOpen = expanded === id;
            const summary = renderSummary(id, item);
            return (
              <div
                key={id}
                className="rounded border border-border-muted bg-bg-primary"
              >
                <div
                  className="flex cursor-pointer items-center justify-between px-2 py-1.5"
                  onClick={() => setExpanded(isOpen ? null : id)}
                >
                  <span className="text-xs text-text-primary">
                    <span className="font-semibold">
                      {getDisplayName
                        ? getDisplayName(item)
                        : (item as any).displayName ?? id}
                    </span>
                    <span className="ml-2 text-text-muted">{id}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    {summary && (
                      <span className="text-[10px] text-text-muted">
                        {summary}
                      </span>
                    )}
                    <span onClick={(ev) => ev.stopPropagation()}>
                      <IconButton
                        onClick={() => deleteItem(id)}
                        title="Delete"
                        danger
                      >
                        x
                      </IconButton>
                    </span>
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t border-border-muted px-2 py-2">
                    <div className="flex flex-col gap-1.5">
                      {renderDetail(id, item, (p) => patch(id, p))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
