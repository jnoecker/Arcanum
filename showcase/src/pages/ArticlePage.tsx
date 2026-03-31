import { useParams, Link } from "react-router-dom";
import { useEffect, useMemo } from "react";
import DOMPurify from "dompurify";
import { useShowcase } from "@/lib/DataContext";
import { TEMPLATE_LABELS, TEMPLATE_COLORS } from "@/lib/templates";

export function ArticlePage() {
  const { id } = useParams<{ id: string }>();
  const { data, articleById } = useShowcase();

  const article = id ? articleById.get(decodeURIComponent(id)) : undefined;

  useEffect(() => {
    document.title = article ? `${article.title} — ${data?.meta.worldName ?? "World Lore"}` : "Not Found";
  }, [article, data?.meta.worldName]);

  // Prev/next within same template
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
      <div className="text-center py-20">
        <h1 className="font-display text-accent text-xl mb-2">Article Not Found</h1>
        <p className="text-text-muted text-sm mb-4">This entry has been lost to the ages.</p>
        <Link to="/articles" className="text-text-link text-sm hover:text-accent transition-colors">
          Return to the Codex
        </Link>
      </div>
    );
  }

  const color = TEMPLATE_COLORS[article.template];

  // Gather template-specific fields
  const fieldEntries = Object.entries(article.fields).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );

  // Resolve relations
  const relations = article.relations.map((r) => ({
    ...r,
    target: articleById.get(r.targetId),
  }));

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex items-center gap-2 text-xs text-text-muted">
          <li><Link to="/articles" className="hover:text-text-link transition-colors">Codex</Link></li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              to={`/articles?template=${article.template}`}
              className="hover:text-text-link transition-colors"
              style={{ color }}
            >
              {TEMPLATE_LABELS[article.template]}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-text-secondary truncate max-w-[200px]">{article.title}</li>
        </ol>
      </nav>

      {/* Hero image -- full bleed with gradient */}
      {article.imageUrl && (
        <div className="relative -mx-4 sm:-mx-6 mb-8 overflow-hidden rounded-xl">
          <img
            src={article.imageUrl}
            alt={article.title}
            className="w-full h-[280px] sm:h-[360px] object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-abyss via-bg-abyss/50 to-transparent" />
          <div className="absolute bottom-0 inset-x-0 p-5 sm:p-8">
            <div
              className="text-xs tracking-[0.14em] uppercase font-display mb-1.5"
              style={{ color }}
            >
              {TEMPLATE_LABELS[article.template]}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl text-accent-emphasis tracking-[0.06em] drop-shadow-lg">
              {article.title}
            </h1>
            {article.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {article.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-black/30 backdrop-blur-sm text-text-secondary text-xs px-2 py-0.5 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header without image */}
      {!article.imageUrl && (
        <div className="mb-8" style={{ borderLeft: `3px solid ${color}60`, paddingLeft: 16 }}>
          <div
            className="text-xs tracking-[0.14em] uppercase font-display mb-1"
            style={{ color }}
          >
            {TEMPLATE_LABELS[article.template]}
          </div>
          <h1 className="font-display text-3xl text-accent-emphasis tracking-[0.06em]">
            {article.title}
          </h1>
          {article.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-accent/10 text-accent-muted text-xs px-2 py-0.5 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main content */}
        <article className="flex-1 min-w-0">
          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.contentHtml) }}
          />

          {/* Prev / Next navigation */}
          {(siblings.prev || siblings.next) && (
            <nav className="flex items-stretch gap-4 mt-12 pt-8 border-t border-border-muted" aria-label="Adjacent articles">
              {siblings.prev ? (
                <Link
                  to={`/articles/${encodeURIComponent(siblings.prev.id)}`}
                  className="flex-1 group rounded-lg border border-border-muted p-3 hover:border-accent/40 transition-colors text-left"
                >
                  <div className="text-text-muted text-xs mb-1">&larr; Previous</div>
                  <div className="font-display text-sm text-text-primary group-hover:text-accent transition-colors truncate">
                    {siblings.prev.title}
                  </div>
                </Link>
              ) : <div className="flex-1" />}
              {siblings.next ? (
                <Link
                  to={`/articles/${encodeURIComponent(siblings.next.id)}`}
                  className="flex-1 group rounded-lg border border-border-muted p-3 hover:border-accent/40 transition-colors text-right"
                >
                  <div className="text-text-muted text-xs mb-1">Next &rarr;</div>
                  <div className="font-display text-sm text-text-primary group-hover:text-accent transition-colors truncate">
                    {siblings.next.title}
                  </div>
                </Link>
              ) : <div className="flex-1" />}
            </nav>
          )}
        </article>

        {/* Sidebar */}
        <aside className="lg:w-72 shrink-0 space-y-6">
          {/* Fields */}
          {fieldEntries.length > 0 && (
            <div
              className="border border-border-muted rounded-lg overflow-hidden"
              style={{ borderTopColor: `${color}50`, borderTopWidth: 2 }}
            >
              <div className="px-4 py-2.5 bg-bg-tertiary/60">
                <h3 className="font-display text-xs tracking-[0.18em] uppercase" style={{ color }}>
                  Details
                </h3>
              </div>
              <dl className="px-4 py-3 space-y-2.5">
                {fieldEntries.map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-text-muted text-xs capitalize">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </dt>
                    <dd className="text-text-primary text-sm">
                      {Array.isArray(value) ? value.join(", ") : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Relations as colored chips */}
          {relations.length > 0 && (
            <div
              className="border border-border-muted rounded-lg overflow-hidden"
              style={{ borderTopColor: `${color}50`, borderTopWidth: 2 }}
            >
              <div className="px-4 py-2.5 bg-bg-tertiary/60">
                <h3 className="font-display text-xs tracking-[0.18em] uppercase" style={{ color }}>
                  Connections
                </h3>
              </div>
              <div className="px-4 py-3 space-y-2">
                {relations.map((r) => (
                  <div key={`${r.targetId}:${r.type}`} className="flex items-baseline gap-2">
                    <span className="text-text-muted text-[10px] tracking-[0.1em] uppercase shrink-0">
                      {r.label ?? r.type}
                    </span>
                    {r.target ? (
                      <Link
                        to={`/articles/${encodeURIComponent(r.targetId)}`}
                        className="text-sm px-2 py-0.5 rounded bg-accent/8 text-text-link hover:bg-accent/15
                                   hover:text-accent transition-colors truncate"
                      >
                        {r.target.title}
                      </Link>
                    ) : (
                      <span className="text-text-muted text-sm italic truncate">{r.targetId}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
