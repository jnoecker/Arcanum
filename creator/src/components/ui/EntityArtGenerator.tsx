import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAssetStore } from "@/stores/assetStore";
import { useImageSrc } from "@/lib/useImageSrc";
import { getEnhanceSystemPrompt, ART_STYLE_LABELS, type ArtStyle } from "@/lib/arcanumPrompts";
import { IMAGE_MODELS } from "@/types/assets";
import type { AssetContext, GeneratedImage } from "@/types/assets";

type Stage = "idle" | "generating" | "preview";

interface EntityArtGeneratorProps {
  /** Returns the composed prompt for the given art style */
  getPrompt: (style: ArtStyle) => string;
  /** Current image value (path or URL) */
  currentImage?: string;
  /** Called when user accepts a generated image */
  onAccept: (filePath: string) => void;
  /** Asset type for manifest (e.g. "entity_portrait", "background") */
  assetType?: string;
  /** Context tags for the asset manifest */
  context?: AssetContext;
}

export function EntityArtGenerator({
  getPrompt,
  currentImage,
  onAccept,
  assetType,
  context,
}: EntityArtGeneratorProps) {
  const settings = useAssetStore((s) => s.settings);
  const artStyle = useAssetStore((s) => s.artStyle);
  const setArtStyle = useAssetStore((s) => s.setArtStyle);
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<GeneratedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editedPrompt, setEditedPrompt] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  const hasApiKey = settings && settings.deepinfra_api_key.length > 0;
  const basePrompt = getPrompt(artStyle);
  const activePrompt = editedPrompt ?? basePrompt;

  // Reset edited prompt when style changes
  const handleStyleChange = (style: ArtStyle) => {
    setArtStyle(style);
    setEditedPrompt(null);
  };

  const handleGenerate = async () => {
    setStage("generating");
    setError(null);
    try {
      const model = IMAGE_MODELS[0]; // FLUX Schnell for fast iteration
      const image = await invoke<GeneratedImage>("generate_image", {
        prompt: activePrompt,
        model: model.id,
        width: 1024,
        height: 1024,
        steps: model.defaultSteps,
        guidance: null,
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
      const enhanced = await invoke<string>("enhance_prompt", {
        prompt: activePrompt,
        systemPrompt: getEnhanceSystemPrompt(artStyle),
      });
      setEditedPrompt(enhanced);
    } catch (e) {
      setError(String(e));
    } finally {
      setEnhancing(false);
    }
  };

  const acceptAsset = useAssetStore((s) => s.acceptAsset);

  const handleAccept = async () => {
    if (!result) return;
    onAccept(result.file_path);
    // Save to asset manifest with context (best-effort)
    if (assetType) {
      await acceptAsset(result, assetType, undefined, context).catch(() => {});
    }
    setStage("idle");
    setResult(null);
  };

  const handleReject = () => {
    setResult(null);
    setStage("idle");
  };

  // Load saved image from disk via IPC
  const savedImageSrc = useImageSrc(currentImage);

  // Show generated preview (data_url) or saved image
  const previewSrc = stage === "preview" && result
    ? result.data_url
    : savedImageSrc;

  if (!hasApiKey) {
    return (
      <div className="mt-1">
        <p className="text-[10px] text-text-muted">
          Set API key in Config &rarr; API Settings to generate art
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Current / preview image */}
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

      {/* Controls */}
      {stage === "idle" && (
        <div className="flex flex-col gap-1">
          {/* Style toggle */}
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

          <div className="flex gap-1">
            <button
              onClick={handleGenerate}
              className="flex-1 rounded bg-accent/15 px-2 py-1 text-[10px] font-medium text-accent transition-colors hover:bg-accent/25"
            >
              Generate Art
            </button>
            <button
              onClick={() => setShowPrompt((v) => !v)}
              className="rounded px-1.5 py-1 text-[10px] text-text-muted transition-colors hover:text-text-secondary"
            >
              {showPrompt ? "Hide" : "Prompt"}
            </button>
          </div>

          {showPrompt && (
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
