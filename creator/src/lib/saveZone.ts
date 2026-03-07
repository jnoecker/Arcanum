import { writeTextFile } from "@tauri-apps/plugin-fs";
import { stringify } from "yaml";
import { useZoneStore } from "@/stores/zoneStore";

/**
 * Save a single zone to its YAML file.
 * Uses yaml stringify for clean output.
 */
export async function saveZone(zoneId: string): Promise<void> {
  const state = useZoneStore.getState();
  const zone = state.zones.get(zoneId);
  if (!zone) throw new Error(`Zone "${zoneId}" not found`);

  const yaml = stringify(zone.data, {
    lineWidth: 120,
    defaultKeyType: "PLAIN",
    defaultStringType: "PLAIN",
  });

  await writeTextFile(zone.filePath, yaml);
  state.markClean(zoneId);
}

/**
 * Save all dirty zones.
 * Returns the list of zone IDs that were saved.
 */
export async function saveAllZones(): Promise<string[]> {
  const state = useZoneStore.getState();
  const saved: string[] = [];

  for (const [zoneId, zone] of state.zones) {
    if (zone.dirty) {
      await saveZone(zoneId);
      saved.push(zoneId);
    }
  }

  return saved;
}
