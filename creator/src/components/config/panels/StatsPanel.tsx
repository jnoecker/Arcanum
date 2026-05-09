import { useEffect, useMemo, useRef, useState } from "react";
import type { ConfigPanelProps } from "./types";
import type { StatBindings, StatDefinition } from "@/types/config";
import {
  TextInput,
  NumberInput,
  SelectInput,
  CommitTextarea,
} from "@/components/ui/FormWidgets";
import { SectionCard } from "./factions/SectionCard";
import {
  PlusIcon,
  TrashIcon,
  SearchIcon,
} from "../achievements/icons";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function normalizeStatId(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

interface StatsPanelProps extends ConfigPanelProps {
  showDefinitions?: boolean;
}

type TabId = "definitions" | "bindings";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "definitions", label: "Definitions" },
  { id: "bindings", label: "Bindings" },
];

export function StatsPanel({ config, onChange, showDefinitions = true }: StatsPanelProps) {
  const { definitions, bindings } = config.stats;
  const [active, setActive] = useState<TabId>(showDefinitions ? "definitions" : "bindings");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const patchDef = (id: string, p: Partial<StatDefinition>) =>
    onChange({
      stats: {
        ...config.stats,
        definitions: {
          ...definitions,
          [id]: { ...definitions[id]!, ...p },
        },
      },
    });

  const patchBindings = (p: Partial<StatBindings>) =>
    onChange({
      stats: { ...config.stats, bindings: { ...bindings, ...p } },
    });

  const addStat = (id: string) => {
    const cleaned = normalizeStatId(id);
    if (!cleaned || definitions[cleaned]) return cleaned;
    onChange({
      stats: {
        ...config.stats,
        definitions: {
          ...definitions,
          [cleaned]: {
            id: cleaned,
            displayName: cleaned,
            abbreviation: cleaned.slice(0, 3),
            description: "",
            baseStat: 10,
          },
        },
      },
    });
    return cleaned;
  };

  const deleteStat = (id: string) => {
    const next = { ...definitions };
    delete next[id];
    onChange({ stats: { ...config.stats, definitions: next } });
  };

  const statOptions = useMemo(
    () =>
      Object.keys(definitions).map((id) => ({
        value: id,
        label: definitions[id]!.displayName || id,
      })),
    [definitions],
  );

  const definitionCount = Object.keys(definitions).length;
  const visibleTabs = showDefinitions ? TABS : TABS.filter((t) => t.id === "bindings");

  return (
    <div className="flex flex-col gap-5">
      {showDefinitions && (
        <div className="flex items-center justify-between gap-3">
          <div
            className="segmented-control"
            role="tablist"
            aria-label="Stats views"
          >
            {visibleTabs.map((tab, index) => (
              <button
                key={tab.id}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                role="tab"
                aria-selected={active === tab.id}
                aria-controls={`stats-tab-${tab.id}`}
                tabIndex={active === tab.id ? 0 : -1}
                onClick={() => setActive(tab.id)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight") {
                    event.preventDefault();
                    const next = (index + 1) % visibleTabs.length;
                    setActive(visibleTabs[next]!.id);
                    tabRefs.current[next]?.focus();
                  } else if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    const next = (index - 1 + visibleTabs.length) % visibleTabs.length;
                    setActive(visibleTabs[next]!.id);
                    tabRefs.current[next]?.focus();
                  }
                }}
                className="segmented-button focus-ring px-4 py-2 text-xs font-medium"
                data-active={active === tab.id}
              >
                {tab.label}
                {tab.id === "definitions" && (
                  <span className="ml-2 text-2xs text-text-muted">{definitionCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        id={`stats-tab-${active}`}
        role="tabpanel"
        aria-labelledby={`stats-tab-${active}`}
      >
        {active === "definitions" && showDefinitions && (
          <StatDefinitionsBuilder
            definitions={definitions}
            onAdd={addStat}
            onPatch={patchDef}
            onDelete={deleteStat}
          />
        )}

        {active === "bindings" && (
          <StatBindingsGrid
            bindings={bindings}
            statOptions={statOptions}
            onPatch={patchBindings}
          />
        )}
      </div>
    </div>
  );
}

// ─── Definitions: roster + editor ──────────────────────────────────

function StatDefinitionsBuilder({
  definitions,
  onAdd,
  onPatch,
  onDelete,
}: {
  definitions: Record<string, StatDefinition>;
  onAdd: (id: string) => string;
  onPatch: (id: string, p: Partial<StatDefinition>) => void;
  onDelete: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId && definitions[selectedId]) return;
    setSelectedId(Object.keys(definitions)[0] ?? null);
  }, [definitions, selectedId]);

  const handleAdd = () => {
    let base = "NEW_STAT";
    let candidate = base;
    let i = 2;
    while (definitions[candidate]) {
      candidate = `${base}_${i}`;
      i += 1;
    }
    const created = onAdd(candidate);
    if (created) setSelectedId(created);
  };

  const handleDelete = (id: string) => {
    onDelete(id);
    if (selectedId === id) setSelectedId(null);
  };

  const selected = selectedId ? definitions[selectedId] ?? null : null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <DefinitionsList
          definitions={definitions}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAdd={handleAdd}
        />
      </div>
      <div className="lg:col-span-8">
        {selectedId && selected ? (
          <DefinitionEditor
            id={selectedId}
            def={selected}
            onPatch={(p) => onPatch(selectedId, p)}
            onDelete={() => handleDelete(selectedId)}
          />
        ) : (
          <div className="panel-surface flex h-full items-center justify-center rounded-2xl p-8 shadow-section">
            <div className="text-center">
              <p className="font-display text-xs uppercase tracking-wider text-text-muted">
                Nothing selected
              </p>
              <p className="mt-2 text-2xs leading-snug text-text-muted/70">
                Pick a stat from the list, or add a new one to begin.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DefinitionsList({
  definitions,
  selectedId,
  onSelect,
  onAdd,
}: {
  definitions: Record<string, StatDefinition>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  const [query, setQuery] = useState("");
  const ids = Object.keys(definitions);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ids;
    return ids.filter((id) => {
      const d = definitions[id]!;
      return (
        id.toLowerCase().includes(q) ||
        d.displayName.toLowerCase().includes(q) ||
        d.abbreviation.toLowerCase().includes(q)
      );
    });
  }, [ids, definitions, query]);

  return (
    <aside className="panel-surface flex flex-col gap-2 rounded-2xl p-3 shadow-section">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
          Stat Definitions
        </h3>
        <span className="font-mono text-2xs text-text-muted/70">{ids.length}</span>
      </div>

      <div className="ornate-input flex items-center gap-2 px-2.5 py-1.5">
        <SearchIcon className="text-text-muted/70" />
        <input
          className="min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted/60"
          placeholder="Search stats…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
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

      <ul className="-mx-1 flex max-h-[60vh] flex-col gap-1 overflow-y-auto px-1 pb-1">
        {filtered.length === 0 ? (
          <li>
            <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-6 text-center text-2xs italic text-text-muted/70">
              {ids.length === 0 ? "No stats yet — add one above." : `No stats match "${query}".`}
            </div>
          </li>
        ) : (
          filtered.map((id) => {
            const def = definitions[id]!;
            const isSelected = selectedId === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onSelect(id)}
                  aria-pressed={isSelected}
                  className={cx(
                    "focus-ring flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition",
                    isSelected
                      ? "border-accent/60 bg-accent/[0.07] shadow-[0_0_18px_-10px_rgb(var(--accent-rgb)/0.7)]"
                      : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] hover:border-accent/30 hover:bg-[var(--chrome-fill)]",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      "inline-flex h-7 w-9 shrink-0 items-center justify-center rounded-md border font-mono text-[0.6rem] font-semibold tracking-wider",
                      isSelected
                        ? "border-accent/60 bg-accent/15 text-accent"
                        : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] text-text-muted",
                    )}
                  >
                    {def.abbreviation || id.slice(0, 3)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-xs font-semibold text-text-primary">
                      {def.displayName || id}
                    </div>
                    <div className="truncate font-mono text-[0.6rem] text-text-muted/70">
                      {id} · base {def.baseStat}
                    </div>
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

function DefinitionEditor({
  id,
  def,
  onPatch,
  onDelete,
}: {
  id: string;
  def: StatDefinition;
  onPatch: (p: Partial<StatDefinition>) => void;
  onDelete: () => void;
}) {
  return (
    <SectionCard
      title={def.displayName || id}
      actions={
        <button
          type="button"
          onClick={onDelete}
          title="Delete stat"
          aria-label="Delete stat"
          className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-md border border-status-error/40 bg-status-error/10 text-status-error transition hover:bg-status-error/20"
        >
          <TrashIcon />
        </button>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Internal ID">
          <input
            value={id}
            disabled
            className="ornate-input min-h-9 w-full px-2.5 py-1.5 font-mono text-xs uppercase tracking-wider text-text-muted opacity-70"
          />
        </Field>
        <Field label="Abbreviation">
          <TextInput
            value={def.abbreviation}
            onCommit={(v) => onPatch({ abbreviation: v })}
            placeholder="STR"
            dense
          />
        </Field>
        <Field label="Display Name" required>
          <TextInput
            value={def.displayName}
            onCommit={(v) => onPatch({ displayName: v })}
            placeholder="Strength"
            dense
          />
        </Field>
        <Field label="Base Value">
          <NumberInput
            value={def.baseStat}
            onCommit={(v) => onPatch({ baseStat: v ?? 10 })}
            min={0}
            dense
          />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Description">
          <CommitTextarea
            label=""
            value={def.description}
            onCommit={(v) => onPatch({ description: v })}
            placeholder="Flavor text shown on the character sheet."
            rows={2}
          />
        </Field>
      </div>
    </SectionCard>
  );
}

// ─── Bindings: card grid ───────────────────────────────────────────

function StatBindingsGrid({
  bindings,
  statOptions,
  onPatch,
}: {
  bindings: StatBindings;
  statOptions: { value: string; label: string }[];
  onPatch: (p: Partial<StatBindings>) => void;
}) {
  return (
    <SectionCard
      title="Stat Bindings"
      description="Connect a stat to each derived attribute. Lower divisors mean each point of the stat does more."
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <BindingCard
          title="Melee Damage"
          formula={(stat, n) => `+ ${stat} / ${n}`}
          stat={bindings.meleeDamageStat}
          statOptions={statOptions}
          onStat={(v) => onPatch({ meleeDamageStat: v })}
          numeric={{
            label: "Divisor",
            value: bindings.meleeDamageDivisor,
            min: 1,
            onCommit: (v) => onPatch({ meleeDamageDivisor: v ?? 3 }),
          }}
        />

        <BindingCard
          title="Dodge"
          formula={(stat, n) => `+ ${stat} × ${n}%  (cap ${bindings.maxDodgePercent}%)`}
          stat={bindings.dodgeStat}
          statOptions={statOptions}
          onStat={(v) => onPatch({ dodgeStat: v })}
          numeric={{
            label: "% / point",
            value: bindings.dodgePerPoint,
            min: 0,
            step: 0.1,
            onCommit: (v) => onPatch({ dodgePerPoint: v ?? 2 }),
          }}
          extra={
            <Field label="Max %" hint="Hard cap regardless of stat investment.">
              <NumberInput
                value={bindings.maxDodgePercent}
                onCommit={(v) => onPatch({ maxDodgePercent: v ?? 30 })}
                min={0}
                max={100}
                dense
              />
            </Field>
          }
        />

        <BindingCard
          title="Spell Damage"
          formula={(stat, n) => `+ ${stat} / ${n}`}
          stat={bindings.spellDamageStat}
          statOptions={statOptions}
          onStat={(v) => onPatch({ spellDamageStat: v })}
          numeric={{
            label: "Divisor",
            value: bindings.spellDamageDivisor,
            min: 1,
            onCommit: (v) => onPatch({ spellDamageDivisor: v ?? 3 }),
          }}
        />

        <BindingCard
          title="HP Scaling"
          formula={(stat, n) => `+ ${stat} / ${n} max HP`}
          stat={bindings.hpScalingStat}
          statOptions={statOptions}
          onStat={(v) => onPatch({ hpScalingStat: v })}
          numeric={{
            label: "Divisor",
            value: bindings.hpScalingDivisor,
            min: 1,
            onCommit: (v) => onPatch({ hpScalingDivisor: v ?? 5 }),
          }}
        />

        <BindingCard
          title="Mana Scaling"
          formula={(stat, n) => `+ ${stat} / ${n} max Mana`}
          stat={bindings.manaScalingStat}
          statOptions={statOptions}
          onStat={(v) => onPatch({ manaScalingStat: v })}
          numeric={{
            label: "Divisor",
            value: bindings.manaScalingDivisor,
            min: 1,
            onCommit: (v) => onPatch({ manaScalingDivisor: v ?? 5 }),
          }}
        />

        <BindingCard
          title="HP Regen"
          formula={(stat, n) => `– ${stat} × ${n}ms from regen tick`}
          stat={bindings.hpRegenStat}
          statOptions={statOptions}
          onStat={(v) => onPatch({ hpRegenStat: v })}
          numeric={{
            label: "ms / point",
            value: bindings.hpRegenMsPerPoint,
            min: 1,
            onCommit: (v) => onPatch({ hpRegenMsPerPoint: v ?? 200 }),
          }}
        />

        <BindingCard
          title="Mana Regen"
          formula={(stat, n) => `– ${stat} × ${n}ms from regen tick`}
          stat={bindings.manaRegenStat}
          statOptions={statOptions}
          onStat={(v) => onPatch({ manaRegenStat: v })}
          numeric={{
            label: "ms / point",
            value: bindings.manaRegenMsPerPoint,
            min: 1,
            onCommit: (v) => onPatch({ manaRegenMsPerPoint: v ?? 200 }),
          }}
        />

        <BindingCard
          title="XP Bonus"
          formula={(stat, n) => `+ ${stat} × ${(n * 100).toFixed(1)}% XP`}
          stat={bindings.xpBonusStat}
          statOptions={statOptions}
          onStat={(v) => onPatch({ xpBonusStat: v })}
          numeric={{
            label: "Per point",
            value: bindings.xpBonusPerPoint,
            min: 0,
            step: 0.001,
            onCommit: (v) => onPatch({ xpBonusPerPoint: v ?? 0.005 }),
          }}
        />
      </div>
    </SectionCard>
  );
}

function BindingCard({
  title,
  formula,
  stat,
  statOptions,
  onStat,
  numeric,
  extra,
}: {
  title: string;
  formula: (statLabel: string, n: number) => string;
  stat: string;
  statOptions: { value: string; label: string }[];
  onStat: (v: string) => void;
  numeric: {
    label: string;
    value: number;
    min?: number;
    step?: number;
    onCommit: (v: number | undefined) => void;
  };
  extra?: React.ReactNode;
}) {
  const statLabel =
    statOptions.find((o) => o.value === stat)?.label ??
    (stat ? stat : "stat");
  return (
    <div className="rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="font-display text-2xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
          {title}
        </h4>
        <span className="truncate font-mono text-[0.6rem] text-text-muted/80">
          {formula(statLabel, numeric.value)}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Field label="Stat">
          <SelectInput
            value={stat}
            options={statOptions}
            onCommit={onStat}
            dense
          />
        </Field>
        <Field label={numeric.label}>
          <NumberInput
            value={numeric.value}
            onCommit={numeric.onCommit}
            min={numeric.min}
            step={numeric.step}
            dense
          />
        </Field>
      </div>

      {extra && <div className="mt-2">{extra}</div>}
    </div>
  );
}

// ─── Shared ────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
        {label} {required && <span className="text-accent">*</span>}
      </span>
      {children}
      {hint && (
        <p className="text-2xs leading-snug text-text-muted/70">{hint}</p>
      )}
    </div>
  );
}
