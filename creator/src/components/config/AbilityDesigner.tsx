import { useEffect, useMemo, useState } from "react";
import type { AbilityDefinitionConfig, AbilityEffectConfig, AppConfig } from "@/types/config";
import {
  AbilityDetail,
  defaultAbilityDefinition,
  renameAbilityDefinition,
  summarizeAbility,
} from "@/components/config/panels/AbilitiesPanel";

const FALLBACK_TARGET_TYPES = [
  { value: "enemy", label: "Enemy" },
  { value: "self", label: "Self" },
  { value: "ally", label: "Ally" },
];

function normalizeAbilityId(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

export function AbilityDesigner({
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

  const abilityIds = useMemo(
    () =>
      Object.keys(config.abilities).filter((id) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const ability = config.abilities[id]!;
        const restriction = ability.requiredClass || ability.classRestriction || "";
        return (
          id.toLowerCase().includes(q) ||
          ability.displayName.toLowerCase().includes(q) ||
          restriction.toLowerCase().includes(q) ||
          ability.effect.type.toLowerCase().includes(q)
        );
      }),
    [config.abilities, search],
  );

  useEffect(() => {
    if (selectedId && config.abilities[selectedId]) return;
    setSelectedId(abilityIds[0] ?? Object.keys(config.abilities)[0] ?? null);
  }, [abilityIds, config.abilities, selectedId]);

  const selected = selectedId ? config.abilities[selectedId] ?? null : null;

  const addAbility = () => {
    const id = normalizeAbilityId(newId);
    if (!id || config.abilities[id]) return;
    onChange({
      abilities: {
        ...config.abilities,
        [id]: defaultAbilityDefinition(newId.trim()),
      },
    });
    setSelectedId(id);
    setNewId("");
  };

  const patchAbility = (id: string, patch: Partial<AbilityDefinitionConfig>) => {
    onChange({
      abilities: {
        ...config.abilities,
        [id]: { ...config.abilities[id]!, ...patch },
      },
    });
  };

  const deleteAbility = (id: string) => {
    const next = { ...config.abilities };
    delete next[id];
    onChange({ abilities: next });
    if (selectedId === id) setSelectedId(null);
  };

  const commitRename = () => {
    if (!selectedId) return;
    const nextId = normalizeAbilityId(renameValue);
    if (!nextId || nextId === selectedId || config.abilities[nextId]) return;
    onChange({ abilities: renameAbilityDefinition(config, selectedId, nextId) });
    setSelectedId(nextId);
    setRenaming(false);
  };

  const patchEffect = (
    ability: AbilityDefinitionConfig,
    patch: (p: Partial<AbilityDefinitionConfig>) => void,
    effectPatch: Partial<AbilityEffectConfig>,
  ) => {
    const nextEffect =
      effectPatch.type && effectPatch.type !== ability.effect.type
        ? { type: effectPatch.type, ...effectPatch }
        : { ...ability.effect, ...effectPatch };
    patch({ effect: nextEffect as AbilityEffectConfig });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <div className="rounded-[24px] border border-white/8 bg-black/12 p-4">
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-text-muted">Ability roster</p>
          <h4 className="mt-2 font-display text-xl text-text-primary">{Object.keys(config.abilities).length} abilities</h4>
        </div>

        <div className="flex gap-2">
          <input
            value={newId}
            onChange={(event) => setNewId(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addAbility();
            }}
            placeholder="New ability id"
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs text-text-primary outline-none"
          />
          <button
            onClick={addAbility}
            className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs text-text-primary transition hover:bg-white/12"
          >
            Add
          </button>
        </div>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search abilities"
          className="mt-3 w-full rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs text-text-primary outline-none"
        />

        <div className="mt-4 flex max-h-[38rem] flex-col gap-2 overflow-y-auto pr-1">
          {abilityIds.map((id) => {
            const ability = config.abilities[id]!;
            const selectedCard = id === selectedId;
            const classId = ability.requiredClass || ability.classRestriction;
            return (
              <button
                key={id}
                onClick={() => {
                  setSelectedId(id);
                  setRenaming(false);
                }}
                className={`rounded-[20px] border px-4 py-3 text-left transition ${
                  selectedCard
                    ? "border-[rgba(184,216,232,0.35)] bg-[linear-gradient(135deg,rgba(168,151,210,0.16),rgba(140,174,201,0.12))]"
                    : "border-white/8 bg-white/4 hover:bg-white/8"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-display text-lg text-text-primary">{ability.displayName}</div>
                    <div className="mt-1 truncate text-[11px] text-text-muted">{id}</div>
                  </div>
                  {ability.image && (
                    <span className="rounded-full bg-[rgba(141,169,123,0.16)] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[rgb(174,204,152)]">
                      Art
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.18em] text-text-muted">
                  <span>{ability.effect.type}</span>
                  <span>{ability.targetType}</span>
                  <span>Lvl {ability.levelRequired}</span>
                  {classId && <span>{classId}</span>}
                </div>
                <div className="mt-3 text-xs text-text-secondary">{summarizeAbility(ability)}</div>
              </button>
            );
          })}
          {abilityIds.length === 0 && (
            <div className="rounded-[20px] border border-dashed border-white/12 bg-white/4 px-4 py-6 text-sm text-text-muted">
              No abilities match the current search.
            </div>
          )}
        </div>
      </div>

      {selectedId && selected ? (
        <div className="rounded-[24px] border border-white/8 bg-black/12 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 pb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-text-muted">Ability designer</p>
              <h4 className="mt-2 font-display text-3xl text-text-primary">{selected.displayName}</h4>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-text-secondary">
                Balance target rules, class access, effect payloads, and icon identity from one workbench.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-text-secondary">{selected.effect.type}</span>
              <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-text-secondary">{selected.targetType}</span>
              <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-text-secondary">Mana {selected.manaCost}</span>
              <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-text-secondary">CD {selected.cooldownMs}ms</span>
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
                  className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs text-text-primary outline-none"
                />
                <button onClick={commitRename} className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs text-text-primary hover:bg-white/12">
                  Rename
                </button>
                <button onClick={() => setRenaming(false)} className="rounded-full border border-white/10 bg-transparent px-4 py-2 text-xs text-text-secondary hover:bg-white/8">
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
                  onClick={() => deleteAbility(selectedId)}
                  className="rounded-full border border-status-danger/40 bg-status-danger/10 px-4 py-2 text-xs text-status-danger hover:bg-status-danger/15"
                >
                  Delete Ability
                </button>
              </>
            )}
          </div>

          <div className="mt-4">
            <AbilityDetail
              id={selectedId}
              ability={selected}
              patch={(patch) => patchAbility(selectedId, patch)}
              classOptions={classOptions}
              statusEffectOptions={statusEffectOptions}
              targetTypeOptions={targetTypeOptions}
              patchEffect={patchEffect}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-[24px] border border-dashed border-white/12 bg-white/4 px-6 py-10 text-sm text-text-muted">
          Create an ability to start designing it.
        </div>
      )}
    </div>
  );
}
