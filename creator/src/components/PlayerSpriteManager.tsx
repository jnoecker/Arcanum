import { memo, useState, useMemo, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSpriteDefinitionStore } from "@/stores/spriteDefinitionStore";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import { useAssetStore } from "@/stores/assetStore";
import { removeBgAndSave } from "@/lib/useBackgroundRemoval";
import { resolveImageDataUrl } from "@/lib/useImageSrc";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { BulkBgRemoval } from "@/components/ui/BulkBgRemoval";
import { AI_ENABLED } from "@/lib/featureFlags";
import { ENTITY_DIMENSIONS, modelNativelyTransparent, resolveImageModel } from "@/types/assets";
import { generateAssetImage } from "@/lib/imageGen";
import { getNegativePrompt } from "@/lib/arcanumPrompts";
import {
  buildEnhancedSpritePrompt,
  type SpriteDimensions,
} from "@/lib/spritePromptGen";
import type {
  SpriteDefinition,
  SpriteVariant,
  SpriteRequirement,
  RequirementType,
} from "@/types/sprites";
import type { AssetContext, SyncProgress } from "@/types/assets";
import { ActionButton } from "./ui/FormWidgets";
import { ConfirmDialog } from "./ConfirmDialog";
import { SpriteScaffold } from "./SpriteScaffold";
import {
  SpriteThumbnail,
  SpriteLightbox,
  PromptPreviewModal,
  SpriteDetailEditor,
  collectSpriteBgTargets,
  requirementLabel,
} from "./PlayerSpriteHelpers";

// ─── Helpers ────────────────────────────────────────────────────────

/** Get the effective imageId for a sprite (from variants or image shorthand). */
function primaryImageId(id: string, def: SpriteDefinition): string {
  if (def.variants && def.variants.length > 0) return def.variants[0]!.imageId;
  return id;
}

/** Get the effective image path for asset lookup. */
function primaryAssetKey(id: string, def: SpriteDefinition): string {
  return primaryImageId(id, def);
}

function findRequirement<T extends RequirementType>(
  requirements: SpriteRequirement[],
  type: T,
): Extract<SpriteRequirement, { type: T }> | undefined {
  return requirements.find(
    (requirement): requirement is Extract<SpriteRequirement, { type: T }> => requirement.type === type,
  );
}

function resolveSpriteDimensions(
  definition: SpriteDefinition,
  variant: SpriteVariant | undefined,
): SpriteDimensions {
  const race = variant?.race
    || findRequirement(definition.requirements, "race")?.race
    || undefined;
  const playerClass = variant?.playerClass
    || findRequirement(definition.requirements, "class")?.playerClass
    || undefined;
  const gender = variant?.gender || definition.gender || undefined;

  return { race, playerClass, gender };
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
    definition.artDirection?.trim() || definition.description?.trim() || null,
  ].filter(Boolean);

  return notes.length > 0 ? notes.join(". ") : undefined;
}

function hasAnyImage(
  id: string,
  def: SpriteDefinition,
  assetMap: Map<string, { fileName: string; assetId: string }>,
): boolean {
  if (def.variants && def.variants.length > 0) {
    return def.variants.some((v) => assetMap.has(v.imageId));
  }
  return assetMap.has(id);
}

// ─── List row (memoized) ────────────────────────────────────────────

interface SpriteListRowProps {
  id: string;
  def: SpriteDefinition;
  selected: boolean;
  checked: boolean;
  fileName: string | undefined;
  onSelect: (id: string) => void;
  onToggleChecked: (id: string) => void;
}

const SpriteListRow = memo(function SpriteListRow({
  id,
  def,
  selected,
  checked,
  fileName,
  onSelect,
  onToggleChecked,
}: SpriteListRowProps) {
  return (
    <div
      className={`flex w-full items-center gap-2 border-b border-[var(--chrome-stroke)] px-3 py-2.5 text-left text-xs transition ${
        selected
          ? "bg-gradient-active text-text-primary"
          : "text-text-secondary hover:bg-[var(--chrome-highlight)]"
      }`}
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 76px" }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggleChecked(id)}
        className="shrink-0 accent-accent"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={() => onSelect(id)}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <SpriteThumbnail fileName={fileName} label={def.displayName} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{def.displayName}</div>
          <div className="truncate text-2xs text-text-muted">{id}</div>
          {def.requirements.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-1">
              {def.requirements.map((req, i) => (
                <span
                  key={i}
                  className="rounded-full bg-[var(--chrome-highlight-strong)] px-1.5 py-0.5 text-3xs text-text-muted"
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
    </div>
  );
});

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
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const settings = useAssetStore((s) => s.settings);
  const artStyle = useAssetStore((s) => s.artStyle);
  const loadAssets = useAssetStore((s) => s.loadAssets);
  const acceptAsset = useAssetStore((s) => s.acceptAsset);
  const deleteAsset = useAssetStore((s) => s.deleteAsset);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newId, setNewId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<"all" | "general" | "staff">("all");
  const [filterRace, setFilterRace] = useState<string>("all");
  const [filterClass, setFilterClass] = useState<string>("all");
  const [filterGender, setFilterGender] = useState<string>("all");
  const [filterImage, setFilterImage] = useState<"all" | "with" | "without">("all");
  const [filterStale, setFilterStale] = useState<"all" | "race" | "class" | "any">("all");
  const [generating, setGenerating] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [exportingSheet, setExportingSheet] = useState(false);
  const [deployResult, setDeployResult] = useState<SyncProgress | null>(null);
  const [viewSprite, setViewSprite] = useState<{ key: string; fileName: string; assetId: string } | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showScaffold, setShowScaffold] = useState(false);
  const [showBulkBgRemoval, setShowBulkBgRemoval] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [promptPreview, setPromptPreview] = useState<{ imageId: string; prompt: string } | null>(null);

  const races = useMemo(() => config ? Object.keys(config.races) : [], [config]);
  const classes = useMemo(() => config ? Object.keys(config.classes).filter((c) => c !== "base") : [], [config]);

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

  const filteredDefs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const raceSet = new Set(races);
    const classSet = new Set(classes);
    return sortedDefs.filter(([id, def]) => {
      if (query) {
        const hay = `${id} ${def.displayName}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      if (filterCategory !== "all" && def.category !== filterCategory) return false;
      if (filterRace !== "all") {
        const raceReqs = def.requirements.filter((r): r is Extract<SpriteRequirement, { type: "race" }> => r.type === "race");
        if (filterRace === "__none__") {
          if (raceReqs.length > 0) return false;
        } else if (!raceReqs.some((r) => r.race === filterRace)) {
          return false;
        }
      }
      if (filterClass !== "all") {
        const classReqs = def.requirements.filter((r): r is Extract<SpriteRequirement, { type: "class" }> => r.type === "class");
        if (filterClass === "__none__") {
          if (classReqs.length > 0) return false;
        } else if (!classReqs.some((r) => r.playerClass === filterClass)) {
          return false;
        }
      }
      if (filterGender !== "all") {
        if (filterGender === "__none__") {
          if (def.gender) return false;
        } else if (def.gender !== filterGender) {
          return false;
        }
      }
      if (filterImage !== "all") {
        const present = hasAnyImage(id, def, spriteAssetMap);
        if (filterImage === "with" && !present) return false;
        if (filterImage === "without" && present) return false;
      }
      if (filterStale !== "all") {
        const hasStaleRace = def.requirements.some(
          (r) => r.type === "race" && r.race.length > 0 && !raceSet.has(r.race),
        );
        const hasStaleClass = def.requirements.some(
          (r) => r.type === "class" && r.playerClass.length > 0 && !classSet.has(r.playerClass),
        );
        if (filterStale === "race" && !hasStaleRace) return false;
        if (filterStale === "class" && !hasStaleClass) return false;
        if (filterStale === "any" && !hasStaleRace && !hasStaleClass) return false;
      }
      return true;
    });
  }, [sortedDefs, searchQuery, filterCategory, filterRace, filterClass, filterGender, filterImage, filterStale, spriteAssetMap, races, classes]);

  const hasActiveFilter =
    searchQuery.trim().length > 0 ||
    filterCategory !== "all" ||
    filterRace !== "all" ||
    filterClass !== "all" ||
    filterGender !== "all" ||
    filterImage !== "all" ||
    filterStale !== "all";

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setFilterCategory("all");
    setFilterRace("all");
    setFilterClass("all");
    setFilterGender("all");
    setFilterImage("all");
    setFilterStale("all");
  }, []);

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
      if (!AI_ENABLED || !hasApiKey || !settings) return;
      setGenerating(imageId);
      setGenerationError(null);

      try {
        const resolved = findSpriteEntry(definitions, imageId);
        if (!resolved) throw new Error(`Unable to resolve sprite definition for "${imageId}".`);

        const model = resolveImageModel(imageProvider, settings?.image_model);
        if (!model) throw new Error("No image model available");

        const dimensions = resolveSpriteDimensions(resolved.definition, resolved.variant);
        const finalPrompt = await buildEnhancedSpritePrompt({
          displayName: resolved.variant?.displayName || resolved.definition.displayName,
          dimensions,
          notes: spritePromptNotes(resolved.definition, resolved.variant),
          style: artStyle,
          nativeTransparency: modelNativelyTransparent(imageProvider, model.id),
          enhance: hasLlmKey,
        });

        const dims = ENTITY_DIMENSIONS.player_sprite ?? { width: 512, height: 512 };

        const image = await generateAssetImage({
          provider: imageProvider,
          model,
          prompt: finalPrompt,
          width: dims.width,
          height: dims.height,
          assetType: "player_sprite",
          negativePrompt: getNegativePrompt("player_sprite"),
        });

        const assetContext: AssetContext = { zone: "sprites", entity_type: "player_sprite", entity_id: imageId };
        const variantGroup = `player_sprite:${imageId}`;

        await acceptAsset(image, "player_sprite", finalPrompt, assetContext, variantGroup, true);

        if (settings.auto_remove_bg && image.data_url) {
          await removeBgAndSave(image.data_url, "player_sprite", assetContext, variantGroup).catch(() => {});
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
    [acceptAsset, artStyle, definitions, hasApiKey, hasLlmKey, imageProvider, loadAssets, settings],
  );

  const handleExportSheet = useCallback(async () => {
    if (filteredDefs.length === 0 || exportingSheet) return;
    setExportingSheet(true);
    setGenerationError(null);
    try {
      const cellSize = 256;
      const cols = 20;
      const rows = Math.ceil(filteredDefs.length / cols);
      const canvas = document.createElement("canvas");
      canvas.width = cols * cellSize;
      canvas.height = rows * cellSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable");

      try {
        await document.fonts.load(`16px "Cinzel"`);
      } catch {
        // Font load is best-effort; fall back silently.
      }

      const resolved = await Promise.all(
        filteredDefs.map(async ([id, def]) => {
          const fileName = spriteAssetMap.get(primaryAssetKey(id, def))?.fileName;
          const src = fileName ? await resolveImageDataUrl(fileName) : null;
          return { id, def, src };
        }),
      );

      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("image decode failed"));
          img.src = src;
        });

      ctx.fillStyle = "#0d1115";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < resolved.length; i++) {
        const entry = resolved[i]!;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * cellSize;
        const y = row * cellSize;

        if (entry.src) {
          try {
            const img = await loadImage(entry.src);
            ctx.drawImage(img, x, y, cellSize, cellSize);
            continue;
          } catch {
            // Fall through to placeholder rendering on decode error.
          }
        }

        ctx.fillStyle = "#161b21";
        ctx.fillRect(x, y, cellSize, cellSize);
        ctx.strokeStyle = "#3a4148";
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(x + 6, y + 6, cellSize - 12, cellSize - 12);
        ctx.setLineDash([]);

        ctx.fillStyle = "#8a8f96";
        ctx.font = `15px "Cinzel", serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const words = entry.def.displayName.split(/\s+/);
        const lines: string[] = [];
        let current = "";
        for (const word of words) {
          const test = current ? `${current} ${word}` : word;
          if (ctx.measureText(test).width > cellSize - 24 && current) {
            lines.push(current);
            current = word;
          } else {
            current = test;
          }
        }
        if (current) lines.push(current);
        const visible = lines.slice(0, 4);
        const lineHeight = 18;
        const startY = y + cellSize / 2 - ((visible.length - 1) * lineHeight) / 2;
        visible.forEach((line, idx) => {
          ctx.fillText(line, x + cellSize / 2, startY + idx * lineHeight);
        });
      }

      const defaultName = `sprite-sheet-${filteredDefs.length}.png`;
      const target = await saveDialog({
        title: "Export sprite sheet",
        defaultPath: defaultName,
        filters: [{ name: "PNG image", extensions: ["png"] }],
      });
      if (!target) return;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("Canvas export failed");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      await writeFile(target as string, bytes);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setGenerationError(message);
      console.error("Sprite sheet export failed:", err);
    } finally {
      setExportingSheet(false);
    }
  }, [filteredDefs, spriteAssetMap, exportingSheet]);

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

  // ─── Bulk selection ────────────────────────────────────────────────

  const toggleChecked = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllChecked = useCallback(() => {
    setCheckedIds((prev) => {
      const visibleIds = filteredDefs.map(([id]) => id);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        for (const id of visibleIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of visibleIds) next.add(id);
      return next;
    });
  }, [filteredDefs]);

  const handleBulkDelete = useCallback(async () => {
    for (const id of checkedIds) {
      // Delete associated generated images
      const def = definitions[id];
      if (def) {
        const imageIds: string[] = [];
        if (def.variants && def.variants.length > 0) {
          for (const v of def.variants) imageIds.push(v.imageId);
        } else {
          imageIds.push(id);
        }
        for (const imageId of imageIds) {
          const asset = spriteAssetMap.get(imageId);
          if (asset) {
            await deleteAsset(asset.assetId).catch(() => {});
          }
        }
      }
      deleteDefinition(id);
    }
    if (selectedId && checkedIds.has(selectedId)) {
      setSelectedId(null);
    }
    setCheckedIds(new Set());
    setShowBulkDeleteConfirm(false);
    await loadAssets();
  }, [checkedIds, definitions, spriteAssetMap, selectedId, deleteDefinition, deleteAsset, loadAssets]);

  // ─── Prompt preview ────────────────────────────────────────────────

  const handlePreviewGenerate = useCallback(
    async (imageId: string) => {
      const resolved = findSpriteEntry(definitions, imageId);
      if (!resolved) return;

      const model = resolveImageModel(imageProvider, settings?.image_model);
      const dimensions = resolveSpriteDimensions(resolved.definition, resolved.variant);

      setGenerating(imageId);
      try {
        const prompt = await buildEnhancedSpritePrompt({
          displayName: resolved.variant?.displayName || resolved.definition.displayName,
          dimensions,
          notes: spritePromptNotes(resolved.definition, resolved.variant),
          style: artStyle,
          nativeTransparency: model ? modelNativelyTransparent(imageProvider, model.id) : false,
          enhance: hasLlmKey,
        });
        setPromptPreview({ imageId, prompt });
      } finally {
        setGenerating(null);
      }
    },
    [artStyle, definitions, hasLlmKey, imageProvider, settings],
  );

  const handleGenerateWithPrompt = useCallback(
    async (editedPrompt: string) => {
      if (!promptPreview || !hasApiKey || !settings) return;
      const { imageId } = promptPreview;
      setPromptPreview(null);
      setGenerating(imageId);
      setGenerationError(null);

      try {
        const finalPrompt = editedPrompt;
        const model = resolveImageModel(imageProvider, settings?.image_model);
        if (!model) throw new Error("No image model available");

        const dims = ENTITY_DIMENSIONS.player_sprite ?? { width: 512, height: 512 };

        const image = await generateAssetImage({
          provider: imageProvider,
          model,
          prompt: finalPrompt,
          width: dims.width,
          height: dims.height,
          assetType: "player_sprite",
          negativePrompt: getNegativePrompt("player_sprite"),
        });

        const assetContext: AssetContext = { zone: "sprites", entity_type: "player_sprite", entity_id: imageId };
        const variantGroup = `player_sprite:${imageId}`;

        await acceptAsset(image, "player_sprite", finalPrompt, assetContext, variantGroup, true);

        if (settings.auto_remove_bg && image.data_url) {
          await removeBgAndSave(image.data_url, "player_sprite", assetContext, variantGroup).catch(() => {});
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
    [promptPreview, acceptAsset, hasApiKey, imageProvider, loadAssets, settings],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border-default bg-bg-secondary px-4 py-2">
        <h2 className="font-display text-xs uppercase tracking-widest text-text-muted">
          Player Sprites
        </h2>
        <span className="text-2xs text-text-muted">
          {hasActiveFilter
            ? `${filteredDefs.length} of ${sortedDefs.length}`
            : `${sortedDefs.length} definition${sortedDefs.length !== 1 ? "s" : ""}`}
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
          onClick={() => setShowBulkBgRemoval(true)}
          variant="secondary"
          size="sm"
        >
          Remove BGs
        </ActionButton>
        <ActionButton
          onClick={handleExportSheet}
          disabled={exportingSheet || filteredDefs.length === 0}
          variant="secondary"
          size="sm"
          title={
            hasActiveFilter
              ? `Export ${filteredDefs.length} filtered sprite${filteredDefs.length === 1 ? "" : "s"} as a 20-wide PNG sheet`
              : `Export all ${filteredDefs.length} sprites as a 20-wide PNG sheet`
          }
        >
          {exportingSheet ? "Exporting..." : "Export Sheet"}
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
        <div className="flex w-[clamp(14rem,20vw,18rem)] min-w-0 shrink-0 flex-col border-r border-border-default bg-bg-secondary">
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
          {/* Filter bar */}
          <div className="flex flex-col gap-2 border-b border-border-default px-3 py-2">
            <div className="flex items-center gap-1">
              <input
                className="ornate-input min-h-9 flex-1 rounded-2xl px-3 py-2 text-xs text-text-primary"
                placeholder="Search sprites…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {hasActiveFilter && (
                <button
                  onClick={clearFilters}
                  className="shrink-0 px-1.5 text-2xs text-text-muted hover:text-text-primary"
                  title="Clear all filters"
                >
                  clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              <select
                className="ornate-input min-h-7 rounded-xl px-2 py-1 text-2xs text-text-primary"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as "all" | "general" | "staff")}
                title="Category"
              >
                <option value="all">All categories</option>
                <option value="general">General</option>
                <option value="staff">Staff</option>
              </select>
              <select
                className="ornate-input min-h-7 rounded-xl px-2 py-1 text-2xs text-text-primary"
                value={filterRace}
                onChange={(e) => setFilterRace(e.target.value)}
                title="Race requirement"
              >
                <option value="all">All races</option>
                <option value="__none__">No race req</option>
                {races.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <select
                className="ornate-input min-h-7 rounded-xl px-2 py-1 text-2xs text-text-primary"
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                title="Class requirement"
              >
                <option value="all">All classes</option>
                <option value="__none__">No class req</option>
                {classes.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                className="ornate-input min-h-7 rounded-xl px-2 py-1 text-2xs text-text-primary"
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value)}
                title="Gender"
              >
                <option value="all">All genders</option>
                <option value="__none__">No gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="nonbinary">Nonbinary</option>
              </select>
              <select
                className="ornate-input min-h-7 rounded-xl px-2 py-1 text-2xs text-text-primary"
                value={filterImage}
                onChange={(e) => setFilterImage(e.target.value as "all" | "with" | "without")}
                title="Image status"
              >
                <option value="all">Any image</option>
                <option value="with">With image</option>
                <option value="without">Without image</option>
              </select>
              <select
                className="ornate-input min-h-7 rounded-xl px-2 py-1 text-2xs text-text-primary"
                value={filterStale}
                onChange={(e) => setFilterStale(e.target.value as "all" | "race" | "class" | "any")}
                title="Sprites whose race/class requirement points to a missing config entry"
              >
                <option value="all">Any refs</option>
                <option value="race">Stale race ref</option>
                <option value="class">Stale class ref</option>
                <option value="any">Stale (any)</option>
              </select>
            </div>
          </div>
          {/* Bulk action bar */}
          {checkedIds.size > 0 && (
            <div className="flex items-center gap-2 border-b border-border-default bg-bg-elevated px-3 py-1.5">
              <button
                onClick={toggleAllChecked}
                className="text-2xs text-accent hover:text-accent/80"
              >
                {filteredDefs.length > 0 && filteredDefs.every(([id]) => checkedIds.has(id))
                  ? hasActiveFilter ? "Deselect Visible" : "Deselect All"
                  : hasActiveFilter ? "Select Visible" : "Select All"}
              </button>
              <span className="text-2xs text-text-muted">
                {checkedIds.size} selected
              </span>
              <div className="flex-1" />
              <ActionButton
                onClick={() => setShowBulkDeleteConfirm(true)}
                variant="danger"
                size="sm"
              >
                Delete ({checkedIds.size})
              </ActionButton>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {filteredDefs.map(([id, def]) => (
              <SpriteListRow
                key={id}
                id={id}
                def={def}
                selected={selectedId === id}
                checked={checkedIds.has(id)}
                fileName={spriteAssetMap.get(primaryAssetKey(id, def))?.fileName}
                onSelect={setSelectedId}
                onToggleChecked={toggleChecked}
              />
            ))}
            {sortedDefs.length === 0 && (
              <div className="flex flex-col gap-2 px-3 py-6 text-xs text-text-muted">
                <p>No sprite definitions yet.</p>
                <p>Add one above, or use <strong className="text-text-secondary">Fill Gaps</strong> to auto-create sprites for all race/class/tier combinations.</p>
              </div>
            )}
            {sortedDefs.length > 0 && filteredDefs.length === 0 && (
              <div className="flex flex-col gap-2 px-3 py-6 text-xs text-text-muted">
                <p>No sprites match the current filters.</p>
                <button
                  onClick={clearFilters}
                  className="self-start text-2xs text-accent hover:text-accent/80"
                >
                  Clear filters
                </button>
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
              hasLlmKey={hasLlmKey}
              generating={generating}
              onPatch={handlePatchSelected}
              onDelete={handleDeleteSelected}
              onGenerateImage={handleGenerateImage}
              onPreviewGenerate={handlePreviewGenerate}
              onViewSprite={handleViewSprite}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-text-muted">
              <p>Select a sprite definition to edit it.</p>
              {sortedDefs.length === 0 && (
                <p className="max-w-sm text-xs">
                  Create your first sprite above, or use <strong className="text-text-secondary">Fill Gaps</strong> to auto-scaffold
                  sprites for every race/class/tier combination in your config.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fill Gaps scaffold dialog */}
      {showScaffold && (
        <SpriteScaffold
          onClose={() => setShowScaffold(false)}
          onComplete={() => void loadAssets()}
        />
      )}

      {/* Bulk BG removal dialog */}
      {showBulkBgRemoval && assetsDir && (
        <BulkBgRemoval
          targets={collectSpriteBgTargets(spriteAssetMap, definitions, assetsDir)}
          onClose={() => setShowBulkBgRemoval(false)}
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
          onFlip={() => {
            setViewSprite(null);
            void loadAssets();
          }}
          onClose={() => setViewSprite(null)}
        />
      )}

      {/* Prompt preview modal */}
      {promptPreview && (
        <PromptPreviewModal
          prompt={promptPreview.prompt}
          imageId={promptPreview.imageId}
          onGenerate={handleGenerateWithPrompt}
          onClose={() => setPromptPreview(null)}
        />
      )}

      {/* Bulk delete confirmation */}
      {showBulkDeleteConfirm && (
        <ConfirmDialog
          title="Delete Sprites"
          message={`Delete ${checkedIds.size} sprite definition${checkedIds.size !== 1 ? "s" : ""} and their generated images? This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          onConfirm={() => void handleBulkDelete()}
          onCancel={() => setShowBulkDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
