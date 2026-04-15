import { useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AI_ENABLED } from "@/lib/featureFlags";
import { useAssetStore } from "@/stores/assetStore";
import { useVibeStore } from "@/stores/vibeStore";
import { useLoreStore } from "@/stores/loreStore";
import { useImageSrc } from "@/lib/useImageSrc";
import { buildZoneMapPrompt, buildZoneMapContext } from "@/lib/zoneMapPrompt";
import { getEnhanceSystemPrompt, getNegativePrompt } from "@/lib/arcanumPrompts";
import { imageGenerateCommand, resolveImageModel, requestsTransparentBackground, type GeneratedImage } from "@/types/assets";
import { compassLayout, getLayoutBounds } from "@/lib/dagreLayout";
import { zoneToGraph } from "@/lib/zoneToGraph";
import type { WorldFile } from "@/types/world";
import type { LoreMap, MapPin } from "@/types/lore";
import { ActionButton } from "@/components/ui/FormWidgets";

interface ZoneMapPanelProps {
  zoneId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
}

const MAP_WIDTH = 1920;
const MAP_HEIGHT = 1080;

/** Compute lore map pins from the zone's compass layout, normalized to image dimensions. */
function computePinsFromLayout(world: WorldFile, imgWidth: number, imgHeight: number): MapPin[] {
  const { nodes } = zoneToGraph(world);
  const realNodes = nodes.filter((n) => !n.id.startsWith("xzone:"));
  const laid = compassLayout(realNodes, world);
  const bounds = getLayoutBounds(laid);
  if (!bounds || bounds.width === 0 || bounds.height === 0) return [];

  const pad = 0.08;
  const usableW = imgWidth * (1 - 2 * pad);
  const usableH = imgHeight * (1 - 2 * pad);
  const scaleX = usableW / bounds.width;
  const scaleY = usableH / bounds.height;

  return laid
    .filter((n) => world.rooms[n.id])
    .map((n) => {
      const room = world.rooms[n.id]!;
      const nx = (n.position.x - bounds.x) * scaleX + imgWidth * pad;
      const ny = (n.position.y - bounds.y) * scaleY + imgHeight * pad;
      // Lore map pins use [lat, lng] where lat = Y from bottom
      const lat = imgHeight - ny;
      const lng = nx;
      return {
        id: `pin_${n.id}`,
        label: room.title,
        position: [lat, lng] as [number, number],
      };
    });
}

export function ZoneMapPanel({ zoneId, world, onWorldChange }: ZoneMapPanelProps) {
  const settings = useAssetStore((s) => s.settings);
  const artStyle = useAssetStore((s) => s.artStyle);
  const acceptAsset = useAssetStore((s) => s.acceptAsset);
  const loadAssets = useAssetStore((s) => s.loadAssets);
  const vibe = useVibeStore((s) => s.vibes.get(zoneId) ?? "");
  const createMap = useLoreStore((s) => s.createMap);
  const lore = useLoreStore((s) => s.lore);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<GeneratedImage | null>(null);
  const [createdLoreMap, setCreatedLoreMap] = useState(false);

  const worldRef = useRef(world);
  worldRef.current = world;
  const generatingZoneRef = useRef(zoneId);
  generatingZoneRef.current = zoneId;

  const currentMapFile = world.image?.zoneMap;
  const currentMapSrc = useImageSrc(currentMapFile);
  const previewSrc = preview?.data_url;

  const imageProvider = settings?.image_provider ?? "deepinfra";
  const model = resolveImageModel(imageProvider, settings?.image_model);
  const hasImageKey = !!(
    (imageProvider === "deepinfra" && settings?.deepinfra_api_key) ||
    (imageProvider === "runware" && settings?.runware_api_key) ||
    (imageProvider === "openai" && settings?.openai_api_key)
  );
  const hasLlmKey = !!(
    settings?.deepinfra_api_key ||
    settings?.anthropic_api_key ||
    settings?.openrouter_api_key
  );

  const handleGenerate = useCallback(async () => {
    if (!model) return;
    const forZone = zoneId;
    setGenerating(true);
    setError(null);
    setPreview(null);
    setCreatedLoreMap(false);

    try {
      let prompt = buildZoneMapPrompt(worldRef.current, vibe, artStyle);

      if (hasLlmKey) {
        const systemPrompt = getEnhanceSystemPrompt(artStyle, "zone_map", "worldbuilding");
        const context = buildZoneMapContext(worldRef.current, vibe);
        const userPrompt = [
          context,
          `\nReference style template (adapt but prioritize the zone context above):\n${prompt}`,
        ].join("\n");
        prompt = await invoke<string>("llm_complete", { systemPrompt, userPrompt });
      }

      const image = await invoke<GeneratedImage>(imageGenerateCommand(imageProvider), {
        prompt,
        negativePrompt: getNegativePrompt("zone_map"),
        model: model.id,
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
        steps: model.defaultSteps ?? 4,
        guidance: "defaultGuidance" in model ? model.defaultGuidance : null,
        assetType: "zone_map",
        autoEnhance: false,
        transparentBackground: imageProvider === "openai" && requestsTransparentBackground("zone_map"),
      });

      if (generatingZoneRef.current === forZone) {
        setPreview(image);
      }
    } catch (e) {
      if (generatingZoneRef.current === forZone) {
        setError(String(e));
      }
    } finally {
      if (generatingZoneRef.current === forZone) {
        setGenerating(false);
      }
    }
  }, [artStyle, hasLlmKey, imageProvider, model, vibe, zoneId]);

  const handleAccept = useCallback(async () => {
    if (!preview) return;
    try {
      const fileName = preview.file_path.split(/[\\/]/).pop() ?? preview.hash;
      await acceptAsset(
        preview,
        "zone_map",
        undefined,
        { zone: zoneId, entity_type: "zone", entity_id: "zone_map" },
        `zone_map:${zoneId}`,
        true,
      );

      const updated: WorldFile = {
        ...worldRef.current,
        image: {
          ...(worldRef.current.image ?? {}),
          zoneMap: fileName,
        },
      };
      worldRef.current = updated;
      onWorldChange(updated);
      await loadAssets();
      setPreview(null);
    } catch (e) {
      setError(String(e));
    }
  }, [acceptAsset, loadAssets, onWorldChange, preview, zoneId]);

  const handleCreateLoreMap = useCallback(() => {
    const mapAsset = worldRef.current.image?.zoneMap;
    if (!mapAsset) return;

    const pins = computePinsFromLayout(worldRef.current, MAP_WIDTH, MAP_HEIGHT);
    const mapId = `map_zone_${zoneId}_${Date.now()}`;
    const title = `${worldRef.current.zone || zoneId} Map`;

    const newMap: LoreMap = {
      id: mapId,
      title,
      imageAsset: mapAsset,
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      pins,
    };

    createMap(newMap);
    setCreatedLoreMap(true);
  }, [createMap, zoneId]);

  const existingLoreMap = lore?.maps?.find(
    (m) => currentMapFile && m.imageAsset === currentMapFile,
  );

  const roomCount = Object.keys(world.rooms).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-sm uppercase tracking-widest text-accent">
            Zone Map
          </h2>
          <p className="mt-1 text-2xs text-text-muted">
            Generate an illustrated fantasy map from this zone's rooms and connections.
          </p>
        </div>
      </div>

      {/* Current map display */}
      {(previewSrc || currentMapSrc) && (
        <div className="relative shrink-0 overflow-hidden rounded-xl border border-border-default bg-bg-abyss">
          <img
            src={previewSrc ?? currentMapSrc!}
            alt={`${world.zone} zone map`}
            className="block w-full"
          />
          {previewSrc && (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-[var(--bg-scrim-heavy)] to-transparent px-4 pb-4 pt-10">
              <span className="mr-2 text-2xs uppercase tracking-widest text-text-muted">
                Preview
              </span>
              <ActionButton onClick={handleAccept} size="sm">
                Accept
              </ActionButton>
              <ActionButton onClick={() => setPreview(null)} variant="secondary" size="sm">
                Discard
              </ActionButton>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!previewSrc && !currentMapSrc && !generating && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-muted bg-bg-elevated/50 px-8 py-16">
          <div className="font-display text-base uppercase tracking-widest text-text-muted">
            No Zone Map
          </div>
          <p className="mt-2 max-w-md text-center text-2xs text-text-secondary">
            Generate an illustrated map showing the geography and landmarks of this zone.
            The map is built from your {roomCount} rooms, their descriptions, exits, and the zone vibe.
          </p>
        </div>
      )}

      {/* Generation spinner */}
      {generating && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border-muted bg-bg-elevated/50 px-8 py-16">
          <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <span className="text-2xs uppercase tracking-widest text-text-muted">
            Generating zone map...
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {AI_ENABLED && (
          <ActionButton
            onClick={handleGenerate}
            disabled={generating || !hasImageKey || roomCount === 0}
          >
            {generating
              ? "Generating..."
              : currentMapFile
                ? "Regenerate Map"
                : "Generate Zone Map"}
          </ActionButton>
        )}

        {currentMapFile && !existingLoreMap && !createdLoreMap && (
          <ActionButton onClick={handleCreateLoreMap} variant="secondary">
            Create Lore Map with Pins
          </ActionButton>
        )}

        {createdLoreMap && (
          <span className="text-2xs text-status-success">
            Lore map created with {Object.keys(world.rooms).length} room pins
          </span>
        )}

        {existingLoreMap && (
          <span className="text-2xs text-text-muted">
            Lore map exists: "{existingLoreMap.title}"
          </span>
        )}
      </div>

      {/* Info */}
      {!hasImageKey && AI_ENABLED && (
        <p className="text-2xs italic text-text-muted">
          Configure an image provider API key in Settings to generate maps.
        </p>
      )}

      {!vibe && AI_ENABLED && (
        <p className="text-2xs italic text-text-muted">
          Tip: Generate a zone vibe first (in the Map view sidebar) for better results.
          The vibe text is injected into the map generation prompt.
        </p>
      )}

      {error && <p className="text-2xs italic text-status-error">{error}</p>}
    </div>
  );
}
