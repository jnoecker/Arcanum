import { useCallback, useEffect, useState } from "react";
import type {
  AppConfig,
  CraftingSkillDefinition,
  CraftingStationTypeDefinition,
} from "@/types/config";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import { useToastStore } from "@/stores/toastStore";
import { saveProjectConfig } from "@/lib/saveConfig";

import { CraftingHeader } from "./crafting/CraftingHeader";
import { SkillCurveCard } from "./crafting/SkillCurveCard";
import { HarvestPacingCard } from "./crafting/HarvestPacingCard";
import { EntityList } from "./crafting/EntityList";
import { CraftingSkillDesigner } from "./crafting/CraftingSkillDesigner";
import { StationTypeDesigner } from "./crafting/StationTypeDesigner";
import { SectionCard } from "./panels/factions/SectionCard";

function nextId(prefix: string, existing: Record<string, unknown>): string {
  if (!existing[prefix]) return prefix;
  let i = 2;
  while (existing[`${prefix}_${i}`]) i += 1;
  return `${prefix}_${i}`;
}

export function CraftingStudio({
  config,
  onChange,
}: {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}) {
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const dirty = useConfigStore((s) => s.dirty);
  const project = useProjectStore((s) => s.project);
  const [saving, setSaving] = useState(false);

  const patchCrafting = useCallback(
    (patch: Partial<AppConfig["crafting"]>) =>
      onChange({ crafting: { ...config.crafting, ...patch } }),
    [config.crafting, onChange],
  );

  const patchSkill = useCallback(
    (id: string, p: Partial<CraftingSkillDefinition>) => {
      const cur = config.craftingSkills[id];
      if (!cur) return;
      onChange({
        craftingSkills: { ...config.craftingSkills, [id]: { ...cur, ...p } },
      });
    },
    [config.craftingSkills, onChange],
  );

  const patchStation = useCallback(
    (id: string, p: Partial<CraftingStationTypeDefinition>) => {
      const cur = config.craftingStationTypes[id];
      if (!cur) return;
      onChange({
        craftingStationTypes: {
          ...config.craftingStationTypes,
          [id]: { ...cur, ...p },
        },
      });
    },
    [config.craftingStationTypes, onChange],
  );

  const addSkill = useCallback(() => {
    const id = nextId("new_skill", config.craftingSkills);
    onChange({
      craftingSkills: {
        ...config.craftingSkills,
        [id]: { displayName: "New Skill", type: "crafting" },
      },
    });
    setSelectedSkill(id);
  }, [config.craftingSkills, onChange]);

  const addStation = useCallback(() => {
    const id = nextId("new_station", config.craftingStationTypes);
    onChange({
      craftingStationTypes: {
        ...config.craftingStationTypes,
        [id]: { displayName: "New Station" },
      },
    });
    setSelectedStation(id);
  }, [config.craftingStationTypes, onChange]);

  const deleteSkill = useCallback(() => {
    if (!selectedSkill) return;
    const next = { ...config.craftingSkills };
    delete next[selectedSkill];
    onChange({ craftingSkills: next });
    setSelectedSkill(null);
  }, [selectedSkill, config.craftingSkills, onChange]);

  const deleteStation = useCallback(() => {
    if (!selectedStation) return;
    const next = { ...config.craftingStationTypes };
    delete next[selectedStation];
    onChange({ craftingStationTypes: next });
    setSelectedStation(null);
  }, [selectedStation, config.craftingStationTypes, onChange]);

  const handleSave = useCallback(async () => {
    if (!project || !dirty || saving) return;
    setSaving(true);
    try {
      await saveProjectConfig(project);
      useToastStore.getState().show("Changes saved");
    } catch (err) {
      console.error("Save failed", err);
    } finally {
      setSaving(false);
    }
  }, [project, dirty, saving]);

  useEffect(() => {
    if (selectedSkill && config.craftingSkills[selectedSkill]) return;
    setSelectedSkill(Object.keys(config.craftingSkills)[0] ?? null);
  }, [selectedSkill, config.craftingSkills]);

  useEffect(() => {
    if (selectedStation && config.craftingStationTypes[selectedStation]) return;
    setSelectedStation(Object.keys(config.craftingStationTypes)[0] ?? null);
  }, [selectedStation, config.craftingStationTypes]);

  const selectedSkillDef = selectedSkill
    ? config.craftingSkills[selectedSkill] ?? null
    : null;
  const selectedStationDef = selectedStation
    ? config.craftingStationTypes[selectedStation] ?? null
    : null;

  return (
    <div className="flex flex-col gap-5">
      <CraftingHeader
        hasUnsavedChanges={dirty}
        saving={saving}
        onSave={handleSave}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SkillCurveCard crafting={config.crafting} onPatch={patchCrafting} />
        <HarvestPacingCard crafting={config.crafting} onPatch={patchCrafting} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <div className="flex flex-col gap-4">
            <EntityList
              title="Crafting Skills"
              items={config.craftingSkills}
              selected={selectedSkill}
              searchPlaceholder="Search skills…"
              addLabel="Add Skill"
              viewAllLabel="View all skills"
              getDisplayName={(s) => s.displayName}
              getSubtitle={(s) =>
                s.type === "gathering" ? "Gathering" : "Crafting"
              }
              onSelect={setSelectedSkill}
              onAdd={addSkill}
            />
            <EntityList
              title="Station Types"
              items={config.craftingStationTypes}
              selected={selectedStation}
              searchPlaceholder="Search station types…"
              addLabel="Add Type"
              viewAllLabel="View all station types"
              getDisplayName={(s) => s.displayName}
              getSubtitle={() => "Station"}
              onSelect={setSelectedStation}
              onAdd={addStation}
            />
          </div>
        </div>

        <div className="xl:col-span-8">
          <div className="flex flex-col gap-4">
            {selectedSkill && selectedSkillDef ? (
              <CraftingSkillDesigner
                id={selectedSkill}
                skill={selectedSkillDef}
                onPatch={(p) => patchSkill(selectedSkill, p)}
                onDelete={deleteSkill}
              />
            ) : (
              <EmptyDesigner
                title="Crafting Skill Designer"
                cta="Add a crafting skill"
                onAdd={addSkill}
              />
            )}

            {selectedStation && selectedStationDef ? (
              <StationTypeDesigner
                id={selectedStation}
                station={selectedStationDef}
                onPatch={(p) => patchStation(selectedStation, p)}
                onDelete={deleteStation}
              />
            ) : (
              <EmptyDesigner
                title="Station Type Designer"
                cta="Add a station type"
                onAdd={addStation}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyDesigner({
  title,
  cta,
  onAdd,
}: {
  title: string;
  cta: string;
  onAdd: () => void;
}) {
  return (
    <SectionCard title={title}>
      <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-4 py-10 text-center">
        <p className="font-display text-xs text-text-muted">Nothing selected.</p>
        <p className="mt-1 text-2xs leading-snug text-text-muted/70">
          Pick an entry from the list, or create a new one.
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="focus-ring mt-3 inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20"
        >
          + {cta}
        </button>
      </div>
    </SectionCard>
  );
}
