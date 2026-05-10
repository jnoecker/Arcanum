import type { ZoneState } from "@/stores/zoneStore";

export interface FactionUsage {
  mobCount: number;
  questCount: number;
  zones: Set<string>;
}

export interface FactionUsageReport {
  /** factionId → usage stats (only for IDs that are referenced somewhere). */
  usage: Map<string, FactionUsage>;
  /** Faction IDs referenced by mobs/quests but not present in `definedIds`. */
  orphanIds: string[];
}

function ensure(map: Map<string, FactionUsage>, id: string): FactionUsage {
  let entry = map.get(id);
  if (!entry) {
    entry = { mobCount: 0, questCount: 0, zones: new Set<string>() };
    map.set(id, entry);
  }
  return entry;
}

/**
 * Walk every loaded zone and tally how many mobs / quests reference each
 * faction id, plus how many distinct zones touch it. Also flags references
 * to ids that don't exist in `definedIds`.
 */
export function buildFactionUsage(
  zones: Map<string, ZoneState>,
  definedIds: Set<string>,
  questRewards: Record<string, Record<string, number>> | undefined,
): FactionUsageReport {
  const usage = new Map<string, FactionUsage>();
  const orphanSet = new Set<string>();

  for (const [zoneId, state] of zones) {
    const data = state.data;
    const mobs = data.mobs;
    if (mobs) {
      for (const mob of Object.values(mobs)) {
        const fid = mob.faction;
        if (!fid) continue;
        const entry = ensure(usage, fid);
        entry.mobCount += 1;
        entry.zones.add(zoneId);
        if (!definedIds.has(fid)) orphanSet.add(fid);
      }
    }
    const quests = data.quests;
    if (quests) {
      for (const [questId, quest] of Object.entries(quests)) {
        const touched = new Set<string>();
        const required = quest.requiredReputation?.faction;
        if (required) touched.add(required);
        const rewards = questRewards?.[questId];
        if (rewards) {
          for (const fid of Object.keys(rewards)) touched.add(fid);
        }
        for (const fid of touched) {
          const entry = ensure(usage, fid);
          entry.questCount += 1;
          entry.zones.add(zoneId);
          if (!definedIds.has(fid)) orphanSet.add(fid);
        }
      }
    }
  }

  return { usage, orphanIds: Array.from(orphanSet).sort() };
}
