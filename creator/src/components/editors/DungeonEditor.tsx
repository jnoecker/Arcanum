import { useCallback, useState } from "react";
import type { WorldFile, DungeonFile, DungeonRoomTemplate, DungeonLootTable } from "@/types/world";
import { updateDungeon } from "@/lib/zoneEdits";
import {
  Section,
  FieldRow,
  TextInput,
  NumberInput,
  IconButton,
  CommitTextarea,
} from "@/components/ui/FormWidgets";
import { DeleteEntityButton } from "./EditorShared";

interface DungeonEditorProps {
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
  onDelete: () => void;
}

// ─── Sub-component: dynamic key + list editor for room templates ──

function RoomTemplatesEditor({
  templates,
  onChange,
}: {
  templates: Record<string, DungeonRoomTemplate[]>;
  onChange: (t: Record<string, DungeonRoomTemplate[]>) => void;
}) {
  const [newCategory, setNewCategory] = useState("");

  const addCategory = () => {
    const key = newCategory.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key || templates[key]) return;
    onChange({ ...templates, [key]: [] });
    setNewCategory("");
  };

  const removeCategory = (key: string) => {
    const next = { ...templates };
    delete next[key];
    onChange(next);
  };

  const addTemplate = (category: string) => {
    onChange({
      ...templates,
      [category]: [...(templates[category] ?? []), { title: "", description: "" }],
    });
  };

  const updateTemplate = (category: string, idx: number, patch: Partial<DungeonRoomTemplate>) => {
    const list = [...(templates[category] ?? [])];
    list[idx] = { ...list[idx]!, ...patch } as DungeonRoomTemplate;
    onChange({ ...templates, [category]: list });
  };

  const removeTemplate = (category: string, idx: number) => {
    const list = (templates[category] ?? []).filter((_, i) => i !== idx);
    onChange({ ...templates, [category]: list });
  };

  return (
    <div className="space-y-3">
      {Object.entries(templates).map(([category, list]) => (
        <div key={category} className="rounded-lg border border-border-muted bg-bg-secondary/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-accent uppercase tracking-[0.1em]">{category}</span>
            <div className="flex items-center gap-1">
              <IconButton title="Add room template" onClick={() => addTemplate(category)}>+</IconButton>
              <IconButton title="Remove category" onClick={() => removeCategory(category)}>&times;</IconButton>
            </div>
          </div>
          {list.map((tpl, i) => (
            <div key={i} className="mb-2 flex gap-2 items-start">
              <div className="flex-1 space-y-1">
                <TextInput value={tpl.title} onCommit={(v) => updateTemplate(category, i, { title: v })} placeholder="Room title" />
                <CommitTextarea label="" value={tpl.description} onCommit={(v) => updateTemplate(category, i, { description: v })} placeholder="Room description" rows={2} />
              </div>
              <IconButton title="Remove" onClick={() => removeTemplate(category, i)}>&times;</IconButton>
            </div>
          ))}
          {list.length === 0 && <p className="text-2xs text-text-muted">No templates. Click + to add one.</p>}
        </div>
      ))}
      <div className="flex items-center gap-2">
        <input
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCategory()}
          placeholder="New category name"
          className="min-w-0 flex-1 rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50"
        />
        <button onClick={addCategory} className="text-2xs text-accent hover:text-text-primary">Add Category</button>
      </div>
    </div>
  );
}

// ─── Sub-component: string pool editor (mob pools) ────────────────

function StringPoolsEditor({
  pools,
  onChange,
  itemLabel,
}: {
  pools: Record<string, string[]>;
  onChange: (p: Record<string, string[]>) => void;
  itemLabel: string;
}) {
  const [newPool, setNewPool] = useState("");

  const addPool = () => {
    const key = newPool.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key || pools[key]) return;
    onChange({ ...pools, [key]: [] });
    setNewPool("");
  };

  const removePool = (key: string) => {
    const next = { ...pools };
    delete next[key];
    onChange(next);
  };

  const addItem = (pool: string) => {
    onChange({ ...pools, [pool]: [...(pools[pool] ?? []), ""] });
  };

  const updateItem = (pool: string, idx: number, value: string) => {
    const list = [...(pools[pool] ?? [])];
    list[idx] = value;
    onChange({ ...pools, [pool]: list });
  };

  const removeItem = (pool: string, idx: number) => {
    onChange({ ...pools, [pool]: (pools[pool] ?? []).filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-3">
      {Object.entries(pools).map(([pool, items]) => (
        <div key={pool} className="rounded-lg border border-border-muted bg-bg-secondary/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-accent uppercase tracking-[0.1em]">{pool}</span>
            <div className="flex items-center gap-1">
              <IconButton title={`Add ${itemLabel}`} onClick={() => addItem(pool)}>+</IconButton>
              <IconButton title="Remove pool" onClick={() => removePool(pool)}>&times;</IconButton>
            </div>
          </div>
          {items.map((item, i) => (
            <div key={i} className="mb-1 flex items-center gap-2">
              <TextInput value={item} onCommit={(v) => updateItem(pool, i, v)} placeholder={`${itemLabel} ID`} />
              <IconButton title="Remove" onClick={() => removeItem(pool, i)}>&times;</IconButton>
            </div>
          ))}
          {items.length === 0 && <p className="text-2xs text-text-muted">Empty pool.</p>}
        </div>
      ))}
      <div className="flex items-center gap-2">
        <input
          value={newPool}
          onChange={(e) => setNewPool(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addPool()}
          placeholder="New pool name"
          className="min-w-0 flex-1 rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50"
        />
        <button onClick={addPool} className="text-2xs text-accent hover:text-text-primary">Add Pool</button>
      </div>
    </div>
  );
}

// ─── Sub-component: loot tables editor ────────────────────────────

function LootTablesEditor({
  tables,
  onChange,
}: {
  tables: Record<string, DungeonLootTable>;
  onChange: (t: Record<string, DungeonLootTable>) => void;
}) {
  const [newTier, setNewTier] = useState("");

  const addTier = () => {
    const key = newTier.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key || tables[key]) return;
    onChange({ ...tables, [key]: {} });
    setNewTier("");
  };

  const removeTier = (key: string) => {
    const next = { ...tables };
    delete next[key];
    onChange(next);
  };

  const updateList = (tier: string, field: "mobDrops" | "completion", list: string[]) => {
    onChange({ ...tables, [tier]: { ...tables[tier], [field]: list } });
  };

  const addToList = (tier: string, field: "mobDrops" | "completion") => {
    const current = tables[tier]?.[field] ?? [];
    updateList(tier, field, [...current, ""]);
  };

  const updateInList = (tier: string, field: "mobDrops" | "completion", idx: number, value: string) => {
    const current = [...(tables[tier]?.[field] ?? [])];
    current[idx] = value;
    updateList(tier, field, current);
  };

  const removeFromList = (tier: string, field: "mobDrops" | "completion", idx: number) => {
    updateList(tier, field, (tables[tier]?.[field] ?? []).filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      {Object.entries(tables).map(([tier, table]) => (
        <div key={tier} className="rounded-lg border border-border-muted bg-bg-secondary/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-accent uppercase tracking-[0.1em]">{tier}</span>
            <IconButton title="Remove tier" onClick={() => removeTier(tier)}>&times;</IconButton>
          </div>
          {(["mobDrops", "completion"] as const).map((field) => (
            <div key={field} className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-2xs text-text-muted capitalize">{field === "mobDrops" ? "Mob Drops" : "Completion Rewards"}</span>
                <IconButton title={`Add ${field} item`} onClick={() => addToList(tier, field)}>+</IconButton>
              </div>
              {(table[field] ?? []).map((item, i) => (
                <div key={i} className="mb-1 flex items-center gap-2">
                  <TextInput value={item} onCommit={(v) => updateInList(tier, field, i, v)} placeholder="Item ID" />
                  <IconButton title="Remove" onClick={() => removeFromList(tier, field, i)}>&times;</IconButton>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
      <div className="flex items-center gap-2">
        <input
          value={newTier}
          onChange={(e) => setNewTier(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTier()}
          placeholder="New difficulty tier"
          className="min-w-0 flex-1 rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50"
        />
        <button onClick={addTier} className="text-2xs text-accent hover:text-text-primary">Add Tier</button>
      </div>
    </div>
  );
}

// ─── Main editor ──────────────────────────────────────────────────

const DEFAULT_ROOM_CATEGORIES = ["corridor", "chamber", "treasure", "boss"];
const DEFAULT_MOB_POOLS = ["common", "elite", "boss"];
const DEFAULT_LOOT_TIERS = ["lore", "normal", "hard", "heroic"];

export function DungeonEditor({ world, onWorldChange, onDelete }: DungeonEditorProps) {
  const dungeon = world.dungeon;
  if (!dungeon) return null;

  const patch = useCallback(
    (p: Partial<DungeonFile>) => onWorldChange(updateDungeon(world, p)),
    [world, onWorldChange],
  );

  return (
    <div className="space-y-6">
      <Section title="Dungeon Basics" defaultExpanded>
        <FieldRow label="Name">
          <TextInput value={dungeon.name} onCommit={(v) => patch({ name: v })} placeholder="Dungeon name" />
        </FieldRow>
        <CommitTextarea
          label="Description"
          value={dungeon.description ?? ""}
          onCommit={(v) => patch({ description: v || undefined })}
          placeholder="Dungeon description..."
          rows={3}
        />
        <FieldRow label="Min Level">
          <NumberInput value={dungeon.minLevel ?? 1} onCommit={(v) => patch({ minLevel: v ?? 1 })} min={1} />
        </FieldRow>
        <div className="flex gap-4">
          <FieldRow label="Room Count Min">
            <NumberInput
              value={dungeon.roomCount?.min ?? 8}
              onCommit={(v) => patch({ roomCount: { min: v ?? 8, max: dungeon.roomCount?.max ?? 14 } })}
              min={1}
            />
          </FieldRow>
          <FieldRow label="Room Count Max">
            <NumberInput
              value={dungeon.roomCount?.max ?? 14}
              onCommit={(v) => patch({ roomCount: { min: dungeon.roomCount?.min ?? 8, max: v ?? 14 } })}
              min={1}
            />
          </FieldRow>
        </div>
      </Section>

      <Section title="Room Templates" defaultExpanded>
        <RoomTemplatesEditor
          templates={dungeon.roomTemplates ?? Object.fromEntries(DEFAULT_ROOM_CATEGORIES.map((c) => [c, []]))}
          onChange={(roomTemplates) => patch({ roomTemplates })}
        />
      </Section>

      <Section title="Mob Pools">
        <StringPoolsEditor
          pools={dungeon.mobPools ?? Object.fromEntries(DEFAULT_MOB_POOLS.map((p) => [p, []]))}
          onChange={(mobPools) => patch({ mobPools })}
          itemLabel="mob"
        />
      </Section>

      <Section title="Loot Tables">
        <LootTablesEditor
          tables={dungeon.lootTables ?? Object.fromEntries(DEFAULT_LOOT_TIERS.map((t) => [t, {}]))}
          onChange={(lootTables) => patch({ lootTables })}
        />
      </Section>

      <DeleteEntityButton label="Dungeon Template" onClick={onDelete} />
    </div>
  );
}

/** Empty state shown when a zone has no dungeon template. */
export function DungeonEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <h2 className="font-display text-lg text-text-primary">No Dungeon Template</h2>
      <p className="text-sm text-text-muted max-w-sm">
        Add a procedural dungeon template to this zone. It defines room pools, mob sets, and loot tables
        that the server assembles into unique instances at runtime.
      </p>
      <button
        onClick={onAdd}
        className="rounded-full border border-[rgba(184,216,232,0.28)] bg-gradient-active-strong px-5 py-2 text-xs text-text-primary transition hover:shadow-glow-sm"
      >
        Add Dungeon Template
      </button>
    </div>
  );
}
