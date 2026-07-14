import { useCallback, useState, useMemo, memo } from "react";
import type { WorldFile, ItemFile, ItemOnUse, ItemType } from "@/types/world";
import { ITEM_TYPES, ARCHETYPAL_STATS } from "@/types/world";
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
import { ReferenceMentionField } from "@/components/ui/ReferenceMentionField";
import { DeleteEntityButton, EnhanceDescriptionButton, EntityActionsFooter, MediaSection } from "./EditorShared";
import { itemPrompt, itemContext } from "@/lib/entityPrompts";
import { keywordFromId } from "@/lib/sanitizeZone";
import { useVibeStore } from "@/stores/vibeStore";
import { useConfigStore } from "@/stores/configStore";
import {
  ITEM_TIERS,
  ITEM_ARCHETYPES,
  ACCESSORY_SLOTS,
  deriveItemStats,
  type ItemTier,
  type ItemArchetype,
} from "@/lib/tuning/itemBudget";

interface ItemEditorProps {
  itemId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  zoneId?: string;
  activeTab?: ItemTab;
  onTabChange?: (tab: ItemTab) => void;
}

export type ItemTab = "item" | "media";
const ITEM_TABS: readonly { value: ItemTab; label: string }[] = [
  { value: "item", label: "Item" },
  { value: "media", label: "Media" },
] as const;

export function ItemEditor(props: ItemEditorProps) {
  const { entity, patch, handleDelete, rooms } = useEntityEditor<ItemFile>(
    props.world,
    props.itemId,
    (w) => w.items?.[props.itemId],
    updateItem,
    deleteItem,
    props.onWorldChange,
    props.onDelete,
  );
  if (!entity) return null;
  return (
    <ItemEditorContent
      {...props}
      item={entity}
      patch={patch}
      handleDelete={handleDelete}
      rooms={rooms}
    />
  );
}

interface ItemEditorContentProps extends ItemEditorProps {
  item: ItemFile;
  patch: (p: Partial<ItemFile>) => void;
  handleDelete: () => void;
  rooms: { value: string; label: string }[];
}

function ItemEditorContent({
  itemId,
  zoneId,
  onDuplicate,
  item,
  patch,
  handleDelete,
  rooms,
  activeTab: controlledTab,
  onTabChange,
}: ItemEditorContentProps) {
  const [localTab, setLocalTab] = useState<ItemTab>("item");
  const activeTab = controlledTab ?? localTab;
  const setActiveTab = onTabChange ?? setLocalTab;
  const equipmentSlots = useConfigStore((s) => s.config?.equipmentSlots);
  const slotOptions = useConfigOptions(equipmentSlots, [
    { value: "head", label: "Head" },
    { value: "body", label: "Body" },
    { value: "hand", label: "Hand" },
  ]);
  const itemTypeOptions = ITEM_TYPES.map((t) => ({
    value: t,
    label: t.charAt(0).toUpperCase() + t.slice(1),
  }));

  const statDefinitions = useConfigStore((s) => s.config?.stats?.definitions);
  const statOptions = useMemo(() => {
    const opts = statDefinitions
      ? Object.entries(statDefinitions).map(([id, def]) => ({
          value: id,
          label: def.abbreviation ?? id,
        }))
      : [
          { value: "STR", label: "STR" },
          { value: "DEX", label: "DEX" },
          { value: "CON", label: "CON" },
          { value: "INT", label: "INT" },
          { value: "WIS", label: "WIS" },
        ];
    return opts;
  }, [statDefinitions]);

  const tierOptions = useMemo(
    () =>
      ITEM_TIERS.map((t) => ({
        value: t,
        label: t.charAt(0).toUpperCase() + t.slice(1),
      })),
    [],
  );

  const archetypeOptions = useMemo(
    () =>
      ITEM_ARCHETYPES.map((a) => ({
        value: a,
        label: a.charAt(0).toUpperCase() + a.slice(1),
      })),
    [],
  );

  const isAccessory = item?.slot ? ACCESSORY_SLOTS.has(item.slot) : false;

  const derivation = useMemo(() => {
    if (!item) return null;
    // Accessory slots are locked to the "stat" archetype, so the picker
    // never writes one. Treat them as `stat` here so the budget readout
    // still shows up — authors get a starting point even when they can't
    // change the archetype.
    const effectiveArchetype: ItemArchetype | undefined = isAccessory
      ? "stat"
      : (item.archetype as ItemArchetype | undefined);
    if (item.level == null || !item.tier || !effectiveArchetype || !item.slot) return null;
    return deriveItemStats({
      slot: item.slot,
      tier: item.tier as ItemTier,
      archetype: effectiveArchetype,
      primaryStat: item.primaryStat,
      secondaryStat: item.secondaryStat,
      tertiaryStat: item.tertiaryStat,
      disableTertiary: item.disableTertiary,
    });
  }, [item, isAccessory]);

  const stats = item.stats ?? {};

  const renderOverrideLabel = (
    label: string,
    authored: number | undefined,
    derived: number | undefined,
  ) => {
    if (derived == null) return <>{label}</>;
    const isOverride = authored != null && authored !== derived;
    if (!isOverride) return <>{label}</>;
    return (
      <span className="flex items-center gap-1">
        {label}
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-accent"
          title={`Overridden (derived: ${derived})`}
        />
        <button
          type="button"
          onClick={() => patch({ [label.toLowerCase()]: derived } as Partial<ItemFile>)}
          className="text-2xs text-text-muted hover:text-accent"
          title="Reset to derived value"
        >
          reset
        </button>
      </span>
    );
  };
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
      const hasEffect = (next.healHp ?? 0) > 0 || (next.healMana ?? 0) > 0 || (next.grantXp ?? 0) > 0;
      patch({ onUse: hasEffect ? next : undefined });
    },
    [onUse, patch],
  );

  const [justApplied, setJustApplied] = useState(false);
  const handleApplyDerivation = useCallback(() => {
    if (!derivation) return;
    const update: Partial<ItemFile> = {
      damage: derivation.damage > 0 ? derivation.damage : undefined,
      armor: derivation.armor > 0 ? derivation.armor : undefined,
      stats: Object.keys(derivation.stats).length > 0 ? derivation.stats : undefined,
    };
    // Backfill the archetype on accessories so the item carries its bucket
    // explicitly. Non-accessory items already have a user-picked archetype —
    // don't clobber it.
    if (isAccessory) update.archetype = "stat";
    patch(update);
    setJustApplied(true);
    setTimeout(() => setJustApplied(false), 1500);
  }, [derivation, isAccessory, patch]);

  return (
    <>
      <EntityHeader type="Item">
        <FieldRow label="Display Name">
          <ReferenceMentionField
            value={item.displayName}
            onCommit={(v) => patch({ displayName: v })}
            ariaLabel="item display name"
            placeholder="Display name — type @ to reference a canonical subject"
          />
        </FieldRow>
        <FieldRow label="Description">
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <ReferenceMentionField
                value={item.description ?? ""}
                onCommit={(v) => patch({ description: v || undefined })}
                placeholder="None — type @ to reference a canonical subject"
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
        {item.room && (
          <FieldRow
            label="Respawn (s)"
            hint="Seconds to respawn this ground item after it's looted. Blank = only repops on the full zone reset."
          >
            <NumberInput
              value={item.respawnSeconds}
              onCommit={(v) => patch({ respawnSeconds: v })}
              placeholder="Default"
              min={0}
            />
          </FieldRow>
        )}
      </EntityHeader>

      <TabBar tabs={ITEM_TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === "item" && (
        <>
          <Section title="Power">
            <p className="mb-1 text-2xs text-text-muted">
              Set slot, level, rarity, and role. The calculator suggests damage, armor, and stat bonuses below — click <strong>Apply</strong> to write them onto the item. Override dropdowns left blank produce adaptive stats (PRIMARY/SECONDARY/TERTIARY) that resolve per class at equip time.
            </p>
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
                <CompactField label="Level">
                  <NumberInput
                    value={item.level}
                    onCommit={(v) => patch({ level: v })}
                    placeholder="—"
                    min={1}
                    max={30}
                    dense
                  />
                </CompactField>
                <CompactField label="Tier">
                  <SelectInput
                    value={item.tier ?? ""}
                    options={tierOptions}
                    onCommit={(v) => patch({ tier: (v || undefined) as ItemFile["tier"] })}
                    allowEmpty
                    placeholder="—"
                    dense
                  />
                </CompactField>
                <CompactField label="Archetype" span>
                  <SelectInput
                    value={isAccessory ? "stat" : (item.archetype ?? "")}
                    options={archetypeOptions}
                    onCommit={(v) => patch({ archetype: (v || undefined) as ItemFile["archetype"] })}
                    allowEmpty
                    placeholder={isAccessory ? "stat (accessory)" : "—"}
                    disabled={isAccessory}
                    dense
                  />
                </CompactField>
                <CompactField label="Primary Override">
                  <SelectInput
                    value={item.primaryStat ?? ""}
                    options={statOptions}
                    onCommit={(v) => patch({ primaryStat: v || undefined })}
                    allowEmpty
                    placeholder="PRIMARY (adaptive)"
                    dense
                  />
                </CompactField>
                <CompactField label="Secondary Override">
                  <SelectInput
                    value={item.secondaryStat ?? ""}
                    options={statOptions}
                    onCommit={(v) => patch({ secondaryStat: v || undefined })}
                    allowEmpty
                    placeholder="SECONDARY (adaptive)"
                    dense
                  />
                </CompactField>
                <CompactField label="Tertiary Override" span>
                  <SelectInput
                    value={item.disableTertiary ? "__none__" : (item.tertiaryStat ?? "")}
                    options={[
                      { value: "__none__", label: "— skip tertiary (60/40 split) —" },
                      ...statOptions,
                    ]}
                    onCommit={(v) => {
                      if (v === "__none__") {
                        patch({ tertiaryStat: undefined, disableTertiary: true });
                      } else {
                        patch({ tertiaryStat: v || undefined, disableTertiary: undefined });
                      }
                    }}
                    allowEmpty
                    placeholder="TERTIARY (adaptive)"
                    dense
                  />
                </CompactField>
              </FieldGrid>
              {derivation && (
                <div className="rounded border border-border-default bg-bg-tertiary px-2 py-1.5 text-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-text-primary">
                      Budget: {Math.round(derivation.budget.totalBudget)} pts
                    </span>
                    <div className="flex items-center gap-2">
                      {justApplied && (
                        <span className="text-2xs text-status-success">Applied ✓</span>
                      )}
                      <button
                        type="button"
                        onClick={handleApplyDerivation}
                        className="rounded border border-accent/40 bg-accent/10 px-2 py-0.5 text-2xs font-medium text-accent transition-colors hover:bg-accent/20"
                        title="Overwrites Damage, Armor, and Stat Bonuses with the values shown below."
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-text-muted">
                    {derivation.damage > 0 && (
                      <span>
                        <span className="text-text-primary">+{derivation.damage}</span> damage
                      </span>
                    )}
                    {derivation.armor > 0 && (
                      <span>
                        <span className="text-text-primary">+{derivation.armor}</span> armor
                      </span>
                    )}
                    {Object.entries(derivation.stats).map(([id, v]) => (
                      <span key={id}>
                        <span className="text-text-primary">+{v}</span> {id}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {!derivation && (item.slot || item.level != null || item.tier || item.archetype) && (
                <div className="rounded border border-dashed border-border-default bg-bg-tertiary px-2 py-1 text-2xs text-text-muted">
                  {isAccessory
                    ? "Set slot, level, and tier to enable the calculator. Accessories are locked to the stat archetype."
                    : "Set slot, level, tier, and archetype to enable the calculator."}
                </div>
              )}
            </div>
          </Section>

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
              <FieldRow
                label="Item Type"
                hint={
                  item.itemType === "keepsake"
                    ? "Keepsakes are soulbound souvenirs — locked like a quest item, but shelved under their own Keepsakes heading in the inventory."
                    : item.itemType === "mount"
                      ? "Mounts sold in shops never enter the inventory — buying one permanently unlocks its sprite and map fast travel."
                      : undefined
                }
              >
                <SelectInput
                  value={item.itemType ?? ""}
                  options={itemTypeOptions}
                  onCommit={(v) => {
                    const next = (v || undefined) as ItemType | undefined;
                    // Mount fields are only valid on mount items; the server refuses them elsewhere.
                    patch(next === "mount"
                      ? { itemType: next }
                      : { itemType: next, mountId: undefined, mountSpeed: undefined, flying: undefined });
                  }}
                  allowEmpty
                  placeholder="— auto —"
                />
              </FieldRow>
              {item.itemType === "mount" && (
                <>
                  <FieldRow
                    label="Mount ID"
                    hint="Must match the {type: mount, mountId} requirement on a mount sprite (Player Sprites manager). Required for mount items."
                  >
                    <TextInput
                      value={item.mountId ?? ""}
                      onCommit={(v) => patch({ mountId: v.trim() || undefined })}
                      placeholder="e.g. dappled_pony"
                    />
                  </FieldRow>
                  <FieldRow
                    label="Ride Speed"
                    hint="Speed multiplier over the base travel pace — 2.0 rides twice as fast. Leave blank for the server default of 1.0. Every item selling this mount must agree."
                  >
                    <NumberInput
                      value={item.mountSpeed}
                      onCommit={(v) => patch({ mountSpeed: v })}
                      placeholder="1.0"
                      min={0.1}
                      max={10}
                      step={0.1}
                    />
                  </FieldRow>
                  <FieldRow label="Flying">
                    <CheckboxInput
                      checked={item.flying ?? false}
                      onCommit={(v) => patch({ flying: v || undefined })}
                      label="Can fly — carries the rider to explored rooms in any zone via the World Map"
                    />
                  </FieldRow>
                </>
              )}
              <FieldRow label="Quest Item">
                <CheckboxInput
                  checked={item.questItem ?? false}
                  onCommit={(v) => patch({ questItem: v || undefined })}
                  label="Soulbound — cannot be dropped, sold, traded, or given"
                />
              </FieldRow>
              <FieldRow label="Takeable">
                <CheckboxInput
                  checked={item.takeable !== false}
                  onCommit={(v) => patch({ takeable: v ? undefined : false })}
                  label="Players can pick this up (uncheck for fixed scenery / flavor)"
                />
              </FieldRow>
              <FieldRow label="Consumable">
                <CheckboxInput
                  checked={item.consumable ?? false}
                  onCommit={(v) => patch({ consumable: v || undefined })}
                  label="Used up on use (potion, scroll, food)"
                />
              </FieldRow>
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
                  <CompactField label="Heal Mana">
                    <NumberInput
                      value={onUse.healMana}
                      onCommit={(v) => handleOnUseChange("healMana", v)}
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

          <Section title="Properties">
            <p className="mb-1 text-2xs text-text-muted">
              The actual numbers the server reads. Use Power's Apply button to populate from the calculator, or edit directly to author by hand.
            </p>
            <div className="flex flex-col gap-1.5">
              <FieldGrid cols={2}>
                <CompactField label={renderOverrideLabel("Damage", item.damage, derivation?.damage)}>
                  <NumberInput
                    value={item.damage}
                    onCommit={(v) => patch({ damage: v })}
                    placeholder={derivation ? String(derivation.damage) : "0"}
                    min={0}
                    dense
                  />
                </CompactField>
                <CompactField label={renderOverrideLabel("Armor", item.armor, derivation?.armor)}>
                  <NumberInput
                    value={item.armor}
                    onCommit={(v) => patch({ armor: v })}
                    placeholder={derivation ? String(derivation.armor) : "0"}
                    min={0}
                    dense
                  />
                </CompactField>
              </FieldGrid>
            </div>
          </Section>

          <Section title="Stat Bonuses">
            <p className="mb-1 text-2xs text-text-muted">
              {derivation
                ? "Derived from Power settings. Edit a value to override; clear to restore the derived default."
                : "Only non-zero values are saved."}
            </p>
            <div className="flex flex-col gap-1">
              {(() => {
                const derivedStats = derivation?.stats ?? {};
                const allStatIds = new Set<string>([
                  ...Object.keys(derivedStats),
                  ...Object.keys(stats),
                ]);
                return Array.from(allStatIds).map((statId) => {
                  const authored = stats[statId];
                  const derived = derivedStats[statId];
                  const isOverride = authored != null && derived != null && authored !== derived;
                  return (
                    <div key={statId} className="flex items-center gap-1">
                      <span className="flex w-20 shrink-0 items-center gap-1 text-xs font-medium text-text-primary">
                        {statId}
                        {isOverride && (
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full bg-accent"
                            title={`Overridden (derived: ${derived})`}
                          />
                        )}
                      </span>
                      <NumberInput
                        value={authored}
                        onCommit={(v) => handleStatChange(statId, v)}
                        placeholder={derived != null ? String(derived) : "0"}
                      />
                      {isOverride && derived != null && (
                        <button
                          type="button"
                          onClick={() => handleStatChange(statId, derived)}
                          className="text-2xs text-text-muted hover:text-accent"
                          title="Reset to derived value"
                        >
                          reset
                        </button>
                      )}
                    </div>
                  );
                });
              })()}
              <AddStatRow
                existingStats={Object.keys(stats)}
                statOptions={statOptions}
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
          videoText={item.videoText}
          onVideoTextChange={(v) => patch({ videoText: v })}
          videoTextSeconds={item.videoTextSeconds}
          onVideoTextSecondsChange={(v) => patch({ videoTextSeconds: v })}
          getPrompt={(style) => itemPrompt(itemId, item, style, zoneId ? useVibeStore.getState().getVibe(zoneId) : undefined)}
          entityContext={itemContext(itemId, item)}
          assetType="entity_portrait"
          context={zoneId ? { zone: zoneId, entity_type: "item", entity_id: itemId } : undefined}
          vibe={zoneId ? useVibeStore.getState().getVibe(zoneId) : undefined}
        />
      )}

      {onDuplicate ? (
        <EntityActionsFooter
          onDuplicate={onDuplicate}
          onDelete={handleDelete}
          duplicateLabel="Duplicate Item"
          deleteLabel="Delete Item"
        />
      ) : (
        <DeleteEntityButton onClick={handleDelete} label="Delete Item" />
      )}
    </>
  );
}

const AddStatRow = memo(function AddStatRow({
  existingStats,
  statOptions,
  onAdd,
}: {
  existingStats: string[];
  statOptions: { value: string; label: string }[];
  onAdd: (statId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const existingSet = useMemo(() => new Set(existingStats), [existingStats]);
  const archetypalAvailable = useMemo(
    () => ARCHETYPAL_STATS.filter((s) => !existingSet.has(s)),
    [existingSet],
  );
  const concreteAvailable = useMemo(
    () => statOptions.filter((o) => !existingSet.has(o.value)),
    [statOptions, existingSet],
  );
  const hasOptions = archetypalAvailable.length > 0 || concreteAvailable.length > 0;

  if (editing) {
    return (
      <div className="mt-1 flex items-center gap-1">
        <select
          autoFocus
          defaultValue=""
          onChange={(e) => {
            const id = e.target.value;
            if (id) onAdd(id);
            setEditing(false);
          }}
          onBlur={() => setEditing(false)}
          className="h-6 flex-1 rounded border border-border-default bg-bg-primary px-1.5 text-2xs text-text-primary outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-border-active"
        >
          <option value="" disabled>
            Pick a stat…
          </option>
          {archetypalAvailable.length > 0 && (
            <optgroup label="Adaptive (resolves per class)">
              {archetypalAvailable.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </optgroup>
          )}
          {concreteAvailable.length > 0 && (
            <optgroup label="Concrete">
              {concreteAvailable.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-2xs text-text-muted hover:text-text-primary"
        >
          &times;
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      disabled={!hasOptions}
      className="mt-1 rounded border border-border-default px-2 py-0.5 text-2xs text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-text-muted"
    >
      + Add Stat Bonus
    </button>
  );
});
