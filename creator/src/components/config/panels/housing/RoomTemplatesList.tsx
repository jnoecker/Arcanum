import { useMemo, useState } from "react";
import type { HousingConfig, HousingTemplateDefinition } from "@/types/config";
import { useImageSrc } from "@/lib/useImageSrc";
import { SelectInput } from "@/components/ui/FormWidgets";
import { SectionCard } from "@/components/ui/SectionCard";
import { PlusIcon, SearchIcon, ChevronRightIcon } from "./icons";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

const DIRECTION_OPTIONS = [
  { value: "NORTH", label: "North" },
  { value: "SOUTH", label: "South" },
  { value: "EAST", label: "East" },
  { value: "WEST", label: "West" },
  { value: "UP", label: "Up" },
  { value: "DOWN", label: "Down" },
];

interface RoomTemplatesListProps {
  templates: Record<string, HousingTemplateDefinition>;
  selected: string | null;
  enabled: boolean;
  entryExitDirection: string;
  onPatchHousing: (p: Partial<HousingConfig>) => void;
  onAdd: () => void;
  onSeedStarter: () => void;
  onSelect: (id: string) => void;
}

const GOLD_FORMATTER = new Intl.NumberFormat();

export function RoomTemplatesList({
  templates,
  selected,
  enabled,
  entryExitDirection,
  onPatchHousing,
  onAdd,
  onSeedStarter,
  onSelect,
}: RoomTemplatesListProps) {
  const [query, setQuery] = useState("");

  const ids = Object.keys(templates);
  const filtered = useMemo(() => {
    if (!query.trim()) return ids;
    const q = query.toLowerCase();
    return ids.filter((id) => {
      const t = templates[id]!;
      return (
        id.toLowerCase().includes(q) ||
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      );
    });
  }, [ids, query, templates]);

  return (
    <SectionCard title="Dwellings">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] p-2">
          <EnabledToggle
            enabled={enabled}
            onToggle={() => onPatchHousing({ enabled: !enabled })}
          />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
              Exit dir.
            </span>
            <div className="min-w-0 flex-1">
              <SelectInput
                value={entryExitDirection}
                options={DIRECTION_OPTIONS}
                onCommit={(v) => onPatchHousing({ entryExitDirection: v })}
                dense
              />
            </div>
          </div>
        </div>

        <div className={cx("flex flex-col gap-3", !enabled && "opacity-60")}>
          <div className="flex items-center gap-2">
            <div className="ornate-input flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5">
              <SearchIcon className="text-text-muted/70" />
              <input
                className="min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted/60"
                placeholder="Search dwellings…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={!enabled}
              />
            </div>
            <button
              type="button"
              onClick={onAdd}
              disabled={!enabled}
              title="Commission a new dwelling"
              className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PlusIcon />
              Add
            </button>
          </div>

          {ids.length === 0 ? (
            <EmptyTemplates onSeedStarter={onSeedStarter} onAdd={onAdd} />
          ) : filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-4 py-6 text-center text-2xs italic text-text-muted/70">
              No dwellings match "{query}".
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map((id) => (
                <RoomCard
                  key={id}
                  id={id}
                  t={templates[id]!}
                  selected={selected === id}
                  onSelect={() => onSelect(id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function EnabledToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={cx(
        "focus-ring inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition",
        enabled
          ? "border-accent/40 bg-accent/10"
          : "border-[var(--chrome-stroke)] bg-transparent hover:border-accent/30",
      )}
    >
      <span
        className={cx(
          "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors",
          enabled ? "bg-accent/80" : "bg-[var(--chrome-fill-strong)]",
        )}
      >
        <span
          className={cx(
            "inline-block h-3 w-3 rounded-full bg-bg-primary shadow-md transition-transform",
            enabled ? "translate-x-[0.875rem]" : "translate-x-0.5",
          )}
        />
      </span>
      <span
        className={cx(
          "font-display text-2xs font-semibold uppercase tracking-wider",
          enabled ? "text-accent" : "text-text-muted",
        )}
      >
        {enabled ? "Enabled" : "Disabled"}
      </span>
    </button>
  );
}

interface RoomCardProps {
  id: string;
  t: HousingTemplateDefinition;
  selected: boolean;
  onSelect: () => void;
}

function RoomCard({ id, t, selected, onSelect }: RoomCardProps) {
  const thumb = useImageSrc(t.image || undefined);
  const vaultCap = t.maxDroppedItems ?? 0;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cx(
          "focus-ring group flex w-full items-stretch gap-3 rounded-xl border p-3 text-left transition",
          selected
            ? "selected-card"
            : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30 hover:bg-[var(--chrome-fill)]",
        )}
      >
        <div
          className={cx(
            "relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border",
            selected ? "border-accent/40" : "border-[var(--chrome-stroke)]",
          )}
        >
          {thumb ? (
            <img
              src={thumb}
              alt={t.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-bg-abyss/40">
              <span className="font-display text-2xs uppercase tracking-[0.18em] text-text-muted/50">
                Room
              </span>
            </div>
          )}
          {t.isEntry && (
            <span className="absolute left-1 top-1 rounded-md bg-accent px-1.5 py-0.5 font-display text-[0.55rem] font-semibold uppercase tracking-wider text-bg-abyss shadow-md">
              Entry
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="truncate font-display text-base font-semibold text-text-primary">
                {t.title || id}
              </h4>
              <p className="truncate font-mono text-2xs text-text-muted/70">{id}</p>
            </div>
            <div className="flex shrink-0 items-baseline gap-1">
              <span className="font-display text-base font-semibold leading-none text-warm">
                {GOLD_FORMATTER.format(t.cost ?? 0)}
              </span>
              <span className="font-display text-[0.6rem] uppercase tracking-wider text-warm/70">
                g
              </span>
            </div>
          </div>

          {t.description && (
            <p className="mt-1 line-clamp-2 text-2xs leading-snug text-text-muted/80">
              {t.description}
            </p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {t.safe && (
              <span className="inline-flex items-center gap-1 rounded-md border border-stellar-blue/30 bg-stellar-blue/10 px-1.5 py-0.5 font-display text-[0.55rem] font-semibold uppercase tracking-wider text-stellar-blue">
                Safe
              </span>
            )}
            {vaultCap > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md border border-status-warning/30 bg-status-warning/10 px-1.5 py-0.5 font-display text-[0.55rem] font-semibold uppercase tracking-wider text-status-warning">
                Vault · {vaultCap}
              </span>
            )}
          </div>
        </div>

        <ChevronRightIcon
          className={cx(
            "mt-7 h-4 w-4 self-start text-text-muted/40 transition-colors",
            selected && "text-accent",
          )}
        />
      </button>
    </li>
  );
}

function EmptyTemplates({
  onSeedStarter,
  onAdd,
}: {
  onSeedStarter: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="bg-gradient-panel-light relative overflow-hidden rounded-xl border border-[var(--chrome-stroke)] px-5 py-8 text-center shadow-section">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px flourish-top-thread" />
      <p className="font-display text-base font-semibold text-text-primary">
        No dwellings yet.
      </p>
      <p className="mt-2 text-2xs leading-snug text-text-muted/80">
        Begin with a starter set — Entry Hall, Bedchamber, Vault, Forge — or
        build your own.
      </p>
      <div className="mt-4 flex flex-col items-stretch gap-2">
        <button
          type="button"
          onClick={onSeedStarter}
          className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-lg border border-accent/40 bg-accent/15 px-3 py-2 font-display text-2xs font-semibold uppercase tracking-[0.18em] text-accent transition hover:bg-accent/25"
        >
          Begin with starter set
        </button>
        <button
          type="button"
          onClick={onAdd}
          className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--chrome-stroke)] bg-transparent px-3 py-1.5 text-2xs text-text-muted transition hover:border-accent/30 hover:text-text-secondary"
        >
          Start blank
        </button>
      </div>
    </div>
  );
}

