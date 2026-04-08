// ─── Story Export Dialog ─────────────────────────────────────────
// Modal for exporting a story to MP4. Flow:
//   1. Preset picker (5 cards)
//   2. Voice override + output file picker
//   3. "Export" button → runs exportStoryVideo() from storyVideoExport.ts
//   4. Progress bar with stage messages
//   5. Success or error view
//
// The heavy lifting lives in storyVideoExport.ts. This dialog is
// just the UI glue: preset selection, file picker, progress display,
// and wiring the progress callback into local state.

import { useState, useMemo, useCallback, useRef } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

import { useStoryStore } from "@/stores/storyStore";
import { DialogShell, ActionButton, Spinner } from "@/components/ui/FormWidgets";
import {
  PRESETS,
  PRESET_ORDER,
  checkStoryFitsPreset,
  suggestExportFilename,
  formatDuration,
  type ExportPresetId,
} from "@/lib/videoExportPresets";
import {
  OPENAI_TTS_VOICES,
  OPENAI_TTS_VOICE_LABELS,
  type OpenAiTtsVoice,
} from "@/lib/narrationSynthesis";
import {
  exportStoryVideo,
  formatBytes,
  type ExportProgressEvent,
  type ExportStoryVideoResult,
} from "@/lib/storyVideoExport";
import { computeStoryTimeline } from "@/lib/storyTiming";
import type { Story } from "@/types/story";
import type { WorldFile } from "@/types/world";
import type { Project } from "@/types/project";

// ─── Props ───────────────────────────────────────────────────────

interface StoryExportDialogProps {
  story: Story;
  world: WorldFile;
  project: Project;
  assetsDir: string;
  onClose: () => void;
}

type DialogStage = "config" | "running" | "success" | "error" | "cancelled";

// ─── Component ───────────────────────────────────────────────────

export function StoryExportDialog({
  story,
  world,
  project,
  assetsDir,
  onClose,
}: StoryExportDialogProps) {
  // ─── State ────────────────────────────────────────────────
  const [presetId, setPresetId] = useState<ExportPresetId>("showcase");
  const [voiceOverride, setVoiceOverride] = useState<OpenAiTtsVoice | undefined>();
  const [outputPath, setOutputPath] = useState<string>("");

  const [dialogStage, setDialogStage] = useState<DialogStage>("config");
  const [progress, setProgress] = useState<ExportProgressEvent | null>(null);
  const [result, setResult] = useState<ExportStoryVideoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // AbortController for the in-flight export. Kept in a ref (not
  // state) so the cancel handler can access the current controller
  // without forcing a re-render of the dialog mid-export.
  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedPreset = PRESETS[presetId];

  // ─── Estimated duration for the fit check ─────────────────
  // Uses word-count estimate since we haven't synthesized TTS yet —
  // the real duration might differ by a few seconds after TTS runs.
  const estimatedDurationMs = useMemo(() => {
    try {
      const timeline = computeStoryTimeline(story);
      return timeline.totalDurationMs;
    } catch {
      return 0;
    }
  }, [story]);

  const fitCheck = useMemo(
    () => checkStoryFitsPreset(estimatedDurationMs, selectedPreset),
    [estimatedDurationMs, selectedPreset],
  );

  // ─── File picker ──────────────────────────────────────────
  const pickOutputPath = useCallback(async () => {
    const suggested = suggestExportFilename(story.title, presetId);
    const picked = await save({
      title: "Export cinematic to…",
      defaultPath: suggested,
      filters: [{ name: "MP4 Video", extensions: ["mp4"] }],
    });
    if (picked) {
      setOutputPath(picked);
    }
  }, [story.title, presetId]);

  // ─── Start export ─────────────────────────────────────────
  const canStart =
    outputPath.length > 0 && dialogStage === "config" && story.scenes.length > 0;

  const handleStart = useCallback(async () => {
    if (!canStart) return;
    setDialogStage("running");
    setProgress({ stage: "ffmpeg", fraction: 0, message: "Starting export…" });
    setError(null);
    setResult(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const exportResult = await exportStoryVideo({
        story,
        world,
        project,
        assetsDir,
        presetId,
        outputPath,
        voiceOverride,
        signal: controller.signal,
        onProgress: (event) => {
          setProgress(event);
        },
      });
      setResult(exportResult);
      setDialogStage("success");
    } catch (e) {
      // User-requested abort surfaces as ExportAbortedError with
      // name === "AbortError" — treat as a normal UX path, not an error.
      if (e instanceof Error && e.name === "AbortError") {
        setDialogStage("cancelled");
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setDialogStage("error");
      }
    } finally {
      abortControllerRef.current = null;
    }
  }, [
    canStart,
    story,
    world,
    project,
    assetsDir,
    presetId,
    outputPath,
    voiceOverride,
  ]);

  const handleAbort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  // ─── Render ───────────────────────────────────────────────
  return (
    <DialogShell
      titleId="story-export-dialog-title"
      title="Export Cinematic"
      widthClassName="max-w-3xl"
      onClose={dialogStage === "running" ? () => {} : onClose}
      footer={renderFooter(
        dialogStage,
        canStart,
        handleStart,
        onClose,
        () => setDialogStage("config"),
        handleAbort,
      )}
    >
      {dialogStage === "config" && (
        <ConfigView
          presetId={presetId}
          onPresetChange={setPresetId}
          voiceOverride={voiceOverride}
          onVoiceChange={setVoiceOverride}
          outputPath={outputPath}
          onPickOutput={pickOutputPath}
          estimatedDurationMs={estimatedDurationMs}
          fitWarning={fitCheck.fits ? null : fitCheck.warning}
          sceneCount={story.scenes.length}
        />
      )}

      {dialogStage === "running" && <RunningView progress={progress} />}

      {dialogStage === "success" && result && (
        <SuccessView result={result} presetId={presetId} storyId={story.id} />
      )}

      {dialogStage === "error" && error && (
        <ErrorView error={error} />
      )}

      {dialogStage === "cancelled" && <CancelledView />}
    </DialogShell>
  );
}

// ─── Footer ──────────────────────────────────────────────────────

function renderFooter(
  stage: DialogStage,
  canStart: boolean,
  onStart: () => void,
  onClose: () => void,
  onReset: () => void,
  onAbort: () => void,
) {
  if (stage === "running") {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-text-muted">
          Export in progress — please keep the app open.
        </span>
        <ActionButton variant="ghost" onClick={onAbort}>
          Abort
        </ActionButton>
      </div>
    );
  }

  if (stage === "success") {
    return (
      <div className="flex items-center justify-end gap-2">
        <ActionButton variant="ghost" onClick={onReset}>
          Export Another
        </ActionButton>
        <ActionButton variant="primary" onClick={onClose}>
          Done
        </ActionButton>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="flex items-center justify-end gap-2">
        <ActionButton variant="ghost" onClick={onClose}>
          Close
        </ActionButton>
        <ActionButton variant="primary" onClick={onReset}>
          Try Again
        </ActionButton>
      </div>
    );
  }

  if (stage === "cancelled") {
    return (
      <div className="flex items-center justify-end gap-2">
        <ActionButton variant="ghost" onClick={onClose}>
          Close
        </ActionButton>
        <ActionButton variant="primary" onClick={onReset}>
          Start Over
        </ActionButton>
      </div>
    );
  }

  // config
  return (
    <div className="flex items-center justify-end gap-2">
      <ActionButton variant="ghost" onClick={onClose}>
        Cancel
      </ActionButton>
      <ActionButton
        variant="primary"
        onClick={onStart}
        disabled={!canStart}
        className={!canStart ? "opacity-45 cursor-not-allowed" : ""}
      >
        Export
      </ActionButton>
    </div>
  );
}

// ─── ConfigView: preset picker + voice + output path ────────────

interface ConfigViewProps {
  presetId: ExportPresetId;
  onPresetChange: (id: ExportPresetId) => void;
  voiceOverride: OpenAiTtsVoice | undefined;
  onVoiceChange: (voice: OpenAiTtsVoice | undefined) => void;
  outputPath: string;
  onPickOutput: () => void;
  estimatedDurationMs: number;
  fitWarning: string | null;
  sceneCount: number;
}

function ConfigView({
  presetId,
  onPresetChange,
  voiceOverride,
  onVoiceChange,
  outputPath,
  onPickOutput,
  estimatedDurationMs,
  fitWarning,
  sceneCount,
}: ConfigViewProps) {
  const effectiveVoice = voiceOverride ?? PRESETS[presetId].ttsVoice;

  return (
    <div className="flex flex-col gap-5 py-2">
      {/* ─── Preset picker ─── */}
      <section>
        <h3 className="mb-2 font-display text-sm uppercase tracking-wider text-text-muted">
          Choose a preset
        </h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {PRESET_ORDER.map((id) => {
            const preset = PRESETS[id];
            const selected = id === presetId;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onPresetChange(id)}
                className={`rounded-md border p-3 text-left transition-colors ${
                  selected
                    ? "border-accent bg-accent/10"
                    : "border-border-default hover:border-border-muted bg-bg-secondary"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-sm text-text-primary">
                    {preset.label}
                  </span>
                  <span className="font-mono text-2xs text-text-muted">
                    {preset.width}×{preset.height} · {preset.fps}fps
                  </span>
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  {preset.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ─── Story stats + fit warning ─── */}
      <section className="flex items-center gap-4 rounded-md border border-border-muted bg-bg-elevated px-3 py-2 text-xs">
        <div>
          <span className="text-text-muted">Scenes </span>
          <span className="font-mono text-text-primary">{sceneCount}</span>
        </div>
        <div>
          <span className="text-text-muted">Est. duration </span>
          <span className="font-mono text-text-primary">
            {formatDuration(estimatedDurationMs)}
          </span>
        </div>
        {fitWarning && (
          <div className="flex-1 text-right text-status-warning">{fitWarning}</div>
        )}
      </section>

      {/* ─── Voice override ─── */}
      <section>
        <h3 className="mb-2 font-display text-sm uppercase tracking-wider text-text-muted">
          Narration voice
        </h3>
        <select
          value={voiceOverride ?? ""}
          onChange={(e) => onVoiceChange((e.target.value || undefined) as OpenAiTtsVoice | undefined)}
          className="ornate-input w-full"
        >
          <option value="">
            Preset default ({OPENAI_TTS_VOICE_LABELS[effectiveVoice].label}) —{" "}
            {OPENAI_TTS_VOICE_LABELS[effectiveVoice].description}
          </option>
          {OPENAI_TTS_VOICES.map((v) => (
            <option key={v} value={v}>
              {OPENAI_TTS_VOICE_LABELS[v].label} — {OPENAI_TTS_VOICE_LABELS[v].description}
            </option>
          ))}
        </select>
      </section>

      {/* ─── Output path ─── */}
      <section>
        <h3 className="mb-2 font-display text-sm uppercase tracking-wider text-text-muted">
          Output file
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={outputPath || "(no file selected)"}
            className="ornate-input flex-1 font-mono text-xs"
          />
          <ActionButton variant="secondary" onClick={onPickOutput}>
            Choose…
          </ActionButton>
        </div>
      </section>
    </div>
  );
}

// ─── RunningView: progress bar + stage message ──────────────────

function RunningView({ progress }: { progress: ExportProgressEvent | null }) {
  const fraction = progress?.fraction ?? 0;
  const pct = Math.round(fraction * 100);
  return (
    <div className="flex flex-col items-center gap-5 py-8">
      <Spinner />
      <div className="w-full max-w-md">
        <div className="h-2 overflow-hidden rounded-full bg-bg-elevated">
          <div
            className="h-full bg-accent transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="font-mono text-text-muted">{pct}%</span>
          <span className="text-text-secondary">{progress?.stage ?? "starting"}</span>
        </div>
      </div>
      <p className="text-center text-sm text-text-primary">
        {progress?.message ?? "Preparing export…"}
      </p>
    </div>
  );
}

// ─── SuccessView: result card + optional publish action ─────────

type PublishState =
  | { kind: "idle" }
  | { kind: "publishing" }
  | { kind: "published"; url: string }
  | { kind: "failed"; error: string };

function SuccessView({
  result,
  presetId,
  storyId,
}: {
  result: ExportStoryVideoResult;
  presetId: ExportPresetId;
  storyId: string;
}) {
  const [publishState, setPublishState] = useState<PublishState>({ kind: "idle" });

  // Publishing only makes sense for the showcase preset — other presets
  // target social feeds, the MUD client, or personal archives and
  // shouldn't overwrite the showcase URL.
  const canPublish = presetId === "showcase";

  const handlePublish = useCallback(async () => {
    setPublishState({ kind: "publishing" });
    try {
      const url = await invoke<string>("deploy_story_video_to_r2", {
        storyId,
        filePath: result.outputPath,
      });
      // Stamp the URL onto the story so the next showcase JSON deploy
      // picks it up. Use updateStory so the dirty flag triggers
      // autosave.
      useStoryStore.getState().updateStory(storyId, { cinematicUrl: url });
      setPublishState({ kind: "published", url });
    } catch (e) {
      setPublishState({
        kind: "failed",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }, [storyId, result.outputPath]);

  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="rounded-md border border-status-success/40 bg-status-success/5 p-4">
        <h3 className="font-display text-base text-status-success">Export complete</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-2xs uppercase tracking-wider text-text-muted">Duration</div>
            <div className="font-mono text-text-primary">
              {formatDuration(result.durationMs)}
            </div>
          </div>
          <div>
            <div className="text-2xs uppercase tracking-wider text-text-muted">Size</div>
            <div className="font-mono text-text-primary">{formatBytes(result.sizeBytes)}</div>
          </div>
          <div className="col-span-2">
            <div className="text-2xs uppercase tracking-wider text-text-muted">File</div>
            <div className="break-all font-mono text-xs text-text-primary">
              {result.outputPath}
            </div>
          </div>
        </div>
      </div>

      {canPublish && (
        <div className="rounded-md border border-border-muted bg-bg-elevated p-4">
          <h3 className="font-display text-sm uppercase tracking-wider text-text-muted">
            Publish to showcase
          </h3>
          <p className="mt-1 text-xs text-text-secondary">
            Upload this MP4 to R2 and link it from the story's showcase page. Viewers
            will see a "Watch as cinematic" button on the story player.
          </p>

          {publishState.kind === "idle" && (
            <div className="mt-3">
              <ActionButton variant="secondary" onClick={handlePublish}>
                Publish to Showcase
              </ActionButton>
            </div>
          )}

          {publishState.kind === "publishing" && (
            <div className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
              <Spinner />
              <span>Uploading to R2…</span>
            </div>
          )}

          {publishState.kind === "published" && (
            <div className="mt-3 space-y-1">
              <div className="text-xs text-status-success">
                Published. The next "Publish Lore" deploy will pick up the URL.
              </div>
              <div className="break-all font-mono text-2xs text-text-muted">
                {publishState.url}
              </div>
            </div>
          )}

          {publishState.kind === "failed" && (
            <div className="mt-3 space-y-2">
              <div className="text-xs text-status-error">
                Publish failed: {publishState.error}
              </div>
              <ActionButton variant="ghost" onClick={handlePublish}>
                Try Again
              </ActionButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ErrorView: error message ───────────────────────────────────

function ErrorView({ error }: { error: string }) {
  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="rounded-md border border-status-error/40 bg-status-error/5 p-4">
        <h3 className="font-display text-base text-status-error">Export failed</h3>
        <p className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-text-primary">
          {error}
        </p>
        <p className="mt-3 text-xs text-text-muted">
          Check that your OpenAI API key is set in Settings (for TTS) and that you have an
          internet connection (for the first-time ffmpeg download).
        </p>
      </div>
    </div>
  );
}

// ─── CancelledView: user-aborted export ─────────────────────────

function CancelledView() {
  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="rounded-md border border-border-muted bg-bg-elevated p-4">
        <h3 className="font-display text-base text-text-primary">Export cancelled</h3>
        <p className="mt-2 text-sm text-text-secondary">
          No output file was written. Any temporary frames and audio from this session
          have been cleaned up automatically.
        </p>
        <p className="mt-3 text-xs text-text-muted">
          Cached narration audio from OpenAI is preserved — if you retry the same story,
          the TTS step will short-circuit and only the ffmpeg passes will re-run.
        </p>
      </div>
    </div>
  );
}
