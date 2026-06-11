import type { AssetEntry } from "@/types/assets";
import type { JukeboxSongFile, RoomFile, WorldFile } from "@/types/world";

export type AudioTrackKind = "music" | "ambient";

const AUDIO_EXTENSION = /\.(mp3|ogg|flac|wav)$/i;
const HASH_LIKE_RE = /^[0-9a-f]{16,}$/i;

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
  const label = prompt
    ? prompt.length > 48 ? `${prompt.slice(0, 48)}…` : prompt
    : entry.file_name;
  // Content-addressed file names make terrible labels — collapse them.
  const stem = label === entry.file_name ? label.replace(/\.[^.]+$/, "") : label;
  if (HASH_LIKE_RE.test(stem)) return `Untitled (${stem.slice(0, 8)}…)`;
  return label;
}

export interface TrackUsage {
  /** Zones whose zone-default slot references the track. */
  zoneDefaults: { zoneId: string; kind: AudioTrackKind }[];
  /** Rooms referencing the track directly. */
  rooms: { zoneId: string; roomId: string; roomTitle: string; kind: AudioTrackKind }[];
  /** Room jukeboxes whose song list includes the track. */
  jukeboxes: { zoneId: string; roomId: string; roomTitle: string }[];
}

export function scanTrackUsage(
  zones: Iterable<[string, { data: WorldFile }]>,
  fileName: string,
): TrackUsage {
  return buildUsageIndex(zones).get(fileName) ?? { zoneDefaults: [], rooms: [], jukeboxes: [] };
}

/** Single pass over all loaded zones: file name → everywhere it's referenced. */
export function buildUsageIndex(
  zones: Iterable<[string, { data: WorldFile }]>,
): Map<string, TrackUsage> {
  const index = new Map<string, TrackUsage>();
  const entry = (fileName: string): TrackUsage => {
    let usage = index.get(fileName);
    if (!usage) {
      usage = { zoneDefaults: [], rooms: [], jukeboxes: [] };
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
      if (room.jukebox) {
        const seen = new Set<string>();
        for (const song of room.jukebox.songs ?? []) {
          if (!song.file || seen.has(song.file)) continue;
          seen.add(song.file);
          entry(song.file).jukeboxes.push({ zoneId, roomId, roomTitle: room.title });
        }
      }
    }
  }
  return index;
}

export function usageSummary(usage: TrackUsage): string {
  if (usage.zoneDefaults.length === 0 && usage.rooms.length === 0 && usage.jukeboxes.length === 0) {
    return "Unused";
  }
  const parts: string[] = [];
  if (usage.zoneDefaults.length > 0) {
    parts.push(`${usage.zoneDefaults.length} zone default${usage.zoneDefaults.length === 1 ? "" : "s"}`);
  }
  if (usage.rooms.length > 0) {
    const zoneCount = new Set(usage.rooms.map((r) => r.zoneId)).size;
    parts.push(`${usage.rooms.length} room${usage.rooms.length === 1 ? "" : "s"} in ${zoneCount} zone${zoneCount === 1 ? "" : "s"}`);
  }
  if (usage.jukeboxes.length > 0) {
    parts.push(`${usage.jukeboxes.length} jukebox${usage.jukeboxes.length === 1 ? "" : "es"}`);
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

export interface AudioTrackMeta {
  name: string;
  description: string;
  lyrics: string;
  durationSeconds: number;
}

export function buildAudioMetaIndex(assets: AssetEntry[]): Map<string, AudioTrackMeta> {
  const index = new Map<string, AudioTrackMeta>();
  for (const entry of assets) {
    index.set(entry.file_name, {
      name: trackLabel(entry),
      description: entry.description,
      lyrics: entry.lyrics,
      durationSeconds: Math.round(entry.duration_seconds),
    });
  }
  return index;
}

/**
 * Denormalize library metadata into jukebox song entries at save time.
 * Songs whose file is in the index are rewritten entirely from it (so stale
 * descriptions and lyrics clear when the library entry empties); songs from
 * other machines stay verbatim. Blank-file songs are dropped, and a jukebox
 * with no surviving songs disappears.
 */
export function enrichJukeboxSongs(
  world: WorldFile,
  meta: Map<string, AudioTrackMeta>,
): WorldFile {
  let changed = false;
  const rooms: Record<string, RoomFile> = {};
  for (const [roomId, room] of Object.entries(world.rooms)) {
    if (!room.jukebox) {
      rooms[roomId] = room;
      continue;
    }
    const songs: JukeboxSongFile[] = [];
    for (const song of room.jukebox.songs ?? []) {
      if (!song.file || !song.file.trim()) continue;
      const track = meta.get(song.file);
      if (!track) {
        songs.push(song);
        continue;
      }
      const enriched: JukeboxSongFile = { file: song.file, name: track.name };
      if (track.description) enriched.description = track.description;
      if (track.lyrics) enriched.lyrics = track.lyrics;
      if (track.durationSeconds > 0) enriched.durationSeconds = track.durationSeconds;
      songs.push(enriched);
    }
    rooms[roomId] = songs.length > 0
      ? { ...room, jukebox: { songs } }
      : { ...room, jukebox: undefined };
    changed = true;
  }
  return changed ? { ...world, rooms } : world;
}
