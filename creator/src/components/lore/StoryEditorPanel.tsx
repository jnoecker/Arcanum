import { useState, useEffect, useRef, useCallback } from "react";
import { useStoryStore } from "@/stores/storyStore";
import { useLoreStore } from "@/stores/loreStore";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";
import { loadStory, saveStory } from "@/lib/storyPersistence";
import { useImageSrc } from "@/lib/useImageSrc";
import { ActionButton, Spinner, EditableField } from "@/components/ui/FormWidgets";
import { AssetPickerModal } from "@/components/ui/AssetPickerModal";
import { SceneTimeline } from "./SceneTimeline";
import { SceneDetailEditor } from "./SceneDetailEditor";

interface StoryEditorPanelProps {
  storyId: string;
}

/** Renders a cover image thumbnail with loading state. */
function CoverImage({
  fileName,
  onChangeClick,
}: {
  fileName: string;
  onChangeClick: () => void;
}) {
  const src = useImageSrc(fileName);
  return (
    <button
      onClick={onChangeClick}
      className="group relative w-[240px] overflow-hidden rounded-xl border border-border-default"
    >
      {src ? (
        <img src={src} alt="Story cover" className="w-full object-cover" />
      ) : (
        <div className="flex h-[160px] w-full items-center justify-center">
          <Spinner />
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="text-sm font-medium text-white">Change</span>
      </div>
    </button>
  );
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
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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

  // Cover image selection handler -- syncs story and lore article
  const handleCoverImageSelect = useCallback(
    (fileName: string) => {
      updateStory(storyId, { coverImage: fileName });
      useLoreStore.getState().updateArticle(storyId, {
        image: fileName,
        updatedAt: new Date().toISOString(),
      });
      setShowAssetPicker(false);
    },
    [storyId, updateStory],
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
  const activeScene = sortedScenes.find((s) => s.id === activeSceneId);

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

        {/* Undo / Redo */}
        <div className="flex shrink-0 items-center gap-1">
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

      {/* Section 1: Collapsible Story Settings (D-04) */}
      <div>
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          aria-expanded={showSettings}
          className="flex items-center gap-2 text-2xs text-text-muted hover:text-text-primary transition-colors"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className={`transform transition-transform duration-200 ${showSettings ? "rotate-180" : ""}`}
          >
            <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Story Settings
        </button>

        <div
          className={`overflow-hidden transition-[max-height] duration-300 ${
            showSettings ? "max-h-[400px]" : "max-h-0"
          }`}
          style={{ transitionTimingFunction: "var(--ease-unfurl)" }}
        >
          <div className="pt-3">
            {story.coverImage ? (
              <CoverImage
                fileName={story.coverImage}
                onChangeClick={() => setShowAssetPicker(true)}
              />
            ) : (
              <button
                onClick={() => setShowAssetPicker(true)}
                className="flex h-[160px] w-[240px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border-default transition-colors hover:border-accent/40 hover:bg-bg-tertiary"
              >
                <span className="text-sm text-text-muted">Add a cover image</span>
              </button>
            )}
          </div>
        </div>
      </div>

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

      {/* Asset Picker Modal */}
      {showAssetPicker && (
        <AssetPickerModal
          onSelect={handleCoverImageSelect}
          onClose={() => setShowAssetPicker(false)}
        />
      )}
    </div>
  );
}
