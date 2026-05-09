import { useCallback, useEffect, useState } from "react";
import type { ConfigPanelProps } from "./types";
import type { PetDefinitionConfig } from "@/types/config";
import { PetsList } from "../pets/PetsList";
import { PetEditor } from "../pets/PetEditor";

function defaultPetDefinition(displayName: string): PetDefinitionConfig {
  return {
    name: displayName.trim() || "New Companion",
    hp: 20,
    minDamage: 1,
    maxDamage: 4,
    armor: 0,
  };
}

function nextDefaultId(existing: Record<string, unknown>): string {
  const base = "new_companion";
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

function normalizeId(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

export function PetsPanel({ config, onChange }: ConfigPanelProps) {
  const pets = config.pets ?? {};
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId && pets[selectedId]) return;
    const first = Object.keys(pets)[0] ?? null;
    setSelectedId(first);
  }, [pets, selectedId]);

  const patchPets = useCallback(
    (next: Record<string, PetDefinitionConfig>) => onChange({ pets: next }),
    [onChange],
  );

  const patchPet = useCallback(
    (id: string, p: Partial<PetDefinitionConfig>) => {
      const current = pets[id];
      if (!current) return;
      patchPets({ ...pets, [id]: { ...current, ...p } });
    },
    [pets, patchPets],
  );

  const renamePet = useCallback(
    (oldId: string, rawNewId: string) => {
      const newId = normalizeId(rawNewId);
      if (!newId || oldId === newId || pets[newId]) return;
      const next: Record<string, PetDefinitionConfig> = {};
      for (const [k, v] of Object.entries(pets)) {
        next[k === oldId ? newId : k] = v;
      }
      patchPets(next);
      if (selectedId === oldId) setSelectedId(newId);
    },
    [pets, selectedId, patchPets],
  );

  const addPet = useCallback(() => {
    const id = nextDefaultId(pets);
    patchPets({ ...pets, [id]: defaultPetDefinition("New Companion") });
    setSelectedId(id);
  }, [pets, patchPets]);

  const duplicatePet = useCallback(() => {
    if (!selectedId || !pets[selectedId]) return;
    const source = pets[selectedId];
    const newId = nextDuplicateId(selectedId, pets);
    const cloned: PetDefinitionConfig = {
      ...source,
      name: `${source.name} (copy)`,
      spells: source.spells
        ? Object.fromEntries(
            Object.entries(source.spells).map(([sid, s]) => [sid, { ...s }]),
          )
        : undefined,
    };
    patchPets({ ...pets, [newId]: cloned });
    setSelectedId(newId);
  }, [pets, selectedId, patchPets]);

  const deletePet = useCallback(() => {
    if (!selectedId || !pets[selectedId]) return;
    const next = { ...pets };
    delete next[selectedId];
    patchPets(next);
    setSelectedId(null);
  }, [pets, selectedId, patchPets]);

  const selected = selectedId ? pets[selectedId] ?? null : null;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="xl:col-span-3">
        <PetsList
          pets={pets}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAdd={addPet}
          onDuplicate={duplicatePet}
          onDelete={deletePet}
        />
      </div>

      <div className="xl:col-span-9">
        {selectedId && selected ? (
          <PetEditor
            id={selectedId}
            pet={selected}
            onPatch={(p) => patchPet(selectedId, p)}
            onRename={(v) => renamePet(selectedId, v)}
          />
        ) : (
          <EmptyEditor onAdd={addPet} />
        )}
      </div>
    </div>
  );
}

function EmptyEditor({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="panel-surface flex flex-col items-center justify-center gap-3 rounded-2xl px-6 py-12 text-center shadow-section">
      <div>
        <p className="font-display text-base text-text-primary">
          No companion selected
        </p>
        <p className="mt-1 max-w-xs text-2xs text-text-muted/80">
          Choose a creature from the bestiary, or summon a new one to begin.
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20"
      >
        + Add Companion
      </button>
    </div>
  );
}
