import { useState, useRef, useCallback, useEffect } from "react";
import { ART_STYLE_LABELS, type ArtStyle } from "@/lib/arcanumPrompts";
import { collectTargets, runBatchArtGeneration, type BatchTarget } from "@/lib/batchArt";
import { useAssetStore } from "@/stores/assetStore";
import { useZoneStore } from "@/stores/zoneStore";
import { saveZone } from "@/lib/saveZone";
import type { WorldFile } from "@/types/world";
import type { WizardStage } from "@/lib/useProjectWizard";

interface CreationStepProps {
  stage: WizardStage;
  error: string | null;
  artStyle: ArtStyle;
  demoZone: WorldFile | null;
  zoneId: string;
  onOpenProject: () => void;
  onRetry: () => void;
}

const STAGE_LABELS: Record<WizardStage, string> = {
  idle: "",
  creating_structure: "Creating project...",
  setting_up: "Setting up project...",
  done: "Project created!",
  error: "Error",
};

export function CreationStep({
  stage,
  error,
  artStyle,
  demoZone,
  zoneId,
  onOpenProject,
  onRetry,
}: CreationStepProps) {
  const [artPhase, setArtPhase] = useState<
    "idle" | "running" | "done" | "skipped"
  >("idle");
  const [targets, setTargets] = useState<BatchTarget[]>([]);
  const [artRunning, setArtRunning] = useState(false);
  const abortRef = useRef(false);

  const settings = useAssetStore((s) => s.settings);
  const acceptAsset = useAssetStore((s) => s.acceptAsset);
  const loadSettings = useAssetStore((s) => s.loadSettings);
  const imageProvider = settings?.image_provider ?? "deepinfra";

  // Reload settings when creation completes (project is now open)
  useEffect(() => {
    if (stage === "done") {
      loadSettings();
    }
  }, [stage, loadSettings]);

  const hasImageKey = !!(
    settings?.deepinfra_api_key || settings?.runware_api_key || settings?.openai_api_key
  );

  const initTargets = useCallback(() => {
    if (!demoZone) return [];
    return collectTargets(demoZone);
  }, [demoZone]);

  const updateZone = useZoneStore((s) => s.updateZone);

  const handleGenerateArt = useCallback(async () => {
    if (!demoZone) return;
    const artTargets = initTargets();
    setTargets(artTargets);
    setArtRunning(true);
    setArtPhase("running");
    abortRef.current = false;

    const updatedWorld = await runBatchArtGeneration(
      artTargets,
      demoZone,
      zoneId,
      artStyle,
      "",
      imageProvider,
      settings?.batch_concurrency ?? 5,
      abortRef,
      {
        onTargetUpdate: (idx, update) => {
          setTargets((prev) =>
            prev.map((t, i) => (i === idx ? { ...t, ...update } : t)),
          );
        },
        onWorldUpdate: (world) => {
          updateZone(zoneId, world);
        },
        acceptAsset,
      },
      settings?.auto_remove_bg,
    );

    // Persist image references to zone YAML and zoneStore
    updateZone(zoneId, updatedWorld);
    try {
      await saveZone(zoneId);
    } catch {
      // Zone save failure is non-fatal — images are in the asset manifest
    }

    setArtRunning(false);
    setArtPhase("done");
  }, [demoZone, zoneId, artStyle, imageProvider, settings, acceptAsset, initTargets, updateZone]);

  const doneCount = targets.filter((t) => t.status === "done").length;
  const errorCount = targets.filter((t) => t.status === "error").length;
  const checkedCount = targets.filter((t) => t.checked).length;

  // Phase A: Project creation
  if (stage !== "done") {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        {stage !== "error" && (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        )}
        {stage === "error" && (
          <div className="text-lg text-status-error">&#10007;</div>
        )}
        <p className="text-sm text-text-secondary">{STAGE_LABELS[stage]}</p>
        {error && (
          <p className="max-w-sm text-center text-xs text-status-error">
            {error}
          </p>
        )}
        {stage === "error" && (
          <button
            onClick={onRetry}
            className="mt-2 rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  // Phase B: Art generation
  return (
    <div className="flex flex-col gap-4">
      {/* Success banner */}
      <div className="flex items-center gap-2 rounded bg-status-success/10 px-3 py-2">
        <span className="text-status-success">&#10003;</span>
        <span className="text-xs text-text-primary">
          Project created successfully
        </span>
      </div>

      {/* Art generation section */}
      {artPhase === "idle" && demoZone && hasImageKey && (
        <div className="rounded-lg border-2 border-accent/30 bg-accent/5 p-5">
          <div className="mb-1 flex items-center justify-between">
            <h4 className="font-display text-sm tracking-wide text-accent-emphasis">
              Generate Art
            </h4>
            <span className="rounded bg-accent/10 px-2 py-0.5 text-2xs font-medium text-accent">
              {ART_STYLE_LABELS[artStyle]}
            </span>
          </div>
          <p className="mb-4 text-xs text-text-secondary">
            Generate AI images for {Object.keys(demoZone.rooms).length} rooms
            {Object.keys(demoZone.mobs ?? {}).length > 0 &&
              `, ${Object.keys(demoZone.mobs ?? {}).length} mobs`}
            {Object.keys(demoZone.items ?? {}).length > 0 &&
              `, ${Object.keys(demoZone.items ?? {}).length} items`}{" "}
            in your demo zone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleGenerateArt}
              className="rounded bg-gradient-to-r from-accent-muted to-accent px-5 py-2 text-xs font-medium text-accent-emphasis transition-all hover:shadow-[var(--glow-aurum)] hover:brightness-110"
            >
              Generate Art
            </button>
            <button
              onClick={() => setArtPhase("skipped")}
              className="rounded border border-border-default bg-bg-elevated px-4 py-2 text-xs text-text-secondary hover:bg-bg-hover"
            >
              Skip Art
            </button>
          </div>
        </div>
      )}

      {/* Art generation progress */}
      {artPhase === "running" && (
        <div className="rounded border border-border-default bg-bg-primary p-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-text-secondary">
              {doneCount + errorCount} of {checkedCount}
            </span>
            <span className="text-text-muted">
              {doneCount} done
              {errorCount > 0 ? `, ${errorCount} errors` : ""}
            </span>
          </div>
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-bg-elevated">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{
                width: `${checkedCount > 0 ? ((doneCount + errorCount) / checkedCount) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            {targets.map((target) => (
              <div
                key={`${target.kind}:${target.id}`}
                className="flex items-center gap-2 text-xs"
              >
                <span className="w-4 shrink-0 text-center">
                  {target.status === "pending" && (
                    <span className="text-text-muted">&middot;</span>
                  )}
                  {target.status === "generating" && (
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border border-accent border-t-transparent" />
                  )}
                  {target.status === "done" && (
                    <span className="text-status-success">&#x2713;</span>
                  )}
                  {target.status === "error" && (
                    <span className="text-status-error">&#x2717;</span>
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-text-secondary">
                  {target.label}
                </span>
              </div>
            ))}
          </div>
          {artRunning && (
            <button
              onClick={() => {
                abortRef.current = true;
              }}
              className="mt-3 rounded border border-status-danger/40 px-3 py-1 text-2xs text-status-danger hover:bg-status-danger/10"
            >
              Abort
            </button>
          )}
        </div>
      )}

      {/* Art generation done */}
      {artPhase === "done" && (
        <div className="flex items-center gap-2 rounded bg-accent/5 px-3 py-2">
          <span className="text-accent">&#10003;</span>
          <span className="text-xs text-text-primary">
            Art generation complete ({doneCount} images
            {errorCount > 0 ? `, ${errorCount} errors` : ""})
          </span>
        </div>
      )}

      {/* Open project button */}
      {(artPhase !== "idle" || !hasImageKey || !demoZone) && (
        <button
          onClick={onOpenProject}
          disabled={artRunning}
          className="self-end rounded bg-gradient-to-r from-accent-muted to-accent px-6 py-2 text-xs font-medium text-accent-emphasis transition-all hover:shadow-[var(--glow-aurum)] hover:brightness-110 disabled:opacity-50"
        >
          Open Project
        </button>
      )}
    </div>
  );
}
