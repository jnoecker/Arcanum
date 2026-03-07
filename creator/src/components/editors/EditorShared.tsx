import { Section, FieldRow, TextInput } from "@/components/ui/FormWidgets";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { MediaPicker } from "@/components/ui/MediaPicker";
import type { ArtStyle } from "@/lib/arcanumPrompts";
import type { AssetContext } from "@/types/assets";

export function DeleteEntityButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <div className="mt-4 border-t border-border-muted pt-3">
      <button
        onClick={onClick}
        className="w-full rounded border border-status-danger/40 px-2 py-1.5 text-xs text-status-danger transition-colors hover:bg-status-danger/10"
      >
        {label}
      </button>
    </div>
  );
}

export function MediaSection({
  image,
  onImageChange,
  video,
  onVideoChange,
  getPrompt,
  assetType,
  context,
}: {
  image: string | undefined;
  onImageChange: (v: string | undefined) => void;
  video?: string;
  onVideoChange?: (v: string | undefined) => void;
  getPrompt?: (style: ArtStyle) => string;
  assetType?: string;
  context?: AssetContext;
}) {
  return (
    <Section title="Media">
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Image">
          <TextInput
            value={image ?? ""}
            onCommit={(v) => onImageChange(v || undefined)}
            placeholder="none"
          />
        </FieldRow>
        {getPrompt && (
          <EntityArtGenerator
            getPrompt={getPrompt}
            currentImage={image}
            onAccept={(filePath) => onImageChange(filePath)}
            assetType={assetType}
            context={context}
          />
        )}
        {onVideoChange && (
          <>
            <FieldRow label="Video">
              <TextInput
                value={video ?? ""}
                onCommit={(v) => onVideoChange(v || undefined)}
                placeholder="none"
              />
            </FieldRow>
            <MediaPicker
              value={video}
              onChange={onVideoChange}
              mediaType="video"
              assetType="video"
            />
          </>
        )}
      </div>
    </Section>
  );
}

export function AudioSection({
  music,
  onMusicChange,
  ambient,
  onAmbientChange,
  audio,
  onAudioChange,
}: {
  music?: string;
  onMusicChange?: (v: string | undefined) => void;
  ambient?: string;
  onAmbientChange?: (v: string | undefined) => void;
  audio?: string;
  onAudioChange?: (v: string | undefined) => void;
}) {
  const hasAny = onMusicChange || onAmbientChange || onAudioChange;
  if (!hasAny) return null;

  return (
    <Section title="Audio">
      <div className="flex flex-col gap-1.5">
        {onMusicChange && (
          <>
            <FieldRow label="Music">
              <TextInput
                value={music ?? ""}
                onCommit={(v) => onMusicChange(v || undefined)}
                placeholder="none"
              />
            </FieldRow>
            <MediaPicker
              value={music}
              onChange={onMusicChange}
              mediaType="audio"
              assetType="music"
            />
          </>
        )}
        {onAmbientChange && (
          <>
            <FieldRow label="Ambient">
              <TextInput
                value={ambient ?? ""}
                onCommit={(v) => onAmbientChange(v || undefined)}
                placeholder="none"
              />
            </FieldRow>
            <MediaPicker
              value={ambient}
              onChange={onAmbientChange}
              mediaType="audio"
              assetType="ambient"
            />
          </>
        )}
        {onAudioChange && (
          <>
            <FieldRow label="Audio">
              <TextInput
                value={audio ?? ""}
                onCommit={(v) => onAudioChange(v || undefined)}
                placeholder="none"
              />
            </FieldRow>
            <MediaPicker
              value={audio}
              onChange={onAudioChange}
              mediaType="audio"
              assetType="audio"
            />
          </>
        )}
      </div>
    </Section>
  );
}
