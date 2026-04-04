import { memo, useState, useMemo, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSpriteDefinitionStore } from "@/stores/spriteDefinitionStore";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import { useAssetStore } from "@/stores/assetStore";
import { useImageSrc } from "@/lib/useImageSrc";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { UNIVERSAL_NEGATIVE } from "@/lib/arcanumPrompts";
import { removeBgAndSave } from "@/lib/useBackgroundRemoval";
import { IMAGE_MODELS, ENTITY_DIMENSIONS, imageGenerateCommand, requestsTransparentBackground } from "@/types/assets";
import {
  buildSpritePrompt,
  generateSpriteTemplate,
  getTierDefinitions,
  type SpriteDimensions,
  type SpritePromptTemplate,
} from "@/lib/spritePromptGen";
import type {
  SpriteDefinition,
  SpriteVariant,
  SpriteRequirement,
  RequirementType,
} from "@/types/sprites";
import type { GeneratedImage, AssetContext, SyncProgress } from "@/types/assets";
import type { AppConfig, TierDefinitionConfig } from "@/types/config";
import { ActionButton } from "./ui/FormWidgets";
import { TierSpriteScaffold } from "./TierSpriteScaffold";

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

function requirementLabel(req: SpriteRequirement): string {
  switch (req.type) {
    case "minLevel": return `Level ${req.level}+`;
    case "race": return `Race: ${req.race || "?"}`;
    case "class": return `Class: ${req.playerClass || "?"}`;
    case "achievement": return `Achievement: ${req.achievementId || "?"}`;
    case "staff": return "Staff";
  }
}

/** Get the effective imageId for a sprite (from variants or image shorthand). */
function primaryImageId(id: string, def: SpriteDefinition): string {
  if (def.variants && def.variants.length > 0) return def.variants[0]!.imageId;
  return id;
}

/** Get the effective image path for asset lookup. */
function primaryAssetKey(id: string, def: SpriteDefinition): string {
  return primaryImageId(id, def);
}

const REQUIREMENT_TYPES: { value: RequirementType; label: string }[] = [
  { value: "minLevel", label: "Min Level" },
  { value: "race", label: "Race" },
  { value: "class", label: "Class" },
  { value: "achievement", label: "Achievement" },
  { value: "staff", label: "Staff" },
];

const SPRITE_TEMPLATE_VIBE =
  "Dreamy character creation sprites for a magical fantasy world, cohesive with a softly enchanted storybook aesthetic.";

function findRequirement<T extends RequirementType>(
  requirements: SpriteRequirement[],
  type: T,
): Extract<SpriteRequirement, { type: T }> | undefined {
  return requirements.find(
    (requirement): requirement is Extract<SpriteRequirement, { type: T }> => requirement.type === type,
  );
}

function tierStartLevel(definition: TierDefinitionConfig): number | null {
  const levels = definition.levels.match(/\d+/g);
  if (!levels?.length) return null;
  return Number(levels[0]);
}

function inferTierFromLevel(level: number, tierDefinitions: Record<string, TierDefinitionConfig>): string {
  const candidates = Object.entries(tierDefinitions)
    .filter(([key]) => key !== "tstaff")
    .map(([key, value]) => ({ key, start: tierStartLevel(value) ?? Number.POSITIVE_INFINITY }))
    .sort((a, b) => a.start - b.start);

  let selected = candidates[0]?.key ?? "t1";
  for (const candidate of candidates) {
    if (level >= candidate.start) selected = candidate.key;
  }
  return selected;
}

function resolveSpriteDimensions(
  definition: SpriteDefinition,
  variant: SpriteVariant | undefined,
  config: AppConfig | null,
): SpriteDimensions {
  const tierDefinitions = config?.playerTiers ?? getTierDefinitions();
  const race = variant?.race
    || findRequirement(definition.requirements, "race")?.race
    || config?.characterCreation.defaultRace
    || Object.keys(config?.races ?? {})[0]
    || "archae";
  const playerClass = variant?.playerClass
    || findRequirement(definition.requirements, "class")?.playerClass
    || "base";
  const isStaff = definition.category === "staff" || Boolean(findRequirement(definition.requirements, "staff"));
  const minLevel = findRequirement(definition.requirements, "minLevel")?.level;
  const tier = isStaff
    ? "tstaff"
    : minLevel != null
      ? inferTierFromLevel(minLevel, tierDefinitions)
      : playerClass === "base"
        ? "t1"
        : inferTierFromLevel(10, tierDefinitions);

  return { race, playerClass, tier };
}

function findSpriteEntry(
  definitions: Record<string, SpriteDefinition>,
  imageId: string,
): { definitionId: string; definition: SpriteDefinition; variant?: SpriteVariant } | null {
  for (const [definitionId, definition] of Object.entries(definitions)) {
    const variant = definition.variants?.find((entry) => entry.imageId === imageId);
    if (variant) return { definitionId, definition, variant };
    if ((!definition.variants || definition.variants.length === 0) && definitionId === imageId) {
      return { definitionId, definition };
    }
  }
  return null;
}

function spritePromptNotes(definition: SpriteDefinition, variant?: SpriteVariant): string | undefined {
  const notes = [
    variant?.displayName && variant.displayName !== definition.displayName
      ? `Variant label: ${variant.displayName}`
      : null,
    definition.description?.trim() || null,
  ].filter(Boolean);

  return notes.length > 0 ? notes.join(". ") : undefined;
}

// ─── Thumbnail ──────────────────────────────────────────────────────

const SpriteThumbnail = memo(function SpriteThumbnail({
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
      <div className={`flex ${size} items-center justify-center rounded-lg border border-dashed border-white/12 bg-white/4 text-2xs text-text-muted`}>
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

function SpriteLightbox({
  spriteKey: key,
  fileName,
  variantGroup,
  canRegenerate,
  canDelete,
  onRegenerate,
  onDelete,
  onRemoveBg,
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
  onClose: () => void;
}) {
  const src = useImageSrc(fileName);
  const [removingBg, setRemovingBg] = useState(false);
  const lightboxTrapRef = useFocusTrap<HTMLDivElement>(onClose);

  const handleRemoveBg = async () => {
    if (!src) return;
    setRemovingBg(true);
    try {
      const context = { zone: "sprites", entity_type: "player_sprite", entity_id: key };
      const entry = await removeBgAndSave(src, "player_sprite", context, variantGroup);
      if (entry) onRemoveBg();
    } finally {
      setRemovingBg(false);
    }
  };

  return (
    <div
      ref={lightboxTrapRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
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

// ─── Requirement editor row ─────────────────────────────────────────

function RequirementRow({
  req,
  index,
  races,
  classes,
  onChange,
  onRemove,
}: {
  req: SpriteRequirement;
  index: number;
  races: string[];
  classes: string[];
  onChange: (index: number, req: SpriteRequirement) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-black/12 px-3 py-2">
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

function VariantRow({
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
  onClickThumbnail,
}: {
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
  onClickThumbnail?: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/8 bg-black/12 p-3">
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
        <ActionButton
          onClick={() => onGenerate(variant)}
          disabled={!hasApiKey || generating}
          variant="secondary"
          size="sm"
        >
          {generating ? "..." : "Render"}
        </ActionButton>
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

function SpriteDetailEditor({
  id,
  def,
  races,
  classes,
  spriteAssetMap,
  hasApiKey,
  generating,
  onPatch,
  onDelete,
  onGenerateImage,
  onViewSprite,
}: {
  id: string;
  def: SpriteDefinition;
  races: string[];
  classes: string[];
  spriteAssetMap: Map<string, { fileName: string; assetId: string }>;
  hasApiKey: boolean;
  generating: string | null;
  onPatch: (patch: Partial<SpriteDefinition>) => void;
  onDelete: () => void;
  onGenerateImage: (imageId: string) => void;
  onViewSprite: (imageId: string) => void;
}) {
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
        <div className="grid grid-cols-3 gap-3">
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
            className="ornate-input min-h-[7rem] resize-y rounded-[22px] px-4 py-3 text-sm text-text-primary"
            placeholder="Flavor text for this sprite..."
            value={def.description ?? ""}
            onChange={(e) => onPatch({ description: e.target.value || undefined })}
          />
        </label>
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
                onClickThumbnail={() => onViewSprite(variant.imageId)}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/12 p-3">
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
            <ActionButton
              onClick={() => onGenerateImage(id)}
              disabled={!hasApiKey || generating === id}
              className="shrink-0"
              variant="primary"
            >
              {generating === id ? "Generating..." : "Generate"}
            </ActionButton>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────

export function PlayerSpriteManager() {
  const definitions = useSpriteDefinitionStore((s) => s.definitions);
  const setDefinition = useSpriteDefinitionStore((s) => s.setDefinition);
  const deleteDefinition = useSpriteDefinitionStore((s) => s.deleteDefinition);
  const dirty = useSpriteDefinitionStore((s) => s.dirty);
  const saveDefinitions = useSpriteDefinitionStore((s) => s.saveDefinitions);

  const project = useProjectStore((s) => s.project);
  const config = useConfigStore((s) => s.config);
  const assets = useAssetStore((s) => s.assets);
  const settings = useAssetStore((s) => s.settings);
  const loadAssets = useAssetStore((s) => s.loadAssets);
  const acceptAsset = useAssetStore((s) => s.acceptAsset);
  const deleteAsset = useAssetStore((s) => s.deleteAsset);
  const assetsDir = useAssetStore((s) => s.assetsDir);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newId, setNewId] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<SyncProgress | null>(null);
  const [viewSprite, setViewSprite] = useState<{ key: string; fileName: string; assetId: string } | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showScaffold, setShowScaffold] = useState(false);
  const spriteTemplateRef = useRef<SpritePromptTemplate | null>(null);
  const spriteTemplatePromiseRef = useRef<Promise<SpritePromptTemplate | null> | null>(null);

  const races = useMemo(() => config ? Object.keys(config.races).map((r) => r.toUpperCase()) : [], [config]);
  const classes = useMemo(() => config ? Object.keys(config.classes).map((c) => c.toUpperCase()) : [], [config]);

  const imageProvider = settings?.image_provider ?? "deepinfra";
  const hasApiKey = !!(settings && (
    (imageProvider === "deepinfra" && settings.deepinfra_api_key.length > 0) ||
    (imageProvider === "runware" && settings.runware_api_key.length > 0) ||
    (imageProvider === "openai" && settings.openai_api_key.length > 0)
  ));
  const hasLlmKey = !!(
    settings?.deepinfra_api_key ||
    settings?.anthropic_api_key ||
    settings?.openrouter_api_key
  );

  useEffect(() => {
    spriteTemplateRef.current = null;
    spriteTemplatePromiseRef.current = null;
  }, [config]);

  // Map imageId → asset file name + asset id for thumbnails & lightbox
  const spriteAssetMap = useMemo(() => {
    const map = new Map<string, { fileName: string; assetId: string }>();
    for (const a of assets) {
      if (a.asset_type === "player_sprite" && a.variant_group?.startsWith("player_sprite:")) {
        const key = a.variant_group.replace("player_sprite:", "");
        if (!map.has(key) || a.is_active) {
          map.set(key, { fileName: a.file_name, assetId: a.id });
        }
      }
    }
    return map;
  }, [assets]);

  const sortedDefs = useMemo(
    () => Object.entries(definitions).sort(([, a], [, b]) => a.sortOrder - b.sortOrder),
    [definitions],
  );

  const selectedDef = selectedId ? definitions[selectedId] : null;

  const ensureSpriteTemplate = useCallback(async (): Promise<SpritePromptTemplate | null> => {
    if (spriteTemplateRef.current) return spriteTemplateRef.current;
    if (spriteTemplatePromiseRef.current) return spriteTemplatePromiseRef.current;
    if (!config || !hasLlmKey) return null;

    const promise = generateSpriteTemplate(
      Object.keys(config.races),
      Object.keys(config.classes),
      Object.keys(config.playerTiers ?? getTierDefinitions()),
      SPRITE_TEMPLATE_VIBE,
    )
      .then((template) => {
        spriteTemplateRef.current = template;
        return template;
      })
      .catch((error) => {
        console.warn("Failed to generate sprite prompt template, using fallback prompt composition.", error);
        return null;
      })
      .finally(() => {
        spriteTemplatePromiseRef.current = null;
      });

    spriteTemplatePromiseRef.current = promise;
    return promise;
  }, [config, hasLlmKey]);

  const readSeedImageDataUrl = useCallback(async (race: string): Promise<string | null> => {
    if ((imageProvider !== "deepinfra" && imageProvider !== "runware") || !assetsDir) return null;

    for (const [definitionId, definition] of Object.entries(definitions)) {
      const entries = definition.variants && definition.variants.length > 0
        ? definition.variants.map((variant) => ({ imageId: variant.imageId, variant }))
        : [{ imageId: definitionId, variant: undefined }];

      for (const entry of entries) {
        const dimensions = resolveSpriteDimensions(definition, entry.variant, config);
        if (dimensions.race !== race || dimensions.playerClass !== "base" || dimensions.tier === "tstaff") {
          continue;
        }

        const spriteAsset = spriteAssetMap.get(entry.imageId);
        if (!spriteAsset) continue;

        try {
          return await invoke<string>("read_image_data_url", {
            path: `${assetsDir}\\images\\${spriteAsset.fileName}`,
          });
        } catch {
          return null;
        }
      }
    }

    return null;
  }, [assetsDir, config, definitions, imageProvider, spriteAssetMap]);

  const handleAdd = useCallback(() => {
    const id = newId.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (!id || definitions[id]) return;
    setDefinition(id, {
      displayName: newId.trim() || id,
      category: "general",
      sortOrder: Object.keys(definitions).length * 10,
      requirements: [],
      image: `player_sprites/${id}.png`,
    });
    setNewId("");
    setSelectedId(id);
  }, [newId, definitions, setDefinition]);

  const handleSave = useCallback(async () => {
    if (!project) return;
    await saveDefinitions(project);
  }, [project, saveDefinitions]);

  const handlePatchSelected = useCallback(
    (patch: Partial<SpriteDefinition>) => {
      if (!selectedId || !selectedDef) return;
      setDefinition(selectedId, { ...selectedDef, ...patch });
    },
    [selectedId, selectedDef, setDefinition],
  );

  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return;
    deleteDefinition(selectedId);
    setSelectedId(null);
  }, [selectedId, deleteDefinition]);

  const handleViewSprite = useCallback(
    (imageId: string) => {
      const entry = spriteAssetMap.get(imageId);
      if (!entry) return;
      setViewSprite({ key: imageId, fileName: entry.fileName, assetId: entry.assetId });
    },
    [spriteAssetMap],
  );

  const handleGenerateImage = useCallback(
    async (imageId: string) => {
      if (!hasApiKey || !settings) return;
      setGenerating(imageId);
      setGenerationError(null);

      try {
        const resolved = findSpriteEntry(definitions, imageId);
        if (!resolved) throw new Error(`Unable to resolve sprite definition for "${imageId}".`);

        const template = await ensureSpriteTemplate();
        const dimensions = resolveSpriteDimensions(resolved.definition, resolved.variant, config);
        const finalPrompt = buildSpritePrompt(
          dimensions,
          template,
          spritePromptNotes(resolved.definition, resolved.variant),
        );
        const models = IMAGE_MODELS.filter((m) => m.provider === imageProvider);
        const model = models[0];
        if (!model) throw new Error("No image model available");

        const dims = ENTITY_DIMENSIONS.player_sprite ?? { width: 512, height: 512 };
        const seedImage = dimensions.playerClass !== "base" && dimensions.tier !== "tstaff"
          ? await readSeedImageDataUrl(dimensions.race)
          : null;

        const image = seedImage && imageProvider === "deepinfra"
          ? await invoke<GeneratedImage>("img2img_generate", {
              prompt: finalPrompt,
              imageBase64: seedImage,
              model: model.id,
              width: dims.width,
              height: dims.height,
              strength: 0.65,
              assetType: "player_sprite",
              autoEnhance: false,
            })
          : await invoke<GeneratedImage>(imageGenerateCommand(imageProvider), {
            prompt: finalPrompt,
            negativePrompt: UNIVERSAL_NEGATIVE,
            seedImage: seedImage && imageProvider === "runware" ? seedImage : null,
            seedStrength: seedImage && imageProvider === "runware" ? 0.65 : null,
            model: model.id,
            width: dims.width,
            height: dims.height,
            steps: model.defaultSteps,
            guidance: "defaultGuidance" in model ? model.defaultGuidance : null,
            assetType: "player_sprite",
            autoEnhance: false,
            transparentBackground: imageProvider === "openai" && requestsTransparentBackground("player_sprite"),
          });

        const assetContext: AssetContext = { zone: "sprites", entity_type: "player_sprite", entity_id: imageId };
        const variantGroup = `player_sprite:${imageId}`;

        await acceptAsset(image, "player_sprite", finalPrompt, assetContext, variantGroup, true);

        if (settings.auto_remove_bg && image.data_url) {
          removeBgAndSave(image.data_url, "player_sprite", assetContext, variantGroup).catch(() => {});
        }

        await loadAssets();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setGenerationError(message);
        console.error("Failed to generate sprite:", err);
      } finally {
        setGenerating(null);
      }
    },
    [acceptAsset, config, definitions, ensureSpriteTemplate, hasApiKey, imageProvider, loadAssets, readSeedImageDataUrl, settings],
  );

  const handleDeploy = useCallback(async () => {
    setDeploying(true);
    setDeployResult(null);
    try {
      const result = await invoke<SyncProgress>("deploy_sprites_to_r2");
      setDeployResult(result);
    } catch (e) {
      setDeployResult({ total: 0, uploaded: 0, skipped: 0, failed: 1, errors: [String(e)] });
    } finally {
      setDeploying(false);
    }
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg-primary">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border-default bg-bg-secondary px-4 py-2">
        <h2 className="font-display text-xs uppercase tracking-widest text-text-muted">
          Player Sprites
        </h2>
        <span className="text-2xs text-text-muted">
          {sortedDefs.length} definition{sortedDefs.length !== 1 ? "s" : ""}
        </span>
        <div className="flex-1" />
        {dirty && <span className="text-xs text-accent">modified</span>}
        <ActionButton
          onClick={handleSave}
          disabled={!dirty}
          variant="primary"
          size="sm"
        >
          Save
        </ActionButton>
        <ActionButton
          onClick={() => setShowScaffold(true)}
          variant="secondary"
          size="sm"
        >
          Fill Gaps
        </ActionButton>
        <ActionButton
          onClick={handleDeploy}
          disabled={deploying || sortedDefs.length === 0}
          variant="secondary"
          size="sm"
        >
          {deploying ? "Deploying..." : "Deploy to R2"}
        </ActionButton>
      </div>

      {/* Deploy result banner */}
      {deployResult && (
        <div className="shrink-0 border-b border-border-default bg-bg-elevated px-4 py-2">
          <div className="flex items-center gap-3 text-xs">
            {deployResult.uploaded > 0 && (
              <span className="text-status-success">
                {deployResult.uploaded} uploaded
              </span>
            )}
            {deployResult.skipped > 0 && (
              <span className="text-text-muted">
                {deployResult.skipped} already synced
              </span>
            )}
            {deployResult.failed > 0 && (
              <span className="text-status-error">
                {deployResult.failed} failed
              </span>
            )}
            <ActionButton
              onClick={() => setDeployResult(null)}
              variant="ghost"
              size="icon"
              className="ml-auto"
            >
              x
            </ActionButton>
          </div>
          {deployResult.errors.length > 0 && (
            <div className="mt-1 max-h-20 overflow-y-auto text-2xs text-status-error">
              {deployResult.errors.slice(0, 10).map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {generationError && (
        <div className="shrink-0 border-b border-border-default bg-status-error/10 px-4 py-2 text-xs text-status-error">
          {generationError}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Left: definition list */}
        <div className="flex w-72 min-w-0 shrink-0 flex-col border-r border-border-default bg-bg-secondary max-[900px]:w-56">
          <div className="flex items-center gap-1 border-b border-border-default px-3 py-2">
            <input
              className="ornate-input min-h-11 flex-1 rounded-2xl px-4 py-3 text-sm text-text-primary"
              placeholder="New sprite ID"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <ActionButton
              onClick={handleAdd}
              disabled={!newId.trim()}
              variant="secondary"
            >
              Add
            </ActionButton>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sortedDefs.map(([id, def]) => {
              const assetKey = primaryAssetKey(id, def);
              return (
                <button
                  key={id}
                  onClick={() => setSelectedId(id)}
                  className={`flex w-full items-center gap-2 border-b border-white/5 px-3 py-2.5 text-left text-xs transition ${
                    selectedId === id
                      ? "bg-gradient-active text-text-primary"
                      : "text-text-secondary hover:bg-white/5"
                  }`}
                >
                  <SpriteThumbnail fileName={spriteAssetMap.get(assetKey)?.fileName} label={def.displayName} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{def.displayName}</div>
                    <div className="truncate text-2xs text-text-muted">{id}</div>
                    {def.requirements.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {def.requirements.map((req, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-white/8 px-1.5 py-0.5 text-3xs text-text-muted"
                          >
                            {requirementLabel(req)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-2xs text-text-muted">
                    {def.category === "staff" ? "S" : def.sortOrder}
                  </span>
                </button>
              );
            })}
            {sortedDefs.length === 0 && (
              <div className="px-3 py-6 text-xs text-text-muted">
                No sprite definitions yet. Add one above.
              </div>
            )}
          </div>
        </div>

        {/* Right: detail editor */}
        <div className="flex-1 overflow-y-auto p-5">
          {selectedDef && selectedId ? (
            <SpriteDetailEditor
              id={selectedId}
              def={selectedDef}
              races={races}
              classes={classes}
              spriteAssetMap={spriteAssetMap}
              hasApiKey={hasApiKey}
              generating={generating}
              onPatch={handlePatchSelected}
              onDelete={handleDeleteSelected}
              onGenerateImage={handleGenerateImage}
              onViewSprite={handleViewSprite}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-text-muted">
              Select a sprite definition or add a new one.
            </div>
          )}
        </div>
      </div>

      {/* Fill Gaps scaffold dialog */}
      {showScaffold && (
        <TierSpriteScaffold
          onClose={() => setShowScaffold(false)}
          onComplete={() => void loadAssets()}
        />
      )}

      {/* Sprite lightbox */}
      {viewSprite && (
        <SpriteLightbox
          spriteKey={viewSprite.key}
          fileName={viewSprite.fileName}
          variantGroup={`player_sprite:${viewSprite.key}`}
          canRegenerate={!generating}
          canDelete={!generating}
          onRegenerate={() => {
            const key = viewSprite.key;
            setViewSprite(null);
            void handleGenerateImage(key);
          }}
          onDelete={() => {
            const assetId = viewSprite.assetId;
            setViewSprite(null);
            void deleteAsset(assetId);
          }}
          onRemoveBg={() => {
            setViewSprite(null);
            void loadAssets();
          }}
          onClose={() => setViewSprite(null)}
        />
      )}
    </div>
  );
}
