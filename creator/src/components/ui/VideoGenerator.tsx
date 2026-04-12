import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAssetStore } from "@/stores/assetStore";
import { getVideoSystemPrompt, VIDEO_TYPE_LABELS, type VideoAssetType } from "@/lib/videoPrompts";
import { useMediaSrc } from "@/lib/useMediaSrc";
import type { AssetContext } from "@/types/assets";
import { InlineError, Spinner } from "@/components/ui/FormWidgets";

interface VideoGeneratorProps {
  imagePath?: string;
  entityName?: string;
  entityDescription?: string;
  onAccept: (fileName: string) => void;
  videoType?: VideoAssetType;
  /** Extra context lines (e.g., zone rooms list for zone_intro) */
  extraContext?: string;
  assetType?: "video";
  context?: AssetContext;
  variantGroup?: string;
  markActive?: boolean;
}

export function VideoGenerator({
  imagePath,
  entityName,
  entityDescription,
  onAccept,
  videoType = "room_cinematic",
  extraContext,
  assetType,
  context,
  variantGroup,
  markActive = false,
}: VideoGeneratorProps) {
  const settings = useAssetStore((s) => s.settings);
  const importAsset = useAssetStore((s) => s.importAsset);
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(5);
  const [audio, setAudio] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [resultPath, setResultPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasRunwareKey = settings && settings.runware_api_key.length > 0;
  const hasLlmKey = settings && (
    settings.deepinfra_api_key.length > 0 ||
    settings.anthropic_api_key.length > 0 ||
    settings.openrouter_api_key.length > 0
  );

  const videoSrc = useMediaSrc(resultPath ?? undefined);

  if (!hasRunwareKey || !imagePath) return null;

  const handleEnhancePrompt = async () => {
    setEnhancing(true);
    setError(null);
    try {
      const context = [
        entityName ? `Entity: "${entityName}"` : "",
        entityDescription ? `Description: ${entityDescription}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const enhanced = await invoke<string>("llm_complete", {
        systemPrompt: getVideoSystemPrompt(videoType),
        userPrompt: [context, extraContext].filter(Boolean).join("\n") || "A magical fantasy scene",
      });
      setPrompt(enhanced);
    } catch (e) {
      setError(String(e));
    } finally {
      setEnhancing(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || !imagePath) return;
    setGenerating(true);
    setError(null);
    try {
      const filePath = await invoke<string>("runware_generate_video", {
        imagePath,
        prompt: prompt.trim(),
        durationSeconds: duration,
        audio,
      });
      setResultPath(filePath);
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  };

  const handleAccept = async () => {
    if (!resultPath) return;
    try {
      const fileName = assetType
        ? (await importAsset(resultPath, assetType, context, variantGroup, markActive)).file_name
        : resultPath.split(/[\\/]/).pop() ?? resultPath;
      onAccept(fileName);
      setResultPath(null);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="flex flex-col gap-1.5 rounded border border-border-default bg-bg-primary p-2">
      <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
        {VIDEO_TYPE_LABELS[videoType]} Generator
      </span>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={2}
        placeholder="Describe the motion/camera movement..."
        className="w-full resize-y rounded border border-border-default bg-bg-secondary px-2 py-1 font-mono text-2xs leading-relaxed text-text-secondary placeholder:text-text-muted outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
      />

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <label className="text-2xs text-text-muted">Duration:</label>
          <input
            type="number"
            min={1}
            max={15}
            value={duration}
            onChange={(e) => setDuration(Math.min(15, Math.max(1, Number(e.target.value))))}
            className="w-16 rounded border border-border-default bg-bg-secondary px-1.5 py-0.5 text-2xs text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
          />
          <span className="text-2xs text-text-muted">sec</span>
        </div>
        <label className="flex items-center gap-1 text-2xs text-text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={audio}
            onChange={(e) => setAudio(e.target.checked)}
            className="accent-accent"
          />
          Audio
        </label>
      </div>

      <div className="flex gap-1">
        {hasLlmKey && (
          <button
            onClick={handleEnhancePrompt}
            disabled={enhancing}
            className="rounded px-1.5 py-0.5 text-2xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
          >
            {enhancing ? <Spinner /> : "Auto-Prompt"}
          </button>
        )}
        <button
          onClick={handleGenerate}
          disabled={generating || !prompt.trim()}
          className="rounded bg-accent/15 px-2 py-0.5 text-2xs font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-50"
        >
          {generating ? <span className="flex items-center gap-1.5"><Spinner />Generating</span> : "Generate Video"}
        </button>
      </div>

      {videoSrc && resultPath && (
        <div className="flex flex-col gap-1">
          <video controls src={videoSrc} className="w-full rounded" />
          <div className="flex gap-1">
            <button
              onClick={handleAccept}
              className="rounded bg-accent/15 px-2 py-0.5 text-2xs font-medium text-accent hover:bg-accent/25"
            >
              Accept
            </button>
            <button
              onClick={() => setResultPath(null)}
              className="rounded px-2 py-0.5 text-2xs text-text-muted hover:text-text-secondary"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {error && (
        <InlineError error={error} onDismiss={() => setError(null)} onRetry={handleGenerate} />
      )}
    </div>
  );
}
