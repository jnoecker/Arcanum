// ─── LoreLinkPicker ─────────────────────────────────────────────────
// Reusable pickers for linking scenes/stories to lore articles, map pins,
// and timeline events. Pulls all data from the lore store.

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useLoreStore, selectArticles, selectMaps, selectEvents, selectCalendars } from "@/stores/loreStore";
import { useImageSrc } from "@/lib/useImageSrc";
import type { ArticleTemplate } from "@/types/lore";

// ─── Shared chip/popover styles ────────────────────────────────────

const POPOVER_CLASS =
  "absolute z-50 mt-1 max-h-72 w-72 overflow-y-auto rounded-lg border border-border-default bg-bg-elevated shadow-2xl";

const CHIP_CLASS =
  "inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-2xs text-accent";

const REMOVE_BTN_CLASS =
  "leading-none text-accent/80 hover:text-status-error";

// ─── Article chip with image ───────────────────────────────────────

function ArticleChip({
  articleId,
  onRemove,
  onClick,
}: {
  articleId: string;
  onRemove?: () => void;
  onClick?: () => void;
}) {
  const article = useLoreStore((s) => s.lore?.articles[articleId]);
  const src = useImageSrc(article?.image);
  if (!article) {
    return (
      <span className={CHIP_CLASS}>
        <span className="italic text-text-muted">missing</span>
        {onRemove && (
          <button type="button" onClick={onRemove} className={REMOVE_BTN_CLASS} aria-label="Remove link">
            &times;
          </button>
        )}
      </span>
    );
  }
  return (
    <span className={CHIP_CLASS}>
      {src ? (
        <img src={src} alt="" className="h-4 w-4 rounded-sm object-cover" />
      ) : (
        <span className="h-4 w-4 rounded-sm bg-bg-tertiary" />
      )}
      <button
        type="button"
        onClick={onClick}
        className="max-w-[120px] truncate hover:underline"
        title={article.title}
      >
        {article.title}
      </button>
      {onRemove && (
        <button type="button" onClick={onRemove} className={REMOVE_BTN_CLASS} aria-label="Remove link">
          &times;
        </button>
      )}
    </span>
  );
}

// ─── Hook: outside-click ───────────────────────────────────────────

function useOutsideClick(ref: React.RefObject<HTMLElement | null>, onClose: () => void, open: boolean) {
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [ref, onClose, open]);
}

// ─── Multi-article picker ──────────────────────────────────────────

interface ArticleMultiPickerProps {
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Filter to a single template (e.g. only characters). Optional. */
  templateFilter?: ArticleTemplate;
  placeholder?: string;
  ariaLabel?: string;
}

export function ArticleMultiPicker({
  selected,
  onChange,
  templateFilter,
  placeholder,
  ariaLabel,
}: ArticleMultiPickerProps) {
  const articles = useLoreStore(selectArticles);
  const selectArticle = useLoreStore((s) => s.selectArticle);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  useOutsideClick(wrapperRef, () => setOpen(false), open);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.values(articles)
      .filter((a) => !a.draft)
      .filter((a) => !templateFilter || a.template === templateFilter)
      .filter((a) => !selected.includes(a.id))
      .filter((a) => !q || a.title.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, 25);
  }, [articles, query, selected, templateFilter]);

  const add = useCallback(
    (id: string) => {
      onChange([...selected, id]);
      setQuery("");
    },
    [onChange, selected],
  );

  const remove = useCallback(
    (id: string) => {
      onChange(selected.filter((s) => s !== id));
    },
    [onChange, selected],
  );

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex flex-wrap items-center gap-1">
        {selected.map((id) => (
          <ArticleChip
            key={id}
            articleId={id}
            onRemove={() => remove(id)}
            onClick={() => selectArticle(id)}
          />
        ))}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={ariaLabel ?? placeholder ?? "Link article"}
          className="rounded-full border border-dashed border-border-default px-2 py-0.5 text-2xs text-text-muted hover:border-accent/40 hover:text-accent"
        >
          + {placeholder ?? "Link article"}
        </button>
      </div>

      {open && (
        <div className={POPOVER_CLASS}>
          <div className="sticky top-0 border-b border-border-muted bg-bg-elevated p-2">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={templateFilter ? `Search ${templateFilter}...` : "Search articles..."}
              aria-label={ariaLabel ? `${ariaLabel} search` : templateFilter ? `Search ${templateFilter}` : "Search articles"}
              className="w-full rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent/50"
            />
          </div>
          {candidates.length === 0 ? (
            <div className="px-3 py-4 text-center text-2xs text-text-muted">
              {query ? "No matches" : "No more articles to link"}
            </div>
          ) : (
            <ul>
              {candidates.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => add(a.id)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-bg-hover"
                  >
                    <span className="flex-1 truncate">{a.title}</span>
                    <span className="text-2xs text-text-muted">{a.template}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Single-article picker ─────────────────────────────────────────

interface ArticleSinglePickerProps {
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  templateFilter?: ArticleTemplate;
  placeholder?: string;
  ariaLabel?: string;
}

export function ArticleSinglePicker({
  value,
  onChange,
  templateFilter,
  placeholder,
  ariaLabel,
}: ArticleSinglePickerProps) {
  const articles = useLoreStore(selectArticles);
  const selectArticle = useLoreStore((s) => s.selectArticle);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  useOutsideClick(wrapperRef, () => setOpen(false), open);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.values(articles)
      .filter((a) => !a.draft)
      .filter((a) => !templateFilter || a.template === templateFilter)
      .filter((a) => !q || a.title.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, 25);
  }, [articles, query, templateFilter]);

  return (
    <div ref={wrapperRef} className="relative">
      {value ? (
        <ArticleChip
          articleId={value}
          onRemove={() => onChange(undefined)}
          onClick={() => selectArticle(value)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={ariaLabel ?? placeholder ?? "Link article"}
          className="rounded-full border border-dashed border-border-default px-2 py-0.5 text-2xs text-text-muted hover:border-accent/40 hover:text-accent"
        >
          + {placeholder ?? "Link article"}
        </button>
      )}

      {open && (
        <div className={POPOVER_CLASS}>
          <div className="sticky top-0 border-b border-border-muted bg-bg-elevated p-2">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={templateFilter ? `Search ${templateFilter}...` : "Search articles..."}
              aria-label={ariaLabel ? `${ariaLabel} search` : templateFilter ? `Search ${templateFilter}` : "Search articles"}
              className="w-full rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent/50"
            />
          </div>
          {candidates.length === 0 ? (
            <div className="px-3 py-4 text-center text-2xs text-text-muted">No matches</div>
          ) : (
            <ul>
              {candidates.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(a.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-bg-hover"
                  >
                    <span className="flex-1 truncate">{a.title}</span>
                    <span className="text-2xs text-text-muted">{a.template}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Map + pin picker ──────────────────────────────────────────────

interface MapPinPickerProps {
  mapId: string | undefined;
  pinId: string | undefined;
  onChange: (mapId: string | undefined, pinId: string | undefined) => void;
  mapAriaLabel?: string;
  pinAriaLabel?: string;
}

export function MapPinPicker({ mapId, pinId, onChange, mapAriaLabel, pinAriaLabel }: MapPinPickerProps) {
  const maps = useLoreStore(selectMaps);
  const map = useMemo(() => maps.find((m) => m.id === mapId), [maps, mapId]);
  const pin = useMemo(() => map?.pins.find((p) => p.id === pinId), [map, pinId]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={mapAriaLabel ?? "Map"}
        className="rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-secondary outline-none focus:border-accent/50"
        value={mapId ?? ""}
        onChange={(e) => onChange(e.target.value || undefined, undefined)}
      >
        <option value="">— map —</option>
        {maps.map((m) => (
          <option key={m.id} value={m.id}>
            {m.title}
          </option>
        ))}
      </select>

      {map && map.pins.length > 0 && (
        <select
          aria-label={pinAriaLabel ?? "Map pin"}
          className="rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-secondary outline-none focus:border-accent/50"
          value={pinId ?? ""}
          onChange={(e) => onChange(mapId, e.target.value || undefined)}
        >
          <option value="">— pin (optional) —</option>
          {map.pins.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label ?? p.id}
            </option>
          ))}
        </select>
      )}

      {map && map.pins.length === 0 && (
        <span className="text-2xs italic text-text-muted">No pins on this map yet</span>
      )}

      {(mapId || pinId) && (
        <button
          type="button"
          onClick={() => onChange(undefined, undefined)}
          className="text-2xs text-text-muted hover:text-status-error"
        >
          clear
        </button>
      )}

      {pin?.label && (
        <span className="text-2xs text-accent/80" title={`Lat ${pin.position[0]}, Lng ${pin.position[1]}`}>
          → {pin.label}
        </span>
      )}
    </div>
  );
}

// ─── Timeline event picker ─────────────────────────────────────────

interface TimelineEventPickerProps {
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  ariaLabel?: string;
}

export function TimelineEventPicker({ value, onChange, ariaLabel }: TimelineEventPickerProps) {
  const events = useLoreStore(selectEvents);
  const calendars = useLoreStore(selectCalendars);

  const sorted = useMemo(
    () => [...events].sort((a, b) => a.year - b.year),
    [events],
  );

  const eraName = useCallback(
    (calendarId: string, eraId: string): string | undefined => {
      const cal = calendars.find((c) => c.id === calendarId);
      return cal?.eras.find((e) => e.id === eraId)?.name;
    },
    [calendars],
  );

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label={ariaLabel ?? "Timeline event"}
        className="rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-secondary outline-none focus:border-accent/50"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        <option value="">— timeline event —</option>
        {sorted.map((ev) => {
          const era = eraName(ev.calendarId, ev.eraId);
          return (
            <option key={ev.id} value={ev.id}>
              {ev.year}{era ? ` ${era}` : ""} — {ev.title}
            </option>
          );
        })}
      </select>
      {value && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="text-2xs text-text-muted hover:text-status-error"
        >
          clear
        </button>
      )}
    </div>
  );
}
