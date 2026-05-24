import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AbilityDefinitionConfig,
  AbilityEffectConfig,
  AppConfig,
} from "@/types/config";
import {
  defaultAbilityDefinition,
  renameAbilityDefinition,
} from "@/components/config/panels/AbilitiesPanel";
import {
  AbilitiesList,
  ABILITY_CATEGORIES,
  ABILITY_SCOPE_FILTERS,
  categoryFor,
  type AbilityCategoryKey,
  type AbilityScopeFilter,
} from "./abilities/AbilitiesList";
import { AbilityEditor } from "./abilities/AbilityEditor";
import { cx } from "@/components/ui/FormWidgets";

const FALLBACK_TARGET_TYPES = [
  { value: "enemy", label: "Enemy" },
  { value: "self", label: "Self" },
  { value: "ally", label: "Ally" },
  { value: "pet", label: "Pet" },
];

function normalizeId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_/]/g, "");
}

function nextDefaultId(existing: Record<string, unknown>): string {
  const base = "new_ability";
  if (!existing[base]) return base;
  let i = 2;
  while (existing[`${base}_${i}`]) i += 1;
  return `${base}_${i}`;
}

function nextDuplicateId(base: string, existing: Record<string, unknown>): string {
  let i = 2;
  while (existing[`${base}_copy_${i - 1}`]) i += 1;
  return `${base}_copy_${i - 1}`;
}

export function AbilityDesigner({
  config,
  onChange,
}: {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}) {
  const abilities = config.abilities;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [category, setCategory] = useState<AbilityCategoryKey>("all");
  const [scope, setScope] = useState<AbilityScopeFilter>("all");

  useEffect(() => {
    if (selectedId && abilities[selectedId]) return;
    const first = Object.keys(abilities)[0] ?? null;
    setSelectedId(first);
  }, [abilities, selectedId]);

  // Auto-jump category to match the selected ability when the user picks one
  // outside the current filter.
  useEffect(() => {
    if (!selectedId) return;
    const a = abilities[selectedId];
    if (!a) return;
    if (category === "all") return;
    if (categoryFor(a) !== category) {
      setCategory("all");
    }
    // We deliberately omit `category` from deps so jumping happens only on selection change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, abilities]);

  const targetTypeOptions = useMemo(() => {
    const entries = Object.entries(config.abilityTargetTypes);
    if (entries.length > 0) {
      return entries.map(([id, def]) => ({ value: id, label: def.displayName }));
    }
    return FALLBACK_TARGET_TYPES;
  }, [config.abilityTargetTypes]);

  const statusEffectOptions = useMemo(
    () =>
      Object.keys(config.statusEffects).map((id) => ({
        value: id,
        label: config.statusEffects[id]!.displayName,
      })),
    [config.statusEffects],
  );

  const classOptions = useMemo(
    () =>
      Object.keys(config.classes).map((id) => ({
        value: id,
        label: config.classes[id]!.displayName,
      })),
    [config.classes],
  );

  const petOptions = useMemo(
    () =>
      Object.keys(config.pets ?? {}).map((id) => ({
        value: id,
        label: (config.pets ?? {})[id]!.name,
      })),
    [config.pets],
  );

  const knownTrees = useMemo(() => {
    const set = new Set<string>();
    for (const a of Object.values(abilities)) {
      if (a.tree) set.add(a.tree);
    }
    return Array.from(set).sort();
  }, [abilities]);

  const patchAbility = useCallback(
    (id: string, p: Partial<AbilityDefinitionConfig>) => {
      const cur = abilities[id];
      if (!cur) return;
      onChange({ abilities: { ...abilities, [id]: { ...cur, ...p } } });
    },
    [abilities, onChange],
  );

  const patchEffect = useCallback(
    (id: string, p: Partial<AbilityEffectConfig>) => {
      const cur = abilities[id];
      if (!cur) return;
      const nextEffect: AbilityEffectConfig =
        p.type && p.type !== cur.effect.type
          ? // On type change, drop the previous type's fields but keep any
            // seed values the caller passed in alongside `type` (e.g. an
            // initial `effects` list when switching to COMPOSITE).
            ({ ...p, type: p.type } as AbilityEffectConfig)
          : { ...cur.effect, ...p };
      onChange({
        abilities: { ...abilities, [id]: { ...cur, effect: nextEffect } },
      });
    },
    [abilities, onChange],
  );

  const renameAbility = useCallback(
    (oldId: string, rawNewId: string) => {
      const newId = normalizeId(rawNewId);
      if (!newId || oldId === newId || abilities[newId]) return;
      onChange({ abilities: renameAbilityDefinition(config, oldId, newId) });
      if (selectedId === oldId) setSelectedId(newId);
    },
    [abilities, config, onChange, selectedId],
  );

  const addAbility = useCallback(() => {
    const id = nextDefaultId(abilities);
    onChange({
      abilities: {
        ...abilities,
        [id]: defaultAbilityDefinition("New Ability"),
      },
    });
    setSelectedId(id);
  }, [abilities, onChange]);

  const duplicateAbility = useCallback(() => {
    if (!selectedId) return;
    const source = abilities[selectedId];
    if (!source) return;
    const newId = nextDuplicateId(selectedId, abilities);
    const cloned: AbilityDefinitionConfig = {
      ...source,
      displayName: `${source.displayName} (copy)`,
      effect: { ...source.effect },
      prerequisites: source.prerequisites
        ? [...source.prerequisites]
        : undefined,
    };
    onChange({ abilities: { ...abilities, [newId]: cloned } });
    setSelectedId(newId);
  }, [abilities, onChange, selectedId]);

  const deleteAbility = useCallback(() => {
    if (!selectedId) return;
    const next = { ...abilities };
    delete next[selectedId];
    onChange({ abilities: next });
    setSelectedId(null);
  }, [abilities, onChange, selectedId]);

  const selected = selectedId ? abilities[selectedId] ?? null : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="panel-surface flex flex-wrap items-center gap-1.5 rounded-2xl px-3 py-2 shadow-section">
        {ABILITY_CATEGORIES.map((c) => {
          const active = category === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              aria-pressed={active}
              className={cx(
                "focus-ring inline-flex items-center rounded-full border px-3 py-1 font-display text-2xs uppercase tracking-[0.16em] transition",
                active
                  ? "border-accent/60 bg-accent/15 text-accent"
                  : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted hover:border-accent/30 hover:text-accent",
              )}
            >
              {c.label}
            </button>
          );
        })}
        <span aria-hidden="true" className="mx-1 h-4 w-px bg-[var(--chrome-stroke)]" />
        {ABILITY_SCOPE_FILTERS.map((s) => {
          const active = scope === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setScope(s.key)}
              aria-pressed={active}
              className={cx(
                "focus-ring inline-flex items-center rounded-full border px-3 py-1 font-display text-2xs uppercase tracking-[0.16em] transition",
                active
                  ? "border-accent/60 bg-accent/15 text-accent"
                  : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted hover:border-accent/30 hover:text-accent",
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-3">
          <AbilitiesList
            abilities={abilities}
            category={category}
            scope={scope}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAdd={addAbility}
            onDuplicate={duplicateAbility}
            onDelete={deleteAbility}
          />
        </div>

        <div className="xl:col-span-9">
          {selectedId && selected ? (
            <AbilityEditor
              id={selectedId}
              ability={selected}
              abilities={abilities}
              knownTrees={knownTrees}
              classOptions={classOptions}
              statusEffectOptions={statusEffectOptions}
              targetTypeOptions={targetTypeOptions}
              petOptions={petOptions}
              mobTiers={config.mobTiers}
              statBindings={config.stats.bindings}
              classes={config.classes}
              progression={config.progression}
              onPatch={(p) => patchAbility(selectedId, p)}
              onPatchEffect={(p) => patchEffect(selectedId, p)}
              onRename={(v) => renameAbility(selectedId, v)}
            />
          ) : (
            <EmptyEditor onAdd={addAbility} />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyEditor({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="panel-surface flex flex-col items-center justify-center gap-3 rounded-2xl px-6 py-12 text-center shadow-section">
      <div>
        <p className="font-display text-base text-text-primary">No ability selected</p>
        <p className="mt-1 max-w-xs text-2xs text-text-muted/80">
          Choose an ability from the roster, or create a new one to get started.
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20"
      >
        + Add Ability
      </button>
    </div>
  );
}
