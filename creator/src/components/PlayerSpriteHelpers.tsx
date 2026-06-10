import { memo, useState, useCallback } from "react";
import { useImageSrc } from "@/lib/useImageSrc";
import { generateArtDirection } from "@/lib/spritePromptGen";
import { AI_ENABLED } from "@/lib/featureFlags";
import type { BulkBgTarget } from "@/components/ui/BulkBgRemoval";
import type {
  SpriteDefinition,
  SpriteRequirement,
  RequirementType,
} from "@/types/sprites";
import { ActionButton } from "./ui/FormWidgets";
import { SpriteArtGenerator } from "./SpriteArtGenerator";

// ─── Helpers ────────────────────────────────────────────────────────

function emptyRequirement(type: RequirementType): SpriteRequirement {
  switch (type) {
    case "minLevel": return { type: "minLevel", level: 1 };
    case "race": return { type: "race", race: "" };
    case "class": return { type: "class", playerClass: "" };
    case "achievement": return { type: "achievement", achievementId: "" };
    case "staff": return { type: "staff" };
  }
}

export function requirementLabel(req: SpriteRequirement): string {
  switch (req.type) {
    case "minLevel": return `Level ${req.level}+`;
    case "race": return `Race: ${req.race || "?"}`;
    case "class": return `Class: ${req.playerClass || "?"}`;
    case "achievement": return `Achievement: ${req.achievementId || "?"}`;
    case "staff": return "Staff";
  }
}

const REQUIREMENT_TYPES: { value: RequirementType; label: string }[] = [
  { value: "minLevel", label: "Min Level" },
  { value: "race", label: "Race" },
  { value: "class", label: "Class" },
  { value: "achievement", label: "Achievement" },
  { value: "staff", label: "Staff" },
];

// ─── Thumbnail ──────────────────────────────────────────────────────

export const SpriteThumbnail = memo(function SpriteThumbnail({
  fileName,
  label,
  size = "h-12 w-12",
  onClick,
}: {
  fileName: string | undefined;
  label: string;
  size?: string;
  onClick?: () => void;
}) {
  const src = useImageSrc(fileName);
  const clickable = onClick && src;
  if (!src) {
    return (
      <div className={`flex ${size} items-center justify-center rounded-lg border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-highlight)] text-2xs text-text-muted`}>
        --
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={label}
      className={`${size} rounded-lg object-cover${clickable ? " cursor-pointer ring-accent/50 hover:ring-2" : ""}`}
      onClick={onClick}
    />
  );
});

// ─── Art direction field ────────────────────────────────────────────

interface ArtDirectionFieldProps {
  def: SpriteDefinition;
  onPatch: (patch: Partial<SpriteDefinition>) => void;
  hasLlmKey: boolean;
}

export function ArtDirectionField({
  def,
  onPatch,
  hasLlmKey,
}: ArtDirectionFieldProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAiSuggest = async () => {
    setGenerating(true);
    setError(null);
    try {
      const raceReq = def.requirements.find((r) => r.type === "race");
      const classReq = def.requirements.find((r) => r.type === "class");
      const result = await generateArtDirection(
        def.displayName,
        raceReq?.type === "race" ? raceReq.race : undefined,
        classReq?.type === "class" ? classReq.playerClass : undefined,
        def.gender,
      );
      onPatch({ artDirection: result });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary">Art Direction</span>
        {AI_ENABLED && (
          <button
            onClick={handleAiSuggest}
            disabled={generating || !hasLlmKey}
            className="shrink-0 rounded px-1.5 py-0.5 text-2xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
            title={hasLlmKey ? "Use AI to suggest visual art direction" : "No LLM API key configured"}
          >
            {generating ? "Generating..." : "AI Suggest"}
          </button>
        )}
      </div>
      <textarea
        className="ornate-input min-h-[5rem] resize-y rounded-3xl px-4 py-3 text-sm text-text-primary"
        placeholder="Describe the visual appearance for AI image generation — e.g. 'A battle-scarred warrior in gleaming silver plate armor with a flaming greatsword, crimson cape billowing...'"
        value={def.artDirection ?? ""}
        onChange={(e) => onPatch({ artDirection: e.target.value || undefined })}
      />
      {!def.artDirection && (
        <p className="text-2xs text-text-muted">
          Add art direction to guide sprite generation. Use AI Suggest for a starting point.
        </p>
      )}
      {error && (
        <span className="truncate text-2xs text-status-error" title={error}>
          {error.length > 60 ? `${error.slice(0, 60)}…` : error}
        </span>
      )}
    </div>
  );
}

// ─── Requirement editor row ─────────────────────────────────────────

interface RequirementRowProps {
  req: SpriteRequirement;
  index: number;
  races: string[];
  classes: string[];
  onChange: (index: number, req: SpriteRequirement) => void;
  onRemove: (index: number) => void;
}

export function RequirementRow({
  req,
  index,
  races,
  classes,
  onChange,
  onRemove,
}: RequirementRowProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-3 py-2">
      <select
        value={req.type}
        onChange={(e) => onChange(index, emptyRequirement(e.target.value as RequirementType))}
        className="ornate-input min-h-11 rounded-2xl px-3 py-3 text-sm text-text-primary"
      >
        {REQUIREMENT_TYPES.map((rt) => (
          <option key={rt.value} value={rt.value}>{rt.label}</option>
        ))}
      </select>

      {req.type === "minLevel" && (
        <input
          type="number"
          min={1}
          value={req.level}
          onChange={(e) => onChange(index, { type: "minLevel", level: parseInt(e.target.value) || 1 })}
          className="ornate-input min-h-11 w-24 rounded-2xl px-3 py-3 text-sm text-text-primary"
          placeholder="Level"
        />
      )}

      {req.type === "race" && (
        <select
          value={req.race}
          onChange={(e) => onChange(index, { type: "race", race: e.target.value })}
          className="ornate-input min-h-11 rounded-2xl px-3 py-3 text-sm text-text-primary"
        >
          <option value="">Select race...</option>
          {races.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      )}

      {req.type === "class" && (
        <select
          value={req.playerClass}
          onChange={(e) => onChange(index, { type: "class", playerClass: e.target.value })}
          className="ornate-input min-h-11 rounded-2xl px-3 py-3 text-sm text-text-primary"
        >
          <option value="">Select class...</option>
          {classes.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      )}

      {req.type === "achievement" && (
        <input
          value={req.achievementId}
          onChange={(e) => onChange(index, { type: "achievement", achievementId: e.target.value })}
          className="ornate-input min-h-11 flex-1 rounded-2xl px-3 py-3 text-sm text-text-primary"
          placeholder="e.g. combat/secret_slayer"
        />
      )}

      {req.type === "staff" && (
        <span className="text-2xs text-text-muted">Player must be staff</span>
      )}

      <ActionButton
        onClick={() => onRemove(index)}
        className="ml-auto shrink-0"
        variant="danger"
        size="sm"
      >
        Remove
      </ActionButton>
    </div>
  );
}

// ─── Sprite detail editor ───────────────────────────────────────────

interface SpriteDetailEditorProps {
  id: string;
  def: SpriteDefinition;
  races: string[];
  classes: string[];
  spriteAssetMap: Map<string, { fileName: string; assetId: string }>;
  hasLlmKey: boolean;
  onPatch: (patch: Partial<SpriteDefinition>) => void;
  onDelete: () => void;
}

export function SpriteDetailEditor({
  id,
  def,
  races,
  classes,
  spriteAssetMap,
  hasLlmKey,
  onPatch,
  onDelete,
}: SpriteDetailEditorProps) {
  const handleAddRequirement = useCallback(() => {
    onPatch({ requirements: [...def.requirements, emptyRequirement("minLevel")] });
  }, [def.requirements, onPatch]);

  const handleChangeRequirement = useCallback((index: number, req: SpriteRequirement) => {
    const reqs = [...def.requirements];
    reqs[index] = req;
    onPatch({ requirements: reqs });
  }, [def.requirements, onPatch]);

  const handleRemoveRequirement = useCallback((index: number) => {
    onPatch({ requirements: def.requirements.filter((_, i) => i !== index) });
  }, [def.requirements, onPatch]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-text-primary">{def.displayName}</h3>
        <ActionButton
          onClick={onDelete}
          variant="danger"
        >
          Delete Sprite
        </ActionButton>
      </div>

      {/* Basic fields */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-3">
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Display Name
            <input
              className="ornate-input min-h-11 rounded-2xl px-4 py-3 text-sm text-text-primary"
              value={def.displayName}
              onChange={(e) => onPatch({ displayName: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Category
            <select
              className="ornate-input min-h-11 rounded-2xl px-4 py-3 text-sm text-text-primary"
              value={def.category}
              onChange={(e) => onPatch({ category: e.target.value as "general" | "staff" })}
            >
              <option value="general">General</option>
              <option value="staff">Staff</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Gender
            <select
              className="ornate-input min-h-11 rounded-2xl px-4 py-3 text-sm text-text-primary"
              value={def.gender ?? ""}
              onChange={(e) => onPatch({ gender: e.target.value || undefined })}
            >
              <option value="">Any</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="nonbinary">Nonbinary</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Sort Order
            <input
              type="number"
              className="ornate-input min-h-11 rounded-2xl px-4 py-3 text-sm text-text-primary"
              value={def.sortOrder}
              onChange={(e) => onPatch({ sortOrder: parseInt(e.target.value) || 0 })}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Description
          <textarea
            className="ornate-input min-h-[7rem] resize-y rounded-3xl px-4 py-3 text-sm text-text-primary"
            placeholder="Flavor text shown to players..."
            value={def.description ?? ""}
            onChange={(e) => onPatch({ description: e.target.value || undefined })}
          />
        </label>

        <ArtDirectionField def={def} onPatch={onPatch} hasLlmKey={hasLlmKey} />
      </div>

      {/* Requirements */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="font-display text-sm text-text-primary">
            Requirements ({def.requirements.length})
          </h4>
          <ActionButton
            onClick={handleAddRequirement}
            variant="secondary"
            size="sm"
          >
            Add Requirement
          </ActionButton>
        </div>
        {def.requirements.length === 0 && (
          <p className="text-2xs text-text-muted">
            No requirements &mdash; this sprite will be available to all players.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {def.requirements.map((req, idx) => (
            <RequirementRow
              key={idx}
              req={req}
              index={idx}
              races={races}
              classes={classes}
              onChange={handleChangeRequirement}
              onRemove={handleRemoveRequirement}
            />
          ))}
        </div>
      </div>

      {/* Image */}
      <div>
        <h4 className="mb-2 font-display text-sm text-text-primary">Image</h4>
        <SpriteArtGenerator
          id={id}
          def={def}
          currentImage={spriteAssetMap.get(id)?.fileName}
        />
      </div>
    </div>
  );
}

// ─── Utility: collect sprite BG removal targets ─────────────────────

export function collectSpriteBgTargets(
  spriteAssetMap: Map<string, { fileName: string; assetId: string }>,
  definitions: Record<string, SpriteDefinition>,
  assetsDir: string,
): BulkBgTarget[] {
  const targets: BulkBgTarget[] = [];

  for (const [id, def] of Object.entries(definitions)) {
    // Collect all image IDs: either from variants or the single image shorthand
    const imageIds: string[] = [];
    if (def.variants && def.variants.length > 0) {
      for (const v of def.variants) imageIds.push(v.imageId);
    } else {
      imageIds.push(id);
    }

    for (const imageId of imageIds) {
      const asset = spriteAssetMap.get(imageId);
      if (!asset) continue;

      targets.push({
        id: imageId,
        label: `${def.displayName} — ${imageId}`,
        imagePath: asset.fileName,
        resolvedPath: `${assetsDir}\\images\\${asset.fileName}`,
        assetType: "player_sprite",
        variantGroup: `player_sprite:${imageId}`,
        context: { zone: "sprites", entity_type: "player_sprite", entity_id: imageId },
      });
    }
  }

  return targets;
}
