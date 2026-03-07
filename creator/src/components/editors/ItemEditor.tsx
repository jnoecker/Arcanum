import { useCallback } from "react";
import type { WorldFile, ItemFile, ItemOnUse } from "@/types/world";
import { updateItem, deleteItem } from "@/lib/zoneEdits";
import {
  Section,
  FieldRow,
  TextInput,
  NumberInput,
  SelectInput,
  CheckboxInput,
} from "@/components/ui/FormWidgets";

interface ItemEditorProps {
  zoneId: string;
  itemId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
  onDelete: () => void;
}

const SLOT_OPTIONS = [
  { value: "HEAD", label: "Head" },
  { value: "BODY", label: "Body" },
  { value: "HAND", label: "Hand" },
];

export function ItemEditor({
  zoneId: _zoneId,
  itemId,
  world,
  onWorldChange,
  onDelete,
}: ItemEditorProps) {
  const item = world.items?.[itemId];
  if (!item) return null;

  const rooms = Object.keys(world.rooms).map((r) => ({
    value: r,
    label: r,
  }));

  const patch = useCallback(
    (p: Partial<ItemFile>) => onWorldChange(updateItem(world, itemId, p)),
    [world, itemId, onWorldChange],
  );

  const handleDelete = useCallback(() => {
    onWorldChange(deleteItem(world, itemId));
    onDelete();
  }, [world, itemId, onWorldChange, onDelete]);

  // ─── Stat helpers ─────────────────────────────────────────────
  const stats = item.stats ?? {};
  const handleStatChange = useCallback(
    (statId: string, value: number | undefined) => {
      const next = { ...stats };
      if (value == null || value === 0) {
        delete next[statId];
      } else {
        next[statId] = value;
      }
      patch({ stats: Object.keys(next).length > 0 ? next : undefined });
    },
    [stats, patch],
  );

  // ─── OnUse helpers ────────────────────────────────────────────
  const onUse = item.onUse ?? {};
  const handleOnUseChange = useCallback(
    (field: keyof ItemOnUse, value: number | undefined) => {
      const next: ItemOnUse = { ...onUse, [field]: value };
      const hasEffect = (next.healHp ?? 0) > 0 || (next.grantXp ?? 0) > 0;
      patch({ onUse: hasEffect ? next : undefined });
    },
    [onUse, patch],
  );

  return (
    <>
      {/* Core fields */}
      <Section title="Basics">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Display Name">
            <TextInput
              value={item.displayName}
              onCommit={(v) => patch({ displayName: v })}
            />
          </FieldRow>
          <FieldRow label="Keyword">
            <TextInput
              value={item.keyword ?? ""}
              onCommit={(v) => patch({ keyword: v || undefined })}
              placeholder="auto"
            />
          </FieldRow>
          <FieldRow label="Description">
            <TextInput
              value={item.description ?? ""}
              onCommit={(v) => patch({ description: v || undefined })}
              placeholder="none"
            />
          </FieldRow>
          <FieldRow label="Room">
            <SelectInput
              value={item.room ?? ""}
              options={rooms}
              onCommit={(v) => patch({ room: v || undefined })}
              allowEmpty
              placeholder="— unplaced —"
            />
          </FieldRow>
          <FieldRow label="Base Price">
            <NumberInput
              value={item.basePrice}
              onCommit={(v) => patch({ basePrice: v })}
              placeholder="0"
              min={0}
            />
          </FieldRow>
          <CheckboxInput
            checked={item.matchByKey ?? false}
            onCommit={(v) => patch({ matchByKey: v || undefined })}
            label="Match by keyword"
          />
        </div>
      </Section>

      {/* Equipment */}
      <Section title="Equipment">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Slot">
            <SelectInput
              value={item.slot ?? ""}
              options={SLOT_OPTIONS}
              onCommit={(v) => patch({ slot: v || undefined })}
              allowEmpty
              placeholder="— none —"
            />
          </FieldRow>
          <FieldRow label="Damage">
            <NumberInput
              value={item.damage}
              onCommit={(v) => patch({ damage: v })}
              placeholder="0"
              min={0}
            />
          </FieldRow>
          <FieldRow label="Armor">
            <NumberInput
              value={item.armor}
              onCommit={(v) => patch({ armor: v })}
              placeholder="0"
              min={0}
            />
          </FieldRow>
        </div>
      </Section>

      {/* Stat bonuses */}
      <Section title="Stat Bonuses">
        <p className="mb-1 text-[10px] text-text-muted">
          Only non-zero values are saved
        </p>
        <div className="flex flex-col gap-1">
          {/* Show existing stats + add button */}
          {Object.entries(stats).map(([statId, value]) => (
            <div key={statId} className="flex items-center gap-1">
              <span className="w-16 shrink-0 text-xs font-medium text-text-primary">
                {statId}
              </span>
              <NumberInput
                value={value}
                onCommit={(v) => handleStatChange(statId, v)}
              />
            </div>
          ))}
          <AddStatRow
            existingStats={Object.keys(stats)}
            onAdd={(statId) => handleStatChange(statId, 1)}
          />
        </div>
      </Section>

      {/* Consumable */}
      <Section title="Consumable">
        <div className="flex flex-col gap-1.5">
          <CheckboxInput
            checked={item.consumable ?? false}
            onCommit={(v) => patch({ consumable: v || undefined })}
            label="Is consumable"
          />
          {item.consumable && (
            <>
              <FieldRow label="Charges">
                <NumberInput
                  value={item.charges}
                  onCommit={(v) => patch({ charges: v })}
                  placeholder="unlimited"
                  min={1}
                />
              </FieldRow>
              <FieldRow label="Heal HP">
                <NumberInput
                  value={onUse.healHp}
                  onCommit={(v) => handleOnUseChange("healHp", v)}
                  placeholder="0"
                  min={0}
                />
              </FieldRow>
              <FieldRow label="Grant XP">
                <NumberInput
                  value={onUse.grantXp}
                  onCommit={(v) => handleOnUseChange("grantXp", v)}
                  placeholder="0"
                  min={0}
                />
              </FieldRow>
            </>
          )}
        </div>
      </Section>

      {/* Media */}
      <Section title="Media">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Image">
            <TextInput
              value={item.image ?? ""}
              onCommit={(v) => patch({ image: v || undefined })}
              placeholder="none"
            />
          </FieldRow>
        </div>
      </Section>

      {/* Delete */}
      <div className="px-4 py-3">
        <button
          onClick={handleDelete}
          className="w-full rounded border border-status-danger/40 px-2 py-1.5 text-xs text-status-danger transition-colors hover:bg-status-danger/10"
        >
          Delete Item
        </button>
      </div>
    </>
  );
}

/** Inline component to add a new stat key. */
function AddStatRow({
  existingStats,
  onAdd,
}: {
  existingStats: string[];
  onAdd: (statId: string) => void;
}) {
  return (
    <button
      onClick={() => {
        const id = prompt("Stat ID (e.g. STR, DEX):");
        if (id && !existingStats.includes(id.toUpperCase())) {
          onAdd(id.toUpperCase());
        }
      }}
      className="mt-1 rounded border border-border-default px-2 py-0.5 text-[10px] text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-primary"
    >
      + Add Stat Bonus
    </button>
  );
}
