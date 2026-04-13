import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AI_ENABLED } from "@/lib/featureFlags";
import { useAssetStore } from "@/stores/assetStore";
import { getAudioSystemPrompt, getDefaultDuration, type AudioTrackType } from "@/lib/musicPrompts";
import { useMediaSrc } from "@/lib/useMediaSrc";
import type { AssetContext } from "@/types/assets";
import { InlineError, Spinner } from "@/components/ui/FormWidgets";

interface MusicGeneratorProps {
  roomTitle?: string;
  roomDescription?: string;
  vibe?: string;
  currentAudio?: string;
  onAccept: (fileName: string) => void;
  trackType?: AudioTrackType;
  assetType?: "music" | "ambient" | "audio";
  context?: AssetContext;
  variantGroup?: string;
  markActive?: boolean;
}

const TRACK_LABELS: Record<AudioTrackType, string> = {
  music: "Music Generator",
  ambient: "Ambient Generator",
};

export function MusicGenerator({
  roomTitle,
  roomDescription,
  vibe,
  currentAudio,
  onAccept,
  trackType = "music",
  assetType,
  context,
  variantGroup,
  markActive = false,
}: MusicGeneratorProps) {
  const settings = useAssetStore((s) => s.settings);
  const importAsset = useAssetStore((s) => s.importAsset);
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(getDefaultDuration(trackType));
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

  const audioSrc = useMediaSrc(resultPath ?? currentAudio);

  if (!AI_ENABLED) return null;

  if (!hasRunwareKey) return null;

  const handleEnhancePrompt = async () => {
    setEnhancing(true);
    setError(null);
    try {
      const context = [
        roomTitle ? `Room: "${roomTitle}"` : "",
        roomDescription ? `Description: ${roomDescription}` : "",
        vibe ? `Zone atmosphere: ${vibe}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const enhanced = await invoke<string>("llm_complete", {
        systemPrompt: getAudioSystemPrompt(trackType),
        userPrompt: context || "A peaceful fantasy environment",
      });
      setPrompt(enhanced);
    } catch (e) {
      setError(String(e));
    } finally {
      setEnhancing(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const filePath = await invoke<string>("runware_generate_audio", {
        prompt: prompt.trim(),
        durationSeconds: duration,
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
        {TRACK_LABELS[trackType]}
      </span>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={2}
        placeholder={trackType === "ambient" ? "Describe the ambient soundscape..." : "Describe the music..."}
        className="w-full resize-y rounded border border-border-default bg-bg-secondary px-2 py-1 font-mono text-2xs leading-relaxed text-text-secondary placeholder:text-text-muted outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
      />

      <div className="flex items-center gap-2">
        <label className="text-2xs text-text-muted">Duration:</label>
        <input
          type="number"
          min={10}
          max={300}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-16 rounded border border-border-default bg-bg-secondary px-1.5 py-0.5 text-2xs text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
        />
        <span className="text-2xs text-text-muted">sec</span>
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
          {generating ? <span className="flex items-center gap-1.5"><Spinner />Generating</span> : trackType === "ambient" ? "Generate Ambient" : "Generate Music"}
        </button>
      </div>

      {audioSrc && (
        <div className="flex flex-col gap-1">
          <audio controls src={audioSrc} className="h-8 w-full" />
          {resultPath && (
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
          )}
        </div>
      )}

      {error && (
        <InlineError error={error} onDismiss={() => setError(null)} onRetry={handleGenerate} />
      )}
    </div>
  );
}
