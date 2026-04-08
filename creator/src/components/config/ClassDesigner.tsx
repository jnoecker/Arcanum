import { useEffect, useMemo, useState } from "react";
import type { AppConfig, ClassDefinitionConfig } from "@/types/config";
import {
  ClassDetail,
  defaultClassDefinition,
  renameClassDefinition,
  summarizeClass,
} from "@/components/config/panels/ClassesPanel";

export function ClassDesigner({
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

  const classIds = useMemo(
    () =>
      Object.keys(config.classes).filter((id) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const cls = config.classes[id]!;
        return id.toLowerCase().includes(q) || cls.displayName.toLowerCase().includes(q);
      }),
    [config.classes, search],
  );

  useEffect(() => {
    if (selectedId && config.classes[selectedId]) return;
    setSelectedId(classIds[0] ?? Object.keys(config.classes)[0] ?? null);
  }, [classIds, config.classes, selectedId]);

  const selected = selectedId ? config.classes[selectedId] ?? null : null;

  const statOptions = useMemo(
    () =>
      Object.entries(config.stats.definitions).map(([id, def]) => ({
        value: id,
        label: def.displayName,
      })),
    [config.stats.definitions],
  );
  const raceOptions = useMemo(
    () => Object.keys(config.races).map((id) => ({ value: id, label: config.races[id]!.displayName || id })),
    [config.races],
  );

  const addClass = () => {
    const id = newId.trim().toUpperCase().replace(/\s+/g, "_");
    if (!id || config.classes[id]) return;
    onChange({
      classes: {
        ...config.classes,
        [id]: defaultClassDefinition(newId.trim()),
      },
    });
    setSelectedId(id);
    setNewId("");
  };

  const deleteClass = (id: string) => {
    const next = { ...config.classes };
    delete next[id];
    onChange({ classes: next });
    if (selectedId === id) setSelectedId(null);
  };

  const patchClass = (id: string, patch: Partial<ClassDefinitionConfig>) => {
    onChange({
      classes: {
        ...config.classes,
        [id]: { ...config.classes[id]!, ...patch },
      },
    });
  };

  const commitRename = () => {
    if (!selectedId) return;
    const nextId = renameValue.trim().toUpperCase().replace(/\s+/g, "_");
    if (!nextId || nextId === selectedId || config.classes[nextId]) return;
    const updated = renameClassDefinition(config, selectedId, nextId);
    onChange({ classes: updated.classes, abilities: updated.abilities });
    setSelectedId(nextId);
    setRenaming(false);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <div className="rounded-3xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-4">
        <div className="mb-4">
          <p className="text-2xs uppercase tracking-ui text-text-muted">Class roster</p>
          <h4 className="mt-2 font-display text-xl text-text-primary">{Object.keys(config.classes).length} classes</h4>
        </div>

        <div className="flex gap-2">
          <input
            value={newId}
            onChange={(event) => setNewId(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addClass();
            }}
            placeholder="New class id"
            className="min-w-0 flex-1 rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight-strong)] px-4 py-2 text-xs text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
          />
          <button
            onClick={addClass}
            className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight-strong)] px-4 py-2 text-xs text-text-primary transition hover:bg-[var(--chrome-highlight-strong)]"
          >
            Add
          </button>
        </div>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search classes"
          className="mt-3 w-full rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight-strong)] px-4 py-2 text-xs text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
        />

        <div className="mt-4 flex max-h-[38rem] flex-col gap-2 overflow-y-auto pr-1">
          {classIds.map((id) => {
            const cls = config.classes[id]!;
            const selectedCard = id === selectedId;
            return (
              <button
                key={id}
                onClick={() => {
                  setSelectedId(id);
                  setRenaming(false);
                }}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  selectedCard
                    ? "border-border-active bg-gradient-active"
                    : "border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] hover:bg-[var(--chrome-highlight-strong)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-display text-lg text-text-primary">{cls.displayName}</div>
                    <div className="mt-1 truncate text-2xs text-text-muted">{id}</div>
                  </div>
                  {cls.image && (
                    <span className="rounded-full bg-badge-success-bg px-2 py-1 text-2xs uppercase tracking-label text-badge-success">
                      Art
                    </span>
                  )}
                </div>
                <div className="mt-3 text-xs text-text-secondary">{summarizeClass(cls)}</div>
              </button>
            );
          })}
          {classIds.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-highlight)] px-4 py-6 text-sm text-text-muted">
              No classes match the current search.
            </div>
          )}
        </div>
      </div>

      {selectedId && selected ? (
        <div className="rounded-3xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--chrome-stroke)] pb-4">
            <div>
              <p className="text-2xs uppercase tracking-ui text-text-muted">Class designer</p>
              <h4 className="mt-2 font-display text-3xl text-text-primary">{selected.displayName}</h4>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-text-secondary">
                Tune progression, identity, and presentation for this class.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[var(--chrome-highlight-strong)] px-3 py-1 text-xs text-text-secondary">HP +{selected.hpPerLevel}</span>
              <span className="rounded-full bg-[var(--chrome-highlight-strong)] px-3 py-1 text-xs text-text-secondary">Mana +{selected.manaPerLevel}</span>
              <span className="rounded-full bg-[var(--chrome-highlight-strong)] px-3 py-1 text-xs text-text-secondary">{selected.primaryStat ?? "No primary stat"}</span>
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
                  className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight-strong)] px-4 py-2 text-xs text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
                />
                <button onClick={commitRename} title="Confirm rename" className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight-strong)] px-4 py-2 text-xs text-text-primary hover:bg-[var(--chrome-highlight-strong)]">
                  Rename
                </button>
                <button onClick={() => setRenaming(false)} title="Cancel rename" className="rounded-full border border-[var(--chrome-stroke)] bg-transparent px-4 py-2 text-xs text-text-secondary hover:bg-[var(--chrome-highlight-strong)]">
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
                  className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight-strong)] px-4 py-2 text-xs text-text-primary hover:bg-[var(--chrome-highlight-strong)]"
                >
                  Rename ID
                </button>
                <button
                  onClick={() => deleteClass(selectedId)}
                  className="rounded-full border border-status-danger/40 bg-status-danger/10 px-4 py-2 text-xs text-status-danger hover:bg-status-danger/15"
                >
                  Delete Class
                </button>
              </>
            )}
          </div>

          <div className="mt-4">
            <ClassDetail
              id={selectedId}
              cls={selected}
              patch={(patch) => patchClass(selectedId, patch)}
              statOptions={statOptions}
              raceOptions={raceOptions}
              maxLevel={config.progression.maxLevel}
              baseHp={config.progression.rewards.baseHp}
              baseMana={config.progression.rewards.baseMana}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-highlight)] px-6 py-10 text-sm text-text-muted">
          Create a class to start designing it.
        </div>
      )}
    </div>
  );
}
