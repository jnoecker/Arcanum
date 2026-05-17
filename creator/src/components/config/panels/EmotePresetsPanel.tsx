import { useEffect, useMemo, useState } from "react";
import type { ConfigPanelProps } from "./types";
import type { EmotePreset } from "@/types/config";
import { TextInput, cx } from "@/components/ui/FormWidgets";
import {
  PlusIcon,
  SearchIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  XIcon,
} from "@/components/config/icons";

export function EmotePresetsPanel({ config, onChange }: ConfigPanelProps) {
  const presets = config.emotePresets.presets;
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  // Auto-select the first preset on mount; stay valid as the array shrinks.
  useEffect(() => {
    if (selectedIdx !== null && selectedIdx < presets.length) return;
    if (presets.length === 0) {
      setSelectedIdx(null);
      return;
    }
    setSelectedIdx(0);
  }, [presets.length, selectedIdx]);

  const update = (next: EmotePreset[]) =>
    onChange({ emotePresets: { presets: next } });

  const patchAt = (idx: number, p: Partial<EmotePreset>) => {
    update(presets.map((pre, i) => (i === idx ? { ...pre, ...p } : pre)));
  };

  const addPreset = () => {
    const next = [...presets, { label: "", emoji: "", action: "" }];
    update(next);
    setSelectedIdx(next.length - 1);
  };

  const removeAt = (idx: number) => {
    const next = presets.filter((_, i) => i !== idx);
    update(next);
    if (selectedIdx === idx) {
      setSelectedIdx(next.length === 0 ? null : Math.min(idx, next.length - 1));
    } else if (selectedIdx !== null && idx < selectedIdx) {
      setSelectedIdx(selectedIdx - 1);
    }
  };

  const moveAt = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= presets.length) return;
    const next = [...presets];
    const [item] = next.splice(idx, 1);
    if (!item) return;
    next.splice(target, 0, item);
    update(next);
    if (selectedIdx === idx) setSelectedIdx(target);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return presets
      .map((p, idx) => ({ p, idx }))
      .filter(({ p }) => {
        if (!q) return true;
        return (
          p.label.toLowerCase().includes(q) ||
          p.action.toLowerCase().includes(q) ||
          p.emoji.includes(q)
        );
      });
  }, [presets, query]);

  const selected = selectedIdx !== null ? presets[selectedIdx] ?? null : null;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="xl:col-span-3">
        <EmotesList
          presets={presets}
          filtered={filtered}
          query={query}
          onQuery={setQuery}
          selectedIdx={selectedIdx}
          onSelect={setSelectedIdx}
          onAdd={addPreset}
        />
      </div>

      <div className="xl:col-span-9">
        {selected !== null && selectedIdx !== null ? (
          <EmoteEditor
            preset={selected}
            index={selectedIdx}
            total={presets.length}
            onPatch={(p) => patchAt(selectedIdx, p)}
            onRemove={() => removeAt(selectedIdx)}
            onMoveUp={() => moveAt(selectedIdx, -1)}
            onMoveDown={() => moveAt(selectedIdx, 1)}
            onClose={() => setSelectedIdx(null)}
          />
        ) : (
          <div className="panel-surface flex h-full items-center justify-center rounded-2xl p-8 shadow-section">
            <div className="text-center">
              <p className="font-display text-xs uppercase tracking-wider text-text-muted">
                Nothing selected
              </p>
              <p className="mt-2 text-2xs leading-snug text-text-muted/70">
                Pick an emote from the roster, or add a new one to begin.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── List ──────────────────────────────────────────────────────────

function EmotesList({
  presets,
  filtered,
  query,
  onQuery,
  selectedIdx,
  onSelect,
  onAdd,
}: {
  presets: EmotePreset[];
  filtered: { p: EmotePreset; idx: number }[];
  query: string;
  onQuery: (v: string) => void;
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
  onAdd: () => void;
}) {
  return (
    <aside className="panel-surface flex flex-col gap-2 rounded-2xl p-3 shadow-section">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
          Emotes
        </h3>
        <span className="font-mono text-2xs text-text-muted/70">
          {presets.length}
        </span>
      </div>

      <div className="ornate-input flex items-center gap-2 px-2.5 py-1.5">
        <SearchIcon className="text-text-muted/70" />
        <input
          className="min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted/60"
          placeholder="Search emotes…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-2xs font-medium text-accent transition hover:bg-accent/20"
      >
        <PlusIcon />
        Add
      </button>

      <ul className="-mx-1 flex max-h-[64vh] flex-col gap-1 overflow-y-auto px-1 pb-1">
        {filtered.length === 0 ? (
          <li>
            <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-6 text-center text-2xs italic text-text-muted/70">
              {presets.length === 0
                ? "No emotes yet — add one above."
                : `No emotes match "${query}".`}
            </div>
          </li>
        ) : (
          filtered.map(({ p, idx }) => {
            const isSelected = selectedIdx === idx;
            return (
              <li key={idx}>
                <button
                  type="button"
                  onClick={() => onSelect(idx)}
                  aria-pressed={isSelected}
                  className={cx(
                    "focus-ring flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition",
                    isSelected
                      ? "selected-pill"
                      : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30 hover:bg-[var(--chrome-fill)]",
                  )}
                >
                  <span
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--chrome-stroke)] bg-bg-primary/40 text-base leading-none"
                    aria-hidden="true"
                  >
                    {p.emoji || "·"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-xs font-semibold text-text-primary">
                      {p.label || "Untitled"}
                    </div>
                    {p.action.trim() && (
                      <div className="truncate text-[0.6rem] italic text-text-muted/70">
                        {p.action}
                      </div>
                    )}
                  </div>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
}

// ─── Editor ────────────────────────────────────────────────────────

function EmoteEditor({
  preset,
  index,
  total,
  onPatch,
  onRemove,
  onMoveUp,
  onMoveDown,
  onClose,
}: {
  preset: EmotePreset;
  index: number;
  total: number;
  onPatch: (p: Partial<EmotePreset>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onClose: () => void;
}) {
  const labelText = preset.label.trim() || "Untitled";
  const actionText = preset.action.trim() || "…";

  return (
    <section className="panel-surface flex flex-col gap-4 rounded-2xl p-4 shadow-section">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--chrome-stroke)] pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--chrome-stroke)] bg-bg-primary/40 text-2xl leading-none"
          >
            {preset.emoji || "·"}
          </span>
          <div className="min-w-0">
            <span className="font-display text-2xs uppercase tracking-[0.18em] text-text-muted">
              #{index + 1}
            </span>
            <h2 className="truncate font-display text-xl font-semibold text-text-primary">
              {labelText}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <IconAction label="Move up" onClick={onMoveUp} disabled={index === 0}>
            <ArrowUpIcon />
          </IconAction>
          <IconAction
            label="Move down"
            onClick={onMoveDown}
            disabled={index === total - 1}
          >
            <ArrowDownIcon />
          </IconAction>
          <IconAction label="Delete emote" onClick={onRemove} danger>
            <TrashIcon />
          </IconAction>
          <button
            type="button"
            onClick={onClose}
            title="Close editor"
            aria-label="Close editor"
            className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted transition hover:border-accent/30 hover:text-text-primary"
          >
            <XIcon className="h-3 w-3" />
          </button>
        </div>
      </header>

      <div className="rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-2.5">
        <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
          In-game preview
        </span>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--chrome-stroke)] bg-bg-primary/60 px-2 py-1 text-xs text-text-secondary">
            {preset.emoji ? (
              <span className="text-sm leading-none" aria-hidden="true">
                {preset.emoji}
              </span>
            ) : (
              <span
                className="text-sm leading-none text-text-muted/50"
                aria-hidden="true"
              >
                ·
              </span>
            )}
            <span className="truncate">{labelText}</span>
          </span>
          <p className="text-2xs italic text-text-muted">
            <span className="text-text-secondary">Lira</span> {actionText}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[6rem_1fr]">
        <FieldLabel label="Emoji">
          <TextInput
            value={preset.emoji}
            onCommit={(v) => onPatch({ emoji: v })}
            placeholder="👋"
            dense
          />
        </FieldLabel>
        <FieldLabel label="Label">
          <TextInput
            value={preset.label}
            onCommit={(v) => onPatch({ label: v })}
            placeholder="Wave"
            dense
          />
        </FieldLabel>
      </div>

      <FieldLabel label="Action" hint="Player name is prepended automatically.">
        <TextInput
          value={preset.action}
          onCommit={(v) => onPatch({ action: v })}
          placeholder="waves."
          dense
        />
      </FieldLabel>
    </section>
  );
}

// ─── Shared ────────────────────────────────────────────────────────

function FieldLabel({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
        {label}
      </span>
      {children}
      {hint && (
        <p className="text-2xs leading-snug text-text-muted/70">{hint}</p>
      )}
    </div>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cx(
        "focus-ring inline-flex h-7 w-7 items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-30",
        danger
          ? "text-text-muted/70 hover:bg-status-error/15 hover:text-status-error"
          : "text-text-muted/70 hover:bg-[var(--chrome-fill)] hover:text-text-primary",
      )}
    >
      {children}
    </button>
  );
}
