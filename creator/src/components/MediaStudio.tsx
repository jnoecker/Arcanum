import { useEffect, useMemo, useState } from "react";
import { useAssetStore } from "@/stores/assetStore";
import { useProjectStore } from "@/stores/projectStore";
import { useVibeStore } from "@/stores/vibeStore";
import type { AssetContext } from "@/types/assets";
import type { RoomFile, WorldFile } from "@/types/world";
import { MusicGenerator } from "@/components/ui/MusicGenerator";
import { VideoGenerator } from "@/components/ui/VideoGenerator";
import { MediaPicker } from "@/components/ui/MediaPicker";
import { TextInput } from "@/components/ui/FormWidgets";
import { isLegacyImagePath, isR2HashPath } from "@/lib/useImageSrc";

interface MediaStudioProps {
  zoneId: string | null;
  world: WorldFile | null;
  onWorldChange: (world: WorldFile) => void;
}

type MediaSlotId =
  | "zone:music"
  | "zone:ambient"
  | "zone:flyover"
  | "room:music"
  | "room:ambient"
  | "room:audio"
  | "room:video";

interface MediaSlot {
  id: MediaSlotId;
  label: string;
  description: string;
  scope: "zone" | "room";
  mediaType: "audio" | "video";
  generatorType: "music" | "ambient" | "video" | "none";
}

const MEDIA_SLOTS: MediaSlot[] = [
  { id: "zone:music", label: "Zone score", description: "Default exploration music. Rooms without a dedicated track fall back to this.", scope: "zone", mediaType: "audio", generatorType: "music" },
  { id: "zone:ambient", label: "Zone ambience", description: "Underlying environmental soundscape for the whole zone.", scope: "zone", mediaType: "audio", generatorType: "ambient" },
  { id: "zone:flyover", label: "Zone flyover", description: "Cinematic intro generated from zone imagery.", scope: "zone", mediaType: "video", generatorType: "video" },
  { id: "room:music", label: "Room music", description: "A specific musical cue for this room, overriding the zone score.", scope: "room", mediaType: "audio", generatorType: "music" },
  { id: "room:ambient", label: "Room ambience", description: "Environmental sound design layered under or instead of music.", scope: "room", mediaType: "audio", generatorType: "ambient" },
  { id: "room:audio", label: "Room foley", description: "Direct imported audio for special room cues, loops, or handcrafted effects.", scope: "room", mediaType: "audio", generatorType: "none" },
  { id: "room:video", label: "Room cinematic", description: "A short establishing shot sourced from the room art.", scope: "room", mediaType: "video", generatorType: "video" },
];

function zoneMediaGroup(zoneId: string, key: string): string {
  return `zone-media:${zoneId}:${key}`;
}

function roomMediaGroup(zoneId: string, roomId: string, key: string): string {
  return `room-media:${zoneId}:${roomId}:${key}`;
}

function resolveImagePath(image: string | undefined, assetsDir: string, mudDir?: string): string | undefined {
  if (!image) return undefined;
  if (isR2HashPath(image)) return assetsDir ? `${assetsDir}\\images\\${image}` : undefined;
  if (!isLegacyImagePath(image)) return image;
  if (!mudDir) return undefined;
  return `${mudDir}/src/main/resources/world/images/${image}`;
}

function getSlotValue(slot: MediaSlot, world: WorldFile, selectedRoom: RoomFile | null, zoneIntroFileName: string | undefined): string | undefined {
  if (slot.id === "zone:music") return world.audio?.music;
  if (slot.id === "zone:ambient") return world.audio?.ambient;
  if (slot.id === "zone:flyover") return zoneIntroFileName;
  if (!selectedRoom) return undefined;
  if (slot.id === "room:music") return selectedRoom.music;
  if (slot.id === "room:ambient") return selectedRoom.ambient;
  if (slot.id === "room:audio") return selectedRoom.audio;
  if (slot.id === "room:video") return selectedRoom.video;
  return undefined;
}

export function MediaStudio({ zoneId, world, onWorldChange }: MediaStudioProps) {
  const assets = useAssetStore((s) => s.assets);
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const mudDir = useProjectStore((s) => s.project?.mudDir);
  const vibe = useVibeStore((s) => (zoneId ? s.getVibe(zoneId) : undefined));
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<MediaSlotId>("zone:music");

  const roomEntries = useMemo(
    () => Object.entries(world?.rooms ?? {}).sort(([, a], [, b]) => (a.title || "").localeCompare(b.title || "")),
    [world],
  );

  useEffect(() => {
    if (selectedRoomId && world?.rooms[selectedRoomId]) return;
    setSelectedRoomId(roomEntries[0]?.[0] ?? null);
  }, [roomEntries, selectedRoomId, world]);

  const selectedRoom = selectedRoomId ? world?.rooms[selectedRoomId] ?? null : null;
  const selectedSlot = MEDIA_SLOTS.find((s) => s.id === selectedSlotId)!;

  const zoneContext = useMemo<AssetContext | undefined>(
    () => (zoneId ? { zone: zoneId, entity_type: "zone", entity_id: "defaults" } : undefined),
    [zoneId],
  );
  const roomContext = useMemo<AssetContext | undefined>(
    () => (zoneId && selectedRoomId ? { zone: zoneId, entity_type: "room", entity_id: selectedRoomId } : undefined),
    [selectedRoomId, zoneId],
  );

  const zoneIntroAsset = useMemo(
    () => assets.find((asset) => asset.variant_group === (zoneId ? zoneMediaGroup(zoneId, "zone_intro") : "") && asset.is_active),
    [assets, zoneId],
  );

  const zoneImagePath = useMemo(() => {
    if (!world) return undefined;
    const firstWithImage = Object.values(world.rooms).find((room) => room.image);
    return resolveImagePath(firstWithImage?.image, assetsDir, mudDir);
  }, [assetsDir, mudDir, world]);

  const roomImagePath = useMemo(
    () => resolveImagePath(selectedRoom?.image, assetsDir, mudDir),
    [assetsDir, mudDir, selectedRoom?.image],
  );

  const zoneDesc = useMemo(() => {
    if (!world) return "";
    return `Zone: ${world.zone}. Rooms: ${Object.values(world.rooms).map((room) => room.title).join(", ")}`;
  }, [world]);

  const roomNames = useMemo(
    () => Object.entries(world?.rooms ?? {}).map(([id, room]) => `- ${room.title} (${id})`).join("\n"),
    [world],
  );

  if (!zoneId || !world) {
    return (
      <section className="rounded-3xl border border-[var(--chrome-stroke)] bg-gradient-panel p-5 shadow-section">
        <div className="rounded-3xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-highlight)] px-4 py-8 text-sm text-text-muted">
          Select a zone to shape its music, ambience, and cinematics from the studio.
        </div>
      </section>
    );
  }

  const patchZoneAudio = (field: string, value: string | undefined) => {
    const next = { ...(world.audio ?? {}), [field]: value };
    const hasValues = Object.values(next).some(Boolean);
    onWorldChange({ ...world, audio: hasValues ? next : undefined });
  };

  const patchRoom = (field: string, value: string | undefined) => {
    if (!selectedRoomId || !selectedRoom) return;
    onWorldChange({
      ...world,
      rooms: { ...world.rooms, [selectedRoomId]: { ...selectedRoom, [field]: value } as RoomFile },
    });
  };

  const currentValue = getSlotValue(selectedSlot, world, selectedRoom, zoneIntroAsset?.file_name);

  const commitValue = (value: string | undefined) => {
    if (selectedSlot.id === "zone:music") patchZoneAudio("music", value);
    else if (selectedSlot.id === "zone:ambient") patchZoneAudio("ambient", value);
    else if (selectedSlot.id === "zone:flyover") { /* managed via asset library */ }
    else if (selectedSlot.id === "room:music") patchRoom("music", value);
    else if (selectedSlot.id === "room:ambient") patchRoom("ambient", value);
    else if (selectedSlot.id === "room:audio") patchRoom("audio", value);
    else if (selectedSlot.id === "room:video") patchRoom("video", value);
  };

  // Resolve context/variant group for current slot
  const slotContext = selectedSlot.scope === "zone" ? zoneContext : roomContext;
  const slotVariantGroup = (() => {
    if (selectedSlot.id === "zone:music") return zoneMediaGroup(zoneId, "music");
    if (selectedSlot.id === "zone:ambient") return zoneMediaGroup(zoneId, "ambient");
    if (selectedSlot.id === "zone:flyover") return zoneMediaGroup(zoneId, "zone_intro");
    if (!selectedRoomId) return "";
    const field = selectedSlot.id.split(":")[1]!;
    return roomMediaGroup(zoneId, selectedRoomId, field);
  })();

  // Generator props
  const genTitle = selectedSlot.scope === "zone" ? world.zone : (selectedRoom?.title ?? "");
  const genDesc = selectedSlot.scope === "zone" ? zoneDesc : (selectedRoom?.description ?? "");
  const genImagePath = selectedSlot.scope === "zone" ? zoneImagePath : roomImagePath;

  const zoneSlots = MEDIA_SLOTS.filter((s) => s.scope === "zone");
  const roomSlots = MEDIA_SLOTS.filter((s) => s.scope === "room");

  return (
    <section className="rounded-3xl border border-[var(--chrome-stroke)] bg-gradient-panel p-5 shadow-section">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-2xs uppercase tracking-wide-ui text-text-muted">Media studio</p>
          <h2 className="mt-1 font-display text-xl text-text-primary">Score the world and stage its motion.</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted">{roomEntries.length} rooms</span>
          <select
            value={selectedRoomId ?? ""}
            onChange={(event) => setSelectedRoomId(event.target.value || null)}
            className="rounded-full border border-[var(--chrome-stroke-strong)] bg-bg-secondary px-4 py-2 text-xs text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-active [&>option]:bg-bg-secondary [&>option]:text-text-primary"
          >
            {roomEntries.map(([roomId, room]) => (
              <option key={roomId} value={roomId}>{room.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.62fr_1.38fr]">
        {/* Slot list */}
        <div className="rounded-3xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-4">
          <div className="flex flex-col gap-2">
            <div className="mb-1 text-2xs uppercase tracking-ui text-text-muted">Zone</div>
            {zoneSlots.map((slot) => {
              const value = getSlotValue(slot, world, selectedRoom, zoneIntroAsset?.file_name);
              const selected = selectedSlotId === slot.id;
              return (
                <button
                  key={slot.id}
                  onClick={() => setSelectedSlotId(slot.id)}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                    selected ? "border-border-active bg-gradient-active" : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] hover:bg-[var(--chrome-highlight-strong)]"
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${value ? "bg-status-success" : "bg-text-muted/50"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-text-primary">{slot.label}</div>
                    <div className="truncate text-2xs text-text-muted">
                      {value ? value.split(/[\\/]/).pop() : "Empty"}
                    </div>
                  </div>
                </button>
              );
            })}

            <div className="mb-1 mt-3 text-2xs uppercase tracking-ui text-text-muted">
              Room: {selectedRoom?.title ?? "None"}
            </div>
            {roomSlots.map((slot) => {
              const value = getSlotValue(slot, world, selectedRoom, zoneIntroAsset?.file_name);
              const selected = selectedSlotId === slot.id;
              return (
                <button
                  key={slot.id}
                  onClick={() => setSelectedSlotId(slot.id)}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                    selected ? "border-border-active bg-gradient-active" : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] hover:bg-[var(--chrome-highlight-strong)]"
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${value ? "bg-status-success" : "bg-text-muted/50"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-text-primary">{slot.label}</div>
                    <div className="truncate text-2xs text-text-muted">
                      {value ? value.split(/[\\/]/).pop() : "Empty"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex flex-col gap-5">
          {/* Assignment card */}
          <div className="rounded-3xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-2xs uppercase tracking-ui text-text-muted">{selectedSlot.scope}</div>
                <h3 className="mt-0.5 font-display text-xl text-text-primary">{selectedSlot.label}</h3>
                <p className="mt-1 text-xs leading-5 text-text-secondary">{selectedSlot.description}</p>
              </div>
              <span className="rounded-full bg-[var(--chrome-highlight-strong)] px-3 py-1 text-2xs uppercase tracking-label text-text-muted">
                {currentValue ? "Assigned" : "Empty"}
              </span>
            </div>

            {selectedSlot.id !== "zone:flyover" ? (
              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                <TextInput
                  value={currentValue ?? ""}
                  onCommit={(next) => commitValue(next || undefined)}
                  placeholder="None"
                />
                <div className="flex items-center">
                  <MediaPicker
                    value={currentValue}
                    onChange={(value) => commitValue(value)}
                    mediaType={selectedSlot.mediaType}
                    assetType={selectedSlot.id === "room:audio" ? "audio" : selectedSlot.id.includes("video") ? "video" : selectedSlot.generatorType === "music" ? "music" : "ambient"}
                    context={slotContext}
                    variantGroup={slotVariantGroup}
                    isActive
                  />
                </div>
              </div>
            ) : (
              <div className="mt-4 text-xs text-text-muted">
                The active zone intro is tracked from the asset library. Generate a new one from the current zone imagery.
              </div>
            )}
          </div>

          {/* Generator card */}
          {selectedSlot.generatorType !== "none" && (
            <div className="rounded-3xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-4">
              <div className="mb-3 text-2xs uppercase tracking-ui text-text-muted">
                {selectedSlot.generatorType === "video" ? "Video generator" : "Audio generator"}
              </div>

              {selectedSlot.generatorType === "video" ? (
                <>
                  <VideoGenerator
                    imagePath={genImagePath}
                    entityName={genTitle}
                    entityDescription={genDesc}
                    videoType={selectedSlot.id === "zone:flyover" ? "zone_intro" : "room_cinematic"}
                    extraContext={selectedSlot.scope === "zone" ? `Zone rooms:\n${roomNames}` : undefined}
                    assetType="video"
                    context={slotContext}
                    variantGroup={slotVariantGroup}
                    markActive
                    onAccept={(fileName) => {
                      if (selectedSlot.id !== "zone:flyover") commitValue(fileName);
                    }}
                  />
                  {!genImagePath && (
                    <p className="mt-2 text-2xs italic text-text-muted">
                      {selectedSlot.scope === "zone"
                        ? "Generate at least one room image before creating a zone flyover."
                        : "This room needs an image before you can generate a cinematic."}
                    </p>
                  )}
                </>
              ) : (
                <MusicGenerator
                  roomTitle={genTitle}
                  roomDescription={genDesc}
                  vibe={vibe}
                  currentAudio={currentValue}
                  trackType={selectedSlot.generatorType as "music" | "ambient"}
                  assetType={selectedSlot.generatorType as "music" | "ambient"}
                  context={slotContext}
                  variantGroup={slotVariantGroup}
                  markActive
                  onAccept={(fileName) => commitValue(fileName)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
