import { writeTextFile } from "@tauri-apps/plugin-fs";
import { stringify } from "yaml";
import { normalizeWorldAssetRefs } from "@/lib/assetRefs";
import { sanitizeZone } from "@/lib/sanitizeZone";
import { validateZone } from "@/lib/validateZone";
import { useConfigStore } from "@/stores/configStore";
import { useZoneStore } from "@/stores/zoneStore";
import { YAML_OPTS } from "@/lib/yamlOpts";

/**
 * Serialize a zone's data to YAML without writing to disk.
 * Sanitizes the data first so Arcanum never writes invalid YAML.
 */
export function serializeZone(zoneId: string): string {
  const zone = useZoneStore.getState().zones.get(zoneId);
  if (!zone) throw new Error(`Zone "${zoneId}" not found`);
  const sanitized = normalizeWorldAssetRefs(sanitizeZone(zone.data));
  const config = useConfigStore.getState().config;
  const validClasses = config ? new Set(Object.keys(config.classes).map((id) => id.toUpperCase())) : undefined;
  const knownFactions = config?.factions?.definitions
    ? new Set(Object.keys(config.factions.definitions))
    : undefined;
  const knownAchievements = config?.achievementDefs
    ? new Set(Object.keys(config.achievementDefs))
    : undefined;
  const issues = validateZone(
    sanitized,
    config?.equipmentSlots,
    validClasses,
    knownFactions,
    knownAchievements,
    config?.mobTiers,
    config?.progression.quests,
  );
  const errors = issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    const summary = errors.slice(0, 5).map((issue) => `${issue.entity}: ${issue.message}`).join("; ");
    throw new Error(`Zone validation failed: ${summary}`);
  }
  return stringify(sanitized, YAML_OPTS);
}

/**
 * Save a single zone to its YAML file.
 * Uses yaml stringify for clean output.
 */
export async function saveZone(zoneId: string): Promise<void> {
  const state = useZoneStore.getState();
  const zone = state.zones.get(zoneId);
  if (!zone) throw new Error(`Zone "${zoneId}" not found`);

  const yaml = serializeZone(zoneId);
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
