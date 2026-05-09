import { useEffect, useState } from "react";
import type { AppConfig, AchievementDefFile } from "@/types/config";
import { AchievementsList } from "./achievements/AchievementsList";
import { AchievementEditor } from "./achievements/AchievementEditor";
import { AchievementPreview } from "./achievements/AchievementPreview";

function defaultAchievementDef(displayName: string): AchievementDefFile {
  const cleaned = displayName.trim() || "New Achievement";
  return {
    displayName: cleaned,
    description: "",
    category: "combat",
    hidden: false,
    criteria: [],
  };
}

function nextDefaultId(existing: Record<string, unknown>): string {
  const base = "new_achievement";
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
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_/]/g, "");
}

interface AchievementDefEditorProps {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}

export function AchievementDefEditor({
  config,
  onChange,
}: AchievementDefEditorProps) {
  const defs = config.achievementDefs;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId && defs[selectedId]) return;
    const first = Object.keys(defs)[0] ?? null;
    setSelectedId(first);
  }, [defs, selectedId]);

  const patchDef = (id: string, patch: Partial<AchievementDefFile>) => {
    onChange({
      achievementDefs: {
        ...defs,
        [id]: { ...defs[id]!, ...patch },
      },
    });
  };

  const renameDef = (oldId: string, rawNewId: string) => {
    const newId = normalizeId(rawNewId);
    if (!newId || oldId === newId || defs[newId]) return;
    const next: Record<string, AchievementDefFile> = {};
    for (const [k, v] of Object.entries(defs)) {
      next[k === oldId ? newId : k] = v;
    }
    onChange({ achievementDefs: next });
    if (selectedId === oldId) setSelectedId(newId);
  };

  const addDef = () => {
    const id = nextDefaultId(defs);
    onChange({
      achievementDefs: {
        ...defs,
        [id]: defaultAchievementDef("New Achievement"),
      },
    });
    setSelectedId(id);
  };

  const duplicateDef = () => {
    if (!selectedId || !defs[selectedId]) return;
    const source = defs[selectedId];
    const newId = nextDuplicateId(selectedId, defs);
    const cloned: AchievementDefFile = {
      ...source,
      displayName: `${source.displayName} (copy)`,
      criteria: source.criteria.map((c) => ({ ...c })),
      rewards: source.rewards ? { ...source.rewards } : undefined,
    };
    onChange({ achievementDefs: { ...defs, [newId]: cloned } });
    setSelectedId(newId);
  };

  const deleteDef = () => {
    if (!selectedId || !defs[selectedId]) return;
    const next = { ...defs };
    delete next[selectedId];
    onChange({ achievementDefs: next });
    setSelectedId(null);
  };

  const selected = selectedId ? defs[selectedId] ?? null : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-3">
          <AchievementsList
            defs={defs}
            categories={config.achievementCategories}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAdd={addDef}
            onDuplicate={duplicateDef}
            onDelete={deleteDef}
          />
        </div>

        <div className="xl:col-span-9">
          {selectedId && selected ? (
            <AchievementEditor
              id={selectedId}
              def={selected}
              config={config}
              onPatch={(p) => patchDef(selectedId, p)}
              onRename={(v) => renameDef(selectedId, v)}
            />
          ) : (
            <EmptyEditor onAdd={addDef} />
          )}
        </div>
      </div>

      {selectedId && selected && (
        <AchievementPreview
          def={selected}
          categories={config.achievementCategories}
        />
      )}
    </div>
  );
}

function EmptyEditor({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="panel-surface flex flex-col items-center justify-center gap-3 rounded-2xl px-6 py-12 text-center shadow-section">
      <div>
        <p className="font-display text-base text-text-primary">No achievement selected</p>
        <p className="mt-1 max-w-xs text-2xs text-text-muted/80">
          Choose an achievement from the list, or create a new one to get
          started.
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20"
      >
        + Add Achievement
      </button>
    </div>
  );
}
