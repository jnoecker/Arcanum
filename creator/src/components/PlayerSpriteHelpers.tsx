import { memo, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useImageSrc, isR2HashPath } from "@/lib/useImageSrc";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { removeBgAndSave } from "@/lib/useBackgroundRemoval";
import { generateArtDirection } from "@/lib/spritePromptGen";
import { AI_ENABLED } from "@/lib/featureFlags";
import type { BulkBgTarget } from "@/components/ui/BulkBgRemoval";
import type {
  SpriteDefinition,
  SpriteVariant,
  SpriteRequirement,
  RequirementType,
} from "@/types/sprites";
import { ActionButton } from "./ui/FormWidgets";

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

// ─── Lightbox ───────────────────────────────────────────────────────

export function SpriteLightbox({
  spriteKey: key,
  fileName,
  variantGroup,
  canRegenerate,
  canDelete,
  onRegenerate,
  onDelete,
  onRemoveBg,
  onFlip,
  onClose,
}: {
  spriteKey: string;
  fileName: string;
  variantGroup: string;
  canRegenerate: boolean;
  canDelete: boolean;
  onRegenerate: () => void;
  onDelete: () => void;
  onRemoveBg: () => void;
  onFlip?: (newFileName: string) => void;
  onClose: () => void;
}) {
  const src = useImageSrc(fileName);
  const [removingBg, setRemovingBg] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const lightboxTrapRef = useFocusTrap<HTMLDivElement>(onClose);

  const handleRemoveBg = async () => {
    if (!src) return;
    setRemovingBg(true);
    try {
      const context = { zone: "sprites", entity_type: "player_sprite", entity_id: key };
      const entry = await removeBgAndSave(src, "player_sprite", context, variantGroup);
      if (entry) onRemoveBg();
    } catch (err) {
      console.error("[player sprite] bg removal failed:", err);
    } finally {
      setRemovingBg(false);
    }
  };

  return (
    <div
      ref={lightboxTrapRef}
      className="modal-overlay"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {src ? (
          <img
            src={src}
            alt={`Sprite: ${key}`}
            className="max-h-[80vh] max-w-[80vw] rounded border border-border-default object-contain"
            style={{ imageRendering: "auto" }}
          />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center rounded border border-border-default bg-bg-tertiary text-text-muted">
            Rendering preview...
          </div>
        )}
        <span className="font-mono text-xs text-text-secondary">{key}</span>
        <div className="flex gap-2">
          <ActionButton
            onClick={onRegenerate}
            disabled={!canRegenerate}
            variant="primary"
          >
            Regenerate
          </ActionButton>
          <ActionButton
            onClick={handleRemoveBg}
            disabled={removingBg || !src}
            variant="secondary"
          >
            {removingBg ? "Removing BG..." : "Remove BG"}
          </ActionButton>
          {isR2HashPath(fileName) && onFlip && (
            <ActionButton
              onClick={async () => {
                setFlipping(true);
                try {
                  const newFileName = await invoke<string>("flip_image", { imageRef: fileName });
                  onFlip(newFileName);
                } catch (e) {
                  console.error("Flip failed:", e);
                } finally {
                  setFlipping(false);
                }
              }}
              disabled={flipping}
              variant="secondary"
            >
              {flipping ? "Flipping..." : "\u21C4 Flip"}
            </ActionButton>
          )}
          <ActionButton
            onClick={onDelete}
            disabled={!canDelete}
            variant="danger"
          >
            Delete
          </ActionButton>
        </div>
        <ActionButton
          aria-label="Close"
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="absolute -right-4 -top-4"
        >
          x
        </ActionButton>
      </div>
    </div>
  );
}

// ─── Art direction field with AI assist ─────────────────────────────

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

// ─── Prompt preview modal ──────────────────────────────────────────

interface PromptPreviewModalProps {
  prompt: string;
  imageId: string;
  onGenerate: (editedPrompt: string) => void;
  onClose: () => void;
}

export function PromptPreviewModal({
  prompt,
  imageId,
  onGenerate,
  onClose,
}: PromptPreviewModalProps) {
  const [editedPrompt, setEditedPrompt] = useState(prompt);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-abyss/70"
      onClick={onClose}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-preview-title"
        className="mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-border-default bg-bg-secondary shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-default px-5 py-3">
          <div>
            <h2 id="prompt-preview-title" className="font-display text-sm tracking-wide text-text-primary">
              Preview & Generate
            </h2>
            <p className="mt-0.5 text-2xs text-text-muted">
              Review and tweak the prompt before generating &mdash; {imageId}
            </p>
          </div>
          <ActionButton onClick={onClose} variant="ghost" size="icon">x</ActionButton>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <textarea
            className="ornate-input min-h-[20rem] w-full resize-y rounded-3xl px-4 py-3 text-sm leading-relaxed text-text-primary"
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between border-t border-border-default px-5 py-3">
          <button
            onClick={() => setEditedPrompt(prompt)}
            className="text-2xs text-text-muted hover:text-text-secondary"
          >
            Reset to original
          </button>
          <div className="flex gap-2">
            <ActionButton onClick={onClose} variant="secondary" size="sm">
              Cancel
            </ActionButton>
            <ActionButton
              onClick={() => onGenerate(editedPrompt)}
              variant="primary"
              size="sm"
            >
              Generate
            </ActionButton>
          </div>
        </div>
      </div>
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

// ─── Variant editor ─────────────────────────────────────────────────

interface VariantRowProps {
  variant: SpriteVariant;
  index: number;
  races: string[];
  classes: string[];
  assetFileName: string | undefined;
  generating: boolean;
  hasApiKey: boolean;
  onPatch: (index: number, patch: Partial<SpriteVariant>) => void;
  onRemove: (index: number) => void;
  onGenerate: (variant: SpriteVariant) => void;
  onPreview: (variant: SpriteVariant) => void;
  onClickThumbnail?: () => void;
}

export function VariantRow({
  variant,
  index,
  races,
  classes,
  assetFileName,
  generating,
  hasApiKey,
  onPatch,
  onRemove,
  onGenerate,
  onPreview,
  onClickThumbnail,
}: VariantRowProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-3">
      <SpriteThumbnail fileName={assetFileName} label={variant.imageId} onClick={onClickThumbnail} />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-0.5 text-2xs text-text-muted">
            Image ID
            <input
              className="ornate-input min-h-11 rounded-2xl px-3 py-3 text-sm text-text-primary"
              value={variant.imageId}
              onChange={(e) => {
                const imageId = e.target.value;
                onPatch(index, { imageId, imagePath: `player_sprites/${imageId}.png` });
              }}
            />
          </label>
          <label className="flex flex-col gap-0.5 text-2xs text-text-muted">
            Display Name
            <input
              className="ornate-input min-h-11 rounded-2xl px-3 py-3 text-sm text-text-primary"
              placeholder="(inherits parent)"
              value={variant.displayName ?? ""}
              onChange={(e) => onPatch(index, { displayName: e.target.value || undefined })}
            />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-0.5 text-2xs text-text-muted">
            Race Filter
            <select
              className="ornate-input min-h-11 rounded-2xl px-3 py-3 text-sm text-text-primary"
              value={variant.race ?? ""}
              onChange={(e) => onPatch(index, { race: e.target.value || undefined })}
            >
              <option value="">Any</option>
              {races.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-2xs text-text-muted">
            Class Filter
            <select
              className="ornate-input min-h-11 rounded-2xl px-3 py-3 text-sm text-text-primary"
              value={variant.playerClass ?? ""}
              onChange={(e) => onPatch(index, { playerClass: e.target.value || undefined })}
            >
              <option value="">Any</option>
              {classes.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-2xs text-text-muted">
            Gender
            <select
              className="ornate-input min-h-11 rounded-2xl px-3 py-3 text-sm text-text-primary"
              value={variant.gender ?? ""}
              onChange={(e) => onPatch(index, { gender: e.target.value || undefined })}
            >
              <option value="">Any</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="nonbinary">Nonbinary</option>
            </select>
          </label>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-1">
        {AI_ENABLED && (
          <>
            <ActionButton
              onClick={() => onGenerate(variant)}
              disabled={!hasApiKey || generating}
              variant="secondary"
              size="sm"
            >
              {generating ? "..." : "Render"}
            </ActionButton>
            <ActionButton
              onClick={() => onPreview(variant)}
              disabled={!hasApiKey || generating}
              variant="ghost"
              size="sm"
            >
              Preview
            </ActionButton>
          </>
        )}
        <ActionButton
          onClick={() => onRemove(index)}
          variant="danger"
          size="sm"
        >
          Remove
        </ActionButton>
      </div>
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
  hasApiKey: boolean;
  hasLlmKey: boolean;
  generating: string | null;
  onPatch: (patch: Partial<SpriteDefinition>) => void;
  onDelete: () => void;
  onGenerateImage: (imageId: string) => void;
  onPreviewGenerate: (imageId: string) => void;
  onViewSprite: (imageId: string) => void;
}

export function SpriteDetailEditor({
  id,
  def,
  races,
  classes,
  spriteAssetMap,
  hasApiKey,
  hasLlmKey,
  generating,
  onPatch,
  onDelete,
  onGenerateImage,
  onPreviewGenerate,
  onViewSprite,
}: SpriteDetailEditorProps) {
  const useVariants = (def.variants && def.variants.length > 0) || false;

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

  const handleSwitchToVariants = useCallback(() => {
    const variants: SpriteVariant[] = [{
      imageId: id,
      imagePath: def.image || `player_sprites/${id}.png`,
    }];
    onPatch({ variants, image: undefined });
  }, [id, def.image, onPatch]);

  const handleSwitchToSingleImage = useCallback(() => {
    const image = def.variants?.[0]?.imagePath || `player_sprites/${id}.png`;
    onPatch({ image, variants: undefined });
  }, [id, def.variants, onPatch]);

  const handlePatchVariant = useCallback((index: number, patch: Partial<SpriteVariant>) => {
    if (!def.variants) return;
    const variants = def.variants.map((v, i) => (i === index ? { ...v, ...patch } : v));
    onPatch({ variants });
  }, [def.variants, onPatch]);

  const handleRemoveVariant = useCallback((index: number) => {
    if (!def.variants) return;
    onPatch({ variants: def.variants.filter((_, i) => i !== index) });
  }, [def.variants, onPatch]);

  const handleAddVariant = useCallback(() => {
    const suffix = def.variants ? def.variants.length : 0;
    const newVariant: SpriteVariant = {
      imageId: `${id}_v${suffix}`,
      imagePath: `player_sprites/${id}_v${suffix}.png`,
    };
    onPatch({ variants: [...(def.variants ?? []), newVariant] });
  }, [id, def.variants, onPatch]);

  const handleGenerateForVariant = useCallback((variant: SpriteVariant) => {
    onGenerateImage(variant.imageId);
  }, [onGenerateImage]);

  const handlePreviewForVariant = useCallback((variant: SpriteVariant) => {
    onPreviewGenerate(variant.imageId);
  }, [onPreviewGenerate]);

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

      {/* Image / Variants */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="font-display text-sm text-text-primary">
            {useVariants ? `Variants (${def.variants?.length ?? 0})` : "Image"}
          </h4>
          <div className="flex gap-2">
            {useVariants ? (
              <>
                <ActionButton
                  onClick={handleAddVariant}
                  variant="secondary"
                  size="sm"
                >
                  Add Variant
                </ActionButton>
                {(def.variants?.length ?? 0) <= 1 && (
                  <ActionButton
                    onClick={handleSwitchToSingleImage}
                    variant="ghost"
                    size="sm"
                  >
                    Use Single Image
                  </ActionButton>
                )}
              </>
            ) : (
              <ActionButton
                onClick={handleSwitchToVariants}
                variant="ghost"
                size="sm"
              >
                Use Variants
              </ActionButton>
            )}
          </div>
        </div>

        {useVariants ? (
          <div className="flex flex-col gap-3">
            {def.variants?.map((variant, idx) => (
              <VariantRow
                key={variant.imageId}
                variant={variant}
                index={idx}
                races={races}
                classes={classes}
                assetFileName={spriteAssetMap.get(variant.imageId)?.fileName}
                generating={generating === variant.imageId}
                hasApiKey={hasApiKey}
                onPatch={handlePatchVariant}
                onRemove={handleRemoveVariant}
                onGenerate={handleGenerateForVariant}
                onPreview={handlePreviewForVariant}
                onClickThumbnail={() => onViewSprite(variant.imageId)}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-3">
            <SpriteThumbnail
              fileName={spriteAssetMap.get(id)?.fileName}
              label={id}
              size="h-16 w-16"
              onClick={() => onViewSprite(id)}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label className="flex flex-col gap-0.5 text-2xs text-text-muted">
                Image Path
                <input
                  className="ornate-input min-h-11 rounded-2xl px-3 py-3 text-sm text-text-primary"
                  value={def.image ?? `player_sprites/${id}.png`}
                  onChange={(e) => onPatch({ image: e.target.value })}
                />
              </label>
            </div>
            {AI_ENABLED && (
              <div className="flex shrink-0 flex-col gap-1">
                <ActionButton
                  onClick={() => onGenerateImage(id)}
                  disabled={!hasApiKey || generating === id}
                  variant="primary"
                  size="sm"
                >
                  {generating === id ? "Generating..." : "Generate"}
                </ActionButton>
                <ActionButton
                  onClick={() => onPreviewGenerate(id)}
                  disabled={!hasApiKey || generating === id}
                  variant="secondary"
                  size="sm"
                >
                  Preview
                </ActionButton>
              </div>
            )}
          </div>
        )}
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
