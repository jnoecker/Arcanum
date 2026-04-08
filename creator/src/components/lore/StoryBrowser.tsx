import { useState, useMemo, useEffect } from "react";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import { useStoryStore } from "@/stores/storyStore";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";
import { loadStory } from "@/lib/storyPersistence";
import { useImageSrc } from "@/lib/useImageSrc";
import { StoryEditorPanel } from "./StoryEditorPanel";
import { NewStoryDialog } from "./NewStoryDialog";
import { Spinner } from "@/components/ui/FormWidgets";

/** Thumbnail for a story's cover image. */
function StoryThumb({ fileName }: { fileName: string }) {
  const src = useImageSrc(fileName);
  if (!src) return <div className="h-full w-full animate-pulse bg-bg-elevated" />;
  return <img src={src} alt="" className="h-full w-full object-cover" />;
}

export function StoryBrowser() {
  const articles = useLoreStore(selectArticles);
  const zones = useZoneStore((s) => s.zones);
  const project = useProjectStore((s) => s.project);
  const stories = useStoryStore((s) => s.stories);
  const activeStoryId = useStoryStore((s) => s.activeStoryId);
  const setActiveStory = useStoryStore((s) => s.setActiveStory);

  const [showNewStory, setShowNewStory] = useState(false);
  const [loading, setLoading] = useState(false);

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
              <button
                key={article.id}
                onClick={() => setActiveStory(storyId)}
                className="group flex gap-3 rounded-xl border border-border-default bg-bg-primary p-3 text-left transition-colors hover:border-accent/40 hover:bg-bg-hover"
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
