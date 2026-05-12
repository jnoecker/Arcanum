import { useConfigStore } from "@/stores/configStore";
import { useLoreStore } from "@/stores/loreStore";
import { useZoneStore } from "@/stores/zoneStore";
import type { ChunkerInput } from "./chunker";

/** Snapshot the three stores into a `ChunkerInput`. */
export function gatherChunkerInput(): ChunkerInput {
  const lore = useLoreStore.getState().lore;
  const config = useConfigStore.getState().config;
  const zones = Array.from(useZoneStore.getState().zones.entries()).map(
    ([zoneId, z]) => ({ zoneId, data: z.data }),
  );
  return { lore, config, zones };
}
