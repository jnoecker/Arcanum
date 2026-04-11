import { useProjectStore } from "@/stores/projectStore";
import { useConfigStore } from "@/stores/configStore";
import { useZoneStore, selectDirtyCount } from "@/stores/zoneStore";
import { saveAllZones } from "@/lib/saveZone";
import { saveProjectConfig } from "@/lib/saveConfig";

export interface SaveAllResult {
  savedZones: string[];
  savedConfig: boolean;
}

/**
 * Save every dirty zone and, if the config is dirty, the project config.
 * Shared by the Ctrl+S handler and the floating save pill so they stay in
 * lockstep.
 */
export async function saveEverything(): Promise<SaveAllResult> {
  const savedZones = await saveAllZones();

  let savedConfig = false;
  const project = useProjectStore.getState().project;
  if (project && useConfigStore.getState().dirty) {
    await saveProjectConfig(project);
    savedConfig = true;
  }

  return { savedZones, savedConfig };
}

/** Count of unsaved items across zones and config. */
export function countUnsaved(): number {
  const dirtyZones = selectDirtyCount(useZoneStore.getState());
  const configDirty = useConfigStore.getState().dirty ? 1 : 0;
  return dirtyZones + configDirty;
}
