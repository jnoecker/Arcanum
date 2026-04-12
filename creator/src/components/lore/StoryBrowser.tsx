import { useState, useMemo, useEffect, useCallback } from "react";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import { useStoryStore } from "@/stores/storyStore";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";
import { loadStory, deleteStoryFile } from "@/lib/storyPersistence";
import { useImageSrc } from "@/lib/useImageSrc";
import { StoryEditorPanel } from "./StoryEditorPanel";
import { NewStoryDialog } from "./NewStoryDialog";
import { Spinner } from "@/components/ui/FormWidgets";

/** Thumbnail for a story's cover image. */
function StoryThumb({ fileName }: { fileName: string }) {
  const src = useImageSrc(fileName);
  if (!src) return <div className="h-full w-full animate-cosmic-glimmer bg-bg-elevated" />;
  return <img src={src} alt="" className="h-full w-full object-cover" />;
}

export function StoryBrowser() {
  const articles = useLoreStore(selectArticles);
  const zones = useZoneStore((s) => s.zones);
  const project = useProjectStore((s) => s.project);
  const stories = useStoryStore((s) => s.stories);
  const activeStoryId = useStoryStore((s) => s.activeStoryId);
  const setActiveStory = useStoryStore((s) => s.setActiveStory);

  const deleteStory = useStoryStore((s) => s.deleteStory);
  const deleteArticle = useLoreStore((s) => s.deleteArticle);

  const [showNewStory, setShowNewStory] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = useCallback(
    async (articleId: string, storyId: string) => {
      deleteStory(storyId);
      deleteArticle(articleId);
      if (project) {
        await deleteStoryFile(project, storyId).catch(() => {});
      }
      if (activeStoryId === storyId) setActiveStory(null);
    },
    [project, activeStoryId, deleteStory, deleteArticle, setActiveStory],
  );

  // Collect all story-type articles
  const storyArticles = useMemo(() => {
    return Object.values(articles)
      .filter((a) => a.template === "story" && a.fields.storyId)
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  }, [articles]);

  // Lazy-load the active story if not in the store yet
  useEffect(() => {
    if (!activeStoryId || !project || stories[activeStoryId]) return;
    setLoading(true);
    loadStory(project, activeStoryId)
      .then((loaded) => {
        if (loaded) {
          useStoryStore.getState().setStory(loaded);
          useStoryStore.getState().markClean(loaded.id);
        }
      })
      .finally(() => setLoading(false));
  }, [activeStoryId, project, stories]);

  // If a story is selected, show the editor
  if (activeStoryId) {
    if (loading) {
      return (
        <div className="flex min-h-[28rem] items-center justify-center">
          <Spinner />
        </div>
      );
    }
    if (stories[activeStoryId]) {
      return (
        <div className="flex flex-col gap-4">
          <button
            onClick={() => setActiveStory(null)}
            className="self-start rounded bg-bg-elevated px-3 py-1.5 text-2xs font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
          >
            &larr; All Stories
          </button>
          <StoryEditorPanel storyId={activeStoryId} />
        </div>
      );
    }
  }

  // Story listing view
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg text-text-primary">Stories</h3>
          <p className="mt-1 text-xs text-text-secondary">
            Cinematic zone narratives with scenes, narration, and presentation
            mode.
          </p>
        </div>
        <button
          onClick={() => setShowNewStory(true)}
          className="action-button action-button-primary action-button-md focus-ring"
        >
          New Story
        </button>
      </div>

      {storyArticles.length === 0 ? (
        <div className="flex min-h-[20rem] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border-default bg-bg-primary/40 px-6 py-12 text-center">
          <div className="ornate-divider" />
          <p className="font-display text-base text-text-primary">
            No stories yet
          </p>
          <p className="max-w-sm text-sm leading-7 text-text-muted">
            Stories let you compose cinematic sequences from your zone rooms
            &mdash; add narration, position entities, and present them as a
            slideshow.
          </p>
          <button
            onClick={() => setShowNewStory(true)}
            className="focus-ring action-button action-button-primary action-button-md"
          >
            Create Your First Story
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {storyArticles.map((article) => {
            const storyId = article.fields.storyId as string;
            const zoneId = article.fields.zoneId as string | undefined;
            const zoneName = zoneId
              ? (zones.get(zoneId)?.data.zone ?? zoneId)
              : "No zone";
            const sceneCount = stories[storyId]?.scenes.length;

            return (
              <div
                key={article.id}
                className="group relative flex gap-3 rounded-xl border border-border-default bg-bg-primary p-3 text-left transition-colors hover:border-accent/40 hover:bg-bg-hover"
              >
                <button
                  onClick={() => setActiveStory(storyId)}
                  className="flex min-w-0 flex-1 gap-3 text-left"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border-default bg-bg-elevated">
                    {article.image ? (
                      <StoryThumb fileName={article.image} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xs text-text-muted">
                        No cover
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-text-primary group-hover:text-accent">
                      {article.title}
                    </div>
                    <div className="mt-0.5 text-2xs text-text-muted">
                      {zoneName}
                      {sceneCount != null && ` \u00B7 ${sceneCount} scene${sceneCount !== 1 ? "s" : ""}`}
                    </div>
                    {article.updatedAt && (
                      <div className="mt-1 text-2xs text-text-muted">
                        Updated{" "}
                        {new Date(article.updatedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete story "${article.title}"?`)) {
                      handleDelete(article.id, storyId);
                    }
                  }}
                  className="absolute right-2 top-2 rounded p-1 text-text-muted opacity-0 transition-all hover:bg-status-error/10 hover:text-status-error group-hover:opacity-100"
                  title="Delete story"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showNewStory && (
        <NewStoryDialog onClose={() => setShowNewStory(false)} />
      )}
    </div>
  );
}
