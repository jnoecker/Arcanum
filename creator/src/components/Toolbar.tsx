import { lazy, Suspense, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/stores/projectStore";
import type { Workspace } from "@/lib/panelRegistry";
import { useAssetStore } from "@/stores/assetStore";
import { useLoreStore, selectArticleCount } from "@/stores/loreStore";
import { useToastStore } from "@/stores/toastStore";
import { ActionButton, Spinner } from "./ui/FormWidgets";
import { exportShowcaseData } from "@/lib/exportShowcase";
import { ProjectSwitcherMenu } from "./ui/ProjectSwitcherMenu";

const PublishWorldModal = lazy(() =>
  import("./PublishWorldModal").then((m) => ({ default: m.PublishWorldModal })),
);

interface ToolbarProps {
  workspace: Workspace;
  setWorkspace: (workspace: Workspace) => void;
  onNewProject: () => void;
}

export function Toolbar({ workspace, setWorkspace, onNewProject }: ToolbarProps) {
  const project = useProjectStore((s) => s.project);
  const workspaceRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const projectButtonRef = useRef<HTMLButtonElement | null>(null);
  const openGenerator = useAssetStore((s) => s.openGenerator);
  const openGallery = useAssetStore((s) => s.openGallery);
  const showToast = useToastStore((s) => s.show);
  const articleCount = useLoreStore(selectArticleCount);
  const hasLore = articleCount > 0;
  const [exporting, setExporting] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showPublishWorld, setShowPublishWorld] = useState(false);

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
      showToast(
        {
          variant: "ember",
          kicker: "Atlas launched",
          message: "Lore now shimmers across the showcase firmament.",
          glyph: "\u2726",
        },
        3200,
      );
    } catch (err) {
      console.error("Showcase deploy failed:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="relative z-20 shrink-0 px-5 pt-4">
        <div className="flex w-full items-center gap-4">
          {/* ── Left: project-name switcher ───────────────────────────── */}
          <div className="relative flex min-w-0 flex-1 items-center">
            <button
              ref={projectButtonRef}
              onClick={() => setShowSwitcher((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={showSwitcher}
              title="Switch world"
              className="focus-ring group/project min-w-0 rounded-2xl px-3 py-1 text-left transition hover:bg-[var(--chrome-highlight)]/30"
            >
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate font-display text-[clamp(1.5rem,2.4vw,2.25rem)] uppercase leading-none tracking-[0.18em] text-accent">
                  {project?.name ?? "No world"}
                </span>
                <span
                  aria-hidden="true"
                  className="shrink-0 text-xs text-text-muted opacity-60 transition group-hover/project:opacity-100"
                >
                  ▾
                </span>
              </span>
            </button>

            {showSwitcher && (
              <ProjectSwitcherMenu
                anchorRef={projectButtonRef}
                onClose={() => setShowSwitcher(false)}
                onNewProject={onNewProject}
              />
            )}
          </div>

          {/* ── Center: workspace segmented pill ──────────────────────── */}
          <div className="shrink-0">
            <div className="segmented-control" role="tablist" aria-label="Creator mode">
              {([
                { id: "worldmaker" as const, label: "Worldmaker", tip: "Zones, systems, and runtime craft" },
                { id: "lore" as const, label: "Lore", tip: "Canon, maps, and narrative structure" },
              ]).map((entry, index) => (
                <button
                  key={entry.id}
                  ref={(node) => {
                    workspaceRefs.current[index] = node;
                  }}
                  role="tab"
                  aria-selected={workspace === entry.id}
                  tabIndex={workspace === entry.id ? 0 : -1}
                  title={entry.tip}
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
                  className={`focus-ring rounded-full px-4 py-1.5 font-display text-sm transition ${
                    workspace === entry.id
                      ? "bg-[var(--chrome-fill)] text-accent shadow-glow"
                      : "text-text-secondary hover:bg-[var(--chrome-highlight)] hover:text-text-primary"
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Right: actions ─────────────────────────────────────────── */}
          <div className="flex min-w-0 flex-1 shrink-0 items-center justify-end gap-2">
            <ActionButton
              onClick={openGenerator}
              variant="ghost"
              title="Generate new art"
              aria-label="Generate new art"
            >
              Render Art
            </ActionButton>

            <ActionButton
              onClick={openGallery}
              variant="ghost"
              title="Browse the asset gallery"
              aria-label="Browse the asset gallery"
            >
              Gallery
            </ActionButton>

            {workspace === "lore" ? (
              <ActionButton
                onClick={() => void handleExportShowcase()}
                disabled={!hasLore || exporting}
                title="Sync assets and publish lore to the showcase"
                variant="primary"
              >
                {exporting ? (
                  <span className="flex items-center gap-1.5">
                    <Spinner />
                    Publishing
                  </span>
                ) : (
                  "Publish Lore"
                )}
              </ActionButton>
            ) : (
              <ActionButton
                onClick={() => setShowPublishWorld(true)}
                disabled={!project}
                title="Save, validate, and deploy the entire world to R2"
                variant="primary"
              >
                Publish World
              </ActionButton>
            )}
          </div>
        </div>
      </div>

      <Suspense>
        {showPublishWorld && (
          <PublishWorldModal onClose={() => setShowPublishWorld(false)} />
        )}
      </Suspense>
    </>
  );
}
