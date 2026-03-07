import { useState } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useServerStore } from "@/stores/serverStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useValidationStore } from "@/stores/validationStore";
import { useServerManager } from "@/lib/useServerManager";
import { saveAllZones } from "@/lib/saveZone";
import { saveConfig } from "@/lib/saveConfig";
import { validateAllZones } from "@/lib/validateZone";
import { validateConfig } from "@/lib/validateConfig";
import { useConfigStore } from "@/stores/configStore";
import { ErrorDialog } from "./ErrorDialog";
import { ValidationPanel } from "./ValidationPanel";
import { DiffModal } from "./ui/DiffModal";
import { useAssetStore } from "@/stores/assetStore";
import { BatchLegacyImport } from "./BatchLegacyImport";

const STATUS_COLORS: Record<string, string> = {
  stopped: "bg-server-stopped",
  starting: "bg-server-starting",
  running: "bg-server-running",
  stopping: "bg-server-starting",
  error: "bg-server-error",
};

const STATUS_LABELS: Record<string, string> = {
  stopped: "Stopped",
  starting: "Starting...",
  running: "Running",
  stopping: "Stopping...",
  error: "Error",
};

export function Toolbar() {
  const project = useProjectStore((s) => s.project);
  const status = useServerStore((s) => s.status);
  const dirtyCount = useZoneStore(
    (s) => Array.from(s.zones.values()).filter((z) => z.dirty).length,
  );
  const zones = useZoneStore((s) => s.zones);
  const setValidationResults = useValidationStore((s) => s.setResults);
  const openValidationPanel = useValidationStore((s) => s.openPanel);
  const hasConfig = useConfigStore((s) => !!s.config);
  const { startServer, stopServer } = useServerManager();
  const configDirty = useConfigStore((s) => s.dirty);
  const [errors, setErrors] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [showLegacyImport, setShowLegacyImport] = useState(false);
  const openGenerator = useAssetStore((s) => s.openGenerator);
  const openGallery = useAssetStore((s) => s.openGallery);

  const handleStart = async () => {
    const result = await startServer();
    if (!result.success && result.preflightErrors) {
      setErrors(result.preflightErrors);
    }
  };

  const handleRestart = async () => {
    await stopServer();
    // Wait for the server to actually reach stopped/error state before restarting
    await new Promise<void>((resolve) => {
      const unsub = useServerStore.subscribe((state) => {
        if (state.status === "stopped" || state.status === "error") {
          unsub();
          resolve();
        }
      });
      // If already stopped (synchronous kill), resolve immediately
      const current = useServerStore.getState().status;
      if (current === "stopped" || current === "error") {
        unsub();
        resolve();
      }
    });
    await handleStart();
  };

  return (
    <div className="flex h-11 shrink-0 items-center gap-3 border-b border-border-default bg-bg-secondary px-4">
      {/* Project name */}
      <span className="font-display text-sm font-semibold tracking-wide text-accent-emphasis">
        {project?.name ?? "Ambon Arcanum"}
      </span>

      <div className="mx-2 h-4 w-px bg-border-default" />

      {/* Server controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleStart}
          disabled={status !== "stopped" && status !== "error"}
          className="rounded px-3 py-1 text-xs font-medium text-text-primary transition-colors enabled:bg-bg-elevated enabled:hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start
        </button>
        <button
          onClick={stopServer}
          disabled={status !== "running"}
          className="rounded px-3 py-1 text-xs font-medium text-text-primary transition-colors enabled:bg-bg-elevated enabled:hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Stop
        </button>
        <button
          onClick={handleRestart}
          disabled={status !== "running"}
          className="rounded px-3 py-1 text-xs font-medium text-text-primary transition-colors enabled:bg-bg-elevated enabled:hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Restart
        </button>
      </div>

      {/* Server status badge */}
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${STATUS_COLORS[status]} ${status === "running" ? "animate-aurum-pulse" : ""} ${status === "error" ? "animate-crimson-pulse" : ""}`} />
        <span className="font-display text-xs tracking-wide text-text-secondary uppercase">
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="flex-1" />

      {/* Right side actions */}
      <button
        onClick={() => setShowLegacyImport(true)}
        className="rounded px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
      >
        Import Images
      </button>
      <button
        onClick={openGallery}
        className="rounded px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
      >
        Gallery
      </button>
      <button
        onClick={openGenerator}
        className="rounded px-3 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
      >
        Generate Art
      </button>
      <div className="mx-1 h-4 w-px bg-border-default" />
      <button
        onClick={() => setShowDiff(true)}
        disabled={(dirtyCount === 0 && !configDirty) || saving}
        className="rounded px-3 py-1 text-xs font-medium transition-colors enabled:bg-bg-elevated enabled:text-text-primary enabled:hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? "Saving..." : dirtyCount > 0 || configDirty ? `Save All (${dirtyCount + (configDirty ? 1 : 0)})` : "Save All"}
      </button>
      <button
        onClick={() => {
          const results = validateAllZones(zones);
          const config = useConfigStore.getState().config;
          if (config) {
            const configIssues = validateConfig(config);
            if (configIssues.length > 0) {
              results.set("Config", configIssues);
            }
          }
          setValidationResults(results);
          openValidationPanel();
        }}
        disabled={zones.size === 0 && !hasConfig}
        className="rounded px-3 py-1 text-xs font-medium transition-colors enabled:text-text-primary enabled:hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-40"
      >
        Validate
      </button>

      <ValidationPanel />

      {showDiff && (
        <DiffModal
          onCancel={() => setShowDiff(false)}
          onConfirm={async () => {
            setShowDiff(false);
            setSaving(true);
            try {
              await saveAllZones();
              const mudDir = useProjectStore.getState().project?.mudDir;
              if (mudDir && useConfigStore.getState().dirty) {
                await saveConfig(mudDir);
              }
            } catch (err) {
              console.error("Save failed:", err);
            } finally {
              setSaving(false);
            }
          }}
        />
      )}

      {errors && (
        <ErrorDialog
          title="Pre-flight Check Failed"
          messages={errors}
          onClose={() => setErrors(null)}
        />
      )}

      {showLegacyImport && (
        <BatchLegacyImport onClose={() => setShowLegacyImport(false)} />
      )}
    </div>
  );
}
