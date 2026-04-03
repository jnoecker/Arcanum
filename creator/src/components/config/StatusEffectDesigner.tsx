import { useEffect, useMemo, useState } from "react";
import type { AppConfig, StatusEffectDefinitionConfig } from "@/types/config";
import {
  StatusEffectDetail,
  defaultStatusEffectDefinition,
  renameStatusEffectDefinition,
  summarizeStatusEffect,
} from "@/components/config/panels/StatusEffectsPanel";

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

function normalizeStatusEffectId(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

function modifierCount(effect: StatusEffectDefinitionConfig) {
  const flat = [effect.strMod, effect.dexMod, effect.conMod, effect.intMod, effect.wisMod, effect.chaMod].filter(Boolean).length;
  return flat + Object.keys(effect.statMods ?? {}).length;
}

export function StatusEffectDesigner({
  config,
  onChange,
}: {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newId, setNewId] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const statIds = useMemo(() => Object.keys(config.stats.definitions), [config.stats.definitions]);

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

  const effectIds = useMemo(
    () =>
      Object.keys(config.statusEffects).filter((id) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const effect = config.statusEffects[id]!;
        return (
          id.toLowerCase().includes(q) ||
          effect.displayName.toLowerCase().includes(q) ||
          effect.effectType.toLowerCase().includes(q) ||
          (effect.stackBehavior ?? "").toLowerCase().includes(q)
        );
      }),
    [config.statusEffects, search],
  );

  useEffect(() => {
    if (selectedId && config.statusEffects[selectedId]) return;
    setSelectedId(effectIds[0] ?? Object.keys(config.statusEffects)[0] ?? null);
  }, [config.statusEffects, effectIds, selectedId]);

  const selected = selectedId ? config.statusEffects[selectedId] ?? null : null;

  const addStatusEffect = () => {
    const id = normalizeStatusEffectId(newId);
    if (!id || config.statusEffects[id]) return;
    onChange({
      statusEffects: {
        ...config.statusEffects,
        [id]: defaultStatusEffectDefinition(newId.trim()),
      },
    });
    setSelectedId(id);
    setNewId("");
  };

  const patchStatusEffect = (id: string, patch: Partial<StatusEffectDefinitionConfig>) => {
    onChange({
      statusEffects: {
        ...config.statusEffects,
        [id]: { ...config.statusEffects[id]!, ...patch },
      },
    });
  };

  const deleteStatusEffect = (id: string) => {
    const next = { ...config.statusEffects };
    delete next[id];
    onChange({ statusEffects: next });
    if (selectedId === id) setSelectedId(null);
  };

  const commitRename = () => {
    if (!selectedId) return;
    const nextId = normalizeStatusEffectId(renameValue);
    if (!nextId || nextId === selectedId || config.statusEffects[nextId]) return;
    const updated = renameStatusEffectDefinition(config, selectedId, nextId);
    onChange({ statusEffects: updated.statusEffects, abilities: updated.abilities });
    setSelectedId(nextId);
    setRenaming(false);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <div className="rounded-[24px] border border-white/8 bg-black/12 p-4">
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-ui text-text-muted">Condition roster</p>
          <h4 className="mt-2 font-display text-xl text-text-primary">{Object.keys(config.statusEffects).length} conditions</h4>
        </div>

        <div className="flex gap-2">
          <input
            value={newId}
            onChange={(event) => setNewId(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addStatusEffect();
            }}
            placeholder="New condition id"
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
          />
          <button
            onClick={addStatusEffect}
            className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs text-text-primary transition hover:bg-white/12"
          >
            Add
          </button>
        </div>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search conditions"
          className="mt-3 w-full rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
        />

        <div className="mt-4 flex max-h-[38rem] flex-col gap-2 overflow-y-auto pr-1">
          {effectIds.map((id) => {
            const effect = config.statusEffects[id]!;
            const selectedCard = id === selectedId;
            return (
              <button
                key={id}
                onClick={() => {
                  setSelectedId(id);
                  setRenaming(false);
                }}
                className={`rounded-[20px] border px-4 py-3 text-left transition ${
                  selectedCard
                    ? "border-border-active bg-gradient-active"
                    : "border-white/8 bg-white/4 hover:bg-white/8"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-display text-lg text-text-primary">{effect.displayName}</div>
                    <div className="mt-1 truncate text-[11px] text-text-muted">{id}</div>
                  </div>
                  {effect.image && (
                    <span className="rounded-full bg-badge-success-bg px-2 py-1 text-2xs uppercase tracking-label text-badge-success">
                      Art
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-2xs uppercase tracking-label text-text-muted">
                  <span>{effect.effectType}</span>
                  <span>{effect.stackBehavior ?? "REFRESH"}</span>
                  <span>{Math.round(effect.durationMs / 1000)}s</span>
                  {modifierCount(effect) > 0 && <span>{modifierCount(effect)} mods</span>}
                </div>
                <div className="mt-3 text-xs text-text-secondary">{summarizeStatusEffect(effect)}</div>
              </button>
            );
          })}
          {effectIds.length === 0 && (
            <div className="rounded-[20px] border border-dashed border-white/12 bg-white/4 px-4 py-6 text-sm text-text-muted">
              No conditions match the current search.
            </div>
          )}
        </div>
      </div>

      {selectedId && selected ? (
        <div className="rounded-[24px] border border-white/8 bg-black/12 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 pb-4">
            <div>
              <p className="text-[11px] uppercase tracking-ui text-text-muted">Condition designer</p>
              <h4 className="mt-2 font-display text-3xl text-text-primary">{selected.displayName}</h4>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-text-secondary">
                Tune ticking behavior, stack rules, and stat pressure for this condition in one editing pass.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-text-secondary">{selected.effectType}</span>
              <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-text-secondary">{selected.stackBehavior ?? "REFRESH"}</span>
              <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-text-secondary">{selected.durationMs}ms</span>
              {selected.tickIntervalMs ? (
                <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-text-secondary">Tick {selected.tickIntervalMs}ms</span>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {renaming ? (
              <>
                <input
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitRename();
                    if (event.key === "Escape") setRenaming(false);
                  }}
                  className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
                />
                <button onClick={commitRename} title="Confirm rename" className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs text-text-primary hover:bg-white/12">
                  Rename
                </button>
                <button onClick={() => setRenaming(false)} title="Cancel rename" className="rounded-full border border-white/10 bg-transparent px-4 py-2 text-xs text-text-secondary hover:bg-white/8">
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setRenameValue(selectedId);
                    setRenaming(true);
                  }}
                  className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs text-text-primary hover:bg-white/12"
                >
                  Rename ID
                </button>
                <button
                  onClick={() => deleteStatusEffect(selectedId)}
                  className="rounded-full border border-status-danger/40 bg-status-danger/10 px-4 py-2 text-xs text-status-danger hover:bg-status-danger/15"
                >
                  Delete Condition
                </button>
              </>
            )}
          </div>

          <div className="mt-4">
            <StatusEffectDetail
              effect={selected}
              patch={(patch) => patchStatusEffect(selectedId, patch)}
              statIds={statIds}
              effectTypeOptions={effectTypeOptions}
              stackBehaviorOptions={stackBehaviorOptions}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-[24px] border border-dashed border-white/12 bg-white/4 px-6 py-10 text-sm text-text-muted">
          Create a condition to start designing it.
        </div>
      )}
    </div>
  );
}
