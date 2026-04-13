import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSpriteDefinitionStore } from "@/stores/spriteDefinitionStore";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import { useAssetStore } from "@/stores/assetStore";
import { UNIVERSAL_NEGATIVE } from "@/lib/arcanumPrompts";
import { removeBgAndSave } from "@/lib/useBackgroundRemoval";
import { BulkBgRemoval } from "@/components/ui/BulkBgRemoval";
import { ENTITY_DIMENSIONS, imageGenerateCommand, resolveImageModel, requestsTransparentBackground } from "@/types/assets";
import {
  buildSpritePrompt,
  generateSpriteTemplate,
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

const SPRITE_TEMPLATE_VIBE =
  "Character creation sprites for a fantasy world — each one should be a compelling standalone portrait.";

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
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showScaffold, setShowScaffold] = useState(false);
  const [showBulkBgRemoval, setShowBulkBgRemoval] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [promptPreview, setPromptPreview] = useState<{ imageId: string; prompt: string } | null>(null);
  const spriteTemplateRef = useRef<SpritePromptTemplate | null>(null);
  const spriteTemplatePromiseRef = useRef<Promise<SpritePromptTemplate | null> | null>(null);

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
        const dimensions = resolveSpriteDimensions(resolved.definition, resolved.variant);
        const rawPrompt = buildSpritePrompt(
          dimensions,
          template,
          spritePromptNotes(resolved.definition, resolved.variant),
        );
        const finalPrompt = rawPrompt;
        const model = resolveImageModel(imageProvider, settings?.image_model);
        if (!model) throw new Error("No image model available");

        const dims = ENTITY_DIMENSIONS.player_sprite ?? { width: 512, height: 512 };

        const image = await invoke<GeneratedImage>(imageGenerateCommand(imageProvider), {
          prompt: finalPrompt,
          negativePrompt: UNIVERSAL_NEGATIVE,
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
    [acceptAsset, config, definitions, ensureSpriteTemplate, hasApiKey, imageProvider, loadAssets, settings],
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
      if (prev.size === sortedDefs.length) return new Set();
      return new Set(sortedDefs.map(([id]) => id));
    });
  }, [sortedDefs]);

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

      const template = await ensureSpriteTemplate();
      const dimensions = resolveSpriteDimensions(resolved.definition, resolved.variant);
      const rawPrompt = buildSpritePrompt(
        dimensions,
        template,
        spritePromptNotes(resolved.definition, resolved.variant),
      );
      setPromptPreview({ imageId, prompt: rawPrompt });
    },
    [config, definitions, ensureSpriteTemplate],
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

        const image = await invoke<GeneratedImage>(imageGenerateCommand(imageProvider), {
          prompt: finalPrompt,
          negativePrompt: UNIVERSAL_NEGATIVE,
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
    [promptPreview, acceptAsset, hasApiKey, hasLlmKey, imageProvider, loadAssets, settings],
  );

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
          onClick={() => setShowBulkBgRemoval(true)}
          variant="secondary"
          size="sm"
        >
          Remove BGs
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
          {/* Bulk action bar */}
          {checkedIds.size > 0 && (
            <div className="flex items-center gap-2 border-b border-border-default bg-bg-elevated px-3 py-1.5">
              <button
                onClick={toggleAllChecked}
                className="text-2xs text-accent hover:text-accent/80"
              >
                {checkedIds.size === sortedDefs.length ? "Deselect All" : "Select All"}
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
            {sortedDefs.map(([id, def]) => {
              const assetKey = primaryAssetKey(id, def);
              return (
                <div
                  key={id}
                  className={`flex w-full items-center gap-2 border-b border-[var(--chrome-stroke)] px-3 py-2.5 text-left text-xs transition ${
                    selectedId === id
                      ? "bg-gradient-active text-text-primary"
                      : "text-text-secondary hover:bg-[var(--chrome-highlight)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checkedIds.has(id)}
                    onChange={() => toggleChecked(id)}
                    className="shrink-0 accent-accent"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={() => setSelectedId(id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
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
            })}
            {sortedDefs.length === 0 && (
              <div className="flex flex-col gap-2 px-3 py-6 text-xs text-text-muted">
                <p>No sprite definitions yet.</p>
                <p>Add one above, or use <strong className="text-text-secondary">Fill Gaps</strong> to auto-create sprites for all race/class/tier combinations.</p>
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
