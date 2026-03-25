import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useVibeStore } from "@/stores/vibeStore";
import { useAssetStore } from "@/stores/assetStore";
import { buildVibeInput } from "@/lib/vibePrompts";
import { defaultImageContext, defaultImagePrompt, type DefaultImageKind } from "@/lib/entityPrompts";
import { getEnhanceSystemPrompt, UNIVERSAL_NEGATIVE } from "@/lib/arcanumPrompts";
import { useImageSrc } from "@/lib/useImageSrc";
import { IMAGE_MODELS, type GeneratedImage } from "@/types/assets";
import type { WorldFile } from "@/types/world";

interface ZoneVibePanelProps {
  zoneId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
}

const DEFAULT_TYPES: DefaultImageKind[] = ["room", "mob", "item"];

function dimensionsForKind(kind: DefaultImageKind): { width: number; height: number } {
  if (kind === "room") return { width: 1920, height: 1080 };
  if (kind === "mob") return { width: 512, height: 512 };
  return { width: 256, height: 256 };
}

function assetTypeForKind(kind: DefaultImageKind): "background" | "mob" | "item" {
  if (kind === "room") return "background";
  if (kind === "mob") return "mob";
  return "item";
}

function applyDefaultImage(world: WorldFile, kind: DefaultImageKind, fileName: string): WorldFile {
  return {
    ...world,
    image: {
      ...(world.image ?? {}),
      [kind]: fileName,
    },
  };
}

function DefaultThumb({ fileName, label, generating }: { fileName?: string; label: string; generating: boolean }) {
  const src = useImageSrc(fileName);
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div className="rounded-[16px] border border-white/8 bg-surface-scrim-light p-2">
        <div className="mb-2 text-2xs uppercase tracking-ui text-text-muted">{label}</div>
        <button
          type="button"
          onClick={() => { if (src && !generating) setExpanded(true); }}
          disabled={!src || generating}
          className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-[14px] border border-white/8 bg-black/20 transition-opacity enabled:cursor-pointer enabled:hover:opacity-80"
        >
          {generating ? (
            <div className="h-5 w-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          ) : src ? (
            <img src={src} alt={label} className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xs text-text-muted">No default</span>
          )}
        </button>
      </div>

      {expanded && src && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setExpanded(false)}
        >
          <div className="relative mx-8 max-h-[85vh] max-w-[85vw]">
            <img
              src={src}
              alt={label}
              className="max-h-[85vh] max-w-[85vw] cursor-pointer rounded-lg object-contain shadow-2xl"
            />
            <div className="absolute left-0 right-0 top-full mt-3 text-center">
              <span className="rounded-full bg-black/60 px-3 py-1 text-[11px] uppercase tracking-ui text-text-muted backdrop-blur-sm">
                {label}
              </span>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-bg-secondary text-sm text-text-muted transition-colors hover:text-text-primary"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function ZoneVibePanel({ zoneId, world, onWorldChange }: ZoneVibePanelProps) {
  const loadVibe = useVibeStore((s) => s.loadVibe);
  const saveVibe = useVibeStore((s) => s.saveVibe);
  const generateVibe = useVibeStore((s) => s.generateVibe);
  const storedVibe = useVibeStore((s) => s.vibes.get(zoneId) ?? "");
  const isLoading = useVibeStore((s) => s.loading.has(zoneId));
  const settings = useAssetStore((s) => s.settings);
  const artStyle = useAssetStore((s) => s.artStyle);
  const acceptAsset = useAssetStore((s) => s.acceptAsset);
  const loadAssets = useAssetStore((s) => s.loadAssets);

  // Track latest world via ref so sequential generateDefault calls
  // don't overwrite each other with a stale closure snapshot.
  const worldRef = useRef(world);
  worldRef.current = world;

  const [draft, setDraft] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultError, setDefaultError] = useState<string | null>(null);
  const [generatingDefaults, setGeneratingDefaults] = useState<Record<DefaultImageKind, boolean>>({
    room: false,
    mob: false,
    item: false,
  });

  // Track which zone the spinners belong to so they don't leak across tabs
  const generatingZoneRef = useRef(zoneId);

  useEffect(() => {
    generatingZoneRef.current = zoneId;
    setGeneratingDefaults({ room: false, mob: false, item: false });
  }, [zoneId]);

  useEffect(() => {
    loadVibe(zoneId).catch(() => {});
  }, [zoneId, loadVibe]);

  useEffect(() => {
    setDraft(storedVibe);
  }, [storedVibe]);

  const isDirty = draft !== storedVibe;
  const imageProvider = settings?.image_provider ?? "deepinfra";
  const availableModels = useMemo(
    () => IMAGE_MODELS.filter((model) => model.provider === imageProvider),
    [imageProvider],
  );
  const defaultModel = availableModels[0];
  const hasImageKey = !!(
    (imageProvider === "deepinfra" && settings?.deepinfra_api_key) ||
    (imageProvider === "runware" && settings?.runware_api_key)
  );
  const hasLlmKey = !!(
    settings?.deepinfra_api_key ||
    settings?.anthropic_api_key ||
    settings?.openrouter_api_key
  );

  const generateDefault = useCallback(async (kind: DefaultImageKind, vibeText: string) => {
    if (!defaultModel) throw new Error(`No image model configured for provider ${imageProvider}.`);

    const forZone = zoneId;
    const currentWorld = worldRef.current;
    setGeneratingDefaults((prev) => ({ ...prev, [kind]: true }));
    try {
      let prompt = defaultImagePrompt(kind, currentWorld, vibeText, artStyle);
      if (hasLlmKey) {
        const systemPrompt = getEnhanceSystemPrompt(artStyle);
        const userPrompt = [
          `Generate a fallback/default image prompt for this zone asset:\n${defaultImageContext(kind, currentWorld)}`,
          vibeText ? `\nZone atmosphere/vibe:\n${vibeText}` : "",
          `\nReference style template (adapt but prioritize the context above):\n${prompt}`,
        ].join("\n");
        prompt = await invoke<string>("llm_complete", { systemPrompt, userPrompt });
      }

      const image = await invoke<GeneratedImage>(imageProvider === "runware" ? "runware_generate_image" : "generate_image", {
        prompt,
        negativePrompt: UNIVERSAL_NEGATIVE,
        model: defaultModel.id,
        width: dimensionsForKind(kind).width,
        height: dimensionsForKind(kind).height,
        steps: defaultModel.defaultSteps ?? 4,
        guidance: "defaultGuidance" in defaultModel ? defaultModel.defaultGuidance : null,
      });

      const fileName = image.file_path.split(/[\\/]/).pop() ?? image.hash;
      await acceptAsset(
        image,
        assetTypeForKind(kind),
        prompt,
        { zone: zoneId, entity_type: "default", entity_id: kind },
        `default:${zoneId}:${kind}`,
        true,
      );
      // Read the latest world from the ref so sequential calls accumulate
      const latestWorld = worldRef.current;
      const updated = applyDefaultImage(latestWorld, kind, fileName);
      worldRef.current = updated;
      onWorldChange(updated);
      await loadAssets();
    } finally {
      if (generatingZoneRef.current === forZone) {
        setGeneratingDefaults((prev) => ({ ...prev, [kind]: false }));
      }
    }
  }, [acceptAsset, artStyle, defaultModel, hasLlmKey, imageProvider, loadAssets, onWorldChange, zoneId]);

  const generateAllDefaults = useCallback(async (vibeText: string) => {
    if (!hasImageKey) {
      setDefaultError("Configure an image provider API key to generate zone defaults.");
      return;
    }

    setDefaultError(null);
    for (const kind of DEFAULT_TYPES) {
      try {
        await generateDefault(kind, vibeText);
      } catch (e) {
        setDefaultError(`Failed to generate ${kind} default: ${String(e)}`);
        break;
      }
    }
  }, [generateDefault, hasImageKey]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveVibe(zoneId, draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setDefaultError(null);
    try {
      const worldContext = buildVibeInput(world);
      const vibe = await generateVibe(zoneId, worldContext);
      setDraft(vibe);
      if (hasImageKey) {
        await generateAllDefaults(vibe);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading) {
    return <div className="text-2xs text-text-muted">Loading vibe...</div>;
  }

  const anyDefaultGenerating = DEFAULT_TYPES.some((kind) => generatingDefaults[kind]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-display text-2xs uppercase tracking-widest text-text-muted">Zone Vibe</span>
        {saved && <span className="text-2xs text-status-success">Saved</span>}
      </div>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        placeholder="Atmospheric description for this zone — injected into all entity and fallback prompts for visual coherence..."
        className="w-full resize-y rounded border border-border-default bg-bg-primary px-2 py-1 font-mono text-2xs leading-relaxed text-text-secondary placeholder:text-text-muted outline-none focus:border-accent/50"
      />

      <div className="flex flex-wrap gap-1">
        <button
          onClick={handleGenerate}
          disabled={generating || anyDefaultGenerating}
          className="rounded bg-accent/15 px-2 py-0.5 text-2xs font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-50"
        >
          {generating ? "Generating vibe..." : "Generate vibe + defaults"}
        </button>
        <button
          onClick={() => generateAllDefaults(draft)}
          disabled={!draft.trim() || anyDefaultGenerating || generating || !hasImageKey}
          className="rounded bg-bg-elevated px-2 py-0.5 text-2xs font-medium text-text-secondary transition-colors hover:bg-bg-hover disabled:opacity-50"
        >
          {anyDefaultGenerating ? "Generating defaults..." : "Generate defaults"}
        </button>
        {isDirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-bg-elevated px-2 py-0.5 text-2xs font-medium text-text-secondary transition-colors hover:bg-bg-hover disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <DefaultThumb fileName={world.image?.room} label="Room default" generating={generatingDefaults.room} />
        <DefaultThumb fileName={world.image?.mob} label="Mob default" generating={generatingDefaults.mob} />
        <DefaultThumb fileName={world.image?.item} label="Item default" generating={generatingDefaults.item} />
      </div>

      {error && <p className="text-2xs italic text-status-error">{error}</p>}
      {defaultError && <p className="text-2xs italic text-status-error">{defaultError}</p>}
      {!hasImageKey && (
        <p className="text-2xs italic text-text-muted">
          Add an image provider API key to auto-generate zone fallback art after vibe generation.
        </p>
      )}
    </div>
  );
}
