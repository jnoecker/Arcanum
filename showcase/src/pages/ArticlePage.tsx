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
  const relations = article.relations.map((r) => ({
    ...r,
    target: articleById.get(r.targetId),
  }));

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

      {/* Article image */}
      {article.imageUrl && (
        <div className="mb-8 rounded-xl overflow-hidden shadow-[var(--shadow-image)] max-w-md mx-auto animate-fade-in-up">
          <img
            src={article.imageUrl}
            alt={article.title}
            className="w-full h-auto"
          />
        </div>
      )}

      {/* Header */}
      <div className="mb-10" style={{ borderLeft: `3px solid ${color}50`, paddingLeft: 20 }}>
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
                  className="flex-1 group rounded-lg border border-border-muted/40 p-4 hover:border-accent/30 transition-all duration-300 text-left"
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
                  className="flex-1 group rounded-lg border border-border-muted/40 p-4 hover:border-accent/30 transition-all duration-300 text-right"
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
            <div className="rounded-xl overflow-hidden" style={{ borderTop: `2px solid ${color}40` }}>
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

          {relations.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ borderTop: `2px solid ${color}40` }}>
              <div className="px-5 py-3 bg-bg-tertiary/40">
                <h3 className="font-display text-[11px] tracking-[0.2em] uppercase" style={{ color }}>
                  Connections
                </h3>
              </div>
              <div className="px-5 py-4 space-y-2.5 bg-bg-secondary/30">
                {relations.map((r) => (
                  <div key={`${r.targetId}:${r.type}`} className="flex items-baseline gap-2">
                    <span className="text-text-muted text-[10px] tracking-[0.1em] uppercase shrink-0">
                      {r.label ?? r.type}
                    </span>
                    {r.target ? (
                      <Link
                        to={`/articles/${encodeURIComponent(r.targetId)}`}
                        className="text-sm px-2 py-0.5 rounded-md bg-accent/6 text-text-link hover:bg-accent/14
                                   hover:text-accent transition-all duration-200 truncate"
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
