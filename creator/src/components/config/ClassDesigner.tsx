import { useEffect, useState } from "react";
import type { AppConfig, ClassDefinitionConfig } from "@/types/config";
import { renameClassInConfig } from "@/lib/refactorId";
import { ClassesList } from "./classes/ClassesList";
import { ClassEditor } from "./classes/ClassEditor";

function defaultClass(displayName: string): ClassDefinitionConfig {
  return {
    displayName: displayName.trim() || "New Class",
    hpScalingRate: 1.1,
    manaScalingRate: 1.1,
    selectable: true,
  };
}

/**
 * Pre-filled definition for the Akathavae — the pledge-granted pacifist class
 * the server swaps players into when they pledge at a shrine. Authored as a
 * scaffold (opt-in) rather than a passive default so it only appears in worlds
 * that want it. Uses only standard class fields; the multiclass-lock and
 * pledge-grant behavior is enforced by the server at runtime, so it lives in the
 * description rather than as a fabricated config field. `selectable: false`
 * keeps it out of character creation. Leaves stat priorities for the author to
 * map to their own stat IDs.
 */
function akathavaeClass(): ClassDefinitionConfig {
  return {
    displayName: "Akathavae",
    description:
      "Pledge-granted pacifist path. Players who pledge at an Akathavae shrine become Akathavae — combat is forsworn and the world is leveled through illumination. Multiclassing is locked while pledged, and the prior class is restored on renunciation. Not selectable at character creation.",
    backstory:
      "The Akathavae are keepers of knowledge who give voice to stories, in service of the Naraxian god who writes the Arcanum. Where others conquer the world, the Akathavae record it — every room walked, every creature met, every relic held — illuminating each into a personal Arcanum.",
    hpScalingRate: 1.0,
    manaScalingRate: 1.2,
    selectable: false,
    outfitDescription:
      "Candle-lit scholar's robes layered over travelling leathers, a satchel of blank parchment, and a quill kept always within reach.",
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

  const addAkathavaeClass = () => {
    if (classes.AKATHAVAE) {
      setSelectedId("AKATHAVAE");
      return;
    }
    onChange({
      classes: {
        ...classes,
        AKATHAVAE: akathavaeClass(),
      },
    });
    setSelectedId("AKATHAVAE");
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
          onAddAkathavae={addAkathavaeClass}
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
