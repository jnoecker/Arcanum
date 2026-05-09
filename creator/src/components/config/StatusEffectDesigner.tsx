import { useEffect, useMemo, useState } from "react";
import type { AppConfig, StatusEffectDefinitionConfig } from "@/types/config";
import {
  defaultStatusEffectDefinition,
  renameStatusEffectDefinition,
} from "@/components/config/panels/StatusEffectsPanel";
import { ConditionsList } from "./conditions/ConditionsList";
import { ConditionEditor } from "./conditions/ConditionEditor";
import { PlusIcon } from "./conditions/icons";

const FALLBACK_EFFECT_TYPES = [
  { value: "dot", label: "Damage Over Time" },
  { value: "hot", label: "Heal Over Time" },
  { value: "stat_buff", label: "Stat Buff" },
  { value: "stat_debuff", label: "Stat Debuff" },
  { value: "stun", label: "Stun" },
  { value: "root", label: "Root" },
  { value: "shield", label: "Shield" },
];

const FALLBACK_STACK_BEHAVIORS = [
  { value: "refresh", label: "Refresh" },
  { value: "stack", label: "Stack" },
  { value: "none", label: "None" },
];

function normalizeId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function nextDefaultId(existing: Record<string, unknown>): string {
  const base = "new_condition";
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

interface StatusEffectDesignerProps {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}

export function StatusEffectDesigner({ config, onChange }: StatusEffectDesignerProps) {
  const defs = config.statusEffects;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId && defs[selectedId]) return;
    const first = Object.keys(defs)[0] ?? null;
    setSelectedId(first);
  }, [defs, selectedId]);

  const statIds = useMemo(
    () => Object.keys(config.stats.definitions),
    [config.stats.definitions],
  );

  const effectTypeOptions = useMemo(() => {
    const entries = Object.entries(config.statusEffectTypes);
    if (entries.length > 0) {
      return entries.map(([id, def]) => ({ value: id, label: def.displayName }));
    }
    return FALLBACK_EFFECT_TYPES;
  }, [config.statusEffectTypes]);

  const stackBehaviorOptions = useMemo(() => {
    const entries = Object.entries(config.stackBehaviors);
    if (entries.length > 0) {
      return entries.map(([id, def]) => ({ value: id, label: def.displayName }));
    }
    return FALLBACK_STACK_BEHAVIORS;
  }, [config.stackBehaviors]);

  const patchDef = (id: string, patch: Partial<StatusEffectDefinitionConfig>) => {
    onChange({
      statusEffects: {
        ...defs,
        [id]: { ...defs[id]!, ...patch },
      },
    });
  };

  const renameDef = (oldId: string, rawNewId: string) => {
    const newId = normalizeId(rawNewId);
    if (!newId || oldId === newId || defs[newId]) return;
    const updated = renameStatusEffectDefinition(config, oldId, newId);
    onChange({
      statusEffects: updated.statusEffects,
      abilities: updated.abilities,
    });
    if (selectedId === oldId) setSelectedId(newId);
  };

  const addDef = () => {
    const id = nextDefaultId(defs);
    onChange({
      statusEffects: {
        ...defs,
        [id]: defaultStatusEffectDefinition("New Status Effect"),
      },
    });
    setSelectedId(id);
  };

  const duplicateDef = () => {
    if (!selectedId || !defs[selectedId]) return;
    const source = defs[selectedId]!;
    const newId = nextDuplicateId(selectedId, defs);
    const cloned: StatusEffectDefinitionConfig = {
      ...source,
      displayName: `${source.displayName} (copy)`,
      statMods: source.statMods ? { ...source.statMods } : undefined,
    };
    onChange({ statusEffects: { ...defs, [newId]: cloned } });
    setSelectedId(newId);
  };

  const deleteDef = () => {
    if (!selectedId || !defs[selectedId]) return;
    const next = { ...defs };
    delete next[selectedId];
    onChange({ statusEffects: next });
    setSelectedId(null);
  };

  const selected = selectedId ? defs[selectedId] ?? null : null;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="xl:col-span-3">
        <ConditionsList
          defs={defs}
          effectTypeOptions={effectTypeOptions}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAdd={addDef}
          onDuplicate={duplicateDef}
          onDelete={deleteDef}
        />
      </div>

      <div className="xl:col-span-9">
        {selectedId && selected ? (
          <ConditionEditor
            id={selectedId}
            def={selected}
            statIds={statIds}
            effectTypeOptions={effectTypeOptions}
            stackBehaviorOptions={stackBehaviorOptions}
            onPatch={(p) => patchDef(selectedId, p)}
            onRename={(v) => renameDef(selectedId, v)}
          />
        ) : (
          <div className="panel-surface flex flex-col items-center justify-center gap-2 rounded-2xl px-6 py-12 text-center shadow-section">
            <p className="font-display text-sm text-text-primary">
              Nothing selected
            </p>
            <p className="max-w-xs text-2xs text-text-muted/80">
              Choose a status effect from the roster, or add a new one to begin.
            </p>
            <button
              type="button"
              onClick={addDef}
              className="focus-ring mt-1 inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-2xs font-medium text-accent transition hover:bg-accent/20"
            >
              <PlusIcon />
              New Status Effect
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
