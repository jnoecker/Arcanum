import { useCallback, useState } from "react";
import type { AppConfig, GenderDefinition } from "@/types/config";

import { CreationHero } from "./creation/CreationHero";
import { GenderTab } from "./creation/GenderTab";

function normalizeId(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

export function CharacterCreationStudio({
  config,
  onChange,
}: {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}) {
  const [selectedGender, setSelectedGender] = useState<string | null>(() => {
    const first = Object.keys(config.genders)[0];
    return first ?? null;
  });

  const patchCC = useCallback(
    (p: Partial<AppConfig["characterCreation"]>) =>
      onChange({ characterCreation: { ...config.characterCreation, ...p } }),
    [config.characterCreation, onChange],
  );

  const patchGender = useCallback(
    (id: string, p: Partial<GenderDefinition>) => {
      const cur = config.genders[id];
      if (!cur) return;
      onChange({ genders: { ...config.genders, [id]: { ...cur, ...p } } });
    },
    [config.genders, onChange],
  );

  const addGender = useCallback(
    (rawId: string) => {
      const id = normalizeId(rawId);
      if (!id || config.genders[id]) return;
      onChange({
        genders: {
          ...config.genders,
          [id]: { displayName: rawId.trim() || id },
        },
      });
      setSelectedGender(id);
    },
    [config.genders, onChange],
  );

  const deleteGender = useCallback(
    (id: string) => {
      const next = { ...config.genders };
      delete next[id];
      onChange({ genders: next });
      if (selectedGender === id) setSelectedGender(null);
    },
    [config.genders, onChange, selectedGender],
  );

  const renameGender = useCallback(
    (oldId: string, rawNewId: string) => {
      const newId = normalizeId(rawNewId);
      if (!newId || oldId === newId || config.genders[newId]) return;
      const next: Record<string, GenderDefinition> = {};
      for (const [k, v] of Object.entries(config.genders)) {
        next[k === oldId ? newId : k] = v;
      }
      onChange({ genders: next });
      if (selectedGender === oldId) setSelectedGender(newId);
    },
    [config.genders, onChange, selectedGender],
  );

  return (
    <div className="flex flex-col gap-5">
      <CreationHero config={config} onPatch={patchCC} />

      <GenderTab
        genders={config.genders}
        selected={selectedGender}
        onSelect={setSelectedGender}
        onAdd={addGender}
        onPatch={patchGender}
        onDelete={deleteGender}
        onRename={renameGender}
      />
    </div>
  );
}
