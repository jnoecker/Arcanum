import { memo, useState, useMemo, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSpriteDefinitionStore } from "@/stores/spriteDefinitionStore";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import { useAssetStore } from "@/stores/assetStore";
import { useImageSrc } from "@/lib/useImageSrc";
import { composePrompt, UNIVERSAL_NEGATIVE } from "@/lib/arcanumPrompts";
import { removeBgAndSave } from "@/lib/useBackgroundRemoval";
import { IMAGE_MODELS, ENTITY_DIMENSIONS, imageGenerateCommand } from "@/types/assets";
import type {
  SpriteDefinition,
  SpriteVariant,
  SpriteRequirement,
  RequirementType,
} from "@/types/sprites";
import type { GeneratedImage, AssetContext, SyncProgress } from "@/types/assets";

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

// ─── Thumbnail ──────────────────────────────────────────────────────

const SpriteThumbnail = memo(function SpriteThumbnail({
  fileName,
  size = "h-12 w-12",
}: {
  fileName: string | undefined;
  size?: string;
}) {
  const src = useImageSrc(fileName);
  if (!src) {
    return (
      <div className={`flex ${size} items-center justify-center rounded-lg border border-dashed border-white/12 bg-white/4 text-2xs text-text-muted`}>
        --
      </div>
    );
  }
  return <img src={src} alt="" className={`${size} rounded-lg object-cover`} />;
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

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
            alt={key}
            className="max-h-[80vh] max-w-[80vw] rounded border border-border-default object-contain"
            style={{ imageRendering: "auto" }}
          />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center rounded border border-border-default bg-bg-tertiary text-text-muted">
            Loading...
          </div>
        )}
        <span className="font-mono text-xs text-text-secondary">{key}</span>
        <div className="flex gap-2">
          <button
            onClick={onRegenerate}
            disabled={!canRegenerate}
            className="rounded-full border border-accent/40 px-4 py-2 text-xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-40"
          >
            Regenerate
          </button>
          <button
            onClick={handleRemoveBg}
            disabled={removingBg || !src}
            className="rounded-full border border-white/20 px-4 py-2 text-xs text-text-primary transition-colors hover:bg-white/10 disabled:opacity-40"
          >
            {removingBg ? "Removing BG..." : "Remove BG"}
          </button>
          <button
            onClick={onDelete}
            disabled={!canDelete}
            className="rounded-full border border-status-error/40 px-4 py-2 text-xs text-status-error transition-colors hover:bg-status-error/10 disabled:opacity-40"
          >
            Delete
          </button>
        </div>
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-bg-elevated text-text-primary shadow hover:bg-bg-hover"
        >
          &times;
        </button>
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
        className="rounded border border-border-default bg-bg-primary px-1.5 py-1 text-xs text-text-primary outline-none"
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
          className="w-20 rounded border border-border-default bg-bg-primary px-1.5 py-1 text-xs text-text-primary outline-none"
          placeholder="Level"
        />
      )}

      {req.type === "race" && (
        <select
          value={req.race}
          onChange={(e) => onChange(index, { type: "race", race: e.target.value })}
          className="rounded border border-border-default bg-bg-primary px-1.5 py-1 text-xs text-text-primary outline-none"
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
          className="rounded border border-border-default bg-bg-primary px-1.5 py-1 text-xs text-text-primary outline-none"
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
          className="flex-1 rounded border border-border-default bg-bg-primary px-1.5 py-1 text-xs text-text-primary outline-none"
          placeholder="e.g. combat/secret_slayer"
        />
      )}

      {req.type === "staff" && (
        <span className="text-2xs text-text-muted">Player must be staff</span>
      )}

      <button
        onClick={() => onRemove(index)}
        className="ml-auto shrink-0 rounded border border-status-error/30 px-1.5 py-0.5 text-2xs text-status-error hover:bg-status-error/10"
      >
        Remove
      </button>
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
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/8 bg-black/12 p-3">
      <SpriteThumbnail fileName={assetFileName} />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-0.5 text-2xs text-text-muted">
            Image ID
            <input
              className="rounded border border-border-default bg-bg-primary px-1.5 py-1 text-xs text-text-primary outline-none"
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
              className="rounded border border-border-default bg-bg-primary px-1.5 py-1 text-xs text-text-primary outline-none"
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
              className="rounded border border-border-default bg-bg-primary px-1.5 py-1 text-xs text-text-primary outline-none"
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
              className="rounded border border-border-default bg-bg-primary px-1.5 py-1 text-xs text-text-primary outline-none"
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
              className="rounded border border-border-default bg-bg-primary px-1.5 py-1 text-xs text-text-primary outline-none"
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
        <button
          onClick={() => onGenerate(variant)}
          disabled={!hasApiKey || generating}
          className="rounded border border-accent/40 px-2 py-1 text-2xs text-accent hover:bg-accent/10 disabled:opacity-40"
        >
          {generating ? "..." : "Gen"}
        </button>
        <button
          onClick={() => onRemove(index)}
          className="rounded border border-status-error/30 px-2 py-1 text-2xs text-status-error hover:bg-status-error/10"
        >
          Del
        </button>
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
}: {
  id: string;
  def: SpriteDefinition;
  races: string[];
  classes: string[];
  spriteAssetMap: Map<string, string>;
  hasApiKey: boolean;
  generating: string | null;
  onPatch: (patch: Partial<SpriteDefinition>) => void;
  onDelete: () => void;
  onGenerateImage: (imageId: string, brief: string) => void;
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
    onGenerateImage(variant.imageId, def.description ?? def.displayName);
  }, [def.description, def.displayName, onGenerateImage]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-text-primary">{def.displayName}</h3>
        <button
          onClick={onDelete}
          className="rounded border border-status-error/30 px-3 py-1 text-xs text-status-error hover:bg-status-error/10"
        >
          Delete Sprite
        </button>
      </div>

      {/* Basic fields */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Display Name
            <input
              className="rounded border border-border-default bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent/50"
              value={def.displayName}
              onChange={(e) => onPatch({ displayName: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Category
            <select
              className="rounded border border-border-default bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent/50"
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
              className="rounded border border-border-default bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent/50"
              value={def.sortOrder}
              onChange={(e) => onPatch({ sortOrder: parseInt(e.target.value) || 0 })}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Description
          <textarea
            className="h-16 resize-y rounded border border-border-default bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent/50"
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
          <button
            onClick={handleAddRequirement}
            className="rounded border border-border-default px-2 py-1 text-xs text-text-secondary hover:bg-bg-elevated"
          >
            Add Requirement
          </button>
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
                <button
                  onClick={handleAddVariant}
                  className="rounded border border-border-default px-2 py-1 text-xs text-text-secondary hover:bg-bg-elevated"
                >
                  Add Variant
                </button>
                {(def.variants?.length ?? 0) <= 1 && (
                  <button
                    onClick={handleSwitchToSingleImage}
                    className="rounded border border-border-default px-2 py-1 text-xs text-text-muted hover:bg-bg-elevated"
                  >
                    Use Single Image
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={handleSwitchToVariants}
                className="rounded border border-border-default px-2 py-1 text-xs text-text-muted hover:bg-bg-elevated"
              >
                Use Variants
              </button>
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
                assetFileName={spriteAssetMap.get(variant.imageId)}
                generating={generating === variant.imageId}
                hasApiKey={hasApiKey}
                onPatch={handlePatchVariant}
                onRemove={handleRemoveVariant}
                onGenerate={handleGenerateForVariant}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/12 p-3">
            <SpriteThumbnail fileName={spriteAssetMap.get(id)} size="h-16 w-16" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label className="flex flex-col gap-0.5 text-2xs text-text-muted">
                Image Path
                <input
                  className="rounded border border-border-default bg-bg-primary px-1.5 py-1 text-xs text-text-primary outline-none"
                  value={def.image ?? `player_sprites/${id}.png`}
                  onChange={(e) => onPatch({ image: e.target.value })}
                />
              </label>
            </div>
            <button
              onClick={() => onGenerateImage(id, def.description ?? def.displayName)}
              disabled={!hasApiKey || generating === id}
              className="shrink-0 rounded border border-accent/40 px-3 py-1.5 text-xs text-accent hover:bg-accent/10 disabled:opacity-40"
            >
              {generating === id ? "Generating..." : "Generate"}
            </button>
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

  useEffect(() => { loadAssets(); }, [loadAssets]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newId, setNewId] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<SyncProgress | null>(null);
  const [viewSprite, setViewSprite] = useState<{ key: string; fileName: string; assetId: string } | null>(null);

  const races = useMemo(() => config ? Object.keys(config.races).map((r) => r.toUpperCase()) : [], [config]);
  const classes = useMemo(() => config ? Object.keys(config.classes).map((c) => c.toUpperCase()) : [], [config]);

  const imageProvider = settings?.image_provider ?? "deepinfra";
  const hasApiKey = !!(settings && (
    (imageProvider === "deepinfra" && settings.deepinfra_api_key.length > 0) ||
    (imageProvider === "runware" && settings.runware_api_key.length > 0) ||
    (imageProvider === "openai" && settings.openai_api_key.length > 0)
  ));

  // Map imageId → asset file name for thumbnails
  const spriteAssetMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assets) {
      if (a.asset_type === "player_sprite" && a.variant_group?.startsWith("player_sprite:")) {
        const key = a.variant_group.replace("player_sprite:", "");
        if (!map.has(key) || a.is_active) {
          map.set(key, a.file_name);
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

  const handleGenerateImage = useCallback(
    async (imageId: string, brief: string) => {
      if (!hasApiKey || !settings) return;
      setGenerating(imageId);

      try {
        const artStyle = useAssetStore.getState().artStyle;
        const finalPrompt = composePrompt("player_sprite", artStyle, brief);
        const models = IMAGE_MODELS.filter((m) => m.provider === imageProvider);
        const model = models[0];
        if (!model) throw new Error("No image model available");

        const dims = ENTITY_DIMENSIONS.player_sprite ?? { width: 512, height: 512 };
        const cmd = imageGenerateCommand(imageProvider);

        const image = await invoke<GeneratedImage>(cmd, {
          prompt: finalPrompt,
          negativePrompt: UNIVERSAL_NEGATIVE,
          model: model.id,
          width: dims.width,
          height: dims.height,
          steps: model.defaultSteps,
        });

        const assetContext: AssetContext = { zone: "sprites", entity_type: "player_sprite", entity_id: imageId };
        const variantGroup = `player_sprite:${imageId}`;

        await acceptAsset(image, "player_sprite", finalPrompt, assetContext, variantGroup, true);

        if (image.data_url) {
          removeBgAndSave(image.data_url, "player_sprite", assetContext, variantGroup).catch(() => {});
        }

        await loadAssets();
      } catch (err) {
        console.error("Failed to generate sprite:", err);
      } finally {
        setGenerating(null);
      }
    },
    [hasApiKey, settings, imageProvider, acceptAsset, loadAssets],
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
    <div className="flex min-h-0 flex-1 flex-col">
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
        <button
          onClick={handleSave}
          disabled={!dirty}
          className="rounded border border-accent/40 px-3 py-1 text-xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-40"
        >
          Save
        </button>
        <button
          onClick={handleDeploy}
          disabled={deploying || sortedDefs.length === 0}
          className="rounded border border-accent/40 px-3 py-1 text-xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-40"
        >
          {deploying ? "Deploying..." : "Deploy to R2"}
        </button>
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
            <button
              onClick={() => setDeployResult(null)}
              className="ml-auto text-text-muted hover:text-text-primary"
            >
              &times;
            </button>
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

      <div className="flex min-h-0 flex-1">
        {/* Left: definition list */}
        <div className="flex w-72 shrink-0 flex-col border-r border-border-default bg-bg-secondary">
          <div className="flex items-center gap-1 border-b border-border-default px-3 py-2">
            <input
              className="flex-1 rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50"
              placeholder="New sprite ID"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <button
              onClick={handleAdd}
              disabled={!newId.trim()}
              className="rounded border border-border-default px-2 py-1 text-xs text-text-secondary hover:bg-bg-elevated disabled:opacity-40"
            >
              Add
            </button>
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
                  <SpriteThumbnail fileName={spriteAssetMap.get(assetKey)} />
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
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-text-muted">
              Select a sprite definition or add a new one.
            </div>
          )}
        </div>
      </div>

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
            void handleGenerateImage(key, selectedDef?.description ?? selectedDef?.displayName ?? key);
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
