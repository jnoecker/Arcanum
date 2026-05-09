import { useMemo, useState } from "react";
import type { AbilityDefinitionConfig } from "@/types/config";
import { useImageSrc } from "@/lib/useImageSrc";
import { SearchIcon, PlusIcon, CopyIcon, TrashIcon } from "../achievements/icons";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export type AbilityCategoryKey =
  | "all"
  | "DIRECT_DAMAGE"
  | "AREA_DAMAGE"
  | "DIRECT_HEAL"
  | "APPLY_STATUS"
  | "POWER";

export const ABILITY_CATEGORIES: { key: AbilityCategoryKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "DIRECT_DAMAGE", label: "Direct Damage" },
  { key: "AREA_DAMAGE", label: "Area Damage" },
  { key: "DIRECT_HEAL", label: "Heal" },
  { key: "APPLY_STATUS", label: "Effects" },
  { key: "POWER", label: "Power & Identity" },
];

const POWER_TYPES = new Set(["TAUNT", "SUMMON_PET"]);

export function categoryFor(ability: AbilityDefinitionConfig): AbilityCategoryKey {
  const t = ability.effect.type;
  if (t === "DIRECT_DAMAGE") return "DIRECT_DAMAGE";
  if (t === "AREA_DAMAGE") return "AREA_DAMAGE";
  if (t === "DIRECT_HEAL") return "DIRECT_HEAL";
  if (t === "APPLY_STATUS") return "APPLY_STATUS";
  if (POWER_TYPES.has(t)) return "POWER";
  return "POWER";
}

interface AbilitiesListProps {
  abilities: Record<string, AbilityDefinitionConfig>;
  category: AbilityCategoryKey;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function AbilitiesList({
  abilities,
  category,
  selectedId,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
}: AbilitiesListProps) {
  const [query, setQuery] = useState("");
  const hasSelection = selectedId !== null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(abilities).filter(([id, a]) => {
      if (category !== "all" && categoryFor(a) !== category) return false;
      if (!q) return true;
      const restriction = a.requiredClass || a.classRestriction || "";
      return (
        id.toLowerCase().includes(q) ||
        a.displayName.toLowerCase().includes(q) ||
        restriction.toLowerCase().includes(q) ||
        a.effect.type.toLowerCase().includes(q)
      );
    });
  }, [abilities, query, category]);

  return (
    <aside className="panel-surface flex flex-col gap-2 rounded-2xl p-3 shadow-section">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
          Ability Roster
        </h3>
        <span className="font-mono text-2xs text-text-muted/70">
          {Object.keys(abilities).length}
        </span>
      </div>

      <div className="ornate-input flex items-center gap-2 px-2.5 py-1.5">
        <SearchIcon className="text-text-muted/70" />
        <input
          className="min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted/60"
          placeholder="Search abilities…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
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
          title="Duplicate the selected ability"
          aria-label="Duplicate the selected ability"
          className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted transition hover:border-accent/30 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
        >
          <CopyIcon />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={!hasSelection}
          title="Delete the selected ability"
          aria-label="Delete the selected ability"
          className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-lg border border-status-error/40 bg-status-error/10 text-status-error transition hover:bg-status-error/20 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <TrashIcon />
        </button>
      </div>

      <ul className="-mx-1 flex max-h-[64vh] flex-col gap-1.5 overflow-y-auto px-1 pb-1">
        {filtered.length === 0 ? (
          <li>
            <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-6 text-center text-2xs italic text-text-muted/70">
              No abilities match your filters.
            </div>
          </li>
        ) : (
          filtered.map(([id, ability]) => (
            <AbilityRow
              key={id}
              id={id}
              ability={ability}
              selected={selectedId === id}
              onSelect={() => onSelect(id)}
            />
          ))
        )}
      </ul>
    </aside>
  );
}

interface AbilityRowProps {
  id: string;
  ability: AbilityDefinitionConfig;
  selected: boolean;
  onSelect: () => void;
}

function AbilityRow({ id, ability, selected, onSelect }: AbilityRowProps) {
  const imgSrc = useImageSrc(ability.image);
  const classId = ability.requiredClass || ability.classRestriction || "";
  const cost = ability.skillPointCost ?? 1;

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
        <span
          aria-hidden="true"
          className={cx(
            "relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border",
            selected
              ? "border-accent/50 bg-bg-elevated"
              : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)]",
          )}
        >
          {imgSrc ? (
            <img
              src={imgSrc}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <span className="font-display text-sm font-semibold text-text-muted/70">
              {(ability.displayName || id).slice(0, 2).toUpperCase()}
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-sm font-semibold text-text-primary">
            {ability.displayName || id}
          </div>
          <div className="mt-0.5 truncate font-mono text-2xs text-text-muted/70">
            {id}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
            <span>Lvl {ability.levelRequired}</span>
            <span className="text-text-muted/40">·</span>
            <span>{ability.targetType}</span>
            {classId && (
              <>
                <span className="text-text-muted/40">·</span>
                <span className="truncate">{classId}</span>
              </>
            )}
            {cost === 0 && (
              <>
                <span className="text-text-muted/40">·</span>
                <span className="text-badge-success">Auto</span>
              </>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}
