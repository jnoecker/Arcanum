import { useMemo, useState } from "react";
import type { StatusEffectDefinitionConfig } from "@/types/config";
import { useImageSrc } from "@/lib/useImageSrc";
import { SearchIcon, PlusIcon, MoreIcon, CopyIcon, TrashIcon } from "./icons";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

interface ConditionsListProps {
  defs: Record<string, StatusEffectDefinitionConfig>;
  effectTypeOptions: { value: string; label: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const ALL_TYPES = "__all__";

export function ConditionsList({
  defs,
  effectTypeOptions,
  selectedId,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
}: ConditionsListProps) {
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<string>(ALL_TYPES);
  const [filterOpen, setFilterOpen] = useState(false);
  const hasSelection = selectedId !== null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(defs).filter(([id, def]) => {
      if (
        activeType !== ALL_TYPES &&
        (def.effectType ?? "").toLowerCase() !== activeType.toLowerCase()
      ) {
        return false;
      }
      if (!q) return true;
      return (
        id.toLowerCase().includes(q) ||
        def.displayName.toLowerCase().includes(q) ||
        (def.effectType ?? "").toLowerCase().includes(q) ||
        (def.stackBehavior ?? "").toLowerCase().includes(q)
      );
    });
  }, [defs, query, activeType]);

  const activeTypeLabel =
    activeType === ALL_TYPES
      ? "All"
      : (effectTypeOptions.find(
          (t) => t.value.toLowerCase() === activeType.toLowerCase(),
        )?.label ?? activeType);

  return (
    <aside className="panel-surface flex flex-col gap-2 rounded-2xl p-3 shadow-section">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
          Status Effects
        </h3>
        <span className="font-mono text-2xs text-text-muted/70">
          {Object.keys(defs).length}
        </span>
      </div>

      <div className="ornate-input flex items-center gap-2 px-2.5 py-1.5">
        <SearchIcon className="text-text-muted/70" />
        <input
          className="min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted/60"
          placeholder="Search status effects…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            title={`Filter by type · ${activeTypeLabel}`}
            aria-label={`Filter by type, current: ${activeTypeLabel}`}
            className={cx(
              "focus-ring inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[0.6rem] uppercase tracking-wider transition",
              activeType === ALL_TYPES
                ? "border-[var(--chrome-stroke)] bg-transparent text-text-muted hover:border-accent/30 hover:text-accent"
                : "border-accent/40 bg-accent/10 text-accent",
            )}
          >
            <MoreIcon className="h-3 w-3" />
            <span>{activeTypeLabel}</span>
          </button>
          {filterOpen && (
            <div className="absolute right-0 top-7 z-20 w-44 overflow-hidden rounded-xl border border-[var(--chrome-stroke)] bg-bg-elevated shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setActiveType(ALL_TYPES);
                  setFilterOpen(false);
                }}
                className={cx(
                  "flex w-full items-center gap-2 border-b border-[var(--chrome-stroke)] px-3 py-2 text-left text-xs transition",
                  activeType === ALL_TYPES
                    ? "bg-accent/10 text-accent"
                    : "text-text-secondary hover:bg-[var(--chrome-fill-soft)]",
                )}
              >
                All
              </button>
              {effectTypeOptions.map((t) => {
                const active = activeType.toLowerCase() === t.value.toLowerCase();
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      setActiveType(t.value);
                      setFilterOpen(false);
                    }}
                    className={cx(
                      "flex w-full items-center gap-2 border-b border-[var(--chrome-stroke)] px-3 py-2 text-left text-xs transition last:border-b-0",
                      active
                        ? "bg-accent/10 text-accent"
                        : "text-text-secondary hover:bg-[var(--chrome-fill-soft)]",
                    )}
                  >
                    <span className="truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
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
          title="Duplicate the selected status effect"
          aria-label="Duplicate the selected status effect"
          className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted transition hover:border-accent/30 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
        >
          <CopyIcon />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={!hasSelection}
          title="Delete the selected status effect"
          aria-label="Delete the selected status effect"
          className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-lg border border-status-error/40 bg-status-error/10 text-status-error transition hover:bg-status-error/20 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <TrashIcon />
        </button>
      </div>

      <ul className="-mx-1 flex max-h-[64vh] flex-col gap-1.5 overflow-y-auto px-1 pb-1">
        {filtered.length === 0 ? (
          <li>
            <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-6 text-center text-2xs italic text-text-muted/70">
              No status effects match your filters.
            </div>
          </li>
        ) : (
          filtered.map(([id, def]) => {
            const typeLabel =
              effectTypeOptions.find(
                (t) => t.value.toLowerCase() === (def.effectType ?? "").toLowerCase(),
              )?.label ?? def.effectType;
            return (
              <ConditionRow
                key={id}
                id={id}
                def={def}
                typeLabel={typeLabel}
                selected={selectedId === id}
                onSelect={() => onSelect(id)}
              />
            );
          })
        )}
      </ul>
    </aside>
  );
}

interface ConditionRowProps {
  id: string;
  def: StatusEffectDefinitionConfig;
  typeLabel: string;
  selected: boolean;
  onSelect: () => void;
}

function ConditionRow({ id, def, typeLabel, selected, onSelect }: ConditionRowProps) {
  const stack = def.stackBehavior?.toUpperCase() ?? "REFRESH";
  const durationS =
    def.durationMs > 0 ? `${(def.durationMs / 1000).toFixed(0)}s` : "—";

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
        <ConditionThumb image={def.image} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-display text-sm font-semibold text-text-primary">
              {def.displayName || id}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-2xs text-text-muted/80">
            <span className="truncate">{typeLabel || "—"}</span>
            <span className="text-text-muted/40">·</span>
            <span className="shrink-0">{stack}</span>
            <span className="text-text-muted/40">·</span>
            <span className="shrink-0 font-mono">{durationS}</span>
          </div>
        </div>
      </button>
    </li>
  );
}

function ConditionThumb({ image }: { image: string | undefined }) {
  const src = useImageSrc(image);
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border",
        src
          ? "border-[var(--chrome-stroke-strong)]"
          : "border-dashed border-[var(--chrome-stroke)] bg-[var(--chrome-fill)]",
      )}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : null}
    </span>
  );
}

