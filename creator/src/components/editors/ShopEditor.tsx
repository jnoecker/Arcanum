import { useCallback } from "react";
import type { WorldFile, ShopFile } from "@/types/world";
import { updateShop, deleteShop } from "@/lib/zoneEdits";
import { useEntityEditor } from "@/lib/useEntityEditor";
import {
  Section,
  FieldRow,
  TextInput,
  SelectInput,
  IconButton,
  EntityHeader,
} from "@/components/ui/FormWidgets";
import { DeleteEntityButton, MediaSection } from "./EditorShared";
import { ReputationGateEditor } from "./ReputationGateEditor";
import { shopPrompt } from "@/lib/entityPrompts";

interface ShopEditorProps {
  shopId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
  onDelete: () => void;
  zoneId?: string;
}

export function ShopEditor({
  shopId,
  world,
  onWorldChange,
  onDelete,
  zoneId,
}: ShopEditorProps) {
  const { entity: shop, patch, handleDelete, rooms } = useEntityEditor<ShopFile>(
    world,
    shopId,
    (w) => w.shops?.[shopId],
    updateShop,
    deleteShop,
    onWorldChange,
    onDelete,
  );
  if (!shop) return null;

  const zoneItems = Object.entries(world.items ?? {}).map(([id, item]) => ({
    value: id,
    label: `${item.displayName} (${id})`,
  }));

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
      <EntityHeader type="Shop">
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
      </EntityHeader>

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

      <ReputationGateEditor
        value={shop.requiredReputation}
        onChange={(v) => patch({ requiredReputation: v })}
        hint="Players who fail the gate see the shop refuse service."
      />

      <MediaSection image={shop.image} onImageChange={(v) => patch({ image: v })} getPrompt={(style) => shopPrompt(shopId, shop, style)} assetType="background" context={zoneId ? { zone: zoneId, entity_type: "shop", entity_id: shopId } : undefined} />
      <DeleteEntityButton onClick={handleDelete} label="Delete Shop" />
    </>
  );
}
