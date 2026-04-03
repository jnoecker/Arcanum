import { useParams, Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { useShowcase } from "@/lib/DataContext";
import { TEMPLATE_LABELS, TEMPLATE_COLORS } from "@/lib/templates";
import type { ShowcaseArticle } from "@/types/showcase";

const RELATION_TYPE_LABELS: Record<string, string> = {
  ally: "Allies",
  rival: "Rivals",
  member_of: "Member of",
  located_in: "Located in",
  related: "Related",
  mentioned: "Mentioned",
};

/** Order in which relation groups appear in the sidebar */
const RELATION_TYPE_ORDER = ["ally", "rival", "member_of", "located_in", "related", "mentioned"];

const MENTIONED_LIMIT = 5;

interface ResolvedRelation {
  targetId: string;
  type: string;
  label?: string;
  target?: ShowcaseArticle;
  /** For reverse relations, the title of the article that references this one */
  sourceTitle?: string;
  reverse?: boolean;
}

function ConnectionsSection({
  relations,
  color,
}: {
  relations: ResolvedRelation[];
  color: string;
}) {
  const [mentionedExpanded, setMentionedExpanded] = useState(false);

  // Group relations by type
  const grouped = useMemo(() => {
    const map = new Map<string, ResolvedRelation[]>();
    for (const r of relations) {
      const key = r.type;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  }, [relations]);

  // Sort groups by defined order, unknown types go last
  const sortedGroups = useMemo(() => {
    const entries = [...grouped.entries()];
    entries.sort((a, b) => {
      const ai = RELATION_TYPE_ORDER.indexOf(a[0]);
      const bi = RELATION_TYPE_ORDER.indexOf(b[0]);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
    return entries;
  }, [grouped]);

  if (relations.length === 0) return null;

  return (
    <div className="rounded-xl overflow-hidden border-t-2 border-accent/25">
      <div className="px-5 py-3 bg-bg-tertiary/40">
        <h3 className="font-display text-[11px] tracking-[0.2em] uppercase" style={{ color }}>
          Connections
        </h3>
      </div>
      <div className="px-5 py-4 space-y-4 bg-bg-secondary/30">
        {sortedGroups.map(([type, items]) => {
          const isMentioned = type === "mentioned";
          const displayItems =
            isMentioned && !mentionedExpanded ? items.slice(0, MENTIONED_LIMIT) : items;
          const hiddenCount = items.length - MENTIONED_LIMIT;

          return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-text-muted text-[10px] tracking-[0.15em] uppercase font-display">
                  {RELATION_TYPE_LABELS[type] ?? type}
                </span>
                <span className="text-text-muted/50 text-[10px]">({items.length})</span>
              </div>
              <div className="space-y-1.5">
                {displayItems.map((r) => (
                  <RelationLink key={`${r.targetId}:${r.type}:${r.reverse ? "rev" : "fwd"}`} relation={r} />
                ))}
              </div>
              {isMentioned && hiddenCount > 0 && !mentionedExpanded && (
                <button
                  onClick={() => setMentionedExpanded(true)}
                  className="mt-1.5 text-[11px] text-text-link hover:text-accent transition-colors duration-200"
                >
                  and {hiddenCount} more...
                </button>
              )}
              {isMentioned && mentionedExpanded && items.length > MENTIONED_LIMIT && (
                <button
                  onClick={() => setMentionedExpanded(false)}
                  className="mt-1.5 text-[11px] text-text-link hover:text-accent transition-colors duration-200"
                >
                  show less
                </button>
              )}
            </div>
          );
        })}

        <Link
          to="/graph"
          className="mt-3 block text-center text-[11px] text-text-link hover:text-accent transition-colors duration-200"
        >
          See all connections &rarr;
        </Link>
      </div>
    </div>
  );
}

function RelationLink({ relation }: { relation: ResolvedRelation }) {
  const title = relation.target?.title ?? relation.sourceTitle ?? relation.targetId;
  const imageUrl = relation.target?.imageUrl;

  return (
    <div className="flex items-center gap-2">
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="w-8 h-8 rounded-md object-cover shrink-0"
          loading="lazy"
        />
      )}
      {relation.target ? (
        <Link
          to={`/articles/${encodeURIComponent(relation.targetId)}`}
          className="text-sm px-2 py-0.5 rounded-md bg-accent/6 text-text-link hover:bg-accent/14
                     hover:text-accent transition-colors duration-200 truncate min-w-0"
        >
          {title}
        </Link>
      ) : (
        <span className="text-text-muted text-sm italic truncate min-w-0">{title}</span>
      )}
      {relation.reverse && (
        <span className="text-text-muted/40 text-[9px] italic shrink-0">&larr;</span>
      )}
    </div>
  );
}

function ArticleGallery({ images, title }: { images: string[]; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="mb-8 animate-fade-in-up">
      {/* Main image */}
      <div className="relative max-w-md mx-auto rounded-xl overflow-hidden shadow-[var(--shadow-image)]">
        {images.map((src, i) => (
          <img
            key={`${src}-${i}`}
            src={src}
            alt={i === 0 ? title : `${title} — gallery ${i}`}
            className={`w-full h-auto transition-opacity duration-300 ${
              i === activeIndex ? "opacity-100" : "opacity-0 absolute inset-0"
            }`}
          />
        ))}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {images.map((src, i) => (
            <button
              key={`${src}-${i}`}
              onClick={() => setActiveIndex(i)}
              aria-label={i === 0 ? "Primary image" : `Gallery image ${i}`}
              aria-current={i === activeIndex ? "true" : undefined}
              className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 transition-[border-color,opacity,transform,box-shadow] duration-200 ${
                i === activeIndex
                  ? "border-accent/70 scale-105 shadow-[0_0_12px_rgba(168,151,210,0.25)]"
                  : "border-white/10 opacity-60 hover:opacity-90 hover:border-white/25"
              }`}
            >
              <img
                src={src}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ArticlePage() {
  const { id } = useParams<{ id: string }>();
  const { data, articleById } = useShowcase();

  const article = id ? articleById.get(decodeURIComponent(id)) : undefined;

  useEffect(() => {
    document.title = article ? `${article.title} — ${data?.meta.worldName ?? "World Lore"}` : "Not Found";
  }, [article, data?.meta.worldName]);

  const siblings = useMemo(() => {
    if (!article || !data) return { prev: undefined, next: undefined };
    const sameType = data.articles
      .filter((a) => a.template === article.template)
      .sort((a, b) => a.title.localeCompare(b.title));
    const idx = sameType.findIndex((a) => a.id === article.id);
    return {
      prev: idx > 0 ? sameType[idx - 1] : undefined,
      next: idx < sameType.length - 1 ? sameType[idx + 1] : undefined,
    };
  }, [article, data]);

  if (!article) {
    return (
      <div className="text-center py-24">
        <h1 className="font-display text-accent text-2xl mb-3">Article Not Found</h1>
        <p className="text-text-muted mb-6">This entry has been lost to the ages.</p>
        <Link to="/articles" className="text-text-link text-sm hover:text-accent transition-colors duration-300">
          Return to the Codex
        </Link>
      </div>
    );
  }

  const color = TEMPLATE_COLORS[article.template];
  const fieldEntries = Object.entries(article.fields).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  // Forward relations: this article → targets
  const forwardRelations: ResolvedRelation[] = article.relations.map((r) => ({
    ...r,
    target: articleById.get(r.targetId),
    reverse: false,
  }));

  // Reverse relations: other articles → this article
  const reverseRelations = useMemo(() => {
    if (!data) return [];
    return data.articles
      .filter((a) => a.id !== article.id && a.relations.some((r) => r.targetId === article.id))
      .flatMap((a) =>
        a.relations
          .filter((r) => r.targetId === article.id)
          .map((r) => ({
            ...r,
            targetId: a.id,
            sourceTitle: a.title,
            target: articleById.get(a.id),
            reverse: true,
          }))
      );
  }, [data, article.id, articleById]);

  // Merge forward and reverse, deduplicating by targetId+type
  const allRelations = useMemo(() => {
    const seen = new Set<string>();
    const result: ResolvedRelation[] = [];
    for (const r of forwardRelations) {
      const key = `${r.targetId}:${r.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(r);
      }
    }
    for (const r of reverseRelations) {
      const key = `${r.targetId}:${r.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(r);
      }
    }
    return result;
  }, [forwardRelations, reverseRelations]);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-8">
        <ol className="flex items-center gap-2 text-xs text-text-muted">
          <li><Link to="/articles" className="hover:text-text-link transition-colors duration-200">Codex</Link></li>
          <li aria-hidden="true" className="opacity-40">/</li>
          <li>
            <Link
              to={`/articles?template=${article.template}`}
              className="hover:text-text-link transition-colors duration-200"
              style={{ color }}
            >
              {TEMPLATE_LABELS[article.template]}
            </Link>
          </li>
          <li aria-hidden="true" className="opacity-40">/</li>
          <li aria-current="page" className="text-text-secondary truncate max-w-[200px]">{article.title}</li>
        </ol>
      </nav>

      {/* Article image / gallery */}
      {(() => {
        const allImages = [
          article.imageUrl,
          ...(article.galleryUrls ?? []),
        ].filter((u): u is string => !!u);
        if (allImages.length === 0) return null;
        return <ArticleGallery images={allImages} title={article.title} />;
      })()}

      {/* Header */}
      <div className="mb-10 pl-5">
        <div
          className="text-[11px] tracking-[0.18em] uppercase font-display mb-2"
          style={{ color }}
        >
          {TEMPLATE_LABELS[article.template]}
        </div>
        <h1 className="font-display text-3xl sm:text-4xl text-accent-emphasis tracking-[0.04em] leading-tight">
          {article.title}
        </h1>
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="bg-accent/8 text-accent-muted text-xs px-2.5 py-1 rounded-md"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-10">
        {/* Main content */}
        <article className="flex-1 min-w-0">
          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.contentHtml) }}
          />

          {/* Prev / Next */}
          {(siblings.prev || siblings.next) && (
            <nav className="flex items-stretch gap-4 mt-14 pt-10 border-t border-border-muted/40" aria-label="Adjacent articles">
              {siblings.prev ? (
                <Link
                  to={`/articles/${encodeURIComponent(siblings.prev.id)}`}
                  className="flex-1 group rounded-lg border border-border-muted/40 p-4 hover:border-accent/30 transition-colors duration-300 text-left"
                >
                  <div className="text-text-muted text-[11px] tracking-[0.1em] uppercase mb-1.5">&larr; Previous</div>
                  <div className="font-display text-sm text-text-primary group-hover:text-accent transition-colors duration-300 truncate">
                    {siblings.prev.title}
                  </div>
                </Link>
              ) : <div className="flex-1" />}
              {siblings.next ? (
                <Link
                  to={`/articles/${encodeURIComponent(siblings.next.id)}`}
                  className="flex-1 group rounded-lg border border-border-muted/40 p-4 hover:border-accent/30 transition-colors duration-300 text-right"
                >
                  <div className="text-text-muted text-[11px] tracking-[0.1em] uppercase mb-1.5">Next &rarr;</div>
                  <div className="font-display text-sm text-text-primary group-hover:text-accent transition-colors duration-300 truncate">
                    {siblings.next.title}
                  </div>
                </Link>
              ) : <div className="flex-1" />}
            </nav>
          )}
        </article>

        {/* Sidebar */}
        <aside className="lg:w-72 shrink-0 space-y-6">
          {fieldEntries.length > 0 && (
            <div className="rounded-xl overflow-hidden border-t-2 border-accent/25">
              <div className="px-5 py-3 bg-bg-tertiary/40">
                <h3 className="font-display text-[11px] tracking-[0.2em] uppercase" style={{ color }}>
                  Details
                </h3>
              </div>
              <dl className="px-5 py-4 space-y-3 bg-bg-secondary/30">
                {fieldEntries.map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-text-muted text-[11px] capitalize tracking-wide">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </dt>
                    <dd className="text-text-primary text-sm mt-0.5">
                      {Array.isArray(value) ? value.join(", ") : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <ConnectionsSection relations={allRelations} color={color} />
        </aside>
      </div>
    </div>
  );
}
