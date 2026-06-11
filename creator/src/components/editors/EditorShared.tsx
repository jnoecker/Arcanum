import { useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Section, FieldRow, TextInput, CommitTextarea, NumberInput } from "@/components/ui/FormWidgets";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { MediaPicker } from "@/components/ui/MediaPicker";
import { VideoGenerator } from "@/components/ui/VideoGenerator";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AI_ENABLED } from "@/lib/featureFlags";
import type { ArtStyle } from "@/lib/arcanumPrompts";
import type { AssetContext } from "@/types/assets";

export function MediaDisclosure({
  label,
  hasValue,
  children,
}: {
  label: string;
  hasValue: boolean;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(hasValue);

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="self-start rounded-full border border-border-default bg-bg-elevated px-3 py-1 text-2xs font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
      >
        + {label}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded border border-border-default/60 bg-bg-primary/30 px-2 py-2">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">{label}</span>
        <button
          onClick={() => setExpanded(false)}
          className="rounded px-1 text-sm leading-none text-text-muted transition-colors hover:text-text-primary"
          title={`Hide ${label}`}
          aria-label={`Hide ${label}`}
        >
          &times;
        </button>
      </div>
      {children}
    </div>
  );
}

export function DeleteEntityButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="mt-4 border-t border-border-muted pt-3">
      <button
        onClick={() => setConfirming(true)}
        className="w-full rounded border border-status-danger/40 px-2 py-1.5 text-xs text-status-danger transition-colors hover:bg-status-danger/10"
      >
        {label}
      </button>
      {confirming && (
        <ConfirmDialog
          title="Confirm Removal"
          message={`${label}? This action cannot be undone.`}
          confirmLabel="Remove"
          destructive
          onConfirm={() => {
            setConfirming(false);
            onClick();
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

/** Footer with Duplicate + Delete actions for entity editors. Shares the
 *  same visual separator as the standalone DeleteEntityButton so editors
 *  that don't support duplication can keep using that one. */
export function EntityActionsFooter({
  onDuplicate,
  onDelete,
  duplicateLabel,
  deleteLabel,
}: {
  onDuplicate: () => void;
  onDelete: () => void;
  duplicateLabel: string;
  deleteLabel: string;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-border-muted pt-3">
      <button
        onClick={onDuplicate}
        className="w-full rounded border border-border-default px-2 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
      >
        {duplicateLabel}
      </button>
      <button
        onClick={() => setConfirming(true)}
        className="w-full rounded border border-status-danger/40 px-2 py-1.5 text-xs text-status-danger transition-colors hover:bg-status-danger/10"
      >
        {deleteLabel}
      </button>
      {confirming && (
        <ConfirmDialog
          title="Confirm Removal"
          message={`${deleteLabel}? This action cannot be undone.`}
          confirmLabel="Remove"
          destructive
          onConfirm={() => {
            setConfirming(false);
            onDelete();
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
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
  vibe: _vibe,
  systemPrompt,
  label,
}: {
  entitySummary: string;
  currentDescription?: string;
  onAccept: (description: string) => void;
  /** @deprecated Vibe no longer influences enhancement; field kept for callers pending cleanup. */
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

  if (!AI_ENABLED) return null;

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

/**
 * Text alternative for a cinematic — narrated as a vision to text and
 * screen-reader clients in place of the video, and shown verbatim as the
 * transcript under the video in the web client. Valid without a `video`
 * (a text-only vision). Pairs everywhere a `video` field exists.
 */
export function VideoVisionFields({
  videoText,
  onVideoTextChange,
  videoTextSeconds,
  onVideoTextSecondsChange,
}: {
  videoText?: string;
  onVideoTextChange: (v: string | undefined) => void;
  videoTextSeconds?: number;
  onVideoTextSecondsChange: (v: number | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <CommitTextarea
        label="Vision text"
        value={videoText ?? ""}
        onCommit={(v) => onVideoTextChange(v.trim() ? v : undefined)}
        rows={3}
        placeholder="A hawk's-eye sweep over slate rooftops and lantern-lit lanes…"
      />
      <p className="text-2xs text-text-muted">
        Narrated to text & screen-reader players as a vision, and shown as the
        video transcript. Write the content of the vision, not the file.
      </p>
      <FieldRow label="Vision seconds">
        <NumberInput
          value={videoTextSeconds}
          onCommit={onVideoTextSecondsChange}
          min={0}
          placeholder="All at once"
          dense
        />
      </FieldRow>
    </div>
  );
}

export function MediaSection({
  image,
  onImageChange,
  video,
  onVideoChange,
  videoText,
  onVideoTextChange,
  videoTextSeconds,
  onVideoTextSecondsChange,
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
  videoText?: string;
  onVideoTextChange?: (v: string | undefined) => void;
  videoTextSeconds?: number;
  onVideoTextSecondsChange?: (v: number | undefined) => void;
  getPrompt?: (style: ArtStyle) => string;
  entityContext?: string;
  assetType?: string;
  context?: AssetContext;
  vibe?: string;
}) {
  return (
    <Section title="Media">
      <div className="flex flex-col gap-3">
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
              surface="worldbuilding"
            />
          )}
        </div>
        {onVideoChange && (
          <MediaDisclosure label="Video" hasValue={!!video || !!videoText}>
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
            {onVideoTextChange && onVideoTextSecondsChange && (
              <VideoVisionFields
                videoText={videoText}
                onVideoTextChange={onVideoTextChange}
                videoTextSeconds={videoTextSeconds}
                onVideoTextSecondsChange={onVideoTextSecondsChange}
              />
            )}
          </MediaDisclosure>
        )}
      </div>
    </Section>
  );
}

