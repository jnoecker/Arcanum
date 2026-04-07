import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useStoryStore } from "@/stores/storyStore";
import { useLoreStore } from "@/stores/loreStore";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useAssetStore } from "@/stores/assetStore";
import { loadStory, saveStory } from "@/lib/storyPersistence";
import { useResolvedSceneData } from "@/lib/useResolvedSceneData";
import { ActionButton, Spinner, EditableField } from "@/components/ui/FormWidgets";
import { SceneTimeline } from "./SceneTimeline";
import { SceneDetailEditor } from "./SceneDetailEditor";
import { PresentationMode } from "./PresentationMode";
import { StorySettingsSection } from "./StorySettingsSection";
import { StoryAIToolbar } from "./StoryAIToolbar";
import { StoryExportDialog } from "./StoryExportDialog";

interface StoryEditorPanelProps {
  storyId: string;
}

export function StoryEditorPanel({ storyId }: StoryEditorPanelProps) {
  const project = useProjectStore((s) => s.project);
  const story = useStoryStore((s) => s.stories[storyId]);
  const dirty = useStoryStore((s) => s.dirty[storyId] ?? false);
  const canUndo = useStoryStore((s) => s.storyPast.length > 0);
  const canRedo = useStoryStore((s) => s.storyFuture.length > 0);
  const updateStory = useStoryStore((s) => s.updateStory);
  const undoStory = useStoryStore((s) => s.undoStory);
  const redoStory = useStoryStore((s) => s.redoStory);
  const markClean = useStoryStore((s) => s.markClean);
  const activeSceneId = useStoryStore((s) => s.activeSceneId);
  const setActiveScene = useStoryStore((s) => s.setActiveScene);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Stores needed for the export dialog (resolved scenes + audio paths).
  const assetsDir = useAssetStore((s) => s.assetsDir);

  // Derive zone name from zoneStore
  const zones = useZoneStore((s) => s.zones);
  const zoneName = story?.zoneId
    ? (zones.get(story.zoneId)?.data.zone ?? story.zoneId)
    : "Unknown zone";

  // Lazy load story from disk when not in store
  useEffect(() => {
    if (story || !project || !storyId) return;
    setLoading(true);
    setLoadError(false);
    loadStory(project, storyId)
      .then((loaded) => {
        if (loaded) {
          useStoryStore.getState().setStory(loaded);
          // Mark clean since it was just loaded from disk
          useStoryStore.getState().markClean(loaded.id);
        } else {
          setLoadError(true);
        }
      })
      .catch(() => {
        setLoadError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [storyId, story, project]);

  // Auto-save when dirty (3-second debounce matching lore pattern)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!dirty || !project || !story) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveStory(project, story)
        .then(() => markClean(storyId))
        .catch((err) => console.error("Story auto-save failed:", err));
    }, 3000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [dirty, project, story, storyId, markClean]);

  // Flush unsaved story on unmount
  useEffect(() => {
    return () => {
      const s = useStoryStore.getState();
      const p = useProjectStore.getState().project;
      const currentStory = s.stories[storyId];
      if (s.dirty[storyId] && p && currentStory) {
        saveStory(p, currentStory)
          .then(() => s.markClean(storyId))
          .catch((err) => console.error("Story flush-on-unmount failed:", err));
      }
    };
  }, [storyId]);

  // Auto-select first scene when story loads and no scene is active (D-03)
  useEffect(() => {
    if (story && story.scenes.length > 0 && !activeSceneId) {
      const first = [...story.scenes].sort((a, b) => a.sortOrder - b.sortOrder)[0];
      if (first) {
        setActiveScene(first.id);
      }
    }
  }, [story, activeSceneId, setActiveScene]);

  // F5 keyboard shortcut to enter presentation mode
  useEffect(() => {
    if (!story) return;
    const sortedForF5 = [...(story.scenes || [])].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const canPresentF5 = sortedForF5.length > 0;
    function handleF5(e: KeyboardEvent) {
      if (e.key === "F5" && canPresentF5 && !isPresenting) {
        e.preventDefault();
        setIsPresenting(true);
      }
    }
    window.addEventListener("keydown", handleF5);
    return () => window.removeEventListener("keydown", handleF5);
  }, [story, isPresenting]);

  // Title commit handler -- updates both story and lore article stub
  const handleTitleCommit = useCallback(
    (newTitle: string) => {
      if (!newTitle.trim()) return;
      updateStory(storyId, { title: newTitle.trim() });
      useLoreStore.getState().updateArticle(storyId, {
        title: newTitle.trim(),
        updatedAt: new Date().toISOString(),
      });
    },
    [storyId, updateStory],
  );

  // Exit presentation mode and sync active scene back to editor
  const handlePresentationExit = useCallback(
    (exitSceneId: string) => {
      setIsPresenting(false);
      setActiveScene(exitSceneId);
    },
    [setActiveScene],
  );

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-[28rem] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // Error state (T-07-06: corrupt file handling)
  if (loadError) {
    return (
      <div className="flex min-h-[28rem] flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <p className="text-sm text-status-error">
          This story's data could not be loaded. The file may be damaged.
        </p>
      </div>
    );
  }

  // Story not yet loaded (shouldn't happen after loading, but guard)
  if (!story) {
    return (
      <div className="flex min-h-[28rem] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // Sorted scenes for rendering
  const sortedScenes = [...(story.scenes || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const canPresent = sortedScenes.length > 0;
  const canExport = sortedScenes.length > 0;
  const initialSceneIndex = Math.max(
    0,
    sortedScenes.findIndex((s) => s.id === activeSceneId),
  );
  const activeScene = sortedScenes.find((s) => s.id === activeSceneId);

  // Resolved scene data for the export dialog. The hook runs always so
  // images are warm by the time the user clicks Export, but the IPC
  // calls are cheap + cached, and the dialog only opens on demand.
  const resolvedSceneData = useResolvedSceneData(sortedScenes, story.zoneId);
  const resolvedScenesForExport = useMemo(
    () =>
      resolvedSceneData.map((rs) => ({
        sceneId: rs.sceneId,
        roomImageSrc: rs.roomImageSrc,
        entities: rs.entities.map((e) => ({
          entity: e.entity,
          name: e.name,
          imageSrc: e.imageSrc,
        })),
      })),
    [resolvedSceneData],
  );

  // Zone world data (for audio refs).
  const zoneWorld = useZoneStore((s) => s.zones.get(story.zoneId)?.data);

  return (
    <div className="flex flex-col gap-6">
      {/* Section 0: Header Bar */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <EditableField
            value={story.title}
            onCommit={handleTitleCommit}
            placeholder="Untitled story"
            className="font-display text-lg text-text-primary"
            label="Story title"
          />
          <span className="shrink-0 rounded-full bg-bg-elevated px-3 py-1 font-display text-2xs uppercase tracking-[0.5px] text-text-muted">
            {zoneName}
          </span>
        </div>

        {/* Present + Export + Undo / Redo */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPresenting(true)}
            disabled={!canPresent}
            title={canPresent ? "Present story (F5)" : "Add scenes to present"}
            className={[
              "action-button-primary flex items-center gap-1.5 rounded-full px-3 py-1.5",
              "text-xs font-sans font-medium uppercase tracking-[0.12em]",
              !canPresent ? "opacity-45 cursor-not-allowed" : "",
            ].join(" ")}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
              <path d="M2.5 1v10l8-5z" />
            </svg>
            Present
          </button>

          <button
            type="button"
            onClick={() => setIsExporting(true)}
            disabled={!canExport}
            title={canExport ? "Export story as cinematic video" : "Add scenes to export"}
            className={[
              "flex items-center gap-1.5 rounded-full border border-border-default bg-bg-secondary px-3 py-1.5",
              "text-xs font-sans font-medium uppercase tracking-[0.12em] text-text-primary",
              "hover:border-border-focus hover:bg-bg-hover transition-colors",
              !canExport ? "opacity-45 cursor-not-allowed" : "",
            ].join(" ")}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M6 1v7m0 0l3-3m-3 3L3 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M1 9v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Export
          </button>

          <div className="mx-0.5 h-5 w-px bg-border-muted" />

          <ActionButton
            variant="ghost"
            size="icon"
            onClick={undoStory}
            disabled={!canUndo}
            aria-label="Undo"
            className={!canUndo ? "opacity-45" : ""}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 7h8a3 3 0 0 1 0 6H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 4L4 7l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ActionButton>
          <ActionButton
            variant="ghost"
            size="icon"
            onClick={redoStory}
            disabled={!canRedo}
            aria-label="Redo"
            className={!canRedo ? "opacity-45" : ""}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M12 7H4a3 3 0 0 0 0 6h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ActionButton>
        </div>
      </div>

      {/* Section 0.5: AI tools (between header and settings) */}
      <StoryAIToolbar story={story} />

      {/* Section 1: Story Settings (cover, synopsis, tags, lore links) */}
      <StorySettingsSection story={story} />

      {/* Section 2: SceneTimeline (D-01) */}
      <SceneTimeline
        storyId={storyId}
        scenes={sortedScenes}
        activeSceneId={activeSceneId}
      />

      {/* Section 3: SceneDetailEditor (D-01, D-03) */}
      {activeScene && (
        <SceneDetailEditor storyId={storyId} scene={activeScene} zoneId={story.zoneId} />
      )}

      {/* Section 4: Metadata Footer */}
      <div className="flex items-center gap-4 border-t border-border-muted pt-3">
        <span className="text-2xs text-text-muted">
          Created {new Date(story.createdAt).toLocaleDateString()}
        </span>
        <span className="text-2xs text-text-muted">
          Updated {new Date(story.updatedAt).toLocaleDateString()}
        </span>
        <span className="ml-auto font-mono text-2xs text-text-muted">{story.id}</span>
      </div>

      {/* Presentation Mode (portal to body for fullscreen overlay) */}
      {isPresenting && story && createPortal(
        <PresentationMode
          scenes={sortedScenes}
          initialSceneIndex={initialSceneIndex}
          zoneId={story.zoneId}
          narrationSpeed={story.narrationSpeed}
          onExit={handlePresentationExit}
        />,
        document.body,
      )}

      {/* Video Export Dialog */}
      {isExporting && story && project && zoneWorld && (
        <StoryExportDialog
          story={story}
          world={zoneWorld}
          resolvedScenes={resolvedScenesForExport}
          project={project}
          assetsDir={assetsDir}
          onClose={() => setIsExporting(false)}
        />
      )}
    </div>
  );
}
