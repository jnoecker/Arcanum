import { lazy, Suspense, useState } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { panelTab } from "@/lib/panelRegistry";
import { useZoneStore } from "@/stores/zoneStore";
import { useValidationStore } from "@/stores/validationStore";
import { saveAllZones } from "@/lib/saveZone";
import { saveProjectConfig } from "@/lib/saveConfig";
import { validateAllZones } from "@/lib/validateZone";
import { validateConfig } from "@/lib/validateConfig";
import { useConfigStore } from "@/stores/configStore";
import { ValidationPanel } from "./ValidationPanel";
import { useAssetStore } from "@/stores/assetStore";
import { useAdminStore } from "@/stores/adminStore";
import { Spinner } from "./ui/FormWidgets";
import toolbarBg from "@/assets/toolbar-bg.jpg";

const DiffModal = lazy(() => import("./ui/DiffModal").then(m => ({ default: m.DiffModal })));
const BatchLegacyImport = lazy(() => import("./BatchLegacyImport").then(m => ({ default: m.BatchLegacyImport })));
const SketchImportWizard = lazy(() => import("./SketchImportWizard").then(m => ({ default: m.SketchImportWizard })));

const ADMIN_STATUS_COLORS: Record<string, string> = {
  disconnected: "bg-server-stopped",
  connecting: "bg-server-starting",
  connected: "bg-server-running animate-aurum-pulse",
  error: "bg-server-error",
};

const ADMIN_STATUS_LABELS: Record<string, string> = {
  disconnected: "No link",
  connecting: "Reaching...",
  connected: "Linked",
  error: "Link lost",
};

export function Toolbar() {
  const project = useProjectStore((s) => s.project);
  const openTab = useProjectStore((s) => s.openTab);
  const adminConnectionStatus = useAdminStore((s) => s.connectionStatus);
  const dirtyCount = useZoneStore(
    (s) => Array.from(s.zones.values()).filter((z) => z.dirty).length,
  );
  const zones = useZoneStore((s) => s.zones);
  const setValidationResults = useValidationStore((s) => s.setResults);
  const openValidationPanel = useValidationStore((s) => s.openPanel);
  const hasConfig = useConfigStore((s) => !!s.config);
  const configDirty = useConfigStore((s) => s.dirty);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [showLegacyImport, setShowLegacyImport] = useState(false);
  const [showSketchImport, setShowSketchImport] = useState(false);
  const openGenerator = useAssetStore((s) => s.openGenerator);
  const openGallery = useAssetStore((s) => s.openGallery);
  const isStandalone = project?.format === "standalone";

  const handleOpenAdmin = () => {
    openTab({ id: "admin", kind: "admin", label: "Admin" });
  };

  const handleOpenHandoff = () => {
    useProjectStore.getState().openTab(panelTab("deployment"));
  };

  return (
    <>
      <div className="relative z-10 flex shrink-0 items-center px-4 py-2">
        <img
          src={toolbarBg}
          alt=""
          className="pointer-events-none absolute inset-x-4 inset-y-2 rounded-[24px] object-cover opacity-[0.06]"
        />
        <div className="flex min-w-0 flex-1 items-center gap-4 rounded-[24px] border border-white/10 bg-gradient-panel-light px-4 py-2 shadow-bar backdrop-blur-xl">
          {/* ── Project identity ── */}
          <span className="truncate font-display text-sm tracking-wide text-text-primary">
            {project?.name ?? "No world open"}
          </span>
          <div className="h-4 w-px bg-white/10" />

          {/* ── Admin status + export ── */}
          <button
            onClick={handleOpenAdmin}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/10 px-3 py-1 text-2xs font-medium text-text-primary transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none"
            title="Open admin dashboard"
          >
            <div className={`h-2 w-2 rounded-full ${ADMIN_STATUS_COLORS[adminConnectionStatus]}`} />
            <span className="uppercase tracking-label">
              {ADMIN_STATUS_LABELS[adminConnectionStatus]}
            </span>
          </button>

          {isStandalone && (
            <button
              onClick={handleOpenHandoff}
              disabled={!hasConfig}
              title="Export for MUD server"
              className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-2xs font-medium text-text-primary transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Export
            </button>
          )}
          <div className="h-4 w-px bg-white/10" />

          {/* ── Assets cluster ── */}
          <button onClick={() => setShowLegacyImport(true)} title="Import legacy images" className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-2xs font-medium text-text-primary transition hover:bg-white/10">
            Import
          </button>
          <button onClick={() => setShowSketchImport(true)} title="Import zone from sketch" className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-2xs font-medium text-text-primary transition hover:bg-white/10">
            Sketch
          </button>
          <button onClick={openGallery} title="Browse asset library" className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-2xs font-medium text-text-primary transition hover:bg-white/10">
            Gallery
          </button>
          <button onClick={openGenerator} title="Generate new art" className="rounded-full border border-border-active bg-gradient-active-strong px-3 py-1 text-2xs font-medium text-text-primary transition hover:-translate-y-0.5 hover:shadow-glow">
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
            aria-live="polite"
            className={`rounded-full px-3 py-1 text-2xs font-medium transition ${
              saved
                ? "border border-status-success/40 bg-status-success/15 text-status-success"
                : dirtyCount > 0 || configDirty
                  ? "border border-border-active bg-gradient-active-strong text-text-primary hover:-translate-y-0.5 hover:shadow-glow"
                  : "border border-white/10 bg-black/10 text-text-primary enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            }`}
          >
            {saving ? (
              <span className="flex items-center gap-1.5"><Spinner />Saving</span>
            ) : saved ? (
              <span className="animate-saved-flash">Saved &#x2713;</span>
            ) : dirtyCount > 0 || configDirty ? (
              `Save (${dirtyCount + (configDirty ? 1 : 0)})`
            ) : "Save"}
          </button>
        </div>
      </div>

      {/* Modals rendered outside the toolbar's z-10 stacking context
          so their fixed z-50 overlays appear above the content area */}
      <ValidationPanel />

      <Suspense>
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

        {showLegacyImport && (
          <BatchLegacyImport onClose={() => setShowLegacyImport(false)} />
        )}

        {showSketchImport && (
          <SketchImportWizard onClose={() => setShowSketchImport(false)} />
        )}
      </Suspense>

    </>
  );
}
