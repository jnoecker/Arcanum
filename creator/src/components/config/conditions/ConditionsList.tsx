import { useMemo, useState } from "react";
import type { StatusEffectDefinitionConfig } from "@/types/config";
import { useImageSrc } from "@/lib/useImageSrc";
import { SearchIcon, PlusIcon, MoreIcon } from "./icons";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

interface ConditionsListProps {
  defs: Record<string, StatusEffectDefinitionConfig>;
  effectTypeOptions: { value: string; label: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

const ALL_TYPES = "__all__";

export function ConditionsList({
  defs,
  effectTypeOptions,
  selectedId,
  onSelect,
  onAdd,
}: ConditionsListProps) {
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<string>(ALL_TYPES);
  const [moreOpen, setMoreOpen] = useState(false);

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

  const visibleTypeChips = effectTypeOptions.slice(0, 3);
  const overflowTypes = effectTypeOptions.slice(3);

  return (
    <aside className="panel-surface flex flex-col gap-3 rounded-2xl p-4 shadow-section">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
          Conditions Roster
        </h3>
        <span className="font-mono text-2xs text-text-muted/70">
          {Object.keys(defs).length}
        </span>
      </div>

      <div className="ornate-input flex items-center gap-2 px-2.5 py-1.5">
        <SearchIcon className="text-text-muted/70" />
        <input
          className="min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted/60"
          placeholder="Search conditions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <TypeChip
          active={activeType === ALL_TYPES}
          onClick={() => setActiveType(ALL_TYPES)}
        >
          All
        </TypeChip>
        {visibleTypeChips.map((t) => (
          <TypeChip
            key={t.value}
            active={activeType.toLowerCase() === t.value.toLowerCase()}
            onClick={() => setActiveType(t.value)}
          >
            {t.label}
          </TypeChip>
        ))}
        {overflowTypes.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-label="More effect types"
              className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted transition hover:border-accent/30 hover:text-accent"
            >
              <MoreIcon />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-xl border border-[var(--chrome-stroke)] bg-bg-elevated shadow-lg">
                {overflowTypes.map((t) => {
                  const active = activeType.toLowerCase() === t.value.toLowerCase();
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => {
                        setActiveType(t.value);
                        setMoreOpen(false);
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
        )}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20"
      >
        <PlusIcon />
        Add Condition
      </button>

      <ul className="-mx-1 flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto px-1 pb-1">
        {filtered.length === 0 ? (
          <li>
            <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-6 text-center text-2xs italic text-text-muted/70">
              No conditions match your filters.
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

function TypeChip({
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
