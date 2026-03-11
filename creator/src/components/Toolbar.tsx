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
    <div className="relative z-10 flex h-20 shrink-0 items-center gap-4 px-4 py-4">
      <img
        src={toolbarBg}
        alt=""
        className="pointer-events-none absolute inset-x-4 top-4 h-[calc(100%-1rem)] w-[calc(100%-2rem)] rounded-[32px] object-cover opacity-[0.08]"
        style={{ objectPosition: "center center" }}
      />
      <div className="flex min-w-0 flex-1 items-center justify-between rounded-[32px] border border-white/10 bg-[linear-gradient(155deg,rgba(50,60,88,0.84),rgba(38,47,71,0.9))] px-6 py-4 shadow-[0_18px_56px_rgba(8,10,18,0.32)] backdrop-blur-xl">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.34em] text-text-muted">
            Ambon Creator
          </p>
          <div className="mt-1 flex min-w-0 items-center gap-3">
            <span className="truncate font-display text-2xl text-text-primary">
              {project?.name ?? "No world open"}
            </span>
            {project?.mudDir && (
              <span className="truncate text-xs text-text-secondary">
                {project.mudDir}
              </span>
            )}
          </div>
        </div>

        <div className="ml-6 flex shrink-0 items-center gap-2">
          {!isStandalone && (
            <>
              <div className="mr-2 flex items-center gap-2 rounded-full border border-white/10 bg-black/10 px-3 py-2">
                <div className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[status]} ${status === "running" ? "animate-aurum-pulse" : ""} ${status === "error" ? "animate-crimson-pulse" : ""}`} />
                <span className="text-xs uppercase tracking-[0.18em] text-text-secondary">
                  {STATUS_LABELS[status]}
                </span>
              </div>
              <button onClick={handleStart} disabled={status !== "stopped" && status !== "error"} className="rounded-full border border-white/10 bg-black/10 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">
                Start
              </button>
              <button onClick={stopServer} disabled={status !== "running"} className="rounded-full border border-white/10 bg-black/10 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">
                Stop
              </button>
              <button onClick={handleRestart} disabled={status !== "running"} className="rounded-full border border-white/10 bg-black/10 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">
                Restart
              </button>
            </>
          )}

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
              className="rounded-full border border-white/10 bg-black/10 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
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
                  const configContent = buildMonolithicConfig();
                  await invoke<string>("deploy_config_to_r2", {
                    mudDir: project.mudDir,
                    configContent,
                  });

                  const result = await invoke<{ uploaded: number; failed: number }>("deploy_zones_to_r2", {
                    mudDir: project.mudDir,
                    format: project.format,
                  });

                  const zones = useZoneStore.getState().zones;
                  const resources = Array.from(zones.keys()).sort().map((id) => `world/${id}.yaml`);
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
              className="rounded-full border border-white/10 bg-black/10 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deploying ? "Deploying..." : "Export to R2"}
            </button>
          )}
          <button onClick={() => setShowLegacyImport(true)} className="rounded-full border border-white/10 bg-black/10 px-4 py-2 text-xs font-medium text-text-primary transition hover:bg-white/10">
            Import images
          </button>
          <button onClick={openGallery} className="rounded-full border border-white/10 bg-black/10 px-4 py-2 text-xs font-medium text-text-primary transition hover:bg-white/10">
            Gallery
          </button>
          <button onClick={openGenerator} className="rounded-full border border-[rgba(168,151,210,0.35)] bg-[linear-gradient(135deg,rgba(168,151,210,0.26),rgba(140,174,201,0.18))] px-4 py-2 text-xs font-medium text-text-primary transition hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(137,155,214,0.24)]">
            Generate art
          </button>
          <button
            onClick={() => setShowDiff(true)}
            disabled={(dirtyCount === 0 && !configDirty) || saving}
            className="rounded-full border border-white/10 bg-black/10 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving..." : dirtyCount > 0 || configDirty ? `Save all (${dirtyCount + (configDirty ? 1 : 0)})` : "Save all"}
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
            className="rounded-full border border-white/10 bg-black/10 px-4 py-2 text-xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Validate
          </button>
        </div>
      </div>

      {(exportResult || deployResult) && (
        <div className="absolute bottom-1 left-8 flex gap-3">
          {exportResult && (
            <span className={`rounded-full border px-3 py-1 text-[11px] ${exportResult.includes("failed") ? "border-status-error/30 bg-status-error/10 text-status-error" : "border-status-success/30 bg-status-success/10 text-status-success"}`}>
              {exportResult}
            </span>
          )}
          {deployResult && (
            <span className={`rounded-full border px-3 py-1 text-[11px] ${deployResult.includes("failed") ? "border-status-error/30 bg-status-error/10 text-status-error" : "border-status-success/30 bg-status-success/10 text-status-success"}`}>
              {deployResult}
            </span>
          )}
        </div>
      )}

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
