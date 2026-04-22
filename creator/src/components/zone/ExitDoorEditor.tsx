import { useCallback, useMemo } from "react";
import type { DoorFile, WorldFile } from "@/types/world";
import {
  DOOR_INITIAL_STATES,
  removeExitDoor,
  setExitAchievementGate,
  setExitDoor,
} from "@/lib/zoneEdits";
import { CheckboxInput, SelectInput, TextInput } from "@/components/ui/FormWidgets";
import { useConfigStore } from "@/stores/configStore";

interface ExitDoorEditorProps {
  world: WorldFile;
  roomId: string;
  direction: string;
  door: DoorFile | undefined;
  requiresAchievement?: string;
  lockedMessage?: string;
  onWorldChange: (world: WorldFile) => void;
}

/**
 * Expandable inline editor for a single exit's optional door and achievement
 * gate. Displayed alongside the exit row inside RoomPanel.
 */
export function ExitDoorEditor({
  world,
  roomId,
  direction,
  door,
  requiresAchievement = "",
  lockedMessage = "",
  onWorldChange,
}: ExitDoorEditorProps) {
  const hasDoor = !!door;
  const initialState = (door?.initialState ?? "").toLowerCase();

  const hasGate = !!requiresAchievement;

  const achievementDefs = useConfigStore((s) => s.config?.achievementDefs);

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

  const achievementOptions = useMemo(
    () =>
      Object.entries(achievementDefs ?? {}).map(([id, def]) => ({
        value: id,
        label: def?.displayName ? `${def.displayName} (${id})` : id,
      })),
    [achievementDefs],
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

  const patchDoor = useCallback(
    (p: Partial<DoorFile>) => {
      onWorldChange(setExitDoor(world, roomId, direction, p));
    },
    [world, roomId, direction, onWorldChange],
  );

  const handleGateToggle = useCallback(
    (checked: boolean) => {
      if (checked) {
        onWorldChange(
          setExitAchievementGate(world, roomId, direction, {
            requiresAchievement: requiresAchievement || "",
            lockedMessage: lockedMessage || undefined,
          }),
        );
      } else {
        onWorldChange(
          setExitAchievementGate(world, roomId, direction, {
            requiresAchievement: "",
            lockedMessage: "",
          }),
        );
      }
    },
    [world, roomId, direction, onWorldChange, requiresAchievement, lockedMessage],
  );

  const patchGate = useCallback(
    (p: { requiresAchievement?: string; lockedMessage?: string }) => {
      onWorldChange(setExitAchievementGate(world, roomId, direction, p));
    },
    [world, roomId, direction, onWorldChange],
  );

  const unknownAchievement =
    hasGate && achievementDefs !== undefined && !(requiresAchievement in (achievementDefs ?? {}));

  return (
    <div className="mt-1 flex flex-col gap-2 rounded border border-border-muted bg-bg-tertiary/40 px-2 py-1.5">
      <div>
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
                onCommit={(v) => patchDoor({ initialState: v || undefined })}
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
                onCommit={(v) => patchDoor({ keyItemId: v || undefined })}
                options={itemOptions}
                placeholder="— none —"
                dense
                allowEmpty
              />
            </div>
            <CheckboxInput
              checked={!!door?.keyConsumed}
              onCommit={(v) => patchDoor({ keyConsumed: v || undefined })}
              label="Consume key on unlock"
            />
            <CheckboxInput
              checked={door?.resetWithZone !== false}
              onCommit={(v) => patchDoor({ resetWithZone: v ? undefined : false })}
              label="Reset with zone"
            />
          </div>
        )}
      </div>

      <div className="border-t border-border-muted/50 pt-2">
        <CheckboxInput
          checked={hasGate}
          onCommit={handleGateToggle}
          label="Achievement gate"
        />
        {hasGate && (
          <div className="mt-1.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-2xs">
              <span className="w-20 shrink-0 text-text-muted">Requires</span>
              <SelectInput
                value={requiresAchievement}
                onCommit={(v) => patchGate({ requiresAchievement: v })}
                options={achievementOptions}
                placeholder="— pick achievement —"
                dense
                allowEmpty
              />
            </div>
            {unknownAchievement && (
              <div className="text-2xs text-status-warning">
                Achievement "{requiresAchievement}" is not defined in config.
              </div>
            )}
            <div className="flex items-start gap-1.5 text-2xs">
              <span className="mt-2 w-20 shrink-0 text-text-muted">Message</span>
              <TextInput
                value={lockedMessage}
                onCommit={(v) => patchGate({ lockedMessage: v })}
                placeholder="Shown when the player lacks the achievement."
                dense
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
