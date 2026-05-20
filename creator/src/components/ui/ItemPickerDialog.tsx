import { useEffect, useMemo, useRef, useState } from "react";
import type { ItemFile } from "@/types/world";
import { useZoneStore } from "@/stores/zoneStore";
import { SearchIcon, XIcon } from "@/components/config/icons";

/**
 * One item the picker can offer. `fullId` is the cross-zone reference the
 * picker emits back to the caller (`<zoneId>:<itemId>`). The picker stays
 * dumb about *which* form the caller wants stored — callers strip the zone
 * prefix themselves when the item is local (see {@link useItemCatalog}).
 */
export interface ItemCatalogEntry {
  fullId: string;
  zoneId: string;
  itemId: string;
  displayName: string;
  slot?: string;
  hasSlot: boolean;
}

/** Build a flat, zone-grouped catalog of every item across loaded zones. */
export function useItemCatalog(): ItemCatalogEntry[] {
  const zones = useZoneStore((s) => s.zones);
  return useMemo<ItemCatalogEntry[]>(() => {
    const out: ItemCatalogEntry[] = [];
    for (const [zoneId, state] of zones) {
      const items = state.data.items;
      if (!items) continue;
      for (const [itemId, raw] of Object.entries(items)) {
        const item = raw as ItemFile;
        out.push({
          fullId: `${zoneId}:${itemId}`,
          zoneId,
          itemId,
          displayName: item?.displayName || itemId,
          hasSlot: Boolean(item?.slot),
          slot: item?.slot,
        });
      }
    }
    out.sort((a, b) => a.fullId.localeCompare(b.fullId));
    return out;
  }, [zones]);
}

interface ItemPickerDialogProps {
  catalog: ItemCatalogEntry[];
  /** Hide items already chosen (passed in `fullId` form). */
  excludeIds?: Set<string>;
  /** Header label, e.g. "Add Starter Item" or "Add Drop". */
  title: string;
  description?: string;
  onPick: (entry: ItemCatalogEntry) => void;
  onClose: () => void;
}

/**
 * Modal item picker. Used by the starter-equipment editor and the mob drops
 * editor. Lists every item in every loaded zone, filterable by id/name/slot.
 * Focus is trapped while open and restored on close.
 */
export function ItemPickerDialog({
  catalog,
  excludeIds,
  title,
  description,
  onPick,
  onClose,
}: ItemPickerDialogProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => {
      previousFocus.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab") {
        const root = dialogRef.current;
        if (!root) return;
        const focusable = root.querySelectorAll<HTMLElement>(
          'a, button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = excludeIds
      ? catalog.filter((c) => !excludeIds.has(c.fullId))
      : catalog;
    if (!q) return visible;
    return visible.filter((c) => {
      return (
        c.fullId.toLowerCase().includes(q) ||
        c.displayName.toLowerCase().includes(q) ||
        c.slot?.toLowerCase().includes(q)
      );
    });
  }, [catalog, excludeIds, query]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-picker-title"
      className="dialog-overlay fixed inset-0 z-[80] flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel-surface relative flex max-h-[80vh] w-full max-w-xl flex-col gap-3 rounded-2xl p-4 shadow-section">
        <header className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3
              id="item-picker-title"
              className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary"
            >
              {title}
            </h3>
            {description && (
              <p className="mt-0.5 text-2xs text-text-muted/70">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="focus-ring inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-text-muted/70 transition hover:bg-[var(--chrome-fill)] hover:text-text-primary"
          >
            <XIcon />
          </button>
        </header>

        <div className="ornate-input flex items-center gap-2 px-2.5 py-1.5">
          <SearchIcon className="text-text-muted/70" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items by id, name, or slot…"
            className="min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted/60"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)]">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-2xs italic text-text-muted/70">
              {catalog.length === 0
                ? "No items in any loaded zone. Open a zone with items first."
                : query
                  ? `No items match “${query}”.`
                  : "Every item is already chosen."}
            </div>
          ) : (
            <ul className="flex flex-col">
              {filtered.map((c) => (
                <li key={c.fullId}>
                  <button
                    type="button"
                    onClick={() => onPick(c)}
                    className="focus-ring flex w-full items-center gap-3 border-b border-[var(--chrome-stroke)]/50 px-3 py-2 text-left transition last:border-b-0 hover:bg-[var(--chrome-fill)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-sm text-text-primary">
                        {c.displayName}
                      </p>
                      <p className="truncate font-mono text-2xs text-text-muted/70">
                        {c.fullId}
                      </p>
                    </div>
                    {c.slot && (
                      <span className="shrink-0 rounded-full bg-[var(--chrome-fill)] px-1.5 py-px font-display text-[0.55rem] uppercase tracking-wider text-text-muted">
                        {c.slot}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
