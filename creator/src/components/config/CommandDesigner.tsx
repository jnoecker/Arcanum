import { useEffect, useMemo, useState } from "react";
import type { AppConfig, CommandEntryConfig } from "@/types/config";
import { CommandsHeader } from "./commands/CommandsHeader";
import { CommandsList } from "./commands/CommandsList";
import { CommandEditor } from "./commands/CommandEditor";

const COMMAND_CATEGORIES = [
  "navigation",
  "communication",
  "items",
  "combat",
  "progression",
  "shops",
  "quests",
  "groups",
  "guilds",
  "crafting",
  "world",
  "social",
  "utility",
  "admin",
];

function defaultCommand(name: string): CommandEntryConfig {
  return {
    usage: name,
    category: "utility",
    staff: false,
  };
}

function nextDefaultId(existing: Record<string, unknown>): string {
  const base = "new_command";
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

export function CommandDesigner({
  config,
  onChange,
}: {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}) {
  const commands = config.commands;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId && commands[selectedId]) return;
    const first = Object.keys(commands)[0] ?? null;
    setSelectedId(first);
  }, [commands, selectedId]);

  const categoryOptions = useMemo(
    () =>
      COMMAND_CATEGORIES.map((category) => ({ value: category, label: category })),
    [],
  );

  const patchCommand = (id: string, patch: Partial<CommandEntryConfig>) => {
    onChange({
      commands: {
        ...commands,
        [id]: { ...commands[id]!, ...patch },
      },
    });
  };

  const renameCommand = (oldId: string, rawNewId: string) => {
    const newId = normalizeId(rawNewId);
    if (!newId || oldId === newId || commands[newId]) return;
    const next: Record<string, CommandEntryConfig> = {};
    for (const [k, v] of Object.entries(commands)) {
      next[k === oldId ? newId : k] = v;
    }
    onChange({ commands: next });
    if (selectedId === oldId) setSelectedId(newId);
  };

  const addCommand = () => {
    const id = nextDefaultId(commands);
    onChange({
      commands: {
        ...commands,
        [id]: defaultCommand(id),
      },
    });
    setSelectedId(id);
  };

  const duplicateCommand = () => {
    if (!selectedId || !commands[selectedId]) return;
    const source = commands[selectedId];
    const newId = nextDuplicateId(selectedId, commands);
    onChange({
      commands: { ...commands, [newId]: { ...source } },
    });
    setSelectedId(newId);
  };

  const deleteCommand = () => {
    if (!selectedId || !commands[selectedId]) return;
    const next = { ...commands };
    delete next[selectedId];
    onChange({ commands: next });
    setSelectedId(null);
  };

  const selected = selectedId ? commands[selectedId] ?? null : null;
  const staffCount = useMemo(
    () => Object.values(commands).filter((c) => c.staff).length,
    [commands],
  );

  return (
    <div className="flex flex-col gap-4">
      <CommandsHeader
        totalCount={Object.keys(commands).length}
        staffCount={staffCount}
        selectedId={selectedId}
        onDuplicate={duplicateCommand}
        onDelete={deleteCommand}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-3">
          <CommandsList
            commands={commands}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAdd={addCommand}
          />
        </div>

        <div className="xl:col-span-9">
          {selectedId && selected ? (
            <CommandEditor
              id={selectedId}
              cmd={selected}
              categoryOptions={categoryOptions}
              onPatch={(p) => patchCommand(selectedId, p)}
              onRename={(v) => renameCommand(selectedId, v)}
            />
          ) : (
            <EmptyEditor onAdd={addCommand} />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyEditor({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="panel-surface flex flex-col items-center justify-center gap-3 rounded-2xl px-6 py-12 text-center shadow-section">
      <div>
        <p className="font-display text-base text-text-primary">
          No command selected
        </p>
        <p className="mt-1 max-w-xs text-2xs text-text-muted/80">
          Choose a command from the list, or create a new one to get started.
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20"
      >
        + New Command
      </button>
    </div>
  );
}
