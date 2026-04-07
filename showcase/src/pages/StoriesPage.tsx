import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ShowcaseEmptyState, showcaseButtonClassNames } from "@/components/ShowcasePrimitives";
import { useShowcase } from "@/lib/DataContext";
import type { ShowcaseStory } from "@/types/showcase";

function StoryTile({ story, featured = false }: { story: ShowcaseStory; featured?: boolean }) {
  return (
    <Link
      to={`/stories/${encodeURIComponent(story.id)}`}
      className={`group overflow-hidden rounded-[1.5rem] border transition-transform duration-500 hover:-translate-y-1 ${
        featured
          ? "border-[var(--color-aurum)]/25 bg-[linear-gradient(180deg,rgba(20,20,30,0.9),rgba(11,12,18,0.98))] shadow-[var(--shadow-deep)]"
          : "border-border-muted/30 bg-bg-secondary/55"
      }`}
    >
      {story.coverImageUrl ? (
        <div className={featured ? "aspect-[16/9] overflow-hidden bg-bg-tertiary/35" : "aspect-[4/3] overflow-hidden bg-bg-tertiary/35"}>
          <img
            src={story.coverImageUrl}
            alt={story.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        </div>
      ) : (
        <div
          className={featured
            ? "aspect-[16/9] bg-[linear-gradient(135deg,rgba(214,177,90,0.14),transparent_55%),linear-gradient(160deg,rgba(31,32,47,0.96),rgba(12,12,19,0.88))]"
            : "aspect-[4/3] bg-[linear-gradient(135deg,rgba(214,177,90,0.1),transparent_55%),linear-gradient(160deg,rgba(31,32,47,0.92),rgba(12,12,19,0.88))]"}
          aria-hidden="true"
        />
      )}

      <div className={featured ? "space-y-4 px-6 py-6" : "space-y-3 px-5 py-5"}>
        <div className="flex flex-wrap items-center gap-3 text-[0.7rem] uppercase tracking-[0.24em] text-text-muted">
          <span className="text-[var(--color-aurum)]">Story</span>
          <span>{new Intl.NumberFormat().format(story.sceneCount)} scenes</span>
          <span className="max-w-full break-words">{story.zoneName ?? "Unknown zone"}</span>
        </div>

        <h2 className={featured ? "font-display text-3xl text-[var(--color-aurum-pale)]" : "font-display text-2xl text-accent-emphasis"}>
          {story.title}
        </h2>

        <p className="line-clamp-4 text-sm leading-7 text-text-secondary">
          {story.synopsis?.trim() || "A cinematic passage exported from the creator and staged for public viewing."}
        </p>

        {story.tags && story.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {story.tags.slice(0, featured ? 4 : 3).map((tag) => (
              <span key={tag} className="rounded-full border border-border-muted/35 bg-white/[0.03] px-3 py-1 text-[0.72rem] text-text-secondary">
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
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.9fr)]">
        <div className="rounded-[1.75rem] border border-[var(--color-aurum)]/22 bg-[radial-gradient(circle_at_top_left,rgba(214,177,90,0.14),transparent_42%),linear-gradient(155deg,rgba(17,18,27,0.98),rgba(9,10,17,0.94))] px-6 py-7 shadow-[var(--shadow-deep)] sm:px-8">
          <p className="text-[0.68rem] uppercase tracking-[0.38em] text-[var(--color-aurum)]/80">Performance hall</p>
          <h1 className="mt-3 max-w-3xl font-display text-3xl leading-tight text-[var(--color-aurum-pale)] sm:text-4xl">
            Enter staged journeys, narrated sequences, and cinematic exports from the world.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-text-secondary sm:text-[0.95rem]">
            Stories now open with a featured lead production and a supporting repertory beneath it, rather than a flat
            grid of identical cards.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <div className="rounded-[1.5rem] border border-[var(--color-aurum)]/18 bg-bg-secondary/70 px-5 py-5">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-text-muted">Stories</p>
            <p className="mt-3 font-display text-3xl text-[var(--color-aurum-pale)]">
              {new Intl.NumberFormat().format(orderedStories.length)}
            </p>
            <p className="mt-2 text-sm text-text-secondary">Published narrative exports ready for viewing.</p>
          </div>
          <div className="rounded-[1.5rem] border border-border-muted/40 bg-bg-secondary/55 px-5 py-5">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-text-muted">Scenes</p>
            <p className="mt-3 font-display text-3xl text-accent-emphasis">
              {new Intl.NumberFormat().format(
                orderedStories.reduce((sum, story) => sum + story.sceneCount, 0),
              )}
            </p>
            <p className="mt-2 text-sm text-text-secondary">Total scenes across the currently staged repertory.</p>
          </div>
          <div className="rounded-[1.5rem] border border-border-muted/40 bg-bg-secondary/55 px-5 py-5">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-text-muted">Cinematic cuts</p>
            <p className="mt-3 font-display text-3xl text-accent-emphasis">
              {new Intl.NumberFormat().format(cinematicCount)}
            </p>
            <p className="mt-2 text-sm text-text-secondary">Stories that also expose an exported cinematic version.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_19rem]">
        <div className="space-y-6">
          <div className="rounded-[1.6rem] border border-border-muted/35 bg-[linear-gradient(180deg,rgba(18,18,28,0.92),rgba(10,10,18,0.98))] px-5 py-5 shadow-[var(--shadow-deep)] sm:px-6">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[var(--color-aurum)]/80">Featured production</p>
            <h2 className="mt-2 font-display text-3xl text-[var(--color-aurum-pale)]">{leadStory.title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-text-secondary">
              The lead production gives the route a front door. Supporting stories remain available below, but one work
              now carries the page instead of being visually flattened into the rest.
            </p>
            <div className="mt-5">
              <StoryTile story={leadStory} featured />
            </div>
          </div>

          {supportingStories.length > 0 ? (
            <div className="rounded-[1.6rem] border border-border-muted/35 bg-[linear-gradient(180deg,rgba(18,18,28,0.84),rgba(10,10,18,0.96))] px-5 py-5 shadow-[var(--shadow-deep)] sm:px-6">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border-muted/25 pb-4">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.3em] text-text-muted">Repertory</p>
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

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-[1.5rem] border border-border-muted/40 bg-[linear-gradient(180deg,rgba(16,17,27,0.94),rgba(9,10,17,0.98))] px-5 py-5 shadow-[var(--shadow-deep)]">
            <p className="text-[0.68rem] uppercase tracking-[0.3em] text-text-muted">House lights</p>
            <h2 className="mt-2 font-display text-xl text-accent-emphasis">Viewing notes</h2>
            <div className="mt-5 space-y-4 text-sm leading-7 text-text-secondary">
              <p>Stories play as interactive scene sequences, with cinematic cuts available when exported.</p>
              <p>Longer productions rise to the front so the route feels curated instead of mechanically sorted.</p>
              <p>Zone names, scene counts, and tags stay visible to help readers choose a path quickly.</p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
