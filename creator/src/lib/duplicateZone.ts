import type { WorldFile } from "@/types/world";

/**
 * Pure: return a deep clone of `world` with its `zone` label replaced.
 *
 * Room/mob/item IDs survive unchanged — they're scoped to the zone file, so
 * the new zone can freely reuse them. Cross-zone exits are preserved as-is;
 * callers that want those rewritten should do it separately.
 */
export function duplicateZone(world: WorldFile, newZoneName: string): WorldFile {
  const clone = structuredClone(world);
  clone.zone = newZoneName;
  return clone;
}
