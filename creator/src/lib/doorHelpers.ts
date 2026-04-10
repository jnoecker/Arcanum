import type { DoorFile } from "@/types/world";

/** Resolve the key item ID from either the new or legacy field. */
export function resolveDoorKeyId(door?: DoorFile): string | undefined {
  return door?.keyItemId ?? door?.key;
}

/** Resolve the initial door state, falling back to legacy boolean fields. */
export function resolveDoorState(door?: DoorFile): string | undefined {
  return door?.initialState ?? (door?.locked ? "locked" : door?.closed ? "closed" : undefined);
}
