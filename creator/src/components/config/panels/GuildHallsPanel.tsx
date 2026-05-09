import { useMemo, useState } from "react";
import type { ConfigPanelProps, AppConfig } from "./types";
import type { GuildHallRoomTemplate, GuildHallsConfig } from "@/types/config";
import { RoomTemplatesList } from "./guildHalls/RoomTemplatesList";
import { RoomEditor } from "./guildHalls/RoomEditor";

function normalizeId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function defaultTemplate(title: string): GuildHallRoomTemplate {
  const cleaned = title.trim() || "New Room";
  return { title: cleaned, displayName: cleaned, description: "", cost: 0 };
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

export function GuildHallsPanel({ config, onChange }: ConfigPanelProps) {
  const guildHalls: GuildHallsConfig & {
    roomTemplates: Record<string, GuildHallRoomTemplate>;
  } = {
    enabled: false,
    baseCost: 0,
    ...(config.guildHalls ?? {}),
    roomTemplates: (config.guildHalls?.roomTemplates ?? {}) as Record<
      string,
      GuildHallRoomTemplate
    >,
  };

  const [selected, setSelected] = useState<string | null>(null);

  const patchHalls = (p: Partial<AppConfig["guildHalls"]>) =>
    onChange({ guildHalls: { ...guildHalls, ...p } });

  const patchTemplate = (id: string, p: Partial<GuildHallRoomTemplate>) => {
    const t = guildHalls.roomTemplates[id];
    if (!t) return;
    patchHalls({
      roomTemplates: { ...guildHalls.roomTemplates, [id]: { ...t, ...p } },
    });
  };

  const addTemplate = () => {
    const id = nextNewId(guildHalls.roomTemplates);
    patchHalls({
      roomTemplates: {
        ...guildHalls.roomTemplates,
        [id]: defaultTemplate("New Room"),
      },
    });
    setSelected(id);
  };

  const duplicateTemplate = (sourceId: string) => {
    const source = guildHalls.roomTemplates[sourceId];
    if (!source) return;
    const newId = nextDuplicateId(sourceId, guildHalls.roomTemplates);
    const cloned: GuildHallRoomTemplate = {
      ...source,
      title: `${source.title || source.displayName || sourceId} (copy)`,
      displayName: `${source.title || source.displayName || sourceId} (copy)`,
    };
    patchHalls({
      roomTemplates: { ...guildHalls.roomTemplates, [newId]: cloned },
    });
    setSelected(newId);
  };

  const renameTemplate = (oldId: string, rawNewId: string) => {
    const newId = normalizeId(rawNewId);
    if (!newId || oldId === newId || guildHalls.roomTemplates[newId]) return;
    const next: Record<string, GuildHallRoomTemplate> = {};
    for (const [k, v] of Object.entries(guildHalls.roomTemplates)) {
      next[k === oldId ? newId : k] = v;
    }
    patchHalls({ roomTemplates: next });
    if (selected === oldId) setSelected(newId);
  };

  const deleteTemplate = (id: string) => {
    const next = { ...guildHalls.roomTemplates };
    delete next[id];
    patchHalls({ roomTemplates: next });
    if (selected === id) setSelected(null);
  };

  const selectedTemplate = useMemo(
    () => (selected ? guildHalls.roomTemplates[selected] ?? null : null),
    [guildHalls.roomTemplates, selected],
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <RoomTemplatesList
          templates={guildHalls.roomTemplates}
          selected={selected}
          enabled={guildHalls.enabled}
          baseCost={guildHalls.baseCost ?? 0}
          onPatchHalls={patchHalls}
          onAdd={addTemplate}
          onSelect={(id) => setSelected(selected === id ? null : id)}
        />
      </div>
      <div className="lg:col-span-8">
        {selected && selectedTemplate ? (
          <RoomEditor
            id={selected}
            t={selectedTemplate}
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
                Pick a guild hall room from the list, or add a new one to get started.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
