import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { getEnhanceSystemPrompt, UNIVERSAL_NEGATIVE } from "@/lib/arcanumPrompts";
import { IMAGE_MODELS, type AssetContext, type AssetEntry, type GeneratedImage } from "@/types/assets";
import type { WorldFile } from "@/types/world";

type EntityKind = "room" | "mob" | "item" | "shop";
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

const KIND_ORDER: EntityKind[] = ["room", "mob", "item", "shop"];
const DEFAULT_KIND_ORDER: DefaultImageKind[] = ["room", "mob", "item"];

const KIND_LABELS: Record<EntityKind, string> = {
  room: "Rooms",
  mob: "Mobs",
  item: "Items",
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
  for (const [id, shop] of Object.entries(world.shops ?? {})) entities.push({ kind: "shop", id, label: shop.name || id, image: shop.image });
  return entities;
}

function assetTypeForKind(kind: EntityKind | DefaultImageKind): string {
  if (kind === "room" || kind === "shop") return "background";
  if (kind === "mob") return "mob";
  return "item";
}

function dimensionsForKind(kind: EntityKind | DefaultImageKind): { width: number; height: number } {
  if (kind === "room" || kind === "shop") return { width: 1920, height: 1080 };
  if (kind === "mob") return { width: 512, height: 512 };
  return { width: 256, height: 256 };
}

function updateEntityImage(world: WorldFile, entity: BrowseEntity, image: string): WorldFile {
  if (entity.kind === "room") {
    return { ...world, rooms: { ...world.rooms, [entity.id]: { ...world.rooms[entity.id]!, image } } };
  }
  const collection = entity.kind === "mob" ? "mobs" : entity.kind === "item" ? "items" : "shops";
  const entities = world[collection] as Record<string, Record<string, unknown>> | undefined;
  if (!entities?.[entity.id]) return world;
  return { ...world, [collection]: { ...entities, [entity.id]: { ...entities[entity.id], image } } };
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

function VariantCard({ entry, assetsDir, onClick }: { entry: AssetEntry; assetsDir: string; onClick: () => void }) {
  const thumbSrc = useImageSrc(`${assetsDir}\\images\\${entry.file_name}`);
  return (
    <button
      onClick={onClick}
      className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-[16px] border-2 transition ${
        entry.is_active ? "border-accent shadow-[0_0_0_1px_rgba(168,151,210,0.45)]" : "border-white/12 hover:border-[rgba(184,216,232,0.25)]"
      }`}
    >
      {thumbSrc ? <img src={thumbSrc} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-white/6" />}
    </button>
  );
}

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
  const [variants, setVariants] = useState<AssetEntry[]>([]);
  const [previewEntry, setPreviewEntry] = useState<AssetEntry | null>(null);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(null);
      return;
    }
    if (selectedTarget.mode === "default") {
      setPromptDraft(defaultImagePrompt(selectedTarget.kind, world, zoneVibe, artStyle));
      setError(null);
      return;
    }
    const collection = selectedTarget.entity.kind === "room"
      ? world.rooms
      : (selectedTarget.entity.kind === "mob" ? world.mobs : selectedTarget.entity.kind === "item" ? world.items : world.shops) ?? {};
    const entity = collection[selectedTarget.entity.id as keyof typeof collection];
    setPromptDraft(entityPrompt(selectedTarget.entity.kind, selectedTarget.entity.id, entity, artStyle));
    setError(null);
  }, [selectedTarget, world, zoneVibe, artStyle, variants]);

  const imageProvider = settings?.image_provider ?? "deepinfra";
  const availableModels = IMAGE_MODELS.filter((model) => model.provider === imageProvider);
  const defaultModel = availableModels[0];
  const hasImageKey = !!((imageProvider === "deepinfra" && settings?.deepinfra_api_key) || (imageProvider === "runware" && settings?.runware_api_key));
  const hasLlmKey = !!(settings?.deepinfra_api_key || settings?.anthropic_api_key || settings?.openrouter_api_key);

  const buildContext = useCallback(() => {
    if (!selectedTarget) return "";
    if (selectedTarget.mode === "default") return defaultImageContext(selectedTarget.kind, world);
    const collection = selectedTarget.entity.kind === "room"
      ? world.rooms
      : (selectedTarget.entity.kind === "mob" ? world.mobs : selectedTarget.entity.kind === "item" ? world.items : world.shops) ?? {};
    const entity = collection[selectedTarget.entity.id as keyof typeof collection];
    return entityContext(selectedTarget.entity.kind, selectedTarget.entity.id, entity);
  }, [selectedTarget, world]);

  const generateEnhancedPrompt = useCallback(async () => {
    if (!selectedTarget) return "";
    const systemPrompt = getEnhanceSystemPrompt(artStyle);
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
    const command = imageProvider === "runware" ? "runware_generate_image" : "generate_image";
    const dimensions = dimensionsForKind(selectedKind);
    const image = await invoke<GeneratedImage>(command, {
      prompt,
      negativePrompt: UNIVERSAL_NEGATIVE,
      model: defaultModel.id,
      width: dimensions.width,
      height: dimensions.height,
      steps: defaultModel.defaultSteps ?? 4,
      guidance: "defaultGuidance" in defaultModel ? defaultModel.defaultGuidance : null,
    });
    await acceptAsset(image, assetTypeForKind(selectedKind), prompt, selectedContext, selectedVariantGroup, activate);
    return image;
  }, [acceptAsset, defaultModel, imageProvider, selectedContext, selectedKind, selectedTarget, selectedVariantGroup]);

  const handleGeneratePrompt = async () => {
    if (!selectedTarget || !hasLlmKey) return;
    setGeneratingPrompt(true);
    setError(null);
    try {
      setPromptDraft(await generateEnhancedPrompt());
    } catch (err) {
      setError(String(err));
    } finally {
      setGeneratingPrompt(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!selectedTarget || !hasImageKey) return;
    setGeneratingImage(true);
    setError(null);
    try {
      const image = await runGeneration(promptDraft, true);
      if (image) {
        persistImageSelection(image.file_path.split(/[\\/]/).pop() ?? image.hash);
        await loadAssets();
        await refreshVariants();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleGenerateFour = async () => {
    if (!selectedTarget || !hasImageKey) return;
    setBatchGenerating(true);
    setError(null);
    try {
      for (let i = 0; i < 4; i += 1) {
        const image = await runGeneration(promptDraft, i === 0);
        if (i === 0 && image) {
          persistImageSelection(image.file_path.split(/[\\/]/).pop() ?? image.hash);
        }
      }
      await loadAssets();
      await refreshVariants();
    } catch (err) {
      setError(String(err));
    } finally {
      setBatchGenerating(false);
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
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(54,63,90,0.95),rgba(42,53,79,0.92))] p-5 shadow-[0_18px_50px_rgba(9,12,24,0.24)]">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl text-text-primary">Zone assets</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Entity art and zone defaults.
          </p>
        </div>
        <div className="min-w-40">
          <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-text-muted">
            <span>Coverage</span>
            <span>{completion}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/14">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,rgba(168,151,210,0.95),rgba(140,174,201,0.9))]" style={{ width: `${completion}%` }} />
          </div>
        </div>
      </div>

      {!selectedTarget ? (
        <div className="rounded-[20px] border border-dashed border-white/12 bg-black/12 px-4 py-8 text-sm text-text-muted">
          Select a zone with entities to start generating and reviewing art.
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[0.62fr_1.38fr]">
          <div className="rounded-[24px] border border-white/8 bg-black/12 p-4">
            <div className="max-h-[44rem] overflow-y-auto pr-1">
              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-text-muted">Zone defaults</div>
                  <div className="text-[11px] text-text-muted">{DEFAULT_KIND_ORDER.length}</div>
                </div>
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
                        className={`flex items-center gap-3 rounded-[18px] border px-3 py-3 text-left transition ${
                          selected ? "border-[rgba(184,216,232,0.35)] bg-[linear-gradient(135deg,rgba(168,151,210,0.16),rgba(140,174,201,0.12))]" : "border-white/8 bg-black/10 hover:bg-white/8"
                        }`}
                      >
                        <span className={`h-2.5 w-2.5 rounded-full ${hasImage ? "bg-status-success" : "bg-text-muted/50"}`} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-text-primary">{DEFAULT_KIND_LABELS[kind]}</div>
                          <div className="truncate text-[11px] text-text-muted">
                            {usageCount > 0 ? `${usageCount} fallback uses pending` : "Currently optional"}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {KIND_ORDER.map((kind) => {
                const items = entityGroups.get(kind) ?? [];
                if (items.length === 0) return null;
                return (
                  <div key={kind} className="mb-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-[11px] uppercase tracking-[0.24em] text-text-muted">{KIND_LABELS[kind]}</div>
                      <div className="text-[11px] text-text-muted">{items.length}</div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {items.map((entity) => {
                        const key: WorkbenchKey = `entity:${entity.kind}:${entity.id}`;
                        const selected = selectedKey === key;
                        return (
                          <button
                            key={key}
                            onClick={() => setSelectedKey(key)}
                            className={`flex items-center gap-3 rounded-[18px] border px-3 py-3 text-left transition ${
                              selected ? "border-[rgba(184,216,232,0.35)] bg-[linear-gradient(135deg,rgba(168,151,210,0.16),rgba(140,174,201,0.12))]" : "border-white/8 bg-black/10 hover:bg-white/8"
                            }`}
                          >
                            <span className={`h-2.5 w-2.5 rounded-full ${entity.image ? "bg-status-success" : "bg-text-muted/50"}`} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm text-text-primary">{entity.label}</div>
                              <div className="truncate text-[11px] text-text-muted">{entity.id}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-[24px] border border-white/8 bg-black/12 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-text-muted">
                    {selectedTarget.mode === "default" ? "Zone default" : selectedTarget.entity.kind}
                  </div>
                  <h3 className="mt-1 font-display text-2xl text-text-primary">{targetTitle(selectedTarget)}</h3>
                  <div className="mt-1 text-xs text-text-secondary">{targetSubtitle(selectedTarget, world)}</div>
                </div>
                <span className="rounded-full bg-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-text-muted">
                  {variants.length} variants
                </span>
              </div>

              <div className="flex min-h-[20rem] items-center justify-center overflow-hidden rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(34,41,60,0.8),rgba(28,34,52,0.88))] p-4">
                {selectedSrc ? (
                  <img src={selectedSrc} alt={targetTitle(selectedTarget)} className="max-h-[26rem] max-w-full rounded-[18px] object-contain shadow-[0_18px_44px_rgba(8,10,18,0.26)]" />
                ) : (
                  <div className="text-center text-sm text-text-muted">No active art yet.</div>
                )}
              </div>

              <div className="mt-3 rounded-[18px] border border-white/8 bg-[rgba(24,30,45,0.46)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.2em] text-text-muted">
                  {selectedTarget.mode === "default" ? "Fallback behavior" : "Assignment"}
                </div>
                <div className="mt-2 text-xs leading-6 text-text-secondary">
                  {selectedTarget.mode === "default"
                    ? `This image is written to world.image.${selectedTarget.kind} and becomes the zone fallback for ${selectedTarget.kind}s without their own art.`
                    : "This image is assigned directly to the selected entity in the zone data."}
                </div>
              </div>

              {variants.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-text-muted">Variant strip</div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {variants.map((entry) => (
                      <VariantCard key={entry.id} entry={entry} assetsDir={assetsDir} onClick={() => handleVariantSelect(entry)} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-white/8 bg-black/12 p-4">
              <div className="mb-3 text-[11px] uppercase tracking-[0.22em] text-text-muted">Prompt engineering</div>
              {zoneVibe && (
                <div className="mb-3 rounded-[18px] border border-white/8 bg-[rgba(24,30,45,0.46)] px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-text-muted">Zone vibe</div>
                  <div className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-6 text-text-secondary">{zoneVibe}</div>
                </div>
              )}
              <textarea
                value={promptDraft}
                onChange={(event) => setPromptDraft(event.target.value)}
                rows={10}
                className="w-full resize-y rounded-[20px] border border-white/10 bg-[rgba(24,30,45,0.72)] px-4 py-3 font-mono text-[12px] leading-6 text-text-secondary outline-none transition focus:border-[rgba(184,216,232,0.3)]"
                placeholder={selectedTarget.mode === "default" ? "Generate a fallback prompt for this zone asset..." : "Generate a prompt for this entity..."}
              />

              <div className="mt-3 rounded-[18px] border border-white/8 bg-[rgba(24,30,45,0.46)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.2em] text-text-muted">
                  {selectedTarget.mode === "default" ? "Zone default context" : "Entity context"}
                </div>
                <div className="mt-2 max-h-44 overflow-y-auto whitespace-pre-wrap text-xs leading-6 text-text-secondary">{buildContext()}</div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={handleGeneratePrompt}
                  disabled={!hasLlmKey || generatingPrompt || generatingImage || batchGenerating}
                  className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:opacity-50"
                >
                  {generatingPrompt ? "Generating prompt..." : "Generate prompt"}
                </button>
                <button
                  onClick={handleGenerateImage}
                  disabled={!hasImageKey || generatingPrompt || generatingImage || batchGenerating}
                  className="rounded-full border border-[rgba(168,151,210,0.35)] bg-[linear-gradient(135deg,rgba(168,151,210,0.22),rgba(140,174,201,0.14))] px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {generatingImage ? "Generating image..." : "Generate image"}
                </button>
                <button
                  onClick={handleGenerateFour}
                  disabled={!hasImageKey || generatingPrompt || generatingImage || batchGenerating}
                  className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:opacity-50"
                >
                  {batchGenerating ? "Generating 4..." : "Generate 4"}
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || generatingPrompt || generatingImage || batchGenerating}
                  className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:opacity-50"
                >
                  {importing ? "Importing..." : "Import image"}
                </button>
                <button
                  onClick={handleRemoveBg}
                  disabled={removingBg || !previewEntry || !selectedSrc || !selectedKind || !shouldRemoveBg(assetTypeForKind(selectedKind))}
                  className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:opacity-50"
                >
                  {removingBg ? "Removing BG..." : "Remove BG"}
                </button>
              </div>

              {error && (
                <div className="mt-4 rounded-[16px] border border-status-error/30 bg-status-error/10 px-4 py-3 text-xs text-status-error">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
