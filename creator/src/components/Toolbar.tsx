import { lazy, Suspense, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/stores/projectStore";
import { useAssetStore } from "@/stores/assetStore";
import { useLoreStore, selectArticleCount } from "@/stores/loreStore";
import { useToastStore } from "@/stores/toastStore";
import { ActionButton, Spinner } from "./ui/FormWidgets";
import { exportShowcaseData } from "@/lib/exportShowcase";
import { ProjectSwitcherMenu } from "./ui/ProjectSwitcherMenu";

const PublishWorldModal = lazy(() =>
  import("./PublishWorldModal").then((m) => ({ default: m.PublishWorldModal })),
);
const PublishHubDialog = lazy(() =>
  import("./PublishHubDialog").then((m) => ({ default: m.PublishHubDialog })),
);

interface ToolbarProps {
  onNewProject: () => void;
  onToggleGuide?: () => void;
  guideOpen?: boolean;
}

export function Toolbar({ onNewProject, onToggleGuide, guideOpen }: ToolbarProps) {
  const project = useProjectStore((s) => s.project);
  const openWorldMap = useProjectStore((s) => s.openWorldMap);
  const setSettingsOpen = useProjectStore((s) => s.setSettingsOpen);
  const mapView = useProjectStore((s) => s.mapView);
  const projectButtonRef = useRef<HTMLButtonElement | null>(null);
  const openGenerator = useAssetStore((s) => s.openGenerator);
  const openGallery = useAssetStore((s) => s.openGallery);
  const showToast = useToastStore((s) => s.show);
  const articleCount = useLoreStore(selectArticleCount);
  const hasLore = articleCount > 0;
  const [exporting, setExporting] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showPublishWorld, setShowPublishWorld] = useState(false);
  const [showPublishHub, setShowPublishHub] = useState(false);

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
              aria-label="Switch project"
              title="Switch world"
              className="focus-ring group/project min-w-0 rounded-2xl px-3 py-1 text-left transition hover:bg-[var(--chrome-highlight)]/30"
            >
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate font-display text-[clamp(1.5rem,2.4vw,2.25rem)] uppercase leading-none tracking-[0.18em] text-aurum">
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

          {/* ── Center: home (world map) button ───────────────────────── */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={openWorldMap}
              title="Return to the world map (Ctrl+M)"
              aria-label="World map"
              aria-pressed={mapView === "world"}
              className={`focus-ring rounded-full border px-5 py-1.5 font-display text-sm uppercase tracking-wide-ui transition ${
                mapView === "world"
                  ? "border-accent/80 bg-accent/15 text-accent shadow-glow"
                  : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)]/40 text-text-secondary hover:border-accent/60 hover:text-accent"
              }`}
            >
              <span aria-hidden="true" className="mr-1.5">{"\u{1F30D}"}</span>
              World Map
            </button>
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

            <ActionButton
              onClick={() => void handleExportShowcase()}
              disabled={!hasLore || exporting}
              title="Sync assets and publish lore to your self-hosted R2 showcase"
              variant="ghost"
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

            <ActionButton
              onClick={() => setShowPublishHub(true)}
              disabled={!hasLore}
              title="Publish compressed lore + images to the central Arcanum Hub"
              variant="ghost"
            >
              Publish to Hub
            </ActionButton>

            <ActionButton
              onClick={() => setShowPublishWorld(true)}
              disabled={!project}
              title="Save, validate, and deploy the entire world to R2"
              variant="primary"
            >
              Publish World
            </ActionButton>

            <button
              type="button"
              onClick={onToggleGuide}
              title="Getting started guide"
              aria-label="Getting started guide"
              aria-pressed={guideOpen}
              className={`focus-ring ml-1 rounded-full border p-2 transition ${
                guideOpen
                  ? "border-accent/80 bg-accent/15 text-accent shadow-glow"
                  : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)]/40 text-text-secondary hover:border-accent/60 hover:text-accent"
              }`}
            >
              <span aria-hidden="true" className="block text-base leading-none">
                {"\u{1F9ED}"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              title="Open settings (Ctrl+,)"
              aria-label="Open settings"
              className="focus-ring ml-1 rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)]/40 p-2 text-text-secondary transition hover:border-accent/60 hover:text-accent"
            >
              <span aria-hidden="true" className="block text-base leading-none">
                {"\u2699\uFE0F"}
              </span>
            </button>
          </div>
        </div>
      </div>

      <Suspense>
        {showPublishWorld && (
          <PublishWorldModal onClose={() => setShowPublishWorld(false)} />
        )}
        {showPublishHub && (
          <PublishHubDialog onClose={() => setShowPublishHub(false)} />
        )}
      </Suspense>
    </>
  );
}
