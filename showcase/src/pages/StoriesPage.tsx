import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ShowcaseEmptyState,
  showcaseButtonClassNames,
  showcaseSurfaceClassNames,
} from "@/components/ShowcasePrimitives";
import { useShowcase } from "@/lib/DataContext";
import type { ShowcaseStory } from "@/types/showcase";

function StoryTile({ story, featured = false }: { story: ShowcaseStory; featured?: boolean }) {
  const tileClassName = featured ? showcaseSurfaceClassNames.note : showcaseSurfaceClassNames.sectionSoft;

  return (
    <Link
      to={`/stories/${encodeURIComponent(story.id)}`}
      className={`${tileClassName} group overflow-hidden transition-transform duration-500 hover:-translate-y-1`}
    >
      {story.coverImageUrl ? (
        <div
          className={
            featured
              ? "aspect-[16/9] overflow-hidden bg-bg-tertiary/35"
              : "aspect-[4/3] overflow-hidden bg-bg-tertiary/35"
          }
        >
          <img
            src={story.coverImageUrl}
            alt={story.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        </div>
      ) : (
        <div
          className={
            featured
              ? "aspect-[16/9] bg-gradient-story-tile"
              : "aspect-[4/3] bg-gradient-story-tile-soft"
          }
          aria-hidden="true"
        />
      )}

      <div className={featured ? "space-y-4 px-6 py-6" : "space-y-3 px-5 py-5"}>
        <div className="flex flex-wrap items-center gap-3 text-[0.7rem] uppercase tracking-[0.24em] text-text-muted">
          <span className="text-[var(--color-aurum)]">Story</span>
          <span>{new Intl.NumberFormat().format(story.sceneCount)} scenes</span>
          <span className="max-w-full break-words">{story.zoneName ?? "Unknown zone"}</span>
        </div>

        <h2
          className={
            featured
              ? "font-display text-3xl text-[var(--color-aurum-pale)]"
              : "font-display text-2xl text-accent-emphasis"
          }
        >
          {story.title}
        </h2>

        <p className="line-clamp-4 text-sm leading-7 text-text-secondary">
          {story.synopsis?.trim() || "A cinematic passage exported from the creator and staged for public viewing."}
        </p>

        {story.tags && story.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {story.tags.slice(0, featured ? 4 : 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border-muted/35 bg-text-primary/[0.04] px-3 py-1 text-[0.72rem] text-text-secondary"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 pt-2 text-sm">
          <span className="text-text-muted">Open story</span>
          <span className="text-[var(--color-aurum)] transition-transform duration-300 group-hover:translate-x-1">
            Enter the scene
          </span>
        </div>
      </div>
    </Link>
  );
}

export function StoriesPage() {
  const { data } = useShowcase();

  useEffect(() => {
    document.title = `Stories - ${data?.meta.worldName ?? "World Lore"}`;
  }, [data?.meta.worldName]);

  const stories = data?.stories ?? [];

  const orderedStories = useMemo(
    () =>
      [...stories].sort((left, right) => {
        if ((right.sceneCount ?? 0) !== (left.sceneCount ?? 0)) {
          return right.sceneCount - left.sceneCount;
        }
        return left.title.localeCompare(right.title);
      }),
    [stories],
  );

  if (!data) {
    return null;
  }

  if (orderedStories.length === 0) {
    return (
      <ShowcaseEmptyState
        title="No performances are staged yet"
        description="Stories will appear here once cinematic exports are published from the creator."
        actions={
          <Link to="/articles" className={showcaseButtonClassNames.secondary}>
            Explore the codex
          </Link>
        }
      />
    );
  }

  const [leadStory, ...supportingStories] = orderedStories;
  const cinematicCount = orderedStories.filter((story) => Boolean(story.cinematicUrl)).length;

  return (
    <div className="space-y-6">
      <section className={`${showcaseSurfaceClassNames.hero} px-6 py-7 sm:px-8`}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.1fr)] xl:items-center">
          <div>
            <h1 className="mt-3 max-w-3xl font-display text-3xl leading-tight text-[var(--color-aurum-pale)] sm:text-4xl">
              Enter staged journeys, court intrigues, and ruin-runs exported from the world.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-text-secondary sm:text-[0.95rem]">
              The repertory leads with the longest current production, then opens into supporting works for readers who
              want a shorter passage, a different zone, or a more cinematic cut.
            </p>
            <p className="mt-6 text-sm leading-7 text-text-muted">
              {new Intl.NumberFormat().format(orderedStories.length)} published stories with {new Intl.NumberFormat().format(
                orderedStories.reduce((sum, story) => sum + story.sceneCount, 0),
              )} scenes in total.{" "}
              {new Intl.NumberFormat().format(cinematicCount)} include exported cinematic cuts.
            </p>
          </div>

          <div><StoryTile story={leadStory} featured /></div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          {supportingStories.length > 0 ? (
            <div className={`${showcaseSurfaceClassNames.section} px-5 py-5 sm:px-6`}>
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border-muted/25 pb-4">
                <div>
                  <h2 className="mt-2 font-display text-2xl text-accent-emphasis">Additional staged works</h2>
                </div>
                <p className="text-sm text-text-muted">
                  {new Intl.NumberFormat().format(supportingStories.length)} supporting production
                  {supportingStories.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {supportingStories.map((story) => (
                  <StoryTile key={story.id} story={story} />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className={`${showcaseSurfaceClassNames.sectionSoft} px-5 py-5`}>
            <h2 className="font-display text-xl text-accent-emphasis">How stories play</h2>
            <div className="mt-5 space-y-4 text-sm leading-7 text-text-secondary">
              <p>Stories play as interactive scene sequences, with cinematic cuts available when exported.</p>
              <p>Longer productions rise to the front so the route feels curated rather than mechanically sorted.</p>
              <p>Zone names, scene counts, and tags stay visible to help readers choose a path quickly.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
