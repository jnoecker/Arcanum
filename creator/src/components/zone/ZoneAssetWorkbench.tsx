import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useAssetStore } from "@/stores/assetStore";
import { useVibeStore } from "@/stores/vibeStore";
import { useImageSrc } from "@/lib/useImageSrc";
import { removeBgAndSave, shouldRemoveBg } from "@/lib/useBackgroundRemoval";
import {
  defaultImageContext,
  defaultImagePrompt,
  entityContext,
  entityPrompt,
  type DefaultImageKind,
} from "@/lib/entityPrompts";
import { getEnhanceSystemPrompt, getNegativePrompt } from "@/lib/arcanumPrompts";
import { imageGenerateCommand, resolveImageModel, requestsTransparentBackground, type AssetContext, type AssetEntry, type GeneratedImage } from "@/types/assets";
import { InlineError, Spinner } from "@/components/ui/FormWidgets";
import {
  loadCollapsedZoneAssetSections,
  saveCollapsedZoneAssetSections,
} from "@/lib/uiPersistence";
import type { WorldFile } from "@/types/world";

type EntityKind = "room" | "mob" | "item" | "shop" | "gatheringNode";
type WorkbenchKey = `default:${DefaultImageKind}` | `entity:${EntityKind}:${string}`;

interface BrowseEntity {
  kind: EntityKind;
  id: string;
  label: string;
  image?: string;
}

type WorkbenchTarget =
  | { mode: "default"; kind: DefaultImageKind }
  | { mode: "entity"; entity: BrowseEntity };

interface ZoneAssetWorkbenchProps {
  zoneId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
}

const KIND_ORDER: EntityKind[] = ["room", "mob", "item", "gatheringNode", "shop"];
const DEFAULT_KIND_ORDER: DefaultImageKind[] = ["room", "mob", "item"];

const KIND_LABELS: Record<EntityKind, string> = {
  room: "Rooms",
  mob: "Mobs",
  item: "Items",
  gatheringNode: "Gathering Nodes",
  shop: "Shops",
};

const DEFAULT_KIND_LABELS: Record<DefaultImageKind, string> = {
  room: "Default room art",
  mob: "Default mob art",
  item: "Default item art",
};

function collectEntities(world: WorldFile): BrowseEntity[] {
  const entities: BrowseEntity[] = [];
  for (const [id, room] of Object.entries(world.rooms)) entities.push({ kind: "room", id, label: room.title || id, image: room.image });
  for (const [id, mob] of Object.entries(world.mobs ?? {})) entities.push({ kind: "mob", id, label: mob.name || id, image: mob.image });
  for (const [id, item] of Object.entries(world.items ?? {})) entities.push({ kind: "item", id, label: item.displayName || id, image: item.image });
  for (const [id, node] of Object.entries(world.gatheringNodes ?? {})) entities.push({ kind: "gatheringNode", id, label: node.displayName || id, image: node.image });
  for (const [id, shop] of Object.entries(world.shops ?? {})) entities.push({ kind: "shop", id, label: shop.name || id, image: shop.image });
  return entities;
}

function assetTypeForKind(kind: EntityKind | DefaultImageKind): string {
  if (kind === "room" || kind === "shop") return "background";
  if (kind === "mob") return "mob";
  if (kind === "gatheringNode") return "gathering_node";
  return "item";
}

function dimensionsForKind(kind: EntityKind | DefaultImageKind): { width: number; height: number } {
  if (kind === "room" || kind === "shop") return { width: 1920, height: 1080 };
  if (kind === "mob" || kind === "gatheringNode") return { width: 512, height: 512 };
  return { width: 256, height: 256 };
}

function updateEntityImage(world: WorldFile, entity: BrowseEntity, image: string): WorldFile {
  if (entity.kind === "room") {
    const room = world.rooms[entity.id];
    if (!room) return world;
    return { ...world, rooms: { ...world.rooms, [entity.id]: { ...room, image } } };
  }
  const collection = entity.kind === "mob" ? "mobs" : entity.kind === "item" ? "items" : entity.kind === "gatheringNode" ? "gatheringNodes" : "shops";
  const entities = world[collection] as Record<string, Record<string, unknown>> | undefined;
  if (!entities?.[entity.id]) return world;
  return { ...world, [collection]: { ...entities, [entity.id]: { ...entities[entity.id], image } } };
}

/** Resolve an entity object from a WorldFile by kind + id. Returns
 *  undefined if the collection or entry doesn't exist. Kept in one place
 *  so new kinds don't silently fall through to the wrong collection. */
function resolveEntity(world: WorldFile, kind: EntityKind, id: string): unknown {
  switch (kind) {
    case "room": return world.rooms?.[id];
    case "mob": return world.mobs?.[id];
    case "item": return world.items?.[id];
    case "shop": return world.shops?.[id];
    case "gatheringNode": return world.gatheringNodes?.[id];
  }
}

function updateDefaultImage(world: WorldFile, kind: DefaultImageKind, image: string): WorldFile {
  return { ...world, image: { ...(world.image ?? {}), [kind]: image } };
}

function currentImageForTarget(target: WorkbenchTarget | null, world: WorldFile): string | undefined {
  if (!target) return undefined;
  return target.mode === "default" ? world.image?.[target.kind] : target.entity.image;
}

function variantGroupForTarget(target: WorkbenchTarget | null, zoneId: string): string {
  if (!target) return "";
  return target.mode === "default" ? `default:${zoneId}:${target.kind}` : `${target.entity.kind}:${zoneId}:${target.entity.id}`;
}

function contextForTarget(target: WorkbenchTarget | null, zoneId: string): AssetContext | undefined {
  if (!target) return undefined;
  return target.mode === "default"
    ? { zone: zoneId, entity_type: "default", entity_id: target.kind }
    : { zone: zoneId, entity_type: target.entity.kind, entity_id: target.entity.id };
}

function fallbackUsageCount(world: WorldFile, kind: DefaultImageKind): number {
  if (kind === "room") return Object.values(world.rooms).filter((room) => !room.image).length;
  if (kind === "mob") return Object.values(world.mobs ?? {}).filter((mob) => !mob.image).length;
  return Object.values(world.items ?? {}).filter((item) => !item.image).length;
}

function targetTitle(target: WorkbenchTarget): string {
  return target.mode === "default" ? DEFAULT_KIND_LABELS[target.kind] : target.entity.label;
}

function targetSubtitle(target: WorkbenchTarget, world: WorldFile): string {
  if (target.mode === "default") {
    const usageCount = fallbackUsageCount(world, target.kind);
    return usageCount > 0 ? `${usageCount} ${target.kind}${usageCount === 1 ? "" : "s"} will use this fallback` : `No ${target.kind}s currently need the zone fallback`;
  }
  return target.entity.id;
}

function targetKind(target: WorkbenchTarget): EntityKind | DefaultImageKind {
  return target.mode === "default" ? target.kind : target.entity.kind;
}

function defaultSelectionKey(world: WorldFile, entities: BrowseEntity[]): WorkbenchKey | null {
  const defaultWithImage = DEFAULT_KIND_ORDER.find((kind) => world.image?.[kind]);
  if (defaultWithImage) return `default:${defaultWithImage}`;
  const firstEntityWithImage = entities.find((entity) => entity.image);
  if (firstEntityWithImage) return `entity:${firstEntityWithImage.kind}:${firstEntityWithImage.id}`;
  const firstEntity = entities[0];
  return firstEntity ? `entity:${firstEntity.kind}:${firstEntity.id}` : "default:room";
}

const VariantCard = memo(function VariantCard({ entry, assetsDir, onClick }: { entry: AssetEntry; assetsDir: string; onClick: () => void }) {
  const thumbSrc = useImageSrc(`${assetsDir}\\images\\${entry.file_name}`);
  return (
    <button
      onClick={onClick}
      className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 transition ${
        entry.is_active ? "border-accent shadow-[0_0_0_1px_var(--border-accent-ring)]" : "border-[var(--chrome-stroke-strong)] hover:border-[var(--border-glow)]"
      }`}
    >
      {thumbSrc ? <img src={thumbSrc} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-[var(--chrome-highlight)]" />}
    </button>
  );
});

export function ZoneAssetWorkbench({ zoneId, world, onWorldChange }: ZoneAssetWorkbenchProps) {
  const worldRef = useRef(world);
  worldRef.current = world;
  const settings = useAssetStore((s) => s.settings);
  const artStyle = useAssetStore((s) => s.artStyle);
  const acceptAsset = useAssetStore((s) => s.acceptAsset);
  const importAsset = useAssetStore((s) => s.importAsset);
  const listVariants = useAssetStore((s) => s.listVariants);
  const setActiveVariant = useAssetStore((s) => s.setActiveVariant);
  const loadAssets = useAssetStore((s) => s.loadAssets);
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const zoneVibe = useVibeStore((s) => s.vibes.get(zoneId) ?? "");
  const entities = useMemo(() => collectEntities(world), [world]);

  const [selectedKey, setSelectedKey] = useState<WorkbenchKey | null>(null);
  const [promptDraft, setPromptDraft] = useState("");
  const [promptGeneratedByLlm, setPromptGeneratedByLlm] = useState(false);
  const [variants, setVariants] = useState<AssetEntry[]>([]);
  const [previewEntry, setPreviewEntry] = useState<AssetEntry | null>(null);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [batchCount, setBatchCount] = useState(1);
  const [importing, setImporting] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(loadCollapsedZoneAssetSections(zoneId)),
  );

  useEffect(() => {
    setCollapsedSections(new Set(loadCollapsedZoneAssetSections(zoneId)));
    setSearchQuery("");
  }, [zoneId]);

  useEffect(() => {
    saveCollapsedZoneAssetSections(zoneId, [...collapsedSections]);
  }, [zoneId, collapsedSections]);

  const toggleSection = useCallback((id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;
  const entityMatchesQuery = useCallback(
    (entity: BrowseEntity) => {
      if (!normalizedQuery) return true;
      return (
        entity.label.toLowerCase().includes(normalizedQuery) ||
        entity.id.toLowerCase().includes(normalizedQuery)
      );
    },
    [normalizedQuery],
  );

  const entityGroups = useMemo(() => {
    const grouped = new Map<EntityKind, BrowseEntity[]>();
    for (const kind of KIND_ORDER) grouped.set(kind, []);
    for (const entity of entities) grouped.get(entity.kind)?.push(entity);
    return grouped;
  }, [entities]);

  useEffect(() => {
    if (selectedKey?.startsWith("default:")) {
      const kind = selectedKey.replace("default:", "") as DefaultImageKind;
      if (DEFAULT_KIND_ORDER.includes(kind)) return;
    }
    if (selectedKey?.startsWith("entity:")) {
      const [, kind, id] = selectedKey.split(":");
      if (entities.some((entity) => entity.kind === kind && entity.id === id)) return;
    }
    setSelectedKey(defaultSelectionKey(world, entities));
  }, [entities, selectedKey, world]);

  const selectedTarget = useMemo<WorkbenchTarget | null>(() => {
    if (!selectedKey) return null;
    if (selectedKey.startsWith("default:")) return { mode: "default", kind: selectedKey.replace("default:", "") as DefaultImageKind };
    const [, kind, id] = selectedKey.split(":");
    const entity = entities.find((entry) => entry.kind === kind && entry.id === id);
    return entity ? { mode: "entity", entity } : null;
  }, [entities, selectedKey]);

  const selectedVariantGroup = useMemo(() => variantGroupForTarget(selectedTarget, zoneId), [selectedTarget, zoneId]);
  const selectedContext = useMemo(() => contextForTarget(selectedTarget, zoneId), [selectedTarget, zoneId]);
  const selectedKind = selectedTarget ? targetKind(selectedTarget) : null;
  const currentImage = currentImageForTarget(selectedTarget, world);
  const selectedSrc = useImageSrc(previewEntry?.file_name || currentImage);

  const refreshVariants = useCallback(async () => {
    if (!selectedVariantGroup) {
      setVariants([]);
      setPreviewEntry(null);
      return;
    }
    try {
      const next = await listVariants(selectedVariantGroup);
      setVariants(next);
      setPreviewEntry(next.find((entry) => entry.is_active) ?? next[0] ?? null);
    } catch {
      setVariants([]);
      setPreviewEntry(null);
    }
  }, [listVariants, selectedVariantGroup]);

  useEffect(() => {
    refreshVariants();
  }, [refreshVariants]);

  useEffect(() => {
    if (!selectedTarget) {
      setPromptDraft("");
      return;
    }
    const activeVariant = variants.find((entry) => entry.is_active);
    if (activeVariant?.enhanced_prompt || activeVariant?.prompt) {
      setPromptDraft(activeVariant.enhanced_prompt || activeVariant.prompt);
      setPromptGeneratedByLlm(Boolean(activeVariant.enhanced_prompt));
      setError(null);
      return;
    }
    if (selectedTarget.mode === "default") {
      setPromptDraft(defaultImagePrompt(selectedTarget.kind, world, zoneVibe, artStyle));
      setPromptGeneratedByLlm(false);
      setError(null);
      return;
    }
    const entity = resolveEntity(world, selectedTarget.entity.kind, selectedTarget.entity.id);
    setPromptDraft(entityPrompt(selectedTarget.entity.kind, selectedTarget.entity.id, entity, artStyle));
    setPromptGeneratedByLlm(false);
    setError(null);
  }, [selectedTarget, world, zoneVibe, artStyle, variants]);

  const imageProvider = settings?.image_provider ?? "deepinfra";
  const defaultModel = resolveImageModel(imageProvider, settings?.image_model);
  const hasImageKey = !!((imageProvider === "deepinfra" && settings?.deepinfra_api_key) || (imageProvider === "runware" && settings?.runware_api_key) || (imageProvider === "openai" && settings?.openai_api_key));
  const hasLlmKey = !!(settings?.deepinfra_api_key || settings?.anthropic_api_key || settings?.openrouter_api_key);

  const buildContext = useCallback(() => {
    if (!selectedTarget) return "";
    if (selectedTarget.mode === "default") return defaultImageContext(selectedTarget.kind, world);
    const entity = resolveEntity(world, selectedTarget.entity.kind, selectedTarget.entity.id);
    return entityContext(selectedTarget.entity.kind, selectedTarget.entity.id, entity);
  }, [selectedTarget, world]);

  const generateEnhancedPrompt = useCallback(async () => {
    if (!selectedTarget) return "";
    const systemPrompt = getEnhanceSystemPrompt(artStyle, undefined, "worldbuilding");
    const userPrompt = [
      selectedTarget.mode === "default"
        ? `Generate a fallback/default image prompt for this zone asset:\n${buildContext()}`
        : `Generate an image prompt for this entity:\n${buildContext()}`,
      zoneVibe ? `\nZone atmosphere/vibe:\n${zoneVibe}` : "",
      `\nReference style template (adapt but prioritize the context above):\n${promptDraft}`,
    ].join("\n");
    return invoke<string>("llm_complete", { systemPrompt, userPrompt });
  }, [selectedTarget, artStyle, buildContext, zoneVibe, promptDraft]);

  const persistImageSelection = useCallback((fileName: string) => {
    if (!selectedTarget) return;
    const current = worldRef.current;
    if (selectedTarget.mode === "default") {
      onWorldChange(updateDefaultImage(current, selectedTarget.kind, fileName));
      return;
    }
    onWorldChange(updateEntityImage(current, selectedTarget.entity, fileName));
  }, [onWorldChange, selectedTarget]);

  const runGeneration = useCallback(async (prompt: string, activate: boolean) => {
    if (!selectedTarget || !selectedKind || !defaultModel) return null;
    const command = imageGenerateCommand(imageProvider);
    const dimensions = dimensionsForKind(selectedKind);
    const assetType = assetTypeForKind(selectedKind);
    const image = await invoke<GeneratedImage>(command, {
      prompt,
      negativePrompt: getNegativePrompt(assetType),
      model: defaultModel.id,
      width: dimensions.width,
      height: dimensions.height,
      steps: defaultModel.defaultSteps ?? 4,
      guidance: "defaultGuidance" in defaultModel ? defaultModel.defaultGuidance : null,
      assetType,
      autoEnhance: !promptGeneratedByLlm,
      transparentBackground: imageProvider === "openai" && requestsTransparentBackground(assetType),
    });
    await acceptAsset(image, assetType, prompt, selectedContext, selectedVariantGroup, activate);
    return image;
  }, [acceptAsset, defaultModel, imageProvider, promptGeneratedByLlm, selectedContext, selectedKind, selectedTarget, selectedVariantGroup]);

  const handleGeneratePrompt = async () => {
    if (!selectedTarget || !hasLlmKey) return;
    setGeneratingPrompt(true);
    setError(null);
    try {
      setPromptDraft(await generateEnhancedPrompt());
      setPromptGeneratedByLlm(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setGeneratingPrompt(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedTarget || !hasImageKey || !selectedKind) return;
    const count = Math.max(1, Math.min(8, batchCount));
    setGeneratingImage(true);
    setError(null);
    try {
      let firstImage: GeneratedImage | null = null;
      for (let i = 0; i < count; i += 1) {
        const image = await runGeneration(promptDraft, i === 0);
        if (i === 0) firstImage = image;
      }
      if (firstImage) {
        persistImageSelection(firstImage.file_path.split(/[\\/]/).pop() ?? firstImage.hash);
      }
      await loadAssets();
      await refreshVariants();

      // Auto-run background removal for sprite asset types after generation.
      // The spinner stays visible the whole time so the user knows work is
      // still happening even after the new variant appears.
      const assetType = assetTypeForKind(selectedKind);
      if (firstImage?.data_url && shouldRemoveBg(assetType) && settings?.auto_remove_bg) {
        setRemovingBg(true);
        try {
          const entry = await removeBgAndSave(
            firstImage.data_url,
            assetType,
            selectedContext,
            selectedVariantGroup,
          ).catch(() => null);
          if (entry && selectedVariantGroup) {
            await setActiveVariant(selectedVariantGroup, entry.id);
            persistImageSelection(entry.file_name);
            await loadAssets();
            await refreshVariants();
          }
        } finally {
          setRemovingBg(false);
        }
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleImport = async () => {
    if (!selectedTarget || !selectedKind) return;
    const selected = await open({
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
      multiple: false,
    });
    if (!selected) return;

    setImporting(true);
    setError(null);
    try {
      const entry = await importAsset(
        selected as string,
        assetTypeForKind(selectedKind),
        selectedContext,
        selectedVariantGroup,
        true,
      );
      persistImageSelection(entry.file_name);
      await loadAssets();
      await refreshVariants();
    } catch (err) {
      setError(String(err));
    } finally {
      setImporting(false);
    }
  };

  const handleVariantSelect = async (entry: AssetEntry) => {
    if (!selectedVariantGroup) return;
    try {
      await setActiveVariant(selectedVariantGroup, entry.id);
      setPreviewEntry(entry);
      persistImageSelection(entry.file_name);
      await refreshVariants();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleRemoveBg = async () => {
    if (!previewEntry || !selectedSrc || !selectedKind || !shouldRemoveBg(assetTypeForKind(selectedKind))) return;
    setRemovingBg(true);
    setError(null);
    try {
      const entry = await removeBgAndSave(selectedSrc, assetTypeForKind(selectedKind), selectedContext, selectedVariantGroup);
      if (entry) {
        await setActiveVariant(selectedVariantGroup, entry.id);
        persistImageSelection(entry.file_name);
        await loadAssets();
        await refreshVariants();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setRemovingBg(false);
    }
  };

  const completedEntityCount = entities.filter((entity) => entity.image).length;
  const completedDefaultCount = DEFAULT_KIND_ORDER.filter((kind) => world.image?.[kind]).length;
  const totalSlots = entities.length + DEFAULT_KIND_ORDER.length;
  const completion = totalSlots > 0 ? Math.round(((completedEntityCount + completedDefaultCount) / totalSlots) * 100) : 0;

  return (
    <section className="rounded-3xl border border-[var(--chrome-stroke)] bg-gradient-panel p-5 shadow-section">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl text-text-primary">Zone assets</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Entity art and zone defaults.
          </p>
        </div>
        <div className="min-w-40">
          <div className="mb-1 flex items-center justify-between text-2xs uppercase tracking-label text-text-muted">
            <span>Coverage</span>
            <span>{completion}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--chrome-fill)]">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,rgb(var(--accent-rgb)/0.95),rgb(var(--surface-rgb)/0.9))]" style={{ width: `${completion}%` }} />
          </div>
        </div>
      </div>

      {!selectedTarget ? (
        <div className="rounded-2xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill)] px-4 py-8 text-sm text-text-muted">
          Select a zone with entities to start generating and reviewing art.
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[0.62fr_1.38fr]">
          <div className="rounded-3xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search entities by name or id…"
                aria-label="Filter zone assets"
                className="w-full rounded-full border border-[var(--chrome-stroke)] bg-surface-scrim px-4 py-2 text-xs text-text-primary outline-none transition placeholder:text-text-muted focus:border-border-active focus-visible:ring-2 focus-visible:ring-border-active"
              />
              {isSearching && (
                <button
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="shrink-0 rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] px-3 py-2 text-2xs text-text-muted transition hover:bg-[var(--chrome-highlight-strong)]"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="max-h-[40rem] overflow-y-auto pr-1">
              {(() => {
                const defaultsCollapsed = !isSearching && collapsedSections.has("defaults");
                return (
                  <div className="mb-5">
                    <button
                      type="button"
                      onClick={() => toggleSection("defaults")}
                      aria-expanded={!defaultsCollapsed}
                      aria-label={`${defaultsCollapsed ? "Expand" : "Collapse"} Zone defaults`}
                      className="mb-2 flex w-full items-center gap-1.5 rounded-md px-1 py-1 transition hover:bg-[var(--chrome-highlight)]"
                    >
                      <svg
                        className={`h-3 w-3 shrink-0 text-text-muted transition-transform duration-150 ${defaultsCollapsed ? "" : "rotate-90"}`}
                        viewBox="0 0 12 12"
                        fill="currentColor"
                      >
                        <path d="M4.5 2L9 6L4.5 10z" />
                      </svg>
                      <span className="text-2xs uppercase tracking-ui text-text-muted">Zone defaults</span>
                      <span className="ml-auto text-2xs text-text-muted">{DEFAULT_KIND_ORDER.length}</span>
                    </button>
                    {!defaultsCollapsed && (
                      <div className="flex flex-col gap-2">
                        {DEFAULT_KIND_ORDER.map((kind) => {
                          const key: WorkbenchKey = `default:${kind}`;
                          const selected = selectedKey === key;
                          const usageCount = fallbackUsageCount(world, kind);
                          const hasImage = !!world.image?.[kind];
                          return (
                            <button
                              key={kind}
                              onClick={() => setSelectedKey(key)}
                              className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                                selected ? "border-border-active bg-gradient-active" : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] hover:bg-[var(--chrome-highlight-strong)]"
                              }`}
                            >
                              <span className={`h-2.5 w-2.5 rounded-full ${hasImage ? "bg-status-success" : "bg-text-muted/50"}`} />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm text-text-primary">{DEFAULT_KIND_LABELS[kind]}</div>
                                <div className="truncate text-2xs text-text-muted">
                                  {usageCount > 0 ? `${usageCount} fallback uses pending` : "Currently optional"}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {(() => {
                const visibleGroups = KIND_ORDER.map((kind) => {
                  const items = (entityGroups.get(kind) ?? []).filter(entityMatchesQuery);
                  const totalCount = entityGroups.get(kind)?.length ?? 0;
                  return { kind, items, totalCount };
                }).filter((group) => group.totalCount > 0);
                const anyMatches = visibleGroups.some((group) => group.items.length > 0);
                if (isSearching && !anyMatches) {
                  return (
                    <div className="rounded-2xl border border-dashed border-[var(--chrome-stroke-strong)] px-4 py-6 text-center text-xs text-text-muted">
                      No entities match “{searchQuery}”.
                    </div>
                  );
                }
                return visibleGroups.map(({ kind, items, totalCount }) => {
                  if (isSearching && items.length === 0) return null;
                  const collapsed = !isSearching && collapsedSections.has(kind);
                  return (
                    <div key={kind} className="mb-4">
                      <button
                        type="button"
                        onClick={() => toggleSection(kind)}
                        aria-expanded={!collapsed}
                        aria-label={`${collapsed ? "Expand" : "Collapse"} ${KIND_LABELS[kind]}`}
                        className="mb-2 flex w-full items-center gap-1.5 rounded-md px-1 py-1 transition hover:bg-[var(--chrome-highlight)]"
                      >
                        <svg
                          className={`h-3 w-3 shrink-0 text-text-muted transition-transform duration-150 ${collapsed ? "" : "rotate-90"}`}
                          viewBox="0 0 12 12"
                          fill="currentColor"
                        >
                          <path d="M4.5 2L9 6L4.5 10z" />
                        </svg>
                        <span className="text-2xs uppercase tracking-ui text-text-muted">{KIND_LABELS[kind]}</span>
                        <span className="ml-auto text-2xs text-text-muted">
                          {isSearching ? `${items.length} / ${totalCount}` : totalCount}
                        </span>
                      </button>
                      {!collapsed && (
                        <div className="flex flex-col gap-2">
                          {items.map((entity) => {
                            const key: WorkbenchKey = `entity:${entity.kind}:${entity.id}`;
                            const selected = selectedKey === key;
                            return (
                              <button
                                key={key}
                                onClick={() => setSelectedKey(key)}
                                className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                                  selected ? "border-border-active bg-gradient-active" : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] hover:bg-[var(--chrome-highlight-strong)]"
                                }`}
                              >
                                <span className={`h-2.5 w-2.5 rounded-full ${entity.image ? "bg-status-success" : "bg-text-muted/50"}`} />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm text-text-primary">{entity.label}</div>
                                  <div className="truncate text-2xs text-text-muted">{entity.id}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          <div className="flex flex-col gap-5">
            {/* Preview row — wide horizontal card */}
            <div className="rounded-3xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-4">
              <div className="flex gap-5">
                {/* Image preview */}
                <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--chrome-stroke)] bg-[linear-gradient(180deg,rgba(34,41,60,0.8),rgba(28,34,52,0.88))] p-3" style={{ width: "16rem", height: "10rem" }}>
                  {selectedSrc ? (
                    <img src={selectedSrc} alt={targetTitle(selectedTarget)} className="max-h-full max-w-full rounded-xl object-contain shadow-section" />
                  ) : (
                    <div className="text-center text-xs text-text-muted">No art yet</div>
                  )}
                </div>

                {/* Info + variants */}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xs uppercase tracking-ui text-text-muted">
                        {selectedTarget.mode === "default" ? "Zone default" : selectedTarget.entity.kind}
                      </div>
                      <h3 className="mt-0.5 font-display text-xl text-text-primary">{targetTitle(selectedTarget)}</h3>
                      <div className="mt-0.5 text-xs text-text-secondary">{targetSubtitle(selectedTarget, world)}</div>
                    </div>
                    <span className="rounded-full bg-[var(--chrome-highlight-strong)] px-3 py-1 text-2xs uppercase tracking-label text-text-muted">
                      {variants.length} variants
                    </span>
                  </div>

                  <div className="mt-2 text-xs leading-5 text-text-muted">
                    {selectedTarget.mode === "default"
                      ? `Fallback for ${selectedTarget.kind}s without their own art.`
                      : "Assigned directly to the selected entity."}
                  </div>

                  {variants.length > 0 && (
                    <div className="mt-3">
                      <div className="mb-1.5 text-2xs uppercase tracking-ui text-text-muted">Variants</div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {variants.map((entry) => (
                          <VariantCard key={entry.id} entry={entry} assetsDir={assetsDir} onClick={() => handleVariantSelect(entry)} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Prompt engineering — full width */}
            <div className="rounded-3xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-4">
              <div className="mb-3 text-2xs uppercase tracking-ui text-text-muted">Prompt engineering</div>

              <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xs uppercase tracking-ui text-text-muted">Step 1 · Prompt</span>
                      {promptGeneratedByLlm && (
                        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-2xs font-medium text-accent">
                          Enhanced
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleGeneratePrompt}
                      disabled={!hasLlmKey || generatingPrompt || generatingImage || removingBg}
                      className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] px-3 py-1 text-2xs font-medium text-text-primary transition enabled:hover:bg-[var(--chrome-highlight-strong)] disabled:opacity-50"
                    >
                      {generatingPrompt ? (
                        <span className="flex items-center gap-1.5"><Spinner />Enhancing</span>
                      ) : promptGeneratedByLlm ? (
                        "Re-enhance"
                      ) : (
                        "Enhance prompt"
                      )}
                    </button>
                  </div>
                  <textarea
                    value={promptDraft}
                    onChange={(event) => {
                      setPromptDraft(event.target.value);
                      setPromptGeneratedByLlm(false);
                    }}
                    rows={8}
                    className="w-full flex-1 resize-y rounded-2xl border border-[var(--chrome-stroke)] bg-surface-scrim px-4 py-3 font-mono text-xs leading-6 text-text-secondary outline-none transition focus:border-border-active focus-visible:ring-2 focus-visible:ring-border-active"
                    placeholder={selectedTarget.mode === "default" ? "Describe the fallback for this zone asset, then click Enhance prompt..." : "Describe this entity, then click Enhance prompt..."}
                  />
                </div>

                <div className="flex flex-col gap-3">
                  {zoneVibe && (
                    <div className="rounded-2xl border border-[var(--chrome-stroke)] bg-surface-scrim-light px-4 py-3">
                      <div className="text-2xs uppercase tracking-ui text-text-muted">Zone vibe</div>
                      <div className="mt-1.5 max-h-24 overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-text-secondary">{zoneVibe}</div>
                    </div>
                  )}
                  <div className="rounded-2xl border border-[var(--chrome-stroke)] bg-surface-scrim-light px-4 py-3">
                    <div className="text-2xs uppercase tracking-ui text-text-muted">
                      {selectedTarget.mode === "default" ? "Zone default context" : "Entity context"}
                    </div>
                    <div className="mt-1.5 max-h-24 overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-text-secondary">{buildContext()}</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-2xs uppercase tracking-ui text-text-muted">Step 2 · Generate</span>
                <select
                  value={batchCount}
                  onChange={(event) => setBatchCount(Number(event.target.value))}
                  disabled={!hasImageKey || generatingPrompt || generatingImage || removingBg}
                  aria-label="Number of variants to generate"
                  className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] px-3 py-2 text-xs font-medium text-text-primary outline-none transition focus-visible:ring-2 focus-visible:ring-border-active disabled:opacity-50"
                >
                  <option value={1} className="bg-bg-primary">×1</option>
                  <option value={2} className="bg-bg-primary">×2</option>
                  <option value={4} className="bg-bg-primary">×4</option>
                  <option value={8} className="bg-bg-primary">×8</option>
                </select>
                <button
                  onClick={handleGenerate}
                  disabled={!hasImageKey || generatingPrompt || generatingImage || removingBg}
                  className="rounded-full border border-[var(--border-accent-subtle)] bg-gradient-active-strong px-4 py-2 text-xs font-medium text-text-primary transition hover:brightness-110 disabled:opacity-50"
                >
                  {generatingImage ? (
                    <span className="flex items-center gap-1.5">
                      <Spinner />
                      {batchCount > 1 ? `Generating ×${batchCount}` : "Generating image"}
                    </span>
                  ) : removingBg ? (
                    <span className="flex items-center gap-1.5"><Spinner />Removing background</span>
                  ) : batchCount > 1 ? (
                    `Generate ×${batchCount}`
                  ) : (
                    "Generate image"
                  )}
                </button>
                <span className="mx-1 h-6 w-px bg-[var(--chrome-highlight-strong)]" aria-hidden="true" />
                <button
                  onClick={handleImport}
                  disabled={importing || generatingPrompt || generatingImage || removingBg}
                  className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-[var(--chrome-highlight-strong)] disabled:opacity-50"
                >
                  {importing ? <span className="flex items-center gap-1.5"><Spinner />Importing</span> : "Import image"}
                </button>
                <button
                  onClick={handleRemoveBg}
                  disabled={removingBg || generatingImage || !previewEntry || !selectedSrc || !selectedKind || !shouldRemoveBg(assetTypeForKind(selectedKind))}
                  className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-[var(--chrome-highlight-strong)] disabled:opacity-50"
                >
                  {removingBg ? <span className="flex items-center gap-1.5"><Spinner />Removing BG</span> : "Remove BG"}
                </button>
              </div>

              {error && (
                <div className="mt-4">
                  <InlineError error={error} onDismiss={() => setError(null)} onRetry={handleGenerate} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
