import { useState, useEffect, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useAssetStore } from "@/stores/assetStore";
import { useProjectStore } from "@/stores/projectStore";
import { useImageSrc, isLegacyImagePath } from "@/lib/useImageSrc";
import { getEnhanceSystemPrompt, ART_STYLE_LABELS, type ArtStyle } from "@/lib/arcanumPrompts";
import { IMAGE_MODELS, ENTITY_DIMENSIONS, DIMENSION_PRESETS } from "@/types/assets";
import type { AssetContext, GeneratedImage } from "@/types/assets";
import { VariantStrip } from "./VariantStrip";

type Stage = "idle" | "generating" | "preview";

interface EntityArtGeneratorProps {
  getPrompt: (style: ArtStyle) => string;
  currentImage?: string;
  onAccept: (filePath: string) => void;
  assetType?: string;
  context?: AssetContext;
  vibe?: string;
}

function computeVariantGroup(context?: AssetContext): string {
  if (!context) return "";
  const { entity_type, zone, entity_id } = context;
  if (!entity_type || !entity_id) return "";
  return `${entity_type}:${zone}:${entity_id}`;
}

export function EntityArtGenerator({
  getPrompt,
  currentImage,
  onAccept,
  assetType,
  context,
  vibe,
}: EntityArtGeneratorProps) {
  const settings = useAssetStore((s) => s.settings);
  const artStyle = useAssetStore((s) => s.artStyle);
  const setArtStyle = useAssetStore((s) => s.setArtStyle);
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const importAsset = useAssetStore((s) => s.importAsset);
  const mudDir = useProjectStore((s) => s.project?.mudDir);
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<GeneratedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editedPrompt, setEditedPrompt] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dimOverride, setDimOverride] = useState<{ width: number; height: number } | null>(null);

  const imageProvider = settings?.image_provider ?? "deepinfra";
  const hasApiKey = settings && (
    (imageProvider === "deepinfra" && settings.deepinfra_api_key.length > 0) ||
    (imageProvider === "runware" && settings.runware_api_key.length > 0)
  );
  const hasLlmKey = settings && (
    settings.deepinfra_api_key.length > 0 ||
    settings.anthropic_api_key.length > 0 ||
    settings.openrouter_api_key.length > 0
  );
  const basePrompt = getPrompt(artStyle);
  const activePrompt = editedPrompt ?? basePrompt;
  const variantGroup = computeVariantGroup(context);

  // Determine dimensions from entity type
  const entityType = context?.entity_type ?? "";
  const defaultDims = ENTITY_DIMENSIONS[entityType] ?? { width: 1024, height: 1024, label: "1024×1024" };
  const activeDims = dimOverride ?? defaultDims;

  // Filter models by configured provider
  const availableModels = useMemo(
    () => IMAGE_MODELS.filter((m) => m.provider === imageProvider),
    [imageProvider],
  );

  // Auto-import legacy images
  const importedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentImage || !mudDir || !isLegacyImagePath(currentImage)) return;
    if (importedRef.current.has(currentImage)) return;
    importedRef.current.add(currentImage);

    const candidates = [
      `${mudDir}/src/main/resources/world/images/${currentImage}`,
      `${mudDir}/src/main/resources/images/${currentImage}`,
    ];
    (async () => {
      for (const sourcePath of candidates) {
        try {
          await importAsset(sourcePath, assetType ?? "background", context);
          return;
        } catch {
          // Try next candidate
        }
      }
    })();
  }, [currentImage, mudDir, assetType, context, importAsset]);

  const handleStyleChange = (style: ArtStyle) => {
    setArtStyle(style);
    setEditedPrompt(null);
  };

  const handleGenerate = async () => {
    setStage("generating");
    setError(null);
    try {
      const model = availableModels[0];
      if (!model) {
        throw new Error(`No models available for provider: ${imageProvider}`);
      }

      const command = imageProvider === "runware"
        ? "runware_generate_image"
        : "generate_image";

      const image = await invoke<GeneratedImage>(command, {
        prompt: activePrompt,
        model: model.id,
        width: activeDims.width,
        height: activeDims.height,
        steps: model.defaultSteps,
        guidance: "defaultGuidance" in model ? model.defaultGuidance : null,
      });
      setResult(image);
      setStage("preview");
    } catch (e) {
      setError(String(e));
      setStage("idle");
    }
  };

  const handleEnhance = async () => {
    setEnhancing(true);
    setError(null);
    try {
      const systemPrompt = getEnhanceSystemPrompt(artStyle);
      // Inject zone vibe as additional context for the LLM
      const vibeContext = vibe
        ? `\n\nZone atmosphere/vibe to weave into the image prompt:\n${vibe}`
        : "";
      const userPrompt = `${activePrompt}${vibeContext}`;

      const enhanced = await invoke<string>("llm_complete", {
        systemPrompt,
        userPrompt,
      });
      setEditedPrompt(enhanced);
    } catch (e) {
      setError(String(e));
    } finally {
      setEnhancing(false);
    }
  };

  const handlePickImage = async () => {
    const path = await open({
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
      multiple: false,
    });
    if (!path) return;

    setImporting(true);
    setError(null);
    try {
      const entry = await importAsset(
        path,
        assetType ?? "background",
        context,
      );
      onAccept(`${assetsDir}\\images\\${entry.file_name}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(false);
    }
  };

  const acceptAsset = useAssetStore((s) => s.acceptAsset);

  const handleAccept = async () => {
    if (!result) return;
    onAccept(result.file_path);
    if (assetType) {
      await acceptAsset(result, assetType, undefined, context, variantGroup, true).catch(() => {});
    }
    setStage("idle");
    setResult(null);
  };

  const handleReject = () => {
    setResult(null);
    setStage("idle");
  };

  const savedImageSrc = useImageSrc(currentImage);

  const previewSrc = stage === "preview" && result
    ? result.data_url
    : savedImageSrc;

  return (
    <div className="flex flex-col gap-2">
      {previewSrc && (
        <div className="overflow-hidden rounded border border-border-default">
          <img
            src={previewSrc}
            alt="Entity art"
            className="w-full"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}

      {/* Variant history strip */}
      {variantGroup && stage === "idle" && (
        <VariantStrip
          variantGroup={variantGroup}
          onSelect={(entry) => {
            onAccept(`${assetsDir}\\images\\${entry.file_name}`);
          }}
        />
      )}

      {stage === "idle" && (
        <div className="flex flex-col gap-1">
          {/* Style toggle */}
          {(hasApiKey || hasLlmKey) && (
            <div className="flex gap-0.5 rounded bg-bg-primary p-0.5">
              {(Object.entries(ART_STYLE_LABELS) as [ArtStyle, string][]).map(
                ([key, label]) => (
                  <button
                    key={key}
                    onClick={() => handleStyleChange(key)}
                    className={`flex-1 rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                      artStyle === key
                        ? "bg-accent/20 text-accent"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
          )}

          {/* Dimension override */}
          {hasApiKey && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-text-muted">{activeDims.width}×{activeDims.height}</span>
              <select
                value={dimOverride ? `${dimOverride.width}x${dimOverride.height}` : ""}
                onChange={(e) => {
                  if (!e.target.value) {
                    setDimOverride(null);
                  } else {
                    const parts = e.target.value.split("x").map(Number);
                    setDimOverride({ width: parts[0]!, height: parts[1]! });
                  }
                }}
                className="rounded border border-border-default bg-bg-primary px-1 py-0.5 text-[10px] text-text-secondary outline-none"
              >
                <option value="">Default</option>
                {DIMENSION_PRESETS.map((p) => (
                  <option key={p.label} value={`${p.width}x${p.height}`}>{p.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-1">
            {hasApiKey && (
              <button
                onClick={handleGenerate}
                className="flex-1 rounded bg-accent/15 px-2 py-1 text-[10px] font-medium text-accent transition-colors hover:bg-accent/25"
              >
                Generate Art
              </button>
            )}
            <button
              onClick={handlePickImage}
              disabled={importing}
              className="flex-1 rounded bg-bg-elevated px-2 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary disabled:opacity-50"
            >
              {importing ? "Importing..." : "Pick Image"}
            </button>
            {(hasApiKey || hasLlmKey) && (
              <button
                onClick={() => setShowPrompt((v) => !v)}
                className="rounded px-1.5 py-1 text-[10px] text-text-muted transition-colors hover:text-text-secondary"
              >
                {showPrompt ? "Hide" : "Prompt"}
              </button>
            )}
          </div>

          {showPrompt && (hasApiKey || hasLlmKey) && (
            <div className="flex flex-col gap-1">
              <textarea
                value={activePrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                rows={4}
                className="w-full resize-y rounded border border-border-default bg-bg-primary px-2 py-1 font-mono text-[10px] leading-relaxed text-text-secondary outline-none focus:border-accent/50"
              />
              <div className="flex gap-1">
                <button
                  onClick={handleEnhance}
                  disabled={enhancing}
                  className="rounded px-1.5 py-0.5 text-[10px] text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
                >
                  {enhancing ? "..." : "Enhance"}
                </button>
                {editedPrompt && (
                  <button
                    onClick={() => setEditedPrompt(null)}
                    className="rounded px-1.5 py-0.5 text-[10px] text-text-muted transition-colors hover:text-text-secondary"
                  >
                    Reset
                  </button>
                )}
              </div>
              {vibe && (
                <p className="text-[10px] italic text-text-muted">
                  Zone vibe will be injected during enhancement
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {stage === "generating" && (
        <div className="flex items-center gap-2 py-2">
          <div className="h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <span className="text-[10px] text-text-secondary">Generating...</span>
        </div>
      )}

      {stage === "preview" && (
        <div className="flex gap-1">
          <button
            onClick={handleAccept}
            className="flex-1 rounded bg-accent/15 px-2 py-1 text-[10px] font-medium text-accent transition-colors hover:bg-accent/25"
          >
            Accept
          </button>
          <button
            onClick={handleReject}
            className="flex-1 rounded px-2 py-1 text-[10px] text-text-muted transition-colors hover:text-text-secondary"
          >
            Reject
          </button>
        </div>
      )}

      {error && (
        <p className="text-[10px] italic text-status-error">{error}</p>
      )}
    </div>
  );
}
