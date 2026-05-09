import { useEffect, useState } from "react";
import type { AppConfig, ClassDefinitionConfig } from "@/types/config";
import { renameClassInConfig } from "@/lib/refactorId";
import { ClassesList } from "./classes/ClassesList";
import { ClassEditor } from "./classes/ClassEditor";

function defaultClass(displayName: string): ClassDefinitionConfig {
  return {
    displayName: displayName.trim() || "New Class",
    hpPerLevel: 6,
    manaPerLevel: 8,
    selectable: true,
  };
}

function nextDefaultId(existing: Record<string, unknown>): string {
  const base = "NEW_CLASS";
  if (!existing[base]) return base;
  let i = 2;
  while (existing[`${base}_${i}`]) i += 1;
  return `${base}_${i}`;
}

function nextDuplicateId(
  base: string,
  existing: Record<string, unknown>,
): string {
  let i = 2;
  while (existing[`${base}_COPY_${i - 1}`]) i += 1;
  return `${base}_COPY_${i - 1}`;
}

function normalizeId(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

interface ClassDesignerProps {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}

export function ClassDesigner({ config, onChange }: ClassDesignerProps) {
  const classes = config.classes;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId && classes[selectedId]) return;
    const first = Object.keys(classes)[0] ?? null;
    setSelectedId(first);
  }, [classes, selectedId]);

  const patchClass = (id: string, patch: Partial<ClassDefinitionConfig>) => {
    const current = classes[id];
    if (!current) return;
    onChange({
      classes: {
        ...classes,
        [id]: { ...current, ...patch },
      },
    });
  };

  const renameClass = (oldId: string, rawNewId: string) => {
    const newId = normalizeId(rawNewId);
    if (!newId || oldId === newId || classes[newId]) return;
    const updated = renameClassInConfig(config, oldId, newId);
    onChange({ classes: updated.classes, abilities: updated.abilities });
    if (selectedId === oldId) setSelectedId(newId);
  };

  const addClass = () => {
    const id = nextDefaultId(classes);
    onChange({
      classes: {
        ...classes,
        [id]: defaultClass("New Class"),
      },
    });
    setSelectedId(id);
  };

  const duplicateClass = () => {
    if (!selectedId || !classes[selectedId]) return;
    const source = classes[selectedId];
    const newId = nextDuplicateId(selectedId, classes);
    const cloned: ClassDefinitionConfig = {
      ...source,
      displayName: `${source.displayName} (copy)`,
    };
    onChange({ classes: { ...classes, [newId]: cloned } });
    setSelectedId(newId);
  };

  const deleteClass = () => {
    if (!selectedId || !classes[selectedId]) return;
    const next = { ...classes };
    delete next[selectedId];
    onChange({ classes: next });
    setSelectedId(null);
  };

  const selected = selectedId ? classes[selectedId] ?? null : null;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="xl:col-span-3">
        <ClassesList
          classes={classes}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAdd={addClass}
          onDuplicate={duplicateClass}
          onDelete={deleteClass}
        />
      </div>

      <div className="xl:col-span-9">
        {selectedId && selected ? (
          <ClassEditor
            id={selectedId}
            cls={selected}
            config={config}
            onPatch={(p) => patchClass(selectedId, p)}
            onRename={(v) => renameClass(selectedId, v)}
          />
        ) : (
          <EmptyEditor onAdd={addClass} />
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
          No class selected
        </p>
        <p className="mt-1 max-w-xs text-2xs text-text-muted/80">
          Choose a class from the list, or create a new one to get started.
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20"
      >
        + Add Class
      </button>
    </div>
  );
}
