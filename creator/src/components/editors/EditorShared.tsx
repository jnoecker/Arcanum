import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Section, FieldRow, TextInput } from "@/components/ui/FormWidgets";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { MediaPicker } from "@/components/ui/MediaPicker";
import { MusicGenerator } from "@/components/ui/MusicGenerator";
import { VideoGenerator } from "@/components/ui/VideoGenerator";
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

const DESCRIBE_SYSTEM_PROMPT = `You are a creative writer for a fantasy MUD (text-based RPG). Given an entity's current data, write a vivid visual description suitable for both in-game flavor text and AI art generation.

Rules:
- Write 1-2 sentences of physical/visual description
- Focus on appearance: what would someone SEE when encountering this entity?
- Include distinctive visual details (colors, materials, size, posture, clothing, features)
- Match the entity's tier/role (a weak creature looks unassuming, a boss looks imposing)
- Do NOT include game mechanics (HP, damage, stats)
- Do NOT include the entity's name in the description
- Output ONLY the description text — no quotes, no explanation, no preamble`;

/** Button that uses the LLM to generate/enhance an entity description. */
export function EnhanceDescriptionButton({
  entitySummary,
  currentDescription,
  onAccept,
  vibe,
  systemPrompt,
  label,
}: {
  entitySummary: string;
  currentDescription?: string;
  onAccept: (description: string) => void;
  vibe?: string;
  /** Override the default system prompt (e.g. for lore/backstory enhancement). */
  systemPrompt?: string;
  /** Override button label. Defaults to "Enhance". */
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnhance = async () => {
    setLoading(true);
    setError(null);
    try {
      const parts = [entitySummary];
      if (currentDescription) {
        parts.push(`\nCurrent description (improve or expand on this): ${currentDescription}`);
      }
      if (vibe) {
        parts.push(`\nZone atmosphere: ${vibe}`);
      }
      const result = await invoke<string>("llm_complete", {
        systemPrompt: systemPrompt ?? DESCRIBE_SYSTEM_PROMPT,
        userPrompt: parts.join("\n"),
      });
      onAccept(result.trim());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      console.error("[EnhanceDescriptionButton]", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleEnhance}
        disabled={loading}
        className="shrink-0 rounded px-1.5 py-0.5 text-2xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
        title="Use AI to write a description"
      >
        {loading ? "..." : (label ?? "Enhance")}
      </button>
      {error && (
        <span className="truncate text-2xs text-status-error" title={error}>
          {error.length > 60 ? `${error.slice(0, 60)}…` : error}
        </span>
      )}
    </div>
  );
}

export function MediaSection({
  image,
  onImageChange,
  video,
  onVideoChange,
  getPrompt,
  entityContext,
  assetType,
  context,
  vibe,
}: {
  image: string | undefined;
  onImageChange: (v: string | undefined) => void;
  video?: string;
  onVideoChange?: (v: string | undefined) => void;
  getPrompt?: (style: ArtStyle) => string;
  entityContext?: string;
  assetType?: string;
  context?: AssetContext;
  vibe?: string;
}) {
  return (
    <Section title="Media">
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Image">
          <TextInput
            value={image ?? ""}
            onCommit={(v) => onImageChange(v || undefined)}
            placeholder="None"
          />
        </FieldRow>
        {getPrompt && (
          <EntityArtGenerator
            getPrompt={getPrompt}
            entityContext={entityContext}
            currentImage={image}
            onAccept={(filePath) => onImageChange(filePath)}
            assetType={assetType}
            context={context}
            vibe={vibe}
          />
        )}
        {onVideoChange && (
          <>
            <FieldRow label="Video">
              <TextInput
                value={video ?? ""}
                onCommit={(v) => onVideoChange(v || undefined)}
                placeholder="None"
              />
            </FieldRow>
            <MediaPicker
              value={video}
              onChange={onVideoChange}
              mediaType="video"
              assetType="video"
            />
            {image && (
              <VideoGenerator
                imagePath={image}
                onAccept={(filePath) => onVideoChange(filePath)}
              />
            )}
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
  roomTitle,
  roomDescription,
  vibe,
}: {
  music?: string;
  onMusicChange?: (v: string | undefined) => void;
  ambient?: string;
  onAmbientChange?: (v: string | undefined) => void;
  audio?: string;
  onAudioChange?: (v: string | undefined) => void;
  roomTitle?: string;
  roomDescription?: string;
  vibe?: string;
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
                placeholder="None"
              />
            </FieldRow>
            <MediaPicker
              value={music}
              onChange={onMusicChange}
              mediaType="audio"
              assetType="music"
            />
            <MusicGenerator
              roomTitle={roomTitle}
              roomDescription={roomDescription}
              vibe={vibe}
              currentAudio={music}
              onAccept={(filePath) => onMusicChange(filePath)}
            />
          </>
        )}
        {onAmbientChange && (
          <>
            <FieldRow label="Ambient">
              <TextInput
                value={ambient ?? ""}
                onCommit={(v) => onAmbientChange(v || undefined)}
                placeholder="None"
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
                placeholder="None"
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
