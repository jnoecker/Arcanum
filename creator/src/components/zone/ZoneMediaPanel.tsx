import { useCallback, useMemo } from "react";
import type { WorldFile, ZoneAudioDefaults } from "@/types/world";
import { Section, FieldRow, TextInput } from "@/components/ui/FormWidgets";
import { MusicGenerator } from "@/components/ui/MusicGenerator";
import { VideoGenerator } from "@/components/ui/VideoGenerator";
import { MediaPicker } from "@/components/ui/MediaPicker";
import { useVibeStore } from "@/stores/vibeStore";
import { useAssetStore } from "@/stores/assetStore";
import sidebarBg from "@/assets/sidebar-bg.png";

interface ZoneMediaPanelProps {
  zoneId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
}

export function ZoneMediaPanel({ zoneId, world, onWorldChange }: ZoneMediaPanelProps) {
  const vibe = useVibeStore((s) => s.getVibe(zoneId));
  const assetsDir = useAssetStore((s) => s.assetsDir);

  const { zoneImagePath, roomNames, zoneDesc } = useMemo(() => {
    const rooms = world.rooms;
    const firstWithImage = Object.values(rooms).find((r) => r.image);
    return {
      zoneImagePath: firstWithImage?.image && assetsDir
        ? `${assetsDir}\\images\\${firstWithImage.image}`
        : undefined,
      roomNames: Object.entries(rooms)
        .map(([id, r]) => `- ${r.title} (${id})`)
        .join("\n"),
      zoneDesc: `Zone: ${world.zone}. Rooms: ${Object.values(rooms).map((r) => r.title).join(", ")}`,
    };
  }, [world.rooms, world.zone, assetsDir]);

  const patchAudio = useCallback(
    (field: keyof ZoneAudioDefaults, value: string | undefined) => {
      const prev = world.audio ?? {};
      const next = { ...prev, [field]: value };
      // Clean up empty object
      const hasValues = Object.values(next).some(Boolean);
      onWorldChange({ ...world, audio: hasValues ? next : undefined });
    },
    [world, onWorldChange],
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <img src={sidebarBg} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.12]" />
      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-4">
          <h2 className="mb-4 font-display text-sm uppercase tracking-widest text-accent">
            {world.zone} — Media
          </h2>

          {/* Zone Music */}
          <Section title="Zone Music" description="Default background music for the zone. Rooms without their own music track will use this.">
            <div className="flex flex-col gap-1.5">
              <FieldRow label="Track">
                <TextInput
                  value={world.audio?.music ?? ""}
                  onCommit={(v) => patchAudio("music", v || undefined)}
                  placeholder="None"
                />
              </FieldRow>
              <MediaPicker
                value={world.audio?.music}
                onChange={(v) => patchAudio("music", v ?? undefined)}
                mediaType="audio"
                assetType="music"
                context={{ zone: zoneId, entity_type: "zone", entity_id: "defaults" }}
                variantGroup={`zone-media:${zoneId}:music`}
                isActive
              />
              <MusicGenerator
                roomTitle={world.zone}
                roomDescription={zoneDesc}
                vibe={vibe}
                currentAudio={world.audio?.music}
                trackType="music"
                assetType="music"
                context={{ zone: zoneId, entity_type: "zone", entity_id: "defaults" }}
                variantGroup={`zone-media:${zoneId}:music`}
                markActive
                onAccept={(fileName) => patchAudio("music", fileName)}
              />
            </div>
          </Section>

          {/* Zone Ambient */}
          <Section title="Zone Ambient" description="Default ambient soundscape. Rooms without their own ambient track will use this.">
            <div className="flex flex-col gap-1.5">
              <FieldRow label="Track">
                <TextInput
                  value={world.audio?.ambient ?? ""}
                  onCommit={(v) => patchAudio("ambient", v || undefined)}
                  placeholder="None"
                />
              </FieldRow>
              <MediaPicker
                value={world.audio?.ambient}
                onChange={(v) => patchAudio("ambient", v ?? undefined)}
                mediaType="audio"
                assetType="ambient"
                context={{ zone: zoneId, entity_type: "zone", entity_id: "defaults" }}
                variantGroup={`zone-media:${zoneId}:ambient`}
                isActive
              />
              <MusicGenerator
                roomTitle={world.zone}
                roomDescription={zoneDesc}
                vibe={vibe}
                currentAudio={world.audio?.ambient}
                trackType="ambient"
                assetType="ambient"
                context={{ zone: zoneId, entity_type: "zone", entity_id: "defaults" }}
                variantGroup={`zone-media:${zoneId}:ambient`}
                markActive
                onAccept={(fileName) => patchAudio("ambient", fileName)}
              />
            </div>
          </Section>

          {/* Zone Intro Video */}
          <Section title="Zone Intro Video" description="A sweeping flyover cinematic that plays when a player enters the zone. Uses the first room image as a source frame.">
            <div className="flex flex-col gap-1.5">
              <VideoGenerator
                imagePath={zoneImagePath}
                entityName={world.zone}
                entityDescription={`Zone: ${world.zone}. ${Object.keys(world.rooms).length} rooms.`}
                videoType="zone_intro"
                extraContext={`Zone rooms:\n${roomNames}`}
                assetType="video"
                context={{ zone: zoneId, entity_type: "zone", entity_id: "zone_intro" }}
                variantGroup={`zone-media:${zoneId}:zone_intro`}
                markActive
                onAccept={(_filePath) => {
                  // Zone intro video is accepted as a generated asset; no zone-level field to set
                  // The file is saved to the assets directory automatically
                }}
              />
              {!zoneImagePath && (
                <p className="text-2xs italic text-text-muted">
                  Generate a room image first — zone intro video needs a source frame.
                </p>
              )}
            </div>
          </Section>

          {/* Per-Room Audio Summary */}
          <Section title="Room Audio Overview" description="Quick reference for which rooms have music, ambient, or video tracks assigned.">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2 border-b border-border-muted pb-1 text-2xs font-medium uppercase tracking-wider text-text-muted">
                <span className="flex-1">Room</span>
                <span className="w-16 text-center">Music</span>
                <span className="w-16 text-center">Ambient</span>
                <span className="w-16 text-center">Video</span>
              </div>
              {Object.entries(world.rooms).map(([id, room]) => (
                <div key={id} className="flex items-center gap-2 py-0.5 text-xs">
                  <span className="flex-1 truncate text-text-secondary" title={room.title}>
                    {room.title}
                  </span>
                  <span className={`w-16 text-center ${room.music ? "text-status-success" : "text-text-muted"}`}>
                    {room.music ? "yes" : "--"}
                  </span>
                  <span className={`w-16 text-center ${room.ambient ? "text-status-success" : "text-text-muted"}`}>
                    {room.ambient ? "yes" : "--"}
                  </span>
                  <span className={`w-16 text-center ${room.video ? "text-status-success" : "text-text-muted"}`}>
                    {room.video ? "yes" : "--"}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
