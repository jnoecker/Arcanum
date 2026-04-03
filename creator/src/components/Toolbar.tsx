import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/stores/projectStore";
import { PANEL_MAP, panelTab, type Workspace } from "@/lib/panelRegistry";
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
import { useLoreStore } from "@/stores/loreStore";
import { ActionButton, Spinner } from "./ui/FormWidgets";
import toolbarBg from "@/assets/toolbar-bg.jpg";
import { exportShowcaseData } from "@/lib/exportShowcase";

const DiffModal = lazy(() => import("./ui/DiffModal").then((m) => ({ default: m.DiffModal })));
const BatchLegacyImport = lazy(() => import("./BatchLegacyImport").then((m) => ({ default: m.BatchLegacyImport })));
const SketchImportWizard = lazy(() => import("./SketchImportWizard").then((m) => ({ default: m.SketchImportWizard })));

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

const WORKSPACE_COPY: Record<Workspace, { label: string; description: string }> = {
  worldmaker: {
    label: "Worldmaker",
    description: "Shape zones, systems, creatures, and supporting content from one ceremonial frame.",
  },
  lore: {
    label: "Lore",
    description: "Tend the canon itself: setting, history, factions, maps, and the published face of the world.",
  },
};

interface ToolbarProps {
  workspace: Workspace;
  setWorkspace: (workspace: Workspace) => void;
}

export function Toolbar({ workspace, setWorkspace }: ToolbarProps) {
  const project = useProjectStore((s) => s.project);
  const tabs = useProjectStore((s) => s.tabs);
  const activeTabId = useProjectStore((s) => s.activeTabId);
  const openTab = useProjectStore((s) => s.openTab);
  const adminConnectionStatus = useAdminStore((s) => s.connectionStatus);
  const dirtyCount = useZoneStore(
    (s) => Array.from(s.zones.values()).filter((z) => z.dirty).length,
  );
  const zones = useZoneStore((s) => s.zones);
  const workspaceRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const setValidationResults = useValidationStore((s) => s.setResults);
  const openValidationPanel = useValidationStore((s) => s.openPanel);
  const hasConfig = useConfigStore((s) => !!s.config);
  const configDirty = useConfigStore((s) => s.dirty);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [showLegacyImport, setShowLegacyImport] = useState(false);
  const [showSketchImport, setShowSketchImport] = useState(false);
  const [showUtilityMenu, setShowUtilityMenu] = useState(false);
  const openGenerator = useAssetStore((s) => s.openGenerator);
  const openGallery = useAssetStore((s) => s.openGallery);
  const isStandalone = project?.format === "standalone";
  const articleCount = useLoreStore((s) => Object.keys(s.lore?.articles ?? {}).length);
  const hasLore = articleCount > 0;
  const [exporting, setExporting] = useState(false);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;
  const utilityMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showUtilityMenu) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!utilityMenuRef.current?.contains(event.target as Node)) {
        setShowUtilityMenu(false);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [showUtilityMenu]);

  const activeSurface = useMemo(() => {
    if (!activeTab) {
      return {
        kicker: "No surface active",
        title: "Awaiting a world to shape",
      };
    }
    if (activeTab.kind === "panel" && activeTab.panelId) {
      const panel = PANEL_MAP[activeTab.panelId];
      return {
        kicker: panel?.kicker ?? "Surface",
        title: panel?.title ?? activeTab.label,
      };
    }
    if (activeTab.kind === "zone") {
      return {
        kicker: "Zone cartography",
        title: activeTab.label,
      };
    }
    if (activeTab.kind === "admin") {
      return {
        kicker: "Runtime command",
        title: "Admin dashboard",
      };
    }
    return {
      kicker: "Workbench",
      title: activeTab.label,
    };
  }, [activeTab]);

  const handleOpenAdmin = () => {
    openTab({ id: "admin", kind: "admin", label: "Admin" });
  };

  const handleOpenHandoff = () => {
    useProjectStore.getState().openTab(panelTab("deployment"));
  };

  const handleExportShowcase = async () => {
    const lore = useLoreStore.getState().lore;
    if (!lore) return;

    const settings = useAssetStore.getState().settings;
    const imageBaseUrl = settings?.r2_custom_domain?.replace(/\/+$/, "") ?? "";

    setExporting(true);
    try {
      await useAssetStore.getState().syncToR2("all");

      const data = exportShowcaseData(lore, imageBaseUrl);
      const json = JSON.stringify(data);
      await invoke<string>("deploy_showcase_to_r2", { jsonContent: json });
    } catch (err) {
      console.error("Showcase deploy failed:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="relative z-10 flex shrink-0 items-center px-4 pt-4">
        <img
          src={toolbarBg}
          alt=""
          className="pointer-events-none absolute inset-x-4 inset-y-0 rounded-[30px] object-cover opacity-[0.08]"
        />
        <div className="instrument-panel relative min-w-0 flex-1 overflow-hidden rounded-[30px] px-5 py-4">
          <div className="pointer-events-none absolute right-[-8rem] top-[-6rem] h-[20rem] w-[20rem] rounded-full bg-[radial-gradient(circle,rgba(168,151,210,0.16),transparent_72%)] blur-3xl" />
          <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_auto_minmax(20rem,1fr)] xl:items-center">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide-ui text-text-muted">Creator&apos;s instrument</p>
              <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2">
                <h1 className="min-w-0 truncate font-display text-[clamp(1.35rem,2vw,2.25rem)] leading-none text-text-primary">
                  {project?.name ?? "No world open"}
                </h1>
                <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-[10px] uppercase tracking-ui text-text-secondary">
                  {activeSurface.kicker}
                </span>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
                {WORKSPACE_COPY[workspace].description}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-2xs">
                <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-text-secondary">
                  {zones.size} zones in memory
                </span>
                <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-text-secondary">
                  {articleCount} lore articles
                </span>
                <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-text-secondary">
                  {tabs.length} open surfaces
                </span>
                <span className="rounded-full border border-[var(--border-accent-subtle)] bg-[rgba(168,151,210,0.12)] px-3 py-1 text-text-primary">
                  Active: {activeSurface.title}
                </span>
              </div>
            </div>

            <div className="xl:justify-self-center">
              <div className="segmented-control min-w-[18rem]" role="tablist" aria-label="Creator mode">
                {([
                  { id: "worldmaker" as const, label: "Worldmaker" },
                  { id: "lore" as const, label: "Lore" },
                ]).map((entry, index) => (
                  <button
                    key={entry.id}
                    ref={(node) => {
                      workspaceRefs.current[index] = node;
                    }}
                    role="tab"
                    aria-selected={workspace === entry.id}
                    tabIndex={workspace === entry.id ? 0 : -1}
                    onClick={() => setWorkspace(entry.id)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                        event.preventDefault();
                        const nextIndex = (index + 1) % 2;
                        const nextWorkspace = nextIndex === 0 ? "worldmaker" : "lore";
                        setWorkspace(nextWorkspace);
                        workspaceRefs.current[nextIndex]?.focus();
                      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                        event.preventDefault();
                        const nextIndex = (index - 1 + 2) % 2;
                        const nextWorkspace = nextIndex === 0 ? "worldmaker" : "lore";
                        setWorkspace(nextWorkspace);
                        workspaceRefs.current[nextIndex]?.focus();
                      }
                    }}
                    className="world-lens focus-ring flex-1 px-4 py-3 text-left"
                    data-active={workspace === entry.id}
                  >
                    <span className="block font-display text-sm text-text-primary">{entry.label}</span>
                    <span className="mt-1 block text-2xs leading-4 text-text-muted">
                      {entry.id === "worldmaker" ? "Zones, systems, and runtime craft" : "Canon, maps, and narrative structure"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <div ref={utilityMenuRef} className="relative">
                <ActionButton
                  onClick={() => setShowUtilityMenu((value) => !value)}
                  variant="secondary"
                  title="Open import, validation, runtime, and gallery tools"
                >
                  <div className={`h-2.5 w-2.5 rounded-full ${ADMIN_STATUS_COLORS[adminConnectionStatus]}`} />
                  <span>World Tools</span>
                </ActionButton>
                {showUtilityMenu && (
                  <div className="instrument-panel absolute right-0 top-full z-20 mt-3 w-[22rem] rounded-[26px] p-3">
                    <div className="space-y-3">
                      <div>
                        <p className="px-2 text-2xs uppercase tracking-wide-ui text-text-muted">Runtime</p>
                        <div className="mt-2 grid gap-2">
                          <button
                            onClick={() => {
                              setShowUtilityMenu(false);
                              handleOpenAdmin();
                            }}
                            className="focus-ring flex min-h-11 items-center justify-between rounded-[18px] border border-white/8 bg-black/12 px-4 py-3 text-left text-sm text-text-secondary transition hover:border-white/14 hover:bg-white/6 hover:text-text-primary"
                          >
                            <span>Runtime Admin</span>
                            <span className="text-2xs uppercase tracking-label text-text-muted">
                              {ADMIN_STATUS_LABELS[adminConnectionStatus]}
                            </span>
                          </button>
                          {isStandalone && (
                            <button
                              onClick={() => {
                                setShowUtilityMenu(false);
                                handleOpenHandoff();
                              }}
                              disabled={!hasConfig}
                              className="focus-ring flex min-h-11 items-center rounded-[18px] border border-white/8 bg-black/12 px-4 py-3 text-left text-sm text-text-secondary transition hover:border-white/14 hover:bg-white/6 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Export Runtime
                            </button>
                          )}
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
                              setShowUtilityMenu(false);
                            }}
                            disabled={zones.size === 0 && !hasConfig}
                            className="focus-ring flex min-h-11 items-center rounded-[18px] border border-white/8 bg-black/12 px-4 py-3 text-left text-sm text-text-secondary transition hover:border-white/14 hover:bg-white/6 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Run Validation
                          </button>
                        </div>
                      </div>

                      <div>
                        <p className="px-2 text-2xs uppercase tracking-wide-ui text-text-muted">Publication and Imports</p>
                        <div className="mt-2 grid gap-2">
                          <button
                            onClick={() => {
                              setShowUtilityMenu(false);
                              void handleExportShowcase();
                            }}
                            disabled={!hasLore || exporting}
                            className="focus-ring flex min-h-11 items-center rounded-[18px] border border-white/8 bg-black/12 px-4 py-3 text-left text-sm text-text-secondary transition hover:border-white/14 hover:bg-white/6 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {exporting ? "Publishing Lore..." : "Publish Lore Atlas"}
                          </button>
                          <button
                            onClick={() => {
                              setShowUtilityMenu(false);
                              setShowLegacyImport(true);
                            }}
                            className="focus-ring flex min-h-11 items-center rounded-[18px] border border-white/8 bg-black/12 px-4 py-3 text-left text-sm text-text-secondary transition hover:border-white/14 hover:bg-white/6 hover:text-text-primary"
                          >
                            Restore Legacy Media
                          </button>
                          <button
                            onClick={() => {
                              setShowUtilityMenu(false);
                              setShowSketchImport(true);
                            }}
                            className="focus-ring flex min-h-11 items-center rounded-[18px] border border-white/8 bg-black/12 px-4 py-3 text-left text-sm text-text-secondary transition hover:border-white/14 hover:bg-white/6 hover:text-text-primary"
                          >
                            Import From Sketch
                          </button>
                          <button
                            onClick={() => {
                              setShowUtilityMenu(false);
                              openGallery();
                            }}
                            className="focus-ring flex min-h-11 items-center rounded-[18px] border border-white/8 bg-black/12 px-4 py-3 text-left text-sm text-text-secondary transition hover:border-white/14 hover:bg-white/6 hover:text-text-primary"
                          >
                            Browse Asset Gallery
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <span className="rounded-full border border-white/10 bg-black/10 px-3 py-2 text-2xs text-text-secondary">
                Runtime: {ADMIN_STATUS_LABELS[adminConnectionStatus]}
              </span>

              <ActionButton onClick={openGenerator} title="Generate new art" variant="primary">
                Render Art
              </ActionButton>

              <ActionButton
                onClick={() => setShowDiff(true)}
                disabled={(dirtyCount === 0 && !configDirty) || saving}
                title="Review and save changes"
                aria-live="polite"
                variant={saved || dirtyCount > 0 || configDirty ? "primary" : "secondary"}
                className={saved ? "border-status-success/40 bg-status-success/15 text-status-success" : ""}
              >
                {saving ? (
                  <span className="flex items-center gap-1.5"><Spinner />Saving</span>
                ) : saved ? (
                  <span className="animate-saved-flash">Committed</span>
                ) : dirtyCount > 0 || configDirty ? (
                  `Commit ${dirtyCount + (configDirty ? 1 : 0)} change${dirtyCount + (configDirty ? 1 : 0) === 1 ? "" : "s"}`
                ) : "No Changes"}
              </ActionButton>
            </div>
          </div>
        </div>
      </div>

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
                const currentProject = useProjectStore.getState().project;
                if (currentProject && useConfigStore.getState().dirty) {
                  await saveProjectConfig(currentProject);
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
