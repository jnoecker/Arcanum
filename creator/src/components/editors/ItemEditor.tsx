import { useCallback, useState, memo } from "react";
import type { WorldFile, ItemFile, ItemOnUse } from "@/types/world";
import { updateItem, deleteItem } from "@/lib/zoneEdits";
import { useEntityEditor } from "@/lib/useEntityEditor";
import { useConfigOptions } from "@/lib/useConfigOptions";
import {
  Section,
  FieldRow,
  TextInput,
  NumberInput,
  SelectInput,
  CheckboxInput,
  EntityHeader,
  FieldGrid,
  CompactField,
  TabBar,
} from "@/components/ui/FormWidgets";
import { DeleteEntityButton, EnhanceDescriptionButton, MediaSection } from "./EditorShared";
import { itemPrompt, itemContext } from "@/lib/entityPrompts";
import { keywordFromId } from "@/lib/sanitizeZone";
import { useVibeStore } from "@/stores/vibeStore";
import { useConfigStore } from "@/stores/configStore";

interface ItemEditorProps {
  itemId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
  onDelete: () => void;
  zoneId?: string;
}

type ItemTab = "item" | "media";
const ITEM_TABS: readonly { value: ItemTab; label: string }[] = [
  { value: "item", label: "Item" },
  { value: "media", label: "Media" },
] as const;

export function ItemEditor({
  itemId,
  zoneId,
  world,
  onWorldChange,
  onDelete,
}: ItemEditorProps) {
  const [activeTab, setActiveTab] = useState<ItemTab>("item");
  const { entity: item, patch, handleDelete, rooms } = useEntityEditor<ItemFile>(
    world,
    itemId,
    (w) => w.items?.[itemId],
    updateItem,
    deleteItem,
    onWorldChange,
    onDelete,
  );
  const equipmentSlots = useConfigStore((s) => s.config?.equipmentSlots);
  const slotOptions = useConfigOptions(equipmentSlots, [
    { value: "head", label: "Head" },
    { value: "body", label: "Body" },
    { value: "hand", label: "Hand" },
  ]);

  if (!item) return null;

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
      <EntityHeader type="Item">
        <FieldRow label="Display Name">
          <TextInput
            value={item.displayName}
            onCommit={(v) => patch({ displayName: v })}
          />
        </FieldRow>
        <FieldRow label="Description">
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <TextInput
                value={item.description ?? ""}
                onCommit={(v) => patch({ description: v || undefined })}
                placeholder="None"
              />
            </div>
            <EnhanceDescriptionButton
              entitySummary={`Item "${item.displayName}"${item.slot ? `, slot: ${item.slot}` : ""}${item.damage ? `, damage: ${item.damage}` : ""}${item.armor ? `, armor: ${item.armor}` : ""}${item.consumable ? ", consumable" : ""}`}
              currentDescription={item.description}
              onAccept={(v) => patch({ description: v })}
              vibe={zoneId ? useVibeStore.getState().getVibe(zoneId) : undefined}
            />
          </div>
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
      </EntityHeader>

      <TabBar tabs={ITEM_TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === "item" && (
        <>
          <Section title="Identity">
            <div className="flex flex-col gap-1.5">
              <FieldRow label="Keyword">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <TextInput
                      value={item.keyword ?? ""}
                      onCommit={(v) => patch({ keyword: v || undefined })}
                      placeholder={keywordFromId(itemId)}
                    />
                  </div>
                  <CheckboxInput
                    checked={item.matchByKey ?? false}
                    onCommit={(v) => patch({ matchByKey: v || undefined })}
                    label="Match by keyword"
                  />
                </div>
              </FieldRow>
              <FieldRow label="Base Price">
                <NumberInput
                  value={item.basePrice}
                  onCommit={(v) => patch({ basePrice: v })}
                  placeholder="0"
                  min={0}
                />
              </FieldRow>
            </div>
          </Section>

          <Section title="Properties">
            <div className="flex flex-col gap-1.5">
              <FieldGrid cols={2}>
                <CompactField label="Slot" span>
                  <SelectInput
                    value={item.slot ?? ""}
                    options={slotOptions}
                    onCommit={(v) => patch({ slot: v || undefined })}
                    allowEmpty
                    placeholder="— none —"
                    dense
                  />
                </CompactField>
                <CompactField label="Damage">
                  <NumberInput
                    value={item.damage}
                    onCommit={(v) => patch({ damage: v })}
                    placeholder="0"
                    min={0}
                    dense
                  />
                </CompactField>
                <CompactField label="Armor">
                  <NumberInput
                    value={item.armor}
                    onCommit={(v) => patch({ armor: v })}
                    placeholder="0"
                    min={0}
                    dense
                  />
                </CompactField>
              </FieldGrid>
              <hr className="my-2 border-border-muted" />
              <CheckboxInput
                checked={item.consumable ?? false}
                onCommit={(v) => patch({ consumable: v || undefined })}
                label="Is consumable"
              />
              {item.consumable && (
                <FieldGrid cols={2}>
                  <CompactField label="Charges" span>
                    <NumberInput
                      value={item.charges}
                      onCommit={(v) => patch({ charges: v })}
                      placeholder="Unlimited"
                      min={1}
                      dense
                    />
                  </CompactField>
                  <CompactField label="Heal HP">
                    <NumberInput
                      value={onUse.healHp}
                      onCommit={(v) => handleOnUseChange("healHp", v)}
                      placeholder="0"
                      min={0}
                      dense
                    />
                  </CompactField>
                  <CompactField label="Grant XP">
                    <NumberInput
                      value={onUse.grantXp}
                      onCommit={(v) => handleOnUseChange("grantXp", v)}
                      placeholder="0"
                      min={0}
                      dense
                    />
                  </CompactField>
                </FieldGrid>
              )}
            </div>
          </Section>

          <Section title="Stat Bonuses">
            <p className="mb-1 text-2xs text-text-muted">
              Only non-zero values are saved
            </p>
            <div className="flex flex-col gap-1">
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
        </>
      )}

      {activeTab === "media" && (
        <MediaSection
          image={item.image}
          onImageChange={(v) => patch({ image: v })}
          video={item.video}
          onVideoChange={(v) => patch({ video: v })}
          getPrompt={(style) => itemPrompt(itemId, item, style)}
          entityContext={itemContext(itemId, item)}
          assetType="entity_portrait"
          context={zoneId ? { zone: zoneId, entity_type: "item", entity_id: itemId } : undefined}
          vibe={zoneId ? useVibeStore.getState().getVibe(zoneId) : undefined}
        />
      )}

      <DeleteEntityButton onClick={handleDelete} label="Delete Item" />
    </>
  );
}

const AddStatRow = memo(function AddStatRow({
  existingStats,
  onAdd,
}: {
  existingStats: string[];
  onAdd: (statId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    const id = value.trim().toUpperCase();
    if (id && !existingStats.includes(id)) {
      onAdd(id);
    }
    setValue("");
    setEditing(false);
  };

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="mt-1 flex items-center gap-1"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. STR, DEX"
          autoFocus
          className="h-5 flex-1 rounded border border-border-default bg-bg-primary px-1.5 text-2xs text-text-primary outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-border-active"
          onBlur={handleSubmit}
        />
        <button
          type="button"
          onClick={() => {
            setValue("");
            setEditing(false);
          }}
          className="text-2xs text-text-muted hover:text-text-primary"
        >
          &times;
        </button>
      </form>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="mt-1 rounded border border-border-default px-2 py-0.5 text-2xs text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-primary"
    >
      + Add Stat Bonus
    </button>
  );
});
