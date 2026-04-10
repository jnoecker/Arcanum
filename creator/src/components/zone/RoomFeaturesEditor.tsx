import { useCallback, useMemo, useState } from "react";
import type { FeatureFile, WorldFile } from "@/types/world";
import {
  CONTAINER_STATES,
  FEATURE_TYPES,
  LEVER_STATES,
  addFeature,
  defaultFeature,
  generateFeatureId,
  removeFeature,
  renameFeature,
  reorderFeatures,
  updateFeature,
  type FeatureType,
} from "@/lib/zoneEdits";
import {
  ActionButton,
  CheckboxInput,
  CommitTextarea,
  FieldRow,
  SelectInput,
  TextInput,
} from "@/components/ui/FormWidgets";
import { FEATURE_ICONS } from "@/assets/ui";

interface RoomFeaturesEditorProps {
  world: WorldFile;
  roomId: string;
  onWorldChange: (world: WorldFile) => void;
}

/**
 * Editor for the per-room `features:` map. Manages CONTAINER, LEVER, and
 * SIGN features with add / remove / reorder. The local feature key (map
 * key) is rendered as a first-class editable field because it's what
 * puzzle sequence steps reference via `steps[].feature`.
 */
export function RoomFeaturesEditor({ world, roomId, onWorldChange }: RoomFeaturesEditorProps) {
  const room = world.rooms[roomId];
  const features = useMemo(
    () => Object.entries(room?.features ?? {}),
    [room?.features],
  );

  const handleAdd = useCallback(
    (type: FeatureType) => {
      const id = generateFeatureId(world, roomId, type);
      onWorldChange(addFeature(world, roomId, id, defaultFeature(type, id)));
    },
    [world, roomId, onWorldChange],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {FEATURE_TYPES.map((t) => (
          <ActionButton key={t} size="sm" variant="secondary" onClick={() => handleAdd(t)}>
            <span className="inline-flex items-center gap-1">
              {FEATURE_ICONS[t.toLowerCase()] && (
                <img src={FEATURE_ICONS[t.toLowerCase()]} alt="" className="h-3 w-3" />
              )}
              + {labelForType(t)}
            </span>
          </ActionButton>
        ))}
      </div>
      {features.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-2 text-center text-xs italic text-text-muted">
          No features in this room
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {features.map(([id, feature], index) => (
            <li key={id}>
              <FeatureRow
                world={world}
                roomId={roomId}
                featureId={id}
                feature={feature}
                index={index}
                total={features.length}
                onWorldChange={onWorldChange}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function labelForType(type: FeatureType): string {
  if (type === "CONTAINER") return "Container";
  if (type === "LEVER") return "Lever";
  return "Sign";
}

interface FeatureRowProps {
  world: WorldFile;
  roomId: string;
  featureId: string;
  feature: FeatureFile;
  index: number;
  total: number;
  onWorldChange: (world: WorldFile) => void;
}

function FeatureRow({
  world,
  roomId,
  featureId,
  feature,
  index,
  total,
  onWorldChange,
}: FeatureRowProps) {
  const [idError, setIdError] = useState<string | null>(null);
  const type = feature.type.trim().toUpperCase() as FeatureType;

  const patch = useCallback(
    (p: Partial<FeatureFile>) => {
      onWorldChange(updateFeature(world, roomId, featureId, p));
    },
    [world, roomId, featureId, onWorldChange],
  );

  const handleRename = useCallback(
    (nextId: string) => {
      const trimmed = nextId.trim();
      if (!trimmed || trimmed === featureId) {
        setIdError(null);
        return;
      }
      try {
        onWorldChange(renameFeature(world, roomId, featureId, trimmed));
        setIdError(null);
      } catch (err) {
        setIdError(err instanceof Error ? err.message : "Rename failed");
      }
    },
    [world, roomId, featureId, onWorldChange],
  );

  const handleDelete = useCallback(() => {
    onWorldChange(removeFeature(world, roomId, featureId));
  }, [world, roomId, featureId, onWorldChange]);

  const move = useCallback(
    (delta: number) => {
      const currentIds = Object.keys(world.rooms[roomId]?.features ?? {});
      const newIndex = index + delta;
      if (newIndex < 0 || newIndex >= currentIds.length) return;
      const next = [...currentIds];
      const [moved] = next.splice(index, 1);
      next.splice(newIndex, 0, moved!);
      onWorldChange(reorderFeatures(world, roomId, next));
    },
    [world, roomId, index, onWorldChange],
  );

  return (
    <div className="rounded border border-border-muted bg-bg-tertiary/40 p-2">
      <div className="flex items-center gap-1.5">
        <span className="flex items-center gap-1 rounded bg-bg-elevated px-1.5 py-0.5 font-display text-2xs uppercase tracking-wider text-accent">
          {FEATURE_ICONS[type.toLowerCase()] && (
            <img src={FEATURE_ICONS[type.toLowerCase()]} alt="" className="h-3.5 w-3.5" />
          )}
          {labelForType(type)}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={index === 0}
          className="focus-ring rounded px-1 text-2xs text-text-muted hover:bg-bg-elevated hover:text-text-primary disabled:opacity-30"
          title="Move up"
          aria-label="Move up"
        >
          &#x25B2;
        </button>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={index === total - 1}
          className="focus-ring rounded px-1 text-2xs text-text-muted hover:bg-bg-elevated hover:text-text-primary disabled:opacity-30"
          title="Move down"
          aria-label="Move down"
        >
          &#x25BC;
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="focus-ring rounded px-1 text-2xs text-text-muted hover:bg-status-danger/10 hover:text-status-danger"
          title="Delete feature"
          aria-label="Delete feature"
        >
          &times;
        </button>
      </div>

      <div className="mt-2 flex flex-col gap-1">
        <FieldRow
          label="Feature ID"
          hint="Local YAML key. Referenced by puzzle sequence steps — keep it stable."
        >
          <TextInput
            value={featureId}
            onCommit={handleRename}
            placeholder="e.g. vault_lever"
            dense
          />
        </FieldRow>
        {idError && <p className="text-2xs text-status-danger">{idError}</p>}

        <FieldRow label="Display name">
          <TextInput
            value={feature.displayName ?? ""}
            onCommit={(v) => patch({ displayName: v })}
            placeholder="e.g. a heavy iron lever"
            dense
          />
        </FieldRow>

        <FieldRow label="Keyword" hint="Command target — `pull lever`, `open chest`.">
          <TextInput
            value={feature.keyword ?? ""}
            onCommit={(v) => patch({ keyword: v })}
            placeholder="e.g. lever"
            dense
          />
        </FieldRow>

        {type === "CONTAINER" && (
          <ContainerFields world={world} feature={feature} onPatch={patch} />
        )}
        {type === "LEVER" && <LeverFields feature={feature} onPatch={patch} />}
        {type === "SIGN" && <SignFields feature={feature} onPatch={patch} />}
      </div>
    </div>
  );
}

interface ContainerFieldsProps {
  world: WorldFile;
  feature: FeatureFile;
  onPatch: (p: Partial<FeatureFile>) => void;
}

function ContainerFields({ world, feature, onPatch }: ContainerFieldsProps) {
  const itemOptions = useMemo(
    () =>
      Object.entries(world.items ?? {}).map(([id, item]) => ({
        value: id,
        label: item.displayName ? `${item.displayName} (${id})` : id,
      })),
    [world.items],
  );

  const items = feature.items ?? [];

  const handleAddItem = useCallback(() => {
    const firstItem = Object.keys(world.items ?? {})[0];
    if (!firstItem) return;
    onPatch({ items: [...items, firstItem] });
  }, [world.items, items, onPatch]);

  const handleUpdateItem = useCallback(
    (index: number, newId: string) => {
      const next = [...items];
      next[index] = newId;
      onPatch({ items: next });
    },
    [items, onPatch],
  );

  const handleRemoveItem = useCallback(
    (index: number) => {
      const next = items.filter((_, i) => i !== index);
      onPatch({ items: next });
    },
    [items, onPatch],
  );

  return (
    <>
      <FieldRow label="State">
        <SelectInput
          value={(feature.initialState ?? "closed").toLowerCase()}
          onCommit={(v) => onPatch({ initialState: v || undefined })}
          options={CONTAINER_STATES.map((s) => ({ value: s, label: s }))}
          dense
        />
      </FieldRow>
      <FieldRow label="Key item">
        <SelectInput
          value={feature.keyItemId ?? ""}
          onCommit={(v) => onPatch({ keyItemId: v || undefined })}
          options={itemOptions}
          placeholder="— none —"
          dense
          allowEmpty
        />
      </FieldRow>
      <CheckboxInput
        checked={!!feature.keyConsumed}
        onCommit={(v) => onPatch({ keyConsumed: v || undefined })}
        label="Consume key on unlock"
      />
      <CheckboxInput
        checked={feature.resetWithZone !== false}
        onCommit={(v) => onPatch({ resetWithZone: v ? undefined : false })}
        label="Reset with zone"
      />
      <div className="mt-1">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-display text-2xs uppercase tracking-widest text-text-muted">
            Initial contents
          </span>
          <button
            type="button"
            onClick={handleAddItem}
            disabled={itemOptions.length === 0}
            className="focus-ring rounded px-1.5 py-0.5 text-2xs text-text-muted hover:bg-bg-elevated hover:text-text-primary disabled:opacity-40"
            title={itemOptions.length === 0 ? "Define an item first" : "Add item"}
          >
            + Item
          </button>
        </div>
        {items.length === 0 ? (
          <p className="text-2xs italic text-text-muted">Empty</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {items.map((itemId, index) => (
              <li key={`${itemId}-${index}`} className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <SelectInput
                    value={itemId}
                    onCommit={(v) => handleUpdateItem(index, v)}
                    options={itemOptions}
                    dense
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  className="focus-ring rounded px-1 text-2xs text-text-muted hover:text-status-danger"
                  title="Remove item"
                  aria-label="Remove item"
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function LeverFields({
  feature,
  onPatch,
}: {
  feature: FeatureFile;
  onPatch: (p: Partial<FeatureFile>) => void;
}) {
  return (
    <>
      <FieldRow label="State">
        <SelectInput
          value={(feature.initialState ?? "up").toLowerCase()}
          onCommit={(v) => onPatch({ initialState: v || undefined })}
          options={LEVER_STATES.map((s) => ({ value: s, label: s }))}
          dense
        />
      </FieldRow>
      <CheckboxInput
        checked={feature.resetWithZone !== false}
        onCommit={(v) => onPatch({ resetWithZone: v ? undefined : false })}
        label="Reset with zone"
      />
    </>
  );
}

function SignFields({
  feature,
  onPatch,
}: {
  feature: FeatureFile;
  onPatch: (p: Partial<FeatureFile>) => void;
}) {
  return (
    <CommitTextarea
      label="Sign text"
      value={feature.text ?? ""}
      onCommit={(v) => onPatch({ text: v })}
      placeholder="The engraved words players read when they examine this sign."
      rows={3}
    />
  );
}
