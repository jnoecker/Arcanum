import { useCallback, useMemo } from "react";
import type { DoorFile, WorldFile } from "@/types/world";
import { DOOR_INITIAL_STATES, removeExitDoor, setExitDoor } from "@/lib/zoneEdits";
import { CheckboxInput, SelectInput } from "@/components/ui/FormWidgets";

interface ExitDoorEditorProps {
  world: WorldFile;
  roomId: string;
  direction: string;
  door: DoorFile | undefined;
  onWorldChange: (world: WorldFile) => void;
}

/**
 * Expandable inline editor for a single exit's optional door. Shows a
 * "Has door" toggle that reveals initialState / keyItemId / keyConsumed /
 * resetWithZone fields. Displays alongside the exit row inside RoomPanel.
 */
export function ExitDoorEditor({
  world,
  roomId,
  direction,
  door,
  onWorldChange,
}: ExitDoorEditorProps) {
  const hasDoor = !!door;
  const initialState = (door?.initialState ?? "").toLowerCase();

  const itemOptions = useMemo(
    () =>
      Object.entries(world.items ?? {}).map(([id, item]) => ({
        value: id,
        label: item.displayName ? `${item.displayName} (${id})` : id,
      })),
    [world.items],
  );

  const stateOptions = useMemo(
    () => DOOR_INITIAL_STATES.map((s) => ({ value: s, label: s })),
    [],
  );

  const handleToggle = useCallback(
    (checked: boolean) => {
      if (checked) {
        onWorldChange(setExitDoor(world, roomId, direction, { initialState: "closed" }));
      } else {
        onWorldChange(removeExitDoor(world, roomId, direction));
      }
    },
    [world, roomId, direction, onWorldChange],
  );

  const patch = useCallback(
    (p: Partial<DoorFile>) => {
      onWorldChange(setExitDoor(world, roomId, direction, p));
    },
    [world, roomId, direction, onWorldChange],
  );

  return (
    <div className="mt-1 rounded border border-border-muted bg-bg-tertiary/40 px-2 py-1.5">
      <CheckboxInput
        checked={hasDoor}
        onCommit={handleToggle}
        label={`${direction.toUpperCase()} has door`}
      />
      {hasDoor && (
        <div className="mt-1.5 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-2xs">
            <span className="w-20 shrink-0 text-text-muted">State</span>
            <SelectInput
              value={initialState}
              onCommit={(v) => patch({ initialState: v || undefined })}
              options={stateOptions}
              placeholder="closed"
              dense
              allowEmpty
            />
          </div>
          <div className="flex items-center gap-1.5 text-2xs">
            <span className="w-20 shrink-0 text-text-muted">Key item</span>
            <SelectInput
              value={door?.keyItemId ?? ""}
              onCommit={(v) => patch({ keyItemId: v || undefined })}
              options={itemOptions}
              placeholder="— none —"
              dense
              allowEmpty
            />
          </div>
          <CheckboxInput
            checked={!!door?.keyConsumed}
            onCommit={(v) => patch({ keyConsumed: v || undefined })}
            label="Consume key on unlock"
          />
          <CheckboxInput
            checked={door?.resetWithZone !== false}
            onCommit={(v) => patch({ resetWithZone: v ? undefined : false })}
            label="Reset with zone"
          />
        </div>
      )}
    </div>
  );
}
