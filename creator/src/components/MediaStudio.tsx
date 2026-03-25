import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAssetStore } from "@/stores/assetStore";
import { useProjectStore } from "@/stores/projectStore";
import { useVibeStore } from "@/stores/vibeStore";
import type { AssetContext } from "@/types/assets";
import type { RoomFile, WorldFile, ZoneAudioDefaults } from "@/types/world";
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

type ZoneAudioField = keyof ZoneAudioDefaults;
type RoomMediaField = "music" | "ambient" | "audio" | "video";

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

function MediaField({
  label,
  description,
  value,
  onCommit,
  picker,
  generator,
}: {
  label: string;
  description: string;
  value?: string;
  onCommit: (value: string | undefined) => void;
  picker: ReactNode;
  generator?: ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-black/12 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="font-display text-lg text-text-primary">{label}</h4>
          <p className="mt-1 text-xs leading-6 text-text-secondary">{description}</p>
        </div>
        <span className="rounded-full bg-white/8 px-2 py-1 text-2xs uppercase tracking-ui text-text-muted">
          {value ? "Assigned" : "Empty"}
        </span>
      </div>

      <div className="mt-4">
        <TextInput
          value={value ?? ""}
          onCommit={(next) => onCommit(next || undefined)}
          placeholder="none"
        />
      </div>

      <div className="mt-3">{picker}</div>
      {generator && <div className="mt-3">{generator}</div>}
    </div>
  );
}

export function MediaStudio({ zoneId, world, onWorldChange }: MediaStudioProps) {
  const assets = useAssetStore((s) => s.assets);
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const mudDir = useProjectStore((s) => s.project?.mudDir);
  const vibe = useVibeStore((s) => (zoneId ? s.getVibe(zoneId) : undefined));
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const roomEntries = useMemo(
    () =>
      Object.entries(world?.rooms ?? {}).sort(([, a], [, b]) =>
        (a.title || "").localeCompare(b.title || ""),
      ),
    [world],
  );

  useEffect(() => {
    if (selectedRoomId && world?.rooms[selectedRoomId]) return;
    setSelectedRoomId(roomEntries[0]?.[0] ?? null);
  }, [roomEntries, selectedRoomId, world]);

  const selectedRoom = selectedRoomId ? world?.rooms[selectedRoomId] ?? null : null;

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
    () =>
      Object.entries(world?.rooms ?? {})
        .map(([id, room]) => `- ${room.title} (${id})`)
        .join("\n"),
    [world],
  );

  if (!zoneId || !world) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-gradient-panel p-5 shadow-[0_18px_50px_rgba(9,12,24,0.24)]">
        <div className="rounded-[22px] border border-dashed border-white/12 bg-white/4 px-4 py-8 text-sm text-text-muted">
          Select a zone to shape its music, ambience, and cinematics from the studio.
        </div>
      </section>
    );
  }

  const patchZoneAudio = (field: ZoneAudioField, value: string | undefined) => {
    const next = { ...(world.audio ?? {}), [field]: value };
    const hasValues = Object.values(next).some(Boolean);
    onWorldChange({ ...world, audio: hasValues ? next : undefined });
  };

  const patchRoom = (field: RoomMediaField, value: string | undefined) => {
    if (!selectedRoomId || !selectedRoom) return;
    onWorldChange({
      ...world,
      rooms: {
        ...world.rooms,
        [selectedRoomId]: {
          ...selectedRoom,
          [field]: value,
        } as RoomFile,
      },
    });
  };

  return (
    <section className="rounded-[28px] border border-white/10 bg-gradient-panel p-5 shadow-[0_18px_50px_rgba(9,12,24,0.24)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wide-ui text-text-muted">Media studio</p>
          <h2 className="mt-2 font-display text-2xl text-text-primary">Score the world and stage its motion.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-text-secondary">Zone audio, room audio, and cinematics.</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs text-text-secondary">
          {roomEntries.length} rooms in {world.zone}
        </div>
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-4">
          <MediaField
            label="Zone score"
            description="Default exploration music for the zone. Rooms without a dedicated track fall back to this."
            value={world.audio?.music}
            onCommit={(value) => patchZoneAudio("music", value)}
            picker={
              <MediaPicker
                value={world.audio?.music}
                onChange={(value) => patchZoneAudio("music", value)}
                mediaType="audio"
                assetType="music"
                context={zoneContext}
                variantGroup={zoneMediaGroup(zoneId, "music")}
                isActive
              />
            }
            generator={
              <MusicGenerator
                roomTitle={world.zone}
                roomDescription={zoneDesc}
                vibe={vibe}
                currentAudio={world.audio?.music}
                trackType="music"
                assetType="music"
                context={zoneContext}
                variantGroup={zoneMediaGroup(zoneId, "music")}
                markActive
                onAccept={(fileName) => patchZoneAudio("music", fileName)}
              />
            }
          />

          <MediaField
            label="Zone ambience"
            description="Underlying environmental soundscape for the whole zone."
            value={world.audio?.ambient}
            onCommit={(value) => patchZoneAudio("ambient", value)}
            picker={
              <MediaPicker
                value={world.audio?.ambient}
                onChange={(value) => patchZoneAudio("ambient", value)}
                mediaType="audio"
                assetType="ambient"
                context={zoneContext}
                variantGroup={zoneMediaGroup(zoneId, "ambient")}
                isActive
              />
            }
            generator={
              <MusicGenerator
                roomTitle={world.zone}
                roomDescription={zoneDesc}
                vibe={vibe}
                currentAudio={world.audio?.ambient}
                trackType="ambient"
                assetType="ambient"
                context={zoneContext}
                variantGroup={zoneMediaGroup(zoneId, "ambient")}
                markActive
                onAccept={(fileName) => patchZoneAudio("ambient", fileName)}
              />
            }
          />

          <MediaField
            label="Zone flyover"
            description="A cinematic intro managed as a curated variant group instead of an orphaned file."
            value={zoneIntroAsset?.file_name}
            onCommit={() => {}}
            picker={
              <div className="text-xs text-text-muted">
                The active zone intro is tracked from the asset library. Generate a new one from the current zone imagery.
              </div>
            }
            generator={
              <>
                <VideoGenerator
                  imagePath={zoneImagePath}
                  entityName={world.zone}
                  entityDescription={`Zone: ${world.zone}. ${Object.keys(world.rooms).length} rooms.`}
                  videoType="zone_intro"
                  extraContext={`Zone rooms:\n${roomNames}`}
                  assetType="video"
                  context={zoneContext}
                  variantGroup={zoneMediaGroup(zoneId, "zone_intro")}
                  markActive
                  onAccept={() => {}}
                />
                {!zoneImagePath && (
                  <p className="mt-2 text-2xs italic text-text-muted">
                    Generate at least one room image before creating a zone flyover.
                  </p>
                )}
              </>
            }
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-[22px] border border-white/8 bg-black/12 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-lg text-text-primary">Room staging</h3>
                <p className="mt-1 text-xs leading-6 text-text-secondary">Choose a room.</p>
              </div>
              <select
                value={selectedRoomId ?? ""}
                onChange={(event) => setSelectedRoomId(event.target.value || null)}
                className="min-w-[14rem] rounded-full border border-white/12 bg-white/8 px-4 py-2 text-xs text-text-primary outline-none"
              >
                {roomEntries.map(([roomId, room]) => (
                  <option key={roomId} value={roomId}>
                    {room.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedRoom ? (
            <>
              <MediaField
                label="Room music"
                description="A specific musical cue for this room."
                value={selectedRoom.music}
                onCommit={(value) => patchRoom("music", value)}
                picker={
                  <MediaPicker
                    value={selectedRoom.music}
                    onChange={(value) => patchRoom("music", value)}
                    mediaType="audio"
                    assetType="music"
                    context={roomContext}
                    variantGroup={roomMediaGroup(zoneId, selectedRoomId!, "music")}
                    isActive
                  />
                }
                generator={
                  <MusicGenerator
                    roomTitle={selectedRoom.title}
                    roomDescription={selectedRoom.description}
                    vibe={vibe}
                    currentAudio={selectedRoom.music}
                    trackType="music"
                    assetType="music"
                    context={roomContext}
                    variantGroup={roomMediaGroup(zoneId, selectedRoomId!, "music")}
                    markActive
                    onAccept={(fileName) => patchRoom("music", fileName)}
                  />
                }
              />

              <MediaField
                label="Room ambience"
                description="Environmental sound design layered under or instead of music."
                value={selectedRoom.ambient}
                onCommit={(value) => patchRoom("ambient", value)}
                picker={
                  <MediaPicker
                    value={selectedRoom.ambient}
                    onChange={(value) => patchRoom("ambient", value)}
                    mediaType="audio"
                    assetType="ambient"
                    context={roomContext}
                    variantGroup={roomMediaGroup(zoneId, selectedRoomId!, "ambient")}
                    isActive
                  />
                }
                generator={
                  <MusicGenerator
                    roomTitle={selectedRoom.title}
                    roomDescription={selectedRoom.description}
                    vibe={vibe}
                    currentAudio={selectedRoom.ambient}
                    trackType="ambient"
                    assetType="ambient"
                    context={roomContext}
                    variantGroup={roomMediaGroup(zoneId, selectedRoomId!, "ambient")}
                    markActive
                    onAccept={(fileName) => patchRoom("ambient", fileName)}
                  />
                }
              />

              <MediaField
                label="Room foley"
                description="Direct imported audio for special room cues, loops, or handcrafted effects."
                value={selectedRoom.audio}
                onCommit={(value) => patchRoom("audio", value)}
                picker={
                  <MediaPicker
                    value={selectedRoom.audio}
                    onChange={(value) => patchRoom("audio", value)}
                    mediaType="audio"
                    assetType="audio"
                    context={roomContext}
                    variantGroup={roomMediaGroup(zoneId, selectedRoomId!, "audio")}
                    isActive
                  />
                }
              />

              <MediaField
                label="Room cinematic"
                description="A short establishing shot sourced from the room art."
                value={selectedRoom.video}
                onCommit={(value) => patchRoom("video", value)}
                picker={
                  <MediaPicker
                    value={selectedRoom.video}
                    onChange={(value) => patchRoom("video", value)}
                    mediaType="video"
                    assetType="video"
                    context={roomContext}
                    variantGroup={roomMediaGroup(zoneId, selectedRoomId!, "video")}
                    isActive
                  />
                }
                generator={
                  <>
                    <VideoGenerator
                      imagePath={roomImagePath}
                      entityName={selectedRoom.title}
                      entityDescription={selectedRoom.description}
                      videoType="room_cinematic"
                      assetType="video"
                      context={roomContext}
                      variantGroup={roomMediaGroup(zoneId, selectedRoomId!, "video")}
                      markActive
                      onAccept={(fileName) => patchRoom("video", fileName)}
                    />
                    {!roomImagePath && (
                      <p className="mt-2 text-2xs italic text-text-muted">
                        This room needs an image before you can generate a cinematic.
                      </p>
                    )}
                  </>
                }
              />
            </>
          ) : (
            <div className="rounded-[22px] border border-dashed border-white/12 bg-white/4 px-4 py-8 text-sm text-text-muted">
              This zone has no rooms yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
