import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ShowcaseEmptyState, ShowcasePanel, showcaseButtonClassNames } from "@/components/ShowcasePrimitives";
import { StoryPlayer } from "@/components/player/StoryPlayer";
import { useShowcase } from "@/lib/DataContext";
import { TEMPLATE_LABELS } from "@/lib/templates";

function decodeRouteId(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

export function StoryPlayerPage() {
  const { id } = useParams<{ id: string }>();
  const { data, storyById, articleById } = useShowcase();

  const decodedId = decodeRouteId(id);
  const story = decodedId ? storyById.get(decodedId) : undefined;

  useEffect(() => {
    document.title = story ? `${story.title} - ${data?.meta.worldName ?? "World Lore"}` : "Story Not Found";
  }, [data?.meta.worldName, story]);

  const linkedArticles = useMemo(() => {
    if (!story) {
      return [];
    }

    const ids = new Set<string>();
    for (const articleId of story.linkedArticleIds ?? []) {
      ids.add(articleId);
    }
    for (const articleId of story.featuredCharacterIds ?? []) {
      ids.add(articleId);
    }
    for (const scene of story.scenes) {
      for (const articleId of scene.linkedArticleIds ?? []) {
        ids.add(articleId);
      }
      if (scene.linkedLocationArticleId) {
        ids.add(scene.linkedLocationArticleId);
      }
    }

    return [...ids]
      .map((articleId) => articleById.get(articleId))
      .filter((article): article is NonNullable<typeof article> => Boolean(article))
      .sort((left, right) => left.title.localeCompare(right.title));
  }, [articleById, story]);

  const primaryMap = useMemo(() => {
    if (!story || !data?.maps) {
      return undefined;
    }
    return data.maps.find((map) => map.id === story.primaryMapId);
  }, [data?.maps, story]);

  const primaryCalendar = useMemo(() => {
    if (!story || !data?.calendarSystems) {
      return undefined;
    }
    return data.calendarSystems.find((calendar) => calendar.id === story.primaryCalendarId);
  }, [data?.calendarSystems, story]);

  if (!story) {
    return (
      <ShowcaseEmptyState
        className="py-8"
        title="Story not found"
        description="This performance is not available in the current showcase export."
        actions={
          <>
            <Link to="/stories" className={showcaseButtonClassNames.secondary}>
              Return to stories
            </Link>
            <Link to="/articles" className={showcaseButtonClassNames.quiet}>
              Browse the codex
            </Link>
          </>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.9fr)]">
        <div className="rounded-[1.75rem] border border-[var(--color-aurum)]/20 bg-[radial-gradient(circle_at_top_left,rgba(214,177,90,0.14),transparent_44%),linear-gradient(155deg,rgba(18,18,28,0.98),rgba(9,10,18,0.94))] px-6 py-7 shadow-[var(--shadow-deep)] sm:px-8">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-2 text-[0.72rem] uppercase tracking-[0.18em] text-text-muted">
              <li>
                <Link to="/stories" className="transition-colors duration-200 hover:text-text-link">
                  Stories
                </Link>
              </li>
              <li aria-hidden="true" className="opacity-40">/</li>
              <li aria-current="page" className="text-text-secondary">
                Performance
              </li>
            </ol>
          </nav>

          <p className="mt-5 text-[0.68rem] uppercase tracking-[0.36em] text-[var(--color-aurum)]/80">Viewing deck</p>
          <h1 className="mt-3 break-words font-display text-4xl leading-tight text-[var(--color-aurum-pale)] sm:text-5xl">
            {story.title}
          </h1>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-text-secondary sm:text-[0.95rem]">
            {story.synopsis?.trim() || "A staged sequence of scenes published from the creator for interactive or cinematic viewing."}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {story.tags && story.tags.length > 0 ? (
              story.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-[var(--color-aurum)]/30 bg-white/[0.03] px-3 py-1 text-[0.72rem] text-[var(--color-aurum-pale)]">
                  {tag}
                </span>
              ))
            ) : (
              <span className="rounded-full border border-border-muted/30 bg-white/[0.03] px-3 py-1 text-[0.72rem] text-text-muted">
                Story export
              </span>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/stories" className={showcaseButtonClassNames.secondary}>
              Back to repertory
            </Link>
            {primaryMap ? (
              <Link to={`/maps/${encodeURIComponent(primaryMap.id)}`} className={showcaseButtonClassNames.quiet}>
                Open related map
              </Link>
            ) : null}
            {linkedArticles[0] ? (
              <Link to={`/articles/${encodeURIComponent(linkedArticles[0].id)}`} className={showcaseButtonClassNames.quiet}>
                Open linked lore
              </Link>
            ) : null}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.3rem] border border-border-muted/30 bg-bg-secondary/45 px-4 py-4">
              <p className="text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">Scenes</p>
              <p className="mt-2 font-display text-2xl text-accent-emphasis">
                {new Intl.NumberFormat().format(story.sceneCount)}
              </p>
            </div>
            <div className="rounded-[1.3rem] border border-border-muted/30 bg-bg-secondary/45 px-4 py-4">
              <p className="text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">Linked lore</p>
              <p className="mt-2 font-display text-2xl text-accent-emphasis">
                {new Intl.NumberFormat().format(linkedArticles.length)}
              </p>
            </div>
            <div className="rounded-[1.3rem] border border-border-muted/30 bg-bg-secondary/45 px-4 py-4">
              <p className="text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">Cinematic cut</p>
              <p className="mt-2 font-display text-2xl text-accent-emphasis">{story.cinematicUrl ? "Yes" : "No"}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-border-muted/35 bg-[linear-gradient(180deg,rgba(18,18,28,0.92),rgba(10,10,18,0.98))] px-5 py-5 shadow-[var(--shadow-deep)]">
          {story.coverImageUrl ? (
            <div className="overflow-hidden rounded-[1.35rem] border border-[var(--color-aurum)]/15">
              <img src={story.coverImageUrl} alt={story.title} className="aspect-[4/3] w-full object-cover" />
            </div>
          ) : (
            <div className="rounded-[1.35rem] bg-[linear-gradient(135deg,rgba(214,177,90,0.12),transparent_55%),linear-gradient(160deg,rgba(31,32,47,0.92),rgba(12,12,19,0.88))] px-6 py-12">
              <p className="text-[0.68rem] uppercase tracking-[0.3em] text-[var(--color-aurum)]/80">Program note</p>
              <p className="mt-3 font-display text-2xl text-[var(--color-aurum-pale)]">No cover plate</p>
              <p className="mt-3 text-sm leading-7 text-text-secondary">
                This story was published without a cover image, so the stage identity depends on its scene sequence and
                associated lore.
              </p>
            </div>
          )}

          <div className="mt-5 space-y-3">
            <div className="rounded-[1.2rem] border border-border-muted/25 bg-bg-secondary/45 px-4 py-3">
              <p className="text-[0.68rem] uppercase tracking-[0.18em] text-text-muted">Zone</p>
              <p className="mt-1 break-words text-sm text-text-primary">{story.zoneName ?? "Unknown zone"}</p>
            </div>
            {primaryMap ? (
              <div className="rounded-[1.2rem] border border-border-muted/25 bg-bg-secondary/45 px-4 py-3">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-text-muted">Primary map</p>
                <p className="mt-1 break-words text-sm text-text-primary">{primaryMap.title}</p>
              </div>
            ) : null}
            {primaryCalendar ? (
              <div className="rounded-[1.2rem] border border-border-muted/25 bg-bg-secondary/45 px-4 py-3">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-text-muted">Primary calendar</p>
                <p className="mt-1 break-words text-sm text-text-primary">{primaryCalendar.name}</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="rounded-[1.75rem] border border-border-muted/35 bg-[linear-gradient(180deg,rgba(18,18,28,0.94),rgba(10,10,18,0.98))] px-5 py-5 shadow-[var(--shadow-deep)] sm:px-6">
          <div className="border-b border-border-muted/25 pb-5">
            <p className="text-[0.68rem] uppercase tracking-[0.3em] text-[var(--color-aurum)]/80">Interactive stage</p>
            <h2 className="mt-2 font-display text-2xl text-[var(--color-aurum-pale)]">Scene player</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-text-secondary">
              Click-through, auto-play, scroll mode, and cinematic playback all remain available here, but the route now
              frames them as part of a proper destination rather than leaving the player to float on its own.
            </p>
          </div>

          <div className="mt-6">
            <StoryPlayer story={story} />
          </div>
        </section>

        <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          <ShowcasePanel title="Program Notes" toneColor="var(--color-aurum)" bodyClassName="space-y-3">
            <p className="text-sm leading-7 text-text-secondary">
              Use click or auto modes for guided playback. Scroll mode opens the whole sequence as a vertical exhibition.
            </p>
            <p className="text-sm leading-7 text-text-secondary">
              When a cinematic export exists, the player exposes a native video overlay without leaving this page.
            </p>
          </ShowcasePanel>

          {linkedArticles.length > 0 ? (
            <ShowcasePanel title="Linked Lore" toneColor="var(--color-aurum)" bodyClassName="space-y-2">
              {linkedArticles.slice(0, 8).map((article) => (
                <Link
                  key={article.id}
                  to={`/articles/${encodeURIComponent(article.id)}`}
                  className="flex items-center gap-3 rounded-2xl border border-border-muted/25 bg-bg-secondary/45 px-3 py-2 transition-colors duration-200 hover:bg-bg-hover/25"
                >
                  {article.imageUrl ? (
                    <img src={article.imageUrl} alt="" className="h-10 w-10 rounded-xl object-cover" loading="lazy" />
                  ) : (
                    <span className="h-10 w-10 rounded-xl bg-bg-tertiary/60" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text-primary">{article.title}</p>
                    <p className="mt-0.5 truncate text-[0.72rem] text-text-muted">{TEMPLATE_LABELS[article.template]}</p>
                  </div>
                </Link>
              ))}
              {linkedArticles.length > 8 ? (
                <p className="text-[0.72rem] text-text-muted">
                  {new Intl.NumberFormat().format(linkedArticles.length - 8)} more linked entries remain in the weave.
                </p>
              ) : null}
            </ShowcasePanel>
          ) : null}

          <ShowcasePanel title="Scene Sequence" toneColor="var(--color-aurum)" bodyClassName="space-y-2">
            {story.scenes.map((scene, index) => (
              <div key={scene.id} className="rounded-2xl border border-border-muted/25 bg-bg-secondary/45 px-3 py-2">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-text-muted">Scene {index + 1}</p>
                <p className="mt-1 break-words text-sm text-text-primary">{scene.title}</p>
              </div>
            ))}
          </ShowcasePanel>
        </aside>
      </div>
    </div>
  );
}
