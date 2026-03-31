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

  // Group articles by template
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
    // Sort articles within each group
    for (const arr of map.values()) arr.sort((a, b) => a.title.localeCompare(b.title));
    // Sort groups by label
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
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h1 className="font-display text-accent text-2xl tracking-[0.18em]">Codex</h1>
        <span className="text-text-muted text-xs">
          {totalCount} entr{totalCount !== 1 ? "ies" : "y"}
        </span>
      </div>

      {/* Toolbar: search + filters + view toggle */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search articles..."
          className="bg-bg-tertiary/60 border border-border-muted rounded-md px-3 py-1.5 text-sm
                     text-text-primary placeholder:text-text-muted
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:border-accent/60
                     w-full sm:w-64"
        />
        <button
          onClick={() => setSearchParams({})}
          aria-pressed={!activeTemplate}
          className={`px-2.5 py-1 text-xs tracking-[0.12em] uppercase rounded-md border transition-colors ${
            !activeTemplate
              ? "border-accent/50 text-accent bg-accent/10"
              : "border-border-muted text-text-muted hover:text-text-secondary"
          }`}
        >
          All
        </button>
        {templates.map((t) => (
          <button
            key={t}
            onClick={() => setSearchParams({ template: t })}
            aria-pressed={activeTemplate === t}
            className={`px-2.5 py-1 text-xs tracking-[0.12em] uppercase rounded-md border transition-colors ${
              activeTemplate === t
                ? "border-accent/50 text-accent bg-accent/10"
                : "border-border-muted text-text-muted hover:text-text-secondary"
            }`}
          >
            {TEMPLATE_LABELS[t]}
          </button>
        ))}

        {/* View toggle */}
        <div className="ml-auto flex gap-1 border border-border-muted rounded-md overflow-hidden">
          <button
            onClick={() => setView("grid")}
            aria-pressed={view === "grid"}
            aria-label="Grid view"
            className={`px-2 py-1 text-xs transition-colors ${
              view === "grid" ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text-secondary"
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
            className={`px-2 py-1 text-xs transition-colors ${
              view === "list" ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text-secondary"
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

      {/* Content: grouped by template */}
      {grouped.length === 0 ? (
        <p className="text-text-muted text-center py-12">No articles match your filters.</p>
      ) : (
        <div className="space-y-10">
          {grouped.map(([template, articles]) => {
            const color = TEMPLATE_COLORS[template];
            return (
              <section key={template}>
                {/* Section header -- only show when not filtered to single template */}
                {!activeTemplate && (
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-1 h-5 rounded-full" style={{ backgroundColor: color }} />
                    <h2 className="font-display text-sm tracking-[0.16em] uppercase" style={{ color }}>
                      {TEMPLATE_LABELS[template]}
                    </h2>
                    <span className="text-text-muted text-xs">{articles.length}</span>
                    <div className="flex-1 h-px bg-border-muted" />
                  </div>
                )}

                {view === "grid" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {articles.map((a) => (
                      <Link
                        key={a.id}
                        to={`/articles/${encodeURIComponent(a.id)}`}
                        className="group bg-bg-secondary/80 border border-border-muted rounded-lg overflow-hidden
                                   hover:border-accent/40 transition-all hover:shadow-[var(--glow-aurum)]"
                        style={{ borderLeftColor: `${color}60`, borderLeftWidth: 3 }}
                      >
                        {a.imageUrl && (
                          <div className="aspect-[16/10] overflow-hidden bg-bg-tertiary/40">
                            <img
                              src={a.imageUrl}
                              alt={a.title}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          </div>
                        )}
                        <div className="p-3">
                          <h3 className="font-display text-accent-emphasis text-sm">{a.title}</h3>
                          {a.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {a.tags.slice(0, 4).map((tag) => (
                                <span
                                  key={tag}
                                  className="bg-accent/10 text-accent text-[10px] px-1.5 py-0.5 rounded"
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
                  /* List view */
                  <div className="space-y-1">
                    {articles.map((a) => (
                      <Link
                        key={a.id}
                        to={`/articles/${encodeURIComponent(a.id)}`}
                        className="group flex items-center gap-3 px-3 py-2 rounded-md
                                   hover:bg-bg-hover/50 transition-colors"
                      >
                        <div className="w-1 h-4 rounded-full shrink-0" style={{ backgroundColor: `${color}80` }} />
                        {a.imageUrl && (
                          <img
                            src={a.imageUrl}
                            alt=""
                            loading="lazy"
                            className="w-8 h-8 rounded object-cover shrink-0"
                          />
                        )}
                        <span className="text-text-primary text-sm group-hover:text-accent transition-colors truncate">
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
