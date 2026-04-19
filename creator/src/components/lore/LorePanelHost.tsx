import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLoreStore } from "@/stores/loreStore";
import { useStoryStore } from "@/stores/storyStore";
import { useProjectStore } from "@/stores/projectStore";
import { useToastStore } from "@/stores/toastStore";
import { saveLore } from "@/lib/lorePersistence";
import { PANEL_MAP } from "@/lib/panelRegistry";
import { AI_ENABLED } from "@/lib/featureFlags";
import { Spinner } from "@/components/ui/FormWidgets";
import { UndoRedoButtons } from "@/components/ui/UndoRedoButtons";
import configBg from "@/assets/config-bg.png";

import { WorldSettingPanel } from "./WorldSettingPanel";
import { ArticleBrowser } from "./ArticleBrowser";
import { TimelinePanel } from "./TimelinePanel";
import { RelationGraphPanel } from "./RelationGraphPanel";
import { DocumentLibraryPanel } from "./DocumentLibraryPanel";
import { ShowcaseSettingsPanel } from "./ShowcaseSettingsPanel";
import { TemplateEditorPanel } from "./TemplateEditorPanel";
import { SceneTemplateEditorPanel } from "./SceneTemplateEditorPanel";
import { StoryBrowser } from "./StoryBrowser";
import { ArtStylePanel } from "./ArtStylePanel";

// Lazy-load MapPanel to isolate Leaflet CSS from the main bundle.
// MapPanel hosts both the cartography view and the World Planner as tabs.
const MapPanel = lazy(() => import("./MapPanel").then(m => ({ default: m.MapPanel })));

function renderPanel(panelId: string): ReactNode {
  switch (panelId) {
    case "lore":
      return <ArticleBrowser />;
    case "worldSetting":
      return <WorldSettingPanel />;
    case "artStyle":
      return <ArtStylePanel />;
    case "loreMaps":
      return <Suspense fallback={<div className="flex h-64 items-center justify-center text-text-muted"><Spinner /> Loading maps...</div>}><MapPanel /></Suspense>;
    case "loreTimeline":
      return <TimelinePanel />;
    case "loreRelations":
      return <RelationGraphPanel />;
    case "loreDocuments":
      return <DocumentLibraryPanel />;
    case "showcaseSettings":
      return <ShowcaseSettingsPanel />;
    case "templates":
      return <TemplateEditorPanel />;
    case "sceneTemplates":
      return <SceneTemplateEditorPanel />;
    case "storyEditor":
      return <StoryBrowser />;
    default:
      return <div className="px-6 py-8 text-sm text-text-muted/60">Panel not found: {panelId}</div>;
  }
}

export function LorePanelHost({ panelId }: { panelId: string }) {
  const lore = useLoreStore((s) => s.lore);
  const dirty = useLoreStore((s) => s.dirty);
  const project = useProjectStore((s) => s.project);
  const setLoreChatOpen = useProjectStore((s) => s.setLoreChatOpen);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Story editor is a `lore` host panel but edits the story store, so the
  // host-level undo buttons must route to the right store based on panelId.
  const isStoryPanel = panelId === "storyEditor";
  const loreUndoDepth = useLoreStore((s) => s.lorePast.length);
  const loreRedoDepth = useLoreStore((s) => s.loreFuture.length);
  const storyUndoDepth = useStoryStore((s) => s.storyPast.length);
  const storyRedoDepth = useStoryStore((s) => s.storyFuture.length);
  const undoDepth = isStoryPanel ? storyUndoDepth : loreUndoDepth;
  const redoDepth = isStoryPanel ? storyRedoDepth : loreRedoDepth;

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!dirty || !project) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveLore(project).catch((err) => {
        console.error("Lore auto-save failed:", err);
      });
    }, 3000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [dirty, project, lore]);

  // Flush unsaved lore when leaving the lore workspace
  useEffect(() => {
    return () => {
      const { dirty: d } = useLoreStore.getState();
      const p = useProjectStore.getState().project;
      if (d && p) {
        saveLore(p).catch((err) => {
          console.error("Lore flush-on-unmount failed:", err);
        });
      }
    };
  }, []);

  const handleSave = useCallback(async () => {
    if (!project || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveLore(project);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }, [project, saving]);

  const def = PANEL_MAP[panelId];

  if (!lore) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="ornate-divider" />
        <p className="font-display text-base text-text-muted">The Archive Awaits</p>
        <p className="max-w-xs text-xs leading-6 text-text-muted/60">Open a world project to begin recording its lore.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <img
            src={configBg}
            alt=""
            className="h-full w-full object-cover opacity-[0.10] mix-blend-soft-light"
            style={{ objectPosition: "center 40%" }}
          />
        </div>

        <div className={`relative z-10 mx-auto flex flex-col gap-6 px-6 py-5 ${def?.maxWidth ?? "max-w-5xl"}`}>
          <div className="pointer-events-auto sticky top-3 z-20 flex items-center justify-end gap-2">
            <UndoRedoButtons
              canUndo={undoDepth > 0}
              canRedo={redoDepth > 0}
              undoDepth={undoDepth}
              redoDepth={redoDepth}
              onUndo={() => {
                if (undoDepth === 0) return;
                if (isStoryPanel) useStoryStore.getState().undoStory();
                else useLoreStore.getState().undoLore();
                useToastStore.getState().show("Change undone");
              }}
              onRedo={() => {
                if (redoDepth === 0) return;
                if (isStoryPanel) useStoryStore.getState().redoStory();
                else useLoreStore.getState().redoLore();
                useToastStore.getState().show("Change restored");
              }}
            />
            {AI_ENABLED && (
              <button
                type="button"
                onClick={() => setLoreChatOpen(true)}
                aria-label="Ask your world (Ctrl+/)"
                title="Ask your world (Ctrl+/)"
                className="focus-ring flex items-center gap-1.5 rounded-full border border-[var(--chrome-stroke)] bg-bg-primary/80 px-3 py-1 text-2xs font-medium text-accent shadow-md transition hover:bg-bg-primary"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 4h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H7l-3 2.5V12H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
                </svg>
                Ask
              </button>
            )}
            {(dirty || saving || saveError) && (
              <>
                {saveError && <span role="alert" className="text-2xs text-status-error">Save failed</span>}
                <button
                  onClick={handleSave}
                  disabled={!dirty || saving}
                  aria-label={saving ? "Saving lore" : "Save lore"}
                  className="focus-ring rounded-full border border-[var(--chrome-stroke)] bg-bg-primary/80 px-3 py-1 text-2xs font-medium text-accent shadow-md transition hover:bg-bg-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? <span className="flex items-center gap-1.5"><Spinner />Saving</span> : "Save Lore"}
                </button>
              </>
            )}
          </div>
          {renderPanel(panelId)}
        </div>
      </div>
    </div>
  );
}
