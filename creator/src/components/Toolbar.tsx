import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useProjectStore } from "@/stores/projectStore";
import { useServerStore } from "@/stores/serverStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useValidationStore } from "@/stores/validationStore";
import { useServerManager } from "@/lib/useServerManager";
import { invoke } from "@tauri-apps/api/core";
import { saveAllZones } from "@/lib/saveZone";
import { saveProjectConfig } from "@/lib/saveConfig";
import { exportMudFormat, buildMonolithicConfig } from "@/lib/exportMud";
import { validateAllZones } from "@/lib/validateZone";
import { validateConfig } from "@/lib/validateConfig";
import { useConfigStore } from "@/stores/configStore";
import { ErrorDialog } from "./ErrorDialog";
import { ValidationPanel } from "./ValidationPanel";
import { DiffModal } from "./ui/DiffModal";
import { useAssetStore } from "@/stores/assetStore";
import { BatchLegacyImport } from "./BatchLegacyImport";
import toolbarBg from "@/assets/toolbar-bg.jpg";

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
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<string | null>(null);
  const openGenerator = useAssetStore((s) => s.openGenerator);
  const openGallery = useAssetStore((s) => s.openGallery);
  const isStandalone = project?.format === "standalone";

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
    <div className="relative flex h-11 shrink-0 items-center gap-3 overflow-hidden border-b border-border-default bg-bg-secondary px-4">
      <img
        src={toolbarBg}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.15]"
        style={{ objectPosition: "center center" }}
      />
      {/* Project name */}
      <span className="font-display text-sm font-semibold tracking-wide text-accent-emphasis">
        {project?.name ?? "Ambon Arcanum"}
      </span>

      <div className="mx-2 h-4 w-px bg-border-default" />

      {/* Server controls (legacy only) */}
      {!isStandalone && (
        <>
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
        </>
      )}

      {/* Export (standalone only) */}
      {isStandalone && (
        <button
          onClick={async () => {
            const selected = await open({ directory: true, multiple: false });
            if (!selected) return;
            setExporting(true);
            setExportResult(null);
            try {
              const result = await exportMudFormat(selected as string);
              setExportResult(
                `Exported config + ${result.zonesExported} zone${result.zonesExported !== 1 ? "s" : ""}` +
                (result.errors.length > 0 ? ` (${result.errors.length} errors)` : ""),
              );
            } catch (e) {
              setExportResult(`Export failed: ${e}`);
            } finally {
              setExporting(false);
            }
          }}
          disabled={exporting || !hasConfig}
          className="rounded px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {exporting ? "Exporting..." : "Export for MUD"}
        </button>
      )}
      {isStandalone && (
        <button
          onClick={async () => {
            if (!project) return;
            setDeploying(true);
            setDeployResult(null);
            try {
              // Deploy config
              const configContent = buildMonolithicConfig();
              await invoke<string>("deploy_config_to_r2", {
                mudDir: project.mudDir,
                configContent,
              });

              // Deploy zones
              const result = await invoke<{ uploaded: number; failed: number }>(
                "deploy_zones_to_r2",
                { mudDir: project.mudDir, format: project.format },
              );

              // Update world.resources in config
              const zones = useZoneStore.getState().zones;
              const resources = Array.from(zones.keys()).sort()
                .map((id) => `world/${id}.yaml`);
              const currentConfig = useConfigStore.getState().config;
              if (currentConfig && resources.length > 0) {
                useConfigStore.getState().updateConfig({
                  ...currentConfig,
                  world: { ...currentConfig.world, resources },
                });
                await saveProjectConfig(project);
              }

              setDeployResult(
                `Deployed config + ${result.uploaded} zone${result.uploaded !== 1 ? "s" : ""}` +
                (result.failed > 0 ? ` (${result.failed} failed)` : ""),
              );
            } catch (e) {
              setDeployResult(`Deploy failed: ${e}`);
            } finally {
              setDeploying(false);
            }
          }}
          disabled={deploying || !hasConfig}
          className="rounded px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {deploying ? "Deploying..." : "Export to R2"}
        </button>
      )}
      {exportResult && (
        <span className={`text-[10px] ${exportResult.includes("failed") ? "text-status-error" : "text-status-success"}`}>
          {exportResult}
        </span>
      )}
      {deployResult && (
        <span className={`text-[10px] ${deployResult.includes("failed") ? "text-status-error" : "text-status-success"}`}>
          {deployResult}
        </span>
      )}

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
          const config = useConfigStore.getState().config;
          const results = validateAllZones(zones, config?.equipmentSlots);
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
              const project = useProjectStore.getState().project;
              if (project && useConfigStore.getState().dirty) {
                await saveProjectConfig(project);
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
