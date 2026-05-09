import { useMemo, useState } from "react";
import type { ConfigPanelProps, AppConfig } from "./types";
import type { HousingTemplateDefinition } from "@/types/config";
import { useConfigStore } from "@/stores/configStore";

import { RoomTemplatesList } from "./housing/RoomTemplatesList";
import { RoomEditor } from "./housing/RoomEditor";

function normalizeId(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function defaultTemplate(title: string): HousingTemplateDefinition {
  return { title, description: "", cost: 0 };
}

function nextNewId(existing: Record<string, unknown>): string {
  if (!existing["new_room"]) return "new_room";
  let i = 2;
  while (existing[`new_room_${i}`]) i += 1;
  return `new_room_${i}`;
}

function nextDuplicateId(base: string, existing: Record<string, unknown>): string {
  let i = 2;
  while (existing[`${base}_${i}`]) i += 1;
  return `${base}_${i}`;
}

export function HousingPanel({ config, onChange }: ConfigPanelProps) {
  const housing = config.housing;
  const [selected, setSelected] = useState<string | null>(null);

  const stations = useConfigStore((s) => s.config?.craftingStationTypes);
  const stationOptions = useMemo(
    () => [
      { value: "", label: "— none —" },
      ...Object.entries(stations ?? {}).map(([id, s]) => ({
        value: id,
        label: s.displayName || id,
      })),
    ],
    [stations],
  );

  const patchHousing = (p: Partial<AppConfig["housing"]>) =>
    onChange({ housing: { ...housing, ...p } });

  const patchTemplate = (id: string, p: Partial<HousingTemplateDefinition>) => {
    const t = housing.templates[id];
    if (!t) return;
    patchHousing({
      templates: { ...housing.templates, [id]: { ...t, ...p } },
    });
  };

  const addTemplate = () => {
    const id = nextNewId(housing.templates);
    patchHousing({
      templates: {
        ...housing.templates,
        [id]: defaultTemplate("New Room"),
      },
    });
    setSelected(id);
  };

  const duplicateTemplate = (sourceId: string) => {
    const source = housing.templates[sourceId];
    if (!source) return;
    const newId = nextDuplicateId(sourceId, housing.templates);
    const cloned: HousingTemplateDefinition = {
      ...source,
      title: `${source.title || sourceId} (copy)`,
      isEntry: false,
    };
    patchHousing({
      templates: { ...housing.templates, [newId]: cloned },
    });
    setSelected(newId);
  };

  const renameTemplate = (oldId: string, rawNewId: string) => {
    const newId = normalizeId(rawNewId);
    if (!newId || oldId === newId || housing.templates[newId]) return;
    const next: Record<string, HousingTemplateDefinition> = {};
    for (const [k, v] of Object.entries(housing.templates)) {
      next[k === oldId ? newId : k] = v;
    }
    patchHousing({ templates: next });
    if (selected === oldId) setSelected(newId);
  };

  const deleteTemplate = (id: string) => {
    const next = { ...housing.templates };
    delete next[id];
    patchHousing({ templates: next });
    if (selected === id) setSelected(null);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <RoomTemplatesList
          templates={housing.templates}
          selected={selected}
          enabled={housing.enabled}
          entryExitDirection={housing.entryExitDirection}
          onPatchHousing={patchHousing}
          onAdd={addTemplate}
          onSelect={(id) => setSelected(selected === id ? null : id)}
        />
      </div>
      <div className="lg:col-span-8">
        {selected && housing.templates[selected] ? (
          <RoomEditor
            id={selected}
            t={housing.templates[selected]!}
            stationOptions={stationOptions}
            onPatch={(p) => patchTemplate(selected, p)}
            onDelete={() => deleteTemplate(selected)}
            onDuplicate={() => duplicateTemplate(selected)}
            onRename={(v) => renameTemplate(selected, v)}
          />
        ) : (
          <div className="panel-surface flex h-full items-center justify-center rounded-2xl p-8 shadow-section">
            <div className="text-center">
              <p className="font-display text-xs uppercase tracking-wider text-text-muted">
                Nothing selected
              </p>
              <p className="mt-2 text-2xs leading-snug text-text-muted/70">
                Click a room on the left to start editing — or add a new
                template to get started.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
