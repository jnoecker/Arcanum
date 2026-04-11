import { useCallback, useMemo, type ReactNode } from "react";
import type { WorldFile, ZoneAudioDefaults } from "@/types/world";
import { FieldRow, TextInput } from "@/components/ui/FormWidgets";
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

const MusicIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

const AmbientIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
    <path d="M2 10v4" />
    <path d="M6 6v12" />
    <path d="M10 3v18" />
    <path d="M14 8v8" />
    <path d="M18 5v14" />
    <path d="M22 10v4" />
  </svg>
);

const VideoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
    <rect x="2" y="6" width="14" height="12" rx="2" />
    <path d="m22 8-6 4 6 4V8Z" />
  </svg>
);

export function ZoneMediaPanel({ zoneId, world, onWorldChange }: ZoneMediaPanelProps) {
  const vibe = useVibeStore((s) => s.getVibe(zoneId));
  const assetsDir = useAssetStore((s) => s.assetsDir);

  const { zoneImagePath, roomNames, zoneDesc, stats, totalRooms } = useMemo(() => {
    const rooms = world.rooms;
    const firstWithImage = Object.values(rooms).find((r) => r.image);
    const total = Object.keys(rooms).length;
    const musicCount = Object.values(rooms).filter((r) => r.music).length;
    const ambientCount = Object.values(rooms).filter((r) => r.ambient).length;
    const videoCount = Object.values(rooms).filter((r) => r.video).length;
    return {
      zoneImagePath: firstWithImage?.image && assetsDir
        ? `${assetsDir}\\images\\${firstWithImage.image}`
        : undefined,
      roomNames: Object.entries(rooms)
        .map(([id, r]) => `- ${r.title} (${id})`)
        .join("\n"),
      zoneDesc: `Zone: ${world.zone}. Rooms: ${Object.values(rooms).map((r) => r.title).join(", ")}`,
      stats: { music: musicCount, ambient: ambientCount, video: videoCount },
      totalRooms: total,
    };
  }, [world.rooms, world.zone, assetsDir]);

  const patchAudio = useCallback(
    (field: keyof ZoneAudioDefaults, value: string | undefined) => {
      const prev = world.audio ?? {};
      const next = { ...prev, [field]: value };
      const hasValues = Object.values(next).some(Boolean);
      onWorldChange({ ...world, audio: hasValues ? next : undefined });
    },
    [world, onWorldChange],
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <img src={sidebarBg} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.12]" />
      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-6">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border-muted pb-4">
            <div>
              <h2 className="font-display text-2xl uppercase tracking-widest text-accent">
                {world.zone}
              </h2>
              <p className="mt-1 text-xs uppercase tracking-wider text-text-muted">Media &amp; Audio</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-2xs">
              <StatsPill icon={<MusicIcon />} label="music" count={stats.music} total={totalRooms} />
              <StatsPill icon={<AmbientIcon />} label="ambient" count={stats.ambient} total={totalRooms} />
              <StatsPill icon={<VideoIcon />} label="video" count={stats.video} total={totalRooms} />
            </div>
          </div>

          {/* Zone defaults grid */}
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <MediaCard icon={<MusicIcon />} title="Zone Music" description="Default background music. Rooms without their own track will use this.">
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
            </MediaCard>

            <MediaCard icon={<AmbientIcon />} title="Zone Ambient" description="Default ambient soundscape. Rooms without their own track will use this.">
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
            </MediaCard>
          </div>

          {/* Zone Intro Video */}
          <div className="mb-6">
            <MediaCard
              icon={<VideoIcon />}
              title="Zone Intro Video"
              description="A sweeping flyover cinematic that plays when a player enters the zone. Uses the first room image as a source frame."
            >
              <VideoGenerator
                imagePath={zoneImagePath}
                entityName={world.zone}
                entityDescription={`Zone: ${world.zone}. ${totalRooms} rooms.`}
                videoType="zone_intro"
                extraContext={`Zone rooms:\n${roomNames}`}
                assetType="video"
                context={{ zone: zoneId, entity_type: "zone", entity_id: "zone_intro" }}
                variantGroup={`zone-media:${zoneId}:zone_intro`}
                markActive
                onAccept={() => {
                  /* saved as a generated asset; no zone-level field to set */
                }}
              />
              {!zoneImagePath && (
                <p className="text-2xs italic text-text-muted">
                  Generate a room image first — zone intro video needs a source frame.
                </p>
              )}
            </MediaCard>
          </div>

          {/* Per-room coverage */}
          <div className="rounded-md border border-border-muted bg-[var(--chrome-fill-soft)] p-4 shadow-[0_1px_0_var(--chrome-highlight)_inset]">
            <div className="mb-3">
              <h3 className="font-display text-sm uppercase tracking-widest text-accent">Room Coverage</h3>
              <p className="mt-1 text-xs text-text-muted">
                Per-room audio and video assignments. Rooms without a track fall back to zone defaults.
              </p>
            </div>
            <div className="overflow-hidden rounded border border-border-muted">
              <div className="flex items-center gap-3 border-b border-border-muted bg-[var(--chrome-highlight)] px-3 py-1.5 text-2xs font-medium uppercase tracking-wider text-text-muted">
                <span className="flex-1">Room</span>
                <span className="flex w-12 items-center justify-center" title="Music">
                  <MusicIcon />
                </span>
                <span className="flex w-12 items-center justify-center" title="Ambient">
                  <AmbientIcon />
                </span>
                <span className="flex w-12 items-center justify-center" title="Video">
                  <VideoIcon />
                </span>
              </div>
              <div className="divide-y divide-border-muted">
                {Object.entries(world.rooms).map(([id, room]) => (
                  <div
                    key={id}
                    className="flex items-center gap-3 px-3 py-1.5 text-xs transition-colors hover:bg-[var(--chrome-highlight)]"
                  >
                    <span className="flex-1 truncate text-text-secondary" title={room.title}>
                      {room.title}
                    </span>
                    <CoverageDot set={!!room.music} />
                    <CoverageDot set={!!room.ambient} />
                    <CoverageDot set={!!room.video} />
                  </div>
                ))}
                {totalRooms === 0 && (
                  <div className="px-3 py-4 text-center text-xs italic text-text-muted">
                    No rooms yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MediaCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-border-muted bg-[var(--chrome-fill-soft)] p-4 shadow-[0_1px_0_var(--chrome-highlight)_inset]">
      <div className="mb-2 flex items-center gap-2 text-accent">
        {icon}
        <h3 className="font-display text-sm uppercase tracking-widest">{title}</h3>
      </div>
      <p className="mb-3 text-xs text-text-muted">{description}</p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function StatsPill({
  icon,
  label,
  count,
  total,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);
  const dim = count === 0;
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border border-border-muted bg-[var(--chrome-fill-soft)] px-2.5 py-1 ${
        dim ? "text-text-muted" : "text-text-secondary"
      }`}
    >
      <span className={dim ? "text-text-muted" : "text-accent"}>{icon}</span>
      <span className="uppercase tracking-wider">{label}</span>
      <span className={`font-mono ${dim ? "text-text-muted" : "text-text-primary"}`}>
        {count}/{total}
      </span>
      <span className="text-text-muted">·</span>
      <span className="font-mono text-text-muted">{pct}%</span>
    </div>
  );
}

function CoverageDot({ set }: { set: boolean }) {
  return (
    <span className="flex w-12 items-center justify-center">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          set ? "bg-status-success shadow-[0_0_6px_rgb(124_182_109/0.7)]" : "bg-border-default"
        }`}
        aria-label={set ? "present" : "missing"}
      />
    </span>
  );
}
