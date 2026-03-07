import { useCallback } from "react";
import type { WorldFile, ShopFile } from "@/types/world";
import { updateShop, deleteShop } from "@/lib/zoneEdits";
import {
  Section,
  FieldRow,
  TextInput,
  SelectInput,
  IconButton,
} from "@/components/ui/FormWidgets";

interface ShopEditorProps {
  zoneId: string;
  shopId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
  onDelete: () => void;
}

export function ShopEditor({
  zoneId: _zoneId,
  shopId,
  world,
  onWorldChange,
  onDelete,
}: ShopEditorProps) {
  const shop = world.shops?.[shopId];
  if (!shop) return null;

  const rooms = Object.keys(world.rooms).map((r) => ({
    value: r,
    label: r,
  }));

  const zoneItems = Object.entries(world.items ?? {}).map(([id, item]) => ({
    value: id,
    label: `${item.displayName} (${id})`,
  }));

  const patch = useCallback(
    (p: Partial<ShopFile>) => onWorldChange(updateShop(world, shopId, p)),
    [world, shopId, onWorldChange],
  );

  const handleDelete = useCallback(() => {
    onWorldChange(deleteShop(world, shopId));
    onDelete();
  }, [world, shopId, onWorldChange, onDelete]);

  const handleAddItem = useCallback(() => {
    const items = [...(shop.items ?? []), ""];
    patch({ items });
  }, [shop.items, patch]);

  const handleUpdateItem = useCallback(
    (index: number, value: string) => {
      const items = [...(shop.items ?? [])];
      items[index] = value;
      patch({ items });
    },
    [shop.items, patch],
  );

  const handleRemoveItem = useCallback(
    (index: number) => {
      const items = (shop.items ?? []).filter((_, i) => i !== index);
      patch({ items: items.length > 0 ? items : undefined });
    },
    [shop.items, patch],
  );

  return (
    <>
      <Section title="Basics">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Name">
            <TextInput value={shop.name} onCommit={(v) => patch({ name: v })} />
          </FieldRow>
          <FieldRow label="Room">
            <SelectInput
              value={shop.room}
              options={rooms}
              onCommit={(v) => patch({ room: v })}
            />
          </FieldRow>
        </div>
      </Section>

      <Section
        title={`Inventory (${shop.items?.length ?? 0})`}
        actions={
          <IconButton onClick={handleAddItem} title="Add item">+</IconButton>
        }
      >
        {(shop.items ?? []).length === 0 ? (
          <p className="text-xs text-text-muted">No items</p>
        ) : (
          <div className="flex flex-col gap-1">
            {(shop.items ?? []).map((itemId, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <SelectInput
                    value={itemId}
                    options={zoneItems}
                    onCommit={(v) => handleUpdateItem(i, v)}
                    placeholder="— select item —"
                    allowEmpty
                  />
                </div>
                <IconButton
                  onClick={() => handleRemoveItem(i)}
                  title="Remove item"
                  danger
                >
                  &times;
                </IconButton>
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="px-4 py-3">
        <button
          onClick={handleDelete}
          className="w-full rounded border border-status-danger/40 px-2 py-1.5 text-xs text-status-danger transition-colors hover:bg-status-danger/10"
        >
          Delete Shop
        </button>
      </div>
    </>
  );
}
