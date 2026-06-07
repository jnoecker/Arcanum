import { useCallback, useState } from "react";
import type {
  AppConfig,
  ClassDefinitionConfig,
  GenderDefinition,
} from "@/types/config";

import { CreationHero } from "./creation/CreationHero";
import { GenderTab } from "./creation/GenderTab";
import { StarterEquipmentTab } from "./creation/StarterEquipmentTab";
import { EconomyPanel } from "./panels/EconomyPanel";
import { PrestigePanel } from "./panels/PrestigePanel";
import { RespecPanel } from "./panels/RespecPanel";
import { RegenPanel } from "./panels/RegenPanel";

type CCTab = "creation" | "equipment" | "regen";

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

  const [tab, setTab] = useState<CCTab>("creation");

  const patchCC = useCallback(
    (p: Partial<AppConfig["characterCreation"]>) =>
      onChange({ characterCreation: { ...config.characterCreation, ...p } }),
    [config.characterCreation, onChange],
  );

  const patchClass = useCallback(
    (id: string, p: Partial<ClassDefinitionConfig>) => {
      const cur = config.classes[id];
      if (!cur) return;
      onChange({ classes: { ...config.classes, [id]: { ...cur, ...p } } });
    },
    [config.classes, onChange],
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
      <div className="flex gap-1 rounded-full border border-border-muted bg-bg-secondary/60 p-1">
        {(["creation", "equipment", "regen"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-display tracking-wide transition-colors ${
              tab === t ? "bg-accent/20 text-accent" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {t === "creation" ? "Creation" : t === "equipment" ? "Default Equipment" : "Regen"}
          </button>
        ))}
      </div>

      {tab === "creation" && (
        <>
          <CreationHero config={config} onPatch={patchCC} />
          <EconomyPanel config={config} onChange={onChange} />
          <PrestigePanel config={config} onChange={onChange} />
          <RespecPanel config={config} onChange={onChange} />
          <GenderTab
            genders={config.genders}
            selected={selectedGender}
            onSelect={setSelectedGender}
            onAdd={addGender}
            onPatch={patchGender}
            onDelete={deleteGender}
            onRename={renameGender}
          />
        </>
      )}

      {tab === "equipment" && (
        <StarterEquipmentTab classes={config.classes} onPatchClass={patchClass} />
      )}

      {tab === "regen" && <RegenPanel config={config} onChange={onChange} />}
    </div>
  );
}
