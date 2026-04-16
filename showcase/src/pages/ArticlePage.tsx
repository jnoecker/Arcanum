import { useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { Link, useParams } from "react-router-dom";
import { ShowcaseEmptyState, ShowcasePanel, showcaseButtonClassNames } from "@/components/ShowcasePrimitives";
import { useShowcase } from "@/lib/DataContext";
import { TEMPLATE_COLORS, TEMPLATE_LABELS } from "@/lib/templates";
import type { ShowcaseArticle, ShowcaseStory } from "@/types/showcase";

const RELATION_TYPE_LABELS: Record<string, string> = {
  ally: "Allies",
  rival: "Rivals",
  member_of: "Member of",
  located_in: "Located in",
  related: "Related",
  mentioned: "Mentioned",
};

const RELATION_TYPE_ORDER = ["ally", "rival", "member_of", "located_in", "related", "mentioned"];
const MENTIONED_LIMIT = 5;

interface ResolvedRelation {
  targetId: string;
  type: string;
  label?: string;
  target?: ShowcaseArticle;
  sourceTitle?: string;
  reverse?: boolean;
}

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

function formatFieldLabel(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ").trim();
}

function summarizeArticle(article: ShowcaseArticle) {
  const text = article.searchText?.trim() ?? "";
  if (!text) {
    return "This record has been published to the codex without a formal abstract.";
  }

  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= 240) {
    return normalized;
  }

  return `${normalized.slice(0, 237).trimEnd()}...`;
}

function ConnectionsSection({ relations, color }: { relations: ResolvedRelation[]; color: string }) {
  const [mentionedExpanded, setMentionedExpanded] = useState(false);

  const grouped = useMemo(() => {
    const groupedRelations = new Map<string, ResolvedRelation[]>();
    for (const relation of relations) {
      const bucket = groupedRelations.get(relation.type) ?? [];
      bucket.push(relation);
      groupedRelations.set(relation.type, bucket);
    }
    return groupedRelations;
  }, [relations]);

  const sortedGroups = useMemo(() => {
    const entries = [...grouped.entries()];
    entries.sort((left, right) => {
      const leftIndex = RELATION_TYPE_ORDER.indexOf(left[0]);
      const rightIndex = RELATION_TYPE_ORDER.indexOf(right[0]);
      return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
    });
    return entries;
  }, [grouped]);

  if (relations.length === 0) {
    return null;
  }

  return (
    <ShowcasePanel title="Relation Index" toneColor={color} bodyClassName="space-y-4">
      {sortedGroups.map(([type, items]) => {
        const isMentioned = type === "mentioned";
        const displayItems = isMentioned && !mentionedExpanded ? items.slice(0, MENTIONED_LIMIT) : items;
        const hiddenCount = items.length - MENTIONED_LIMIT;

        return (
          <div key={type}>
            <div className="mb-2 flex items-center gap-2">
              <span className="font-display text-[0.65rem] uppercase tracking-[0.18em] text-text-muted">
                {RELATION_TYPE_LABELS[type] ?? type}
              </span>
              <span className="text-[0.65rem] text-text-muted/55">({items.length})</span>
            </div>
            <div className="space-y-2">
              {displayItems.map((relation) => (
                <RelationLink key={`${relation.targetId}:${relation.type}:${relation.reverse ? "rev" : "fwd"}`} relation={relation} />
              ))}
            </div>
            {isMentioned && hiddenCount > 0 && !mentionedExpanded ? (
              <button
                type="button"
                onClick={() => setMentionedExpanded(true)}
                className={`${showcaseButtonClassNames.quiet} mt-2`}
              >
                Show {hiddenCount} more
              </button>
            ) : null}
            {isMentioned && mentionedExpanded && items.length > MENTIONED_LIMIT ? (
              <button
                type="button"
                onClick={() => setMentionedExpanded(false)}
                className={`${showcaseButtonClassNames.quiet} mt-2`}
              >
                Show fewer
              </button>
            ) : null}
          </div>
        );
      })}

      <Link to="/graph" className={`${showcaseButtonClassNames.quiet} mt-2 justify-center`}>
        Open the full weave
      </Link>
    </ShowcasePanel>
  );
}

function RelationLink({ relation }: { relation: ResolvedRelation }) {
  const title = relation.target?.title ?? relation.sourceTitle ?? relation.targetId;
  const imageUrl = relation.target?.imageUrl;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border-muted/25 bg-bg-secondary/45 px-3 py-2">
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" loading="lazy" />
      ) : (
        <span className="h-10 w-10 shrink-0 rounded-xl bg-bg-tertiary/60" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        {relation.target ? (
          <Link
            to={`/articles/${encodeURIComponent(relation.targetId)}`}
            className="block truncate text-sm text-text-link transition-colors duration-200 hover:text-accent"
          >
            {title}
          </Link>
        ) : (
          <span className="block truncate text-sm italic text-text-muted">{title}</span>
        )}
        {relation.label ? <p className="mt-0.5 truncate text-[0.72rem] text-text-muted">{relation.label}</p> : null}
      </div>
      {relation.reverse ? <span className="shrink-0 text-[0.7rem] text-text-muted/50">&larr;</span> : null}
    </div>
  );
}

function ArticleGallery({ images, title }: { images: string[]; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[1.5rem] border border-[var(--color-aurum)]/20 bg-gradient-panel-deep p-3 shadow-[var(--shadow-deep)]">
        <div className="relative overflow-hidden rounded-[1.1rem] bg-bg-tertiary/40">
          {images.map((src, index) => (
            <img
              key={`${src}-${index}`}
              src={src}
              alt={index === 0 ? title : `${title} - gallery ${index + 1}`}
              className={`w-full transition-opacity duration-300 ${index === activeIndex ? "opacity-100" : "absolute inset-0 opacity-0"}`}
            />
          ))}
        </div>
      </div>

      {images.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {images.map((src, index) => (
            <button
              key={`${src}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={index === 0 ? "Primary image" : `Gallery image ${index + 1}`}
              aria-current={index === activeIndex ? "true" : undefined}
              className={`h-11 w-11 overflow-hidden rounded-2xl border transition-[border-color,transform,opacity] duration-200 focus-visible:ring-2 focus-visible:ring-[var(--color-aurum)]/35 sm:h-14 sm:w-14 ${
                index === activeIndex
                  ? "border-[var(--color-aurum)]/55 opacity-100"
                  : "border-border-muted/30 opacity-65 hover:opacity-100"
              }`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FeaturedInStories({ stories, color }: { stories: ShowcaseStory[]; color: string }) {
  if (stories.length === 0) {
    return null;
  }

  return (
    <ShowcasePanel title="Stage Appearances" toneColor={color} bodyClassName="space-y-2">
      {stories.map((story) => (
        <Link
          key={story.id}
          to={`/stories/${encodeURIComponent(story.id)}`}
          className="flex items-center gap-3 rounded-2xl border border-border-muted/25 bg-bg-secondary/45 px-3 py-2 transition-colors duration-200 hover:bg-bg-hover/25"
        >
          {story.coverImageUrl ? (
            <img src={story.coverImageUrl} alt="" className="h-10 w-14 rounded-xl object-cover" loading="lazy" />
          ) : (
            <span className="h-10 w-14 rounded-xl bg-bg-tertiary/60" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-text-primary">{story.title}</p>
            <p className="mt-0.5 truncate text-[0.72rem] text-text-muted">
              {new Intl.NumberFormat().format(story.sceneCount)} scene{story.sceneCount === 1 ? "" : "s"}
            </p>
          </div>
        </Link>
      ))}
    </ShowcasePanel>
  );
}

function findStoriesFeaturingArticle(stories: ShowcaseStory[] | undefined, articleId: string) {
  if (!stories) {
    return [];
  }

  return stories.filter((story) => {
    if (story.linkedArticleIds?.includes(articleId)) {
      return true;
    }
    if (story.featuredCharacterIds?.includes(articleId)) {
      return true;
    }
    return story.scenes.some(
      (scene) => scene.linkedArticleIds?.includes(articleId) || scene.linkedLocationArticleId === articleId,
    );
  });
}

export function ArticlePage() {
  const { id } = useParams<{ id: string }>();
  const { data, articleById } = useShowcase();

  const decodedId = decodeRouteId(id);
  const article = decodedId ? articleById.get(decodedId) : undefined;

  useEffect(() => {
    document.title = article ? `${article.title} - ${data?.meta.worldName ?? "World Lore"}` : "Article Not Found";
  }, [article, data?.meta.worldName]);

  const siblings = useMemo(() => {
    if (!article || !data) {
      return { prev: undefined, next: undefined };
    }

    const sameType = data.articles
      .filter((entry) => entry.template === article.template)
      .sort((left, right) => left.title.localeCompare(right.title));
    const index = sameType.findIndex((entry) => entry.id === article.id);

    return {
      prev: index > 0 ? sameType[index - 1] : undefined,
      next: index < sameType.length - 1 ? sameType[index + 1] : undefined,
    };
  }, [article, data]);

  const reverseRelations = useMemo(() => {
    if (!data || !article) {
      return [];
    }

    return data.articles
      .filter((entry) => entry.id !== article.id && entry.relations.some((relation) => relation.targetId === article.id))
      .flatMap((entry) =>
        entry.relations
          .filter((relation) => relation.targetId === article.id)
          .map((relation) => ({
            ...relation,
            targetId: entry.id,
            sourceTitle: entry.title,
            target: articleById.get(entry.id),
            reverse: true,
          })),
      );
  }, [article, articleById, data]);

  const forwardRelations = useMemo<ResolvedRelation[]>(() => {
    if (!article) {
      return [];
    }

    return article.relations.map((relation) => ({
      ...relation,
      target: articleById.get(relation.targetId),
      reverse: false,
    }));
  }, [article, articleById]);

  const featuredInStories = useMemo(
    () => (article ? findStoriesFeaturingArticle(data?.stories, article.id) : []),
    [article, data?.stories],
  );

  const allRelations = useMemo(() => {
    const seen = new Set<string>();
    const merged: ResolvedRelation[] = [];

    for (const relation of forwardRelations) {
      const key = `${relation.targetId}:${relation.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(relation);
      }
    }

    for (const relation of reverseRelations) {
      const key = `${relation.targetId}:${relation.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(relation);
      }
    }

    return merged;
  }, [forwardRelations, reverseRelations]);

  if (!article) {
    return (
      <ShowcaseEmptyState
        className="py-8"
        title="Article not found"
        description="This entry cannot be recovered from the public archive."
        actions={
          <Link to="/articles" className={showcaseButtonClassNames.secondary}>
            Return to the codex
          </Link>
        }
      />
    );
  }

  const color = TEMPLATE_COLORS[article.template];
  const fieldEntries = Object.entries(article.fields).filter(([, value]) => value !== undefined && value !== null && value !== "");
  const heroSummary = summarizeArticle(article);
  const imageUrls = [article.imageUrl, ...(article.galleryUrls ?? [])].filter((value): value is string => Boolean(value));

  return (
    <div className="space-y-8">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.9fr)]">
        <div className="rounded-[1.75rem] border border-[var(--color-aurum)]/20 bg-gradient-hero-ember px-6 py-7 shadow-[var(--shadow-deep)] sm:px-8">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-2 text-[0.72rem] uppercase tracking-[0.18em] text-text-muted">
              <li>
                <Link to="/articles" className="transition-colors duration-200 hover:text-text-link">
                  Codex
                </Link>
              </li>
              <li aria-hidden="true" className="opacity-40">/</li>
              <li>
                <Link
                  to={`/articles?template=${article.template}`}
                  className="transition-colors duration-200 hover:text-text-link"
                  style={{ color }}
                >
                  {TEMPLATE_LABELS[article.template]}
                </Link>
              </li>
            </ol>
          </nav>

          <p className="mt-5 text-[0.68rem] uppercase tracking-[0.36em]" style={{ color }}>
            Archive folio
          </p>
          <h1 className="mt-3 break-words font-display text-4xl leading-tight text-[var(--color-aurum-pale)] sm:text-5xl">
            {article.title}
          </h1>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-text-secondary sm:text-[0.95rem]">{heroSummary}</p>

          {article.tags.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border bg-text-primary/[0.04] px-3 py-1 text-[0.72rem]"
                  style={{ borderColor: color, color }}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={`/articles?template=${article.template}`} className={showcaseButtonClassNames.secondary}>
              More {TEMPLATE_LABELS[article.template]}
            </Link>
            {article.template === "story" ? (
              <Link to={`/stories/${encodeURIComponent(article.id)}`} className={showcaseButtonClassNames.primary}>
                Play story
              </Link>
            ) : null}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-border-muted/35 bg-gradient-panel-deep px-5 py-5 shadow-[var(--shadow-deep)]">
          <p className="text-[0.68rem] uppercase tracking-[0.3em] text-[var(--color-aurum)]/80">
            {imageUrls.length > 0 ? "Illuminated plate" : "Catalog notes"}
          </p>
          <p className="mt-2 font-display text-xl text-accent-emphasis">
            {imageUrls.length > 0 ? "Image record" : "Record summary"}
          </p>

          <div className="mt-5">
            {imageUrls.length > 0 ? (
              <ArticleGallery images={imageUrls} title={article.title} />
            ) : (
              <div className="space-y-3">
                {fieldEntries.slice(0, 4).map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-[1.2rem] border border-border-muted/25 bg-bg-secondary/45 px-4 py-3"
                  >
                    <p className="text-[0.68rem] uppercase tracking-[0.18em] text-text-muted">
                      {formatFieldLabel(key)}
                    </p>
                    <p className="mt-1 break-words text-sm text-text-primary">
                      {Array.isArray(value) ? value.join(", ") : String(value)}
                    </p>
                  </div>
                ))}
                {fieldEntries.length === 0 ? (
                  <p className="text-sm leading-7 text-text-muted">
                    No structured field details were published with this entry.
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <dl className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.2rem] border border-border-muted/25 bg-bg-secondary/45 px-4 py-4">
              <dt className="text-[0.65rem] uppercase tracking-[0.22em] text-text-muted">Record details</dt>
              <dd className="mt-2 font-display text-2xl text-accent-emphasis">
                {new Intl.NumberFormat().format(fieldEntries.length)}
              </dd>
            </div>
            <div className="rounded-[1.2rem] border border-border-muted/25 bg-bg-secondary/45 px-4 py-4">
              <dt className="text-[0.65rem] uppercase tracking-[0.22em] text-text-muted">Connections</dt>
              <dd className="mt-2 font-display text-2xl text-accent-emphasis">
                {new Intl.NumberFormat().format(allRelations.length)}
              </dd>
            </div>
            <div className="rounded-[1.2rem] border border-border-muted/25 bg-bg-secondary/45 px-4 py-4">
              <dt className="text-[0.65rem] uppercase tracking-[0.22em] text-text-muted">Story appearances</dt>
              <dd className="mt-2 font-display text-2xl text-accent-emphasis">
                {new Intl.NumberFormat().format(featuredInStories.length)}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <article className="rounded-[1.75rem] border border-border-muted/35 bg-gradient-panel-deep px-6 py-6 shadow-[var(--shadow-deep)] sm:px-8">
          <div className="border-b border-border-muted/25 pb-5">
            <p className="text-[0.68rem] uppercase tracking-[0.3em] text-[var(--color-aurum)]/80">Primary text</p>
            <h2 className="mt-2 font-display text-2xl text-[var(--color-aurum-pale)]">Published entry</h2>
          </div>

          {article.contentHtml.trim() ? (
            <div
              className="article-prose prose mt-8"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.contentHtml) }}
            />
          ) : (
            <div className="mt-8">
              <ShowcaseEmptyState
                title="No published entry yet"
                description="This record does not currently include body text."
              />
            </div>
          )}

          {siblings.prev || siblings.next ? (
            <nav className="mt-14 grid gap-4 border-t border-border-muted/25 pt-8 sm:grid-cols-2" aria-label="Adjacent articles">
              {siblings.prev ? (
                <Link
                  to={`/articles/${encodeURIComponent(siblings.prev.id)}`}
                  className="group rounded-[1.35rem] border border-border-muted/30 bg-bg-secondary/40 px-5 py-5 transition-colors duration-300 hover:border-[var(--color-aurum)]/25"
                >
                  <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">&larr; Previous folio</p>
                  <p className="mt-2 truncate font-display text-lg text-accent-emphasis transition-colors duration-300 group-hover:text-[var(--color-aurum-pale)]">
                    {siblings.prev.title}
                  </p>
                </Link>
              ) : (
                <div className="hidden sm:block" />
              )}

              {siblings.next ? (
                <Link
                  to={`/articles/${encodeURIComponent(siblings.next.id)}`}
                  className="group rounded-[1.35rem] border border-border-muted/30 bg-bg-secondary/40 px-5 py-5 text-right transition-colors duration-300 hover:border-[var(--color-aurum)]/25"
                >
                  <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">Next folio &rarr;</p>
                  <p className="mt-2 truncate font-display text-lg text-accent-emphasis transition-colors duration-300 group-hover:text-[var(--color-aurum-pale)]">
                    {siblings.next.title}
                  </p>
                </Link>
              ) : (
                <div className="hidden sm:block" />
              )}
            </nav>
          ) : null}
        </article>

        <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          {fieldEntries.length > 0 ? (
            <ShowcasePanel title="Field Notes" toneColor={color} bodyClassName="space-y-3">
              <dl className="space-y-3">
                {fieldEntries.map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-[0.68rem] uppercase tracking-[0.18em] text-text-muted">{formatFieldLabel(key)}</dt>
                    <dd className="mt-1 break-words text-sm text-text-primary">
                      {Array.isArray(value) ? value.join(", ") : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </ShowcasePanel>
          ) : null}

          <ConnectionsSection relations={allRelations} color={color} />
          <FeaturedInStories stories={featuredInStories} color={color} />
        </aside>
      </div>
    </div>
  );
}
