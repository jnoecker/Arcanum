import type { AssetEntry } from "@/types/assets";
import type { WorldFile } from "@/types/world";

export type AudioTrackKind = "music" | "ambient";

const AUDIO_EXTENSION = /\.(mp3|ogg|flac|wav)$/i;

/** Asset types surfaced in each studio lane. Legacy untyped "audio" imports
 *  (the old room foley slot) land in the ambient lane so they stay reachable. */
const LANE_TYPES: Record<AudioTrackKind, string[]> = {
  music: ["music"],
  ambient: ["ambient", "audio"],
};

export function listAudioTracks(assets: AssetEntry[], kind: AudioTrackKind): AssetEntry[] {
  const types = LANE_TYPES[kind];
  return assets
    .filter((a) => types.includes(a.asset_type) && AUDIO_EXTENSION.test(a.file_name))
    .sort((a, b) => {
      const an = trackLabel(a).toLowerCase();
      const bn = trackLabel(b).toLowerCase();
      return an.localeCompare(bn) || b.created_at.localeCompare(a.created_at);
    });
}

export function trackLabel(entry: AssetEntry): string {
  if (entry.display_name) return entry.display_name;
  const prompt = entry.prompt.replace(/^Imported:\s*/, "").trim();
  if (prompt) return prompt.length > 48 ? `${prompt.slice(0, 48)}…` : prompt;
  return entry.file_name;
}

export interface TrackUsage {
  /** Zones whose zone-default slot references the track. */
  zoneDefaults: { zoneId: string; kind: AudioTrackKind }[];
  /** Rooms referencing the track directly. */
  rooms: { zoneId: string; roomId: string; roomTitle: string; kind: AudioTrackKind }[];
}

export function scanTrackUsage(
  zones: Iterable<[string, { data: WorldFile }]>,
  fileName: string,
): TrackUsage {
  return buildUsageIndex(zones).get(fileName) ?? { zoneDefaults: [], rooms: [] };
}

/** Single pass over all loaded zones: file name → everywhere it's referenced. */
export function buildUsageIndex(
  zones: Iterable<[string, { data: WorldFile }]>,
): Map<string, TrackUsage> {
  const index = new Map<string, TrackUsage>();
  const entry = (fileName: string): TrackUsage => {
    let usage = index.get(fileName);
    if (!usage) {
      usage = { zoneDefaults: [], rooms: [] };
      index.set(fileName, usage);
    }
    return usage;
  };
  for (const [zoneId, { data }] of zones) {
    if (data.audio?.music) entry(data.audio.music).zoneDefaults.push({ zoneId, kind: "music" });
    if (data.audio?.ambient) entry(data.audio.ambient).zoneDefaults.push({ zoneId, kind: "ambient" });
    for (const [roomId, room] of Object.entries(data.rooms)) {
      if (room.music) entry(room.music).rooms.push({ zoneId, roomId, roomTitle: room.title, kind: "music" });
      if (room.ambient) entry(room.ambient).rooms.push({ zoneId, roomId, roomTitle: room.title, kind: "ambient" });
    }
  }
  return index;
}

export function usageSummary(usage: TrackUsage): string {
  if (usage.zoneDefaults.length === 0 && usage.rooms.length === 0) return "Unused";
  const parts: string[] = [];
  if (usage.zoneDefaults.length > 0) {
    parts.push(`${usage.zoneDefaults.length} zone default${usage.zoneDefaults.length === 1 ? "" : "s"}`);
  }
  if (usage.rooms.length > 0) {
    const zoneCount = new Set(usage.rooms.map((r) => r.zoneId)).size;
    parts.push(`${usage.rooms.length} room${usage.rooms.length === 1 ? "" : "s"} in ${zoneCount} zone${zoneCount === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}

export function setZoneDefaultTrack(
  world: WorldFile,
  kind: AudioTrackKind,
  fileName: string | undefined,
): WorldFile {
  const next = { ...(world.audio ?? {}), [kind]: fileName };
  const hasValues = Object.values(next).some(Boolean);
  return { ...world, audio: hasValues ? next : undefined };
}

export function setRoomTrack(
  world: WorldFile,
  roomId: string,
  kind: AudioTrackKind,
  fileName: string | undefined,
): WorldFile {
  const room = world.rooms[roomId];
  if (!room) return world;
  return {
    ...world,
    rooms: { ...world.rooms, [roomId]: { ...room, [kind]: fileName } },
  };
}
