import { useState, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSpriteDefinitionStore } from "@/stores/spriteDefinitionStore";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import { useAssetStore } from "@/stores/assetStore";
import { useImageSrc } from "@/lib/useImageSrc";
import { composePrompt, UNIVERSAL_NEGATIVE } from "@/lib/arcanumPrompts";
import { removeBgAndSave } from "@/lib/useBackgroundRemoval";
import { IMAGE_MODELS, ENTITY_DIMENSIONS, imageGenerateCommand } from "@/types/assets";
import type { AchievementSpriteDef, SpriteVariant } from "@/types/sprites";
import type { GeneratedImage, AssetContext } from "@/types/assets";

function VariantThumb({ fileName }: { fileName: string | undefined }) {
  const src = useImageSrc(fileName);
  if (!src) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-white/12 bg-white/4 text-2xs text-text-muted">
        --
      </div>
    );
  }
  return <img src={src} alt="" className="h-12 w-12 rounded-lg object-cover" />;
}

function emptyVariant(templateId: string, prefix?: string): SpriteVariant {
  const imageId = prefix ? `${prefix}_${templateId}` : templateId;
  return {
    imageId,
    imagePath: `player_sprites/${imageId}.png`,
  };
}

export function AchievementSpriteEditor() {
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

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newId, setNewId] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);

  const races = useMemo(() => config ? Object.keys(config.races) : [], [config]);
  const classes = useMemo(() => config ? Object.keys(config.classes) : [], [config]);

  const imageProvider = settings?.image_provider ?? "deepinfra";
  const hasApiKey = settings && (
    (imageProvider === "deepinfra" && settings.deepinfra_api_key.length > 0) ||
    (imageProvider === "runware" && settings.runware_api_key.length > 0) ||
    (imageProvider === "openai" && settings.openai_api_key.length > 0)
  );

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
      sortOrder: Object.keys(definitions).length * 10,
      achievementId: "",
      brief: "",
      variants: [emptyVariant(id)],
    });
    setNewId("");
    setSelectedId(id);
  }, [newId, definitions, setDefinition]);

  const handleSave = useCallback(async () => {
    if (!project) return;
    await saveDefinitions(project);
  }, [project, saveDefinitions]);

  const patchSelected = useCallback(
    (patch: Partial<AchievementSpriteDef>) => {
      if (!selectedId || !selectedDef) return;
      setDefinition(selectedId, { ...selectedDef, ...patch });
    },
    [selectedId, selectedDef, setDefinition],
  );

  const addVariant = useCallback(() => {
    if (!selectedId || !selectedDef) return;
    patchSelected({
      variants: [...selectedDef.variants, emptyVariant(selectedId, `variant${selectedDef.variants.length}`)],
    });
  }, [selectedId, selectedDef, patchSelected]);

  const patchVariant = useCallback(
    (idx: number, patch: Partial<SpriteVariant>) => {
      if (!selectedDef) return;
      const variants = selectedDef.variants.map((v, i) => (i === idx ? { ...v, ...patch } : v));
      patchSelected({ variants });
    },
    [selectedDef, patchSelected],
  );

  const removeVariant = useCallback(
    (idx: number) => {
      if (!selectedDef) return;
      patchSelected({ variants: selectedDef.variants.filter((_, i) => i !== idx) });
    },
    [selectedDef, patchSelected],
  );

  const acceptAsset = useAssetStore((s) => s.acceptAsset);

  const generateVariantImage = useCallback(
    async (variant: SpriteVariant, brief: string) => {
      if (!hasApiKey || !settings) return;
      setGenerating(variant.imageId);

      try {
        const finalPrompt = composePrompt("player_sprite", "gentle_magic", brief);
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

        const assetContext: AssetContext = { zone: "sprites", entity_type: "player_sprite", entity_id: variant.imageId };
        const variantGroup = `player_sprite:${variant.imageId}`;

        await acceptAsset(image, "player_sprite", finalPrompt, assetContext, variantGroup, true);

        if (image.data_url) {
          removeBgAndSave(image.data_url, "player_sprite", assetContext, variantGroup).catch(() => {});
        }

        await loadAssets();
      } catch (err) {
        console.error("Failed to generate sprite variant:", err);
      } finally {
        setGenerating(null);
      }
    },
    [hasApiKey, settings, imageProvider, acceptAsset, loadAssets],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border-default bg-bg-secondary px-4 py-2">
        <h2 className="font-display text-xs uppercase tracking-widest text-text-muted">
          Achievement Sprites
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
      </div>

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
            {sortedDefs.map(([id, def]) => (
              <button
                key={id}
                onClick={() => setSelectedId(id)}
                className={`flex w-full items-center gap-2 border-b border-white/5 px-3 py-2.5 text-left text-xs transition ${
                  selectedId === id
                    ? "bg-gradient-active text-text-primary"
                    : "text-text-secondary hover:bg-white/5"
                }`}
              >
                <VariantThumb fileName={spriteAssetMap.get(def.variants[0]?.imageId ?? "")} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{def.displayName}</div>
                  <div className="truncate text-2xs text-text-muted">{id}</div>
                </div>
                <span className="shrink-0 text-2xs text-text-muted">
                  {def.variants.length}v
                </span>
              </button>
            ))}
            {sortedDefs.length === 0 && (
              <div className="px-3 py-6 text-xs text-text-muted">
                No achievement sprites defined yet.
              </div>
            )}
          </div>
        </div>

        {/* Right: detail editor */}
        <div className="flex-1 overflow-y-auto p-5">
          {selectedDef && selectedId ? (
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
              {/* Basic fields */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg text-text-primary">{selectedDef.displayName}</h3>
                  <button
                    onClick={() => { deleteDefinition(selectedId); setSelectedId(null); }}
                    className="rounded border border-status-error/30 px-3 py-1 text-xs text-status-error hover:bg-status-error/10"
                  >
                    Delete
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-xs text-text-secondary">
                    Display Name
                    <input
                      className="rounded border border-border-default bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent/50"
                      value={selectedDef.displayName}
                      onChange={(e) => patchSelected({ displayName: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-text-secondary">
                    Sort Order
                    <input
                      type="number"
                      className="rounded border border-border-default bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent/50"
                      value={selectedDef.sortOrder}
                      onChange={(e) => patchSelected({ sortOrder: parseInt(e.target.value) || 0 })}
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-1 text-xs text-text-secondary">
                  Achievement ID
                  <input
                    className="rounded border border-border-default bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent/50"
                    placeholder="e.g. combat/beetle_exterminator"
                    value={selectedDef.achievementId}
                    onChange={(e) => patchSelected({ achievementId: e.target.value })}
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs text-text-secondary">
                  Creative Brief
                  <textarea
                    className="h-20 resize-y rounded border border-border-default bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent/50"
                    placeholder="Describe the visual theme for this sprite..."
                    value={selectedDef.brief ?? ""}
                    onChange={(e) => patchSelected({ brief: e.target.value })}
                  />
                </label>
              </div>

              {/* Variants */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-display text-sm text-text-primary">
                    Variants ({selectedDef.variants.length})
                  </h4>
                  <button
                    onClick={addVariant}
                    className="rounded border border-border-default px-2 py-1 text-xs text-text-secondary hover:bg-bg-elevated"
                  >
                    Add Variant
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  {selectedDef.variants.map((variant, idx) => (
                    <div
                      key={variant.imageId}
                      className="flex items-start gap-3 rounded-xl border border-white/8 bg-black/12 p-3"
                    >
                      <VariantThumb fileName={spriteAssetMap.get(variant.imageId)} />

                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex flex-col gap-0.5 text-2xs text-text-muted">
                            Image ID
                            <input
                              className="rounded border border-border-default bg-bg-primary px-1.5 py-1 text-xs text-text-primary outline-none"
                              value={variant.imageId}
                              onChange={(e) => {
                                const imageId = e.target.value;
                                patchVariant(idx, { imageId, imagePath: `player_sprites/${imageId}.png` });
                              }}
                            />
                          </label>
                          <label className="flex flex-col gap-0.5 text-2xs text-text-muted">
                            Display Name
                            <input
                              className="rounded border border-border-default bg-bg-primary px-1.5 py-1 text-xs text-text-primary outline-none"
                              placeholder="(inherits parent)"
                              value={variant.displayName ?? ""}
                              onChange={(e) => patchVariant(idx, { displayName: e.target.value || undefined })}
                            />
                          </label>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <label className="flex flex-col gap-0.5 text-2xs text-text-muted">
                            Race Filter
                            <select
                              className="rounded border border-border-default bg-bg-primary px-1.5 py-1 text-xs text-text-primary outline-none"
                              value={variant.race ?? ""}
                              onChange={(e) => patchVariant(idx, { race: e.target.value || undefined })}
                            >
                              <option value="">Any</option>
                              {races.map((r) => (
                                <option key={r} value={r.toUpperCase()}>{r}</option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-0.5 text-2xs text-text-muted">
                            Class Filter
                            <select
                              className="rounded border border-border-default bg-bg-primary px-1.5 py-1 text-xs text-text-primary outline-none"
                              value={variant.playerClass ?? ""}
                              onChange={(e) => patchVariant(idx, { playerClass: e.target.value || undefined })}
                            >
                              <option value="">Any</option>
                              {classes.map((c) => (
                                <option key={c} value={c.toUpperCase()}>{c}</option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-0.5 text-2xs text-text-muted">
                            Gender
                            <select
                              className="rounded border border-border-default bg-bg-primary px-1.5 py-1 text-xs text-text-primary outline-none"
                              value={variant.gender ?? ""}
                              onChange={(e) => patchVariant(idx, { gender: e.target.value || undefined })}
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
                          onClick={() => generateVariantImage(variant, selectedDef.brief ?? selectedDef.displayName)}
                          disabled={!hasApiKey || generating === variant.imageId}
                          className="rounded border border-accent/40 px-2 py-1 text-2xs text-accent hover:bg-accent/10 disabled:opacity-40"
                        >
                          {generating === variant.imageId ? "..." : "Gen"}
                        </button>
                        {selectedDef.variants.length > 1 && (
                          <button
                            onClick={() => removeVariant(idx)}
                            className="rounded border border-status-error/30 px-2 py-1 text-2xs text-status-error hover:bg-status-error/10"
                          >
                            Del
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-text-muted">
              Select a sprite definition or add a new one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
