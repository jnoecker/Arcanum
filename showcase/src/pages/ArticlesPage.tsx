import { Link, useSearchParams } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { useShowcase } from "@/lib/DataContext";
import { TEMPLATE_LABELS, TEMPLATE_COLORS } from "@/lib/templates";
import type { ArticleTemplate, ShowcaseArticle } from "@/types/showcase";

type ViewMode = "grid" | "list";

export function ArticlesPage() {
  const { data } = useShowcase();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("grid");

  useEffect(() => {
    document.title = `Codex — ${data?.meta.worldName ?? "World Lore"}`;
  }, [data?.meta.worldName]);

  if (!data) return null;

  const activeTemplate = searchParams.get("template") as ArticleTemplate | null;

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = data.articles.filter((a) => a.template !== "world_setting");
    if (activeTemplate) list = list.filter((a) => a.template === activeTemplate);
    if (q) {
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    const map = new Map<ArticleTemplate, ShowcaseArticle[]>();
    for (const a of list) {
      const arr = map.get(a.template) ?? [];
      arr.push(a);
      map.set(a.template, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.title.localeCompare(b.title));
    return [...map.entries()].sort((a, b) => TEMPLATE_LABELS[a[0]].localeCompare(TEMPLATE_LABELS[b[0]]));
  }, [data.articles, activeTemplate, search]);

  const totalCount = grouped.reduce((sum, [, arr]) => sum + arr.length, 0);

  const templates = useMemo(() => {
    const set = new Set<ArticleTemplate>();
    for (const a of data.articles) {
      if (a.template !== "world_setting") set.add(a.template);
    }
    return [...set].sort((a, b) => TEMPLATE_LABELS[a].localeCompare(TEMPLATE_LABELS[b]));
  }, [data.articles]);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-8">
        <h1 className="font-display text-accent text-2xl tracking-[0.18em]">Codex</h1>
        <span className="text-text-muted text-xs tracking-wide">
          {totalCount} entr{totalCount !== 1 ? "ies" : "y"}
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-10">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search articles..."
          className="bg-bg-secondary/60 border border-border-muted/60 rounded-lg px-3 py-2 text-sm
                     text-text-primary placeholder:text-text-muted/70
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:border-accent/40
                     transition-colors duration-300 w-full sm:w-64"
        />
        <button
          onClick={() => setSearchParams({})}
          aria-pressed={!activeTemplate}
          className={`px-3 py-1.5 text-[11px] tracking-[0.14em] uppercase rounded-md border transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-accent/40 ${
            !activeTemplate
              ? "border-accent/40 text-accent bg-accent/8"
              : "border-border-muted/50 text-text-muted hover:text-text-secondary hover:border-border-muted"
          }`}
        >
          All
        </button>
        {templates.map((t) => (
          <button
            key={t}
            onClick={() => setSearchParams({ template: t })}
            aria-pressed={activeTemplate === t}
            className={`px-3 py-1.5 text-[11px] tracking-[0.14em] uppercase rounded-md border transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-accent/40 ${
              activeTemplate === t
                ? "border-accent/40 text-accent bg-accent/8"
                : "border-border-muted/50 text-text-muted hover:text-text-secondary hover:border-border-muted"
            }`}
          >
            {TEMPLATE_LABELS[t]}
          </button>
        ))}

        <div className="ml-auto flex gap-0.5 border border-border-muted/50 rounded-md overflow-hidden">
          <button
            onClick={() => setView("grid")}
            aria-pressed={view === "grid"}
            aria-label="Grid view"
            className={`px-2.5 py-1.5 text-xs transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/40 ${
              view === "grid" ? "bg-accent/12 text-accent" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="0" y="0" width="6" height="6" rx="1" />
              <rect x="8" y="0" width="6" height="6" rx="1" />
              <rect x="0" y="8" width="6" height="6" rx="1" />
              <rect x="8" y="8" width="6" height="6" rx="1" />
            </svg>
          </button>
          <button
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            aria-label="List view"
            className={`px-2.5 py-1.5 text-xs transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/40 ${
              view === "list" ? "bg-accent/12 text-accent" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="0" y="1" width="14" height="2.5" rx="1" />
              <rect x="0" y="5.75" width="14" height="2.5" rx="1" />
              <rect x="0" y="10.5" width="14" height="2.5" rx="1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      {grouped.length === 0 ? (
        <p className="text-text-muted text-center py-16">No articles match your filters.</p>
      ) : (
        <div className="space-y-14">
          {grouped.map(([template, articles]) => {
            const color = TEMPLATE_COLORS[template];
            return (
              <section key={template}>
                {!activeTemplate && (
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-0.5 h-5 rounded-full" style={{ backgroundColor: color }} />
                    <h2 className="font-display text-[13px] tracking-[0.2em] uppercase" style={{ color }}>
                      {TEMPLATE_LABELS[template]}
                    </h2>
                    <span className="text-text-muted text-xs">{articles.length}</span>
                    <div className="flex-1 h-px bg-border-muted/30" />
                  </div>
                )}

                {view === "grid" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
                    {articles.map((a) => (
                      <Link
                        key={a.id}
                        to={`/articles/${encodeURIComponent(a.id)}`}
                        className="group overflow-hidden rounded-lg transition-colors duration-300
                                   hover:bg-bg-hover/30 focus-visible:ring-2 focus-visible:ring-accent/40"
                        style={{ borderTop: `2px solid ${color}30` }}
                      >
                        {a.imageUrl && (
                          <div className="aspect-square overflow-hidden bg-bg-tertiary/30">
                            <img
                              src={a.imageUrl}
                              alt={a.title}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out"
                            />
                          </div>
                        )}
                        <div className="px-4 py-3 bg-bg-secondary/40">
                          <span
                            className="text-[9px] tracking-[0.14em] uppercase font-display"
                            style={{ color }}
                          >
                            {TEMPLATE_LABELS[a.template]}
                          </span>
                          <h3 className="font-display text-accent-emphasis text-[15px] group-hover:text-accent transition-colors duration-300 mt-0.5">
                            {a.title}
                          </h3>
                          {a.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {a.tags.slice(0, 4).map((tag) => (
                                <span
                                  key={tag}
                                  className="bg-accent/6 text-accent text-[10px] px-2 py-0.5 rounded-md"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {articles.map((a) => (
                      <Link
                        key={a.id}
                        to={`/articles/${encodeURIComponent(a.id)}`}
                        className="group flex items-center gap-3 px-4 py-2.5 rounded-lg
                                   hover:bg-bg-hover/40 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/40"
                        style={{ borderTop: `2px solid ${color}30` }}
                      >
                        <div className="w-1 h-4 rounded-full shrink-0 opacity-60" style={{ backgroundColor: color }} />
                        {a.imageUrl && (
                          <img src={a.imageUrl} alt="" loading="lazy" className="w-9 h-9 rounded-md object-cover shrink-0" />
                        )}
                        <span className="text-text-primary text-sm group-hover:text-accent transition-colors duration-200 truncate">
                          {a.title}
                        </span>
                        {a.tags.length > 0 && (
                          <span className="hidden sm:inline text-text-muted text-xs truncate ml-auto">
                            {a.tags.slice(0, 2).join(", ")}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
