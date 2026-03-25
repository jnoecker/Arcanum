import { useState } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useServerStore } from "@/stores/serverStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useValidationStore } from "@/stores/validationStore";
import { useServerManager } from "@/lib/useServerManager";
import { saveAllZones } from "@/lib/saveZone";
import { saveProjectConfig } from "@/lib/saveConfig";
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
  error: "Failed",
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
  const [saved, setSaved] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [showLegacyImport, setShowLegacyImport] = useState(false);
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
    await new Promise<void>((resolve) => {
      let resolved = false;
      const unsub = useServerStore.subscribe((state) => {
        if (!resolved && (state.status === "stopped" || state.status === "error")) {
          resolved = true;
          unsub();
          resolve();
        }
      });
      const current = useServerStore.getState().status;
      if (!resolved && (current === "stopped" || current === "error")) {
        resolved = true;
        unsub();
        resolve();
      }
    });
    await handleStart();
  };

  const handleOpenHandoff = () => {
    const store = useProjectStore.getState();
    store.openTab({ id: "config", kind: "config", label: "Config" });
    store.setConfigSubTab("operations");
    store.setOperationsSubView("delivery");
  };

  return (
    <>
      <div className="relative z-10 flex shrink-0 items-center px-4 py-2">
        <img
          src={toolbarBg}
          alt=""
          className="pointer-events-none absolute inset-x-4 inset-y-2 rounded-[24px] object-cover opacity-[0.06]"
        />
        <div className="flex min-w-0 flex-1 items-center gap-4 rounded-[24px] border border-white/10 bg-gradient-panel-light px-4 py-2 shadow-[0_12px_36px_rgba(8,10,18,0.28)] backdrop-blur-xl">
          {/* ── Project identity ── */}
          <span className="truncate font-display text-sm tracking-wide text-text-primary">
            {project?.name ?? "No world open"}
          </span>
          <div className="h-4 w-px bg-white/10" />

          {/* ── Server cluster ── */}
          {!isStandalone && (
            <>
              <div className="flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${STATUS_COLORS[status]} ${status === "running" ? "animate-aurum-pulse" : ""} ${status === "error" ? "animate-crimson-pulse" : ""}`} />
                <span className="text-2xs uppercase tracking-label text-text-muted">
                  {STATUS_LABELS[status]}
                </span>
              </div>
              <button onClick={handleStart} disabled={status !== "stopped" && status !== "error"} title="Start server" className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-2xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">
                Start
              </button>
              <button onClick={stopServer} disabled={status !== "running"} title="Stop server" className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-2xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">
                Stop
              </button>
              <button onClick={handleRestart} disabled={status !== "running"} title="Restart server" className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-2xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">
                Restart
              </button>
              <div className="h-4 w-px bg-white/10" />
            </>
          )}

          {isStandalone && (
            <>
              <button
                onClick={handleOpenHandoff}
                disabled={!hasConfig}
                title="Export for MUD server"
                className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-2xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Handoff
              </button>
              <div className="h-4 w-px bg-white/10" />
            </>
          )}

          {/* ── Assets cluster ── */}
          <button onClick={() => setShowLegacyImport(true)} title="Import legacy images" className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-2xs font-medium text-text-primary transition hover:bg-white/10">
            Import
          </button>
          <button onClick={openGallery} title="Browse asset library" className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-2xs font-medium text-text-primary transition hover:bg-white/10">
            Gallery
          </button>
          <button onClick={openGenerator} title="Generate new art" className="rounded-full border border-border-active bg-gradient-active-strong px-3 py-1 text-2xs font-medium text-text-primary transition hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(137,155,214,0.24)]">
            Generate
          </button>

          <div className="ml-auto h-4 w-px bg-white/10" />

          {/* ── Data cluster (pushed right) ── */}
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
            title="Run validation checks"
            className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-2xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Validate
          </button>
          <button
            onClick={() => setShowDiff(true)}
            disabled={(dirtyCount === 0 && !configDirty) || saving}
            title="Review and save changes"
            className={`rounded-full px-3 py-1 text-2xs font-medium transition ${
              saved
                ? "border border-status-success/40 bg-status-success/15 text-status-success"
                : dirtyCount > 0 || configDirty
                  ? "border border-border-active bg-gradient-active-strong text-text-primary hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(137,155,214,0.24)]"
                  : "border border-white/10 bg-black/10 text-text-primary enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            }`}
          >
            {saving ? "Saving..." : saved ? "Saved \u2713" : dirtyCount > 0 || configDirty ? `Save (${dirtyCount + (configDirty ? 1 : 0)})` : "Save"}
          </button>
        </div>
      </div>

      {/* Modals rendered outside the toolbar's z-10 stacking context
          so their fixed z-50 overlays appear above the content area */}
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
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
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
    </>
  );
}
