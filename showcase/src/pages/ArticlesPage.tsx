import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ShowcaseEmptyState, showcaseButtonClassNames } from "@/components/ShowcasePrimitives";
import { useShowcase } from "@/lib/DataContext";
import { TEMPLATE_COLORS, TEMPLATE_LABELS } from "@/lib/templates";
import type { ArticleTemplate, ShowcaseArticle } from "@/types/showcase";

type ViewMode = "grid" | "list";

export function ArticlesPage() {
  const { data } = useShowcase();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("list");

  useEffect(() => {
    document.title = `Codex - ${data?.meta.worldName ?? "World Lore"}`;
  }, [data?.meta.worldName]);

  const articles = data?.articles ?? [];
  const activeTemplate = (searchParams.get("template") as ArticleTemplate | null) ?? null;

  const templates = useMemo(() => {
    const set = new Set<ArticleTemplate>();
    for (const article of articles) {
      if (article.template !== "world_setting") {
        set.add(article.template);
      }
    }
    return [...set].sort((a, b) => TEMPLATE_LABELS[a].localeCompare(TEMPLATE_LABELS[b]));
  }, [articles]);

  const grouped = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = articles.filter((article) => article.template !== "world_setting");

    if (activeTemplate) {
      list = list.filter((article) => article.template === activeTemplate);
    }

    if (query) {
      list = list.filter(
        (article) =>
          article.title.toLowerCase().includes(query) ||
          article.tags.some((tag) => tag.toLowerCase().includes(query)),
      );
    }

    const byTemplate = new Map<ArticleTemplate, ShowcaseArticle[]>();
    for (const article of list) {
      const bucket = byTemplate.get(article.template) ?? [];
      bucket.push(article);
      byTemplate.set(article.template, bucket);
    }

    for (const bucket of byTemplate.values()) {
      bucket.sort((a, b) => a.title.localeCompare(b.title));
    }

    return [...byTemplate.entries()].sort((a, b) =>
      TEMPLATE_LABELS[a[0]].localeCompare(TEMPLATE_LABELS[b[0]]),
    );
  }, [activeTemplate, articles, search]);

  if (!data) {
    return null;
  }

  const clearFilters = () => {
    setSearch("");
    setSearchParams({});
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[1.5rem] border border-border-muted/35 bg-[linear-gradient(180deg,rgba(18,18,28,0.9),rgba(10,11,18,0.97))] px-5 py-4 shadow-[var(--shadow-deep)] sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search the codex…"
            aria-label="Search articles"
            className="min-h-11 w-full rounded-2xl border border-border-muted/50 bg-bg-abyss/80 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted/70 focus:outline-none focus-visible:border-[var(--color-aurum)]/35 focus-visible:ring-2 focus-visible:ring-[var(--color-aurum)]/35 lg:max-w-sm"
          />

          <div className="flex flex-1 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchParams({})}
              aria-pressed={!activeTemplate}
              className="showcase-pill"
              data-active={!activeTemplate}
            >
              All
            </button>
            {templates.map((template) => (
              <button
                key={template}
                type="button"
                onClick={() => setSearchParams({ template })}
                aria-pressed={activeTemplate === template}
                className="showcase-pill"
                data-active={activeTemplate === template}
              >
                {TEMPLATE_LABELS[template]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-full border border-border-muted/40 bg-bg-secondary/50 p-1">
            <button
              type="button"
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.18em] transition-colors duration-200 ${
                view === "list"
                  ? "bg-[var(--color-aurum)]/15 text-[var(--color-aurum-pale)]"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
              className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.18em] transition-colors duration-200 ${
                view === "grid"
                  ? "bg-[var(--color-aurum)]/15 text-[var(--color-aurum-pale)]"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              Grid
            </button>
          </div>

          {(activeTemplate || search.trim()) && (
            <button type="button" onClick={clearFilters} className={showcaseButtonClassNames.quiet}>
              Reset
            </button>
          )}
        </div>
      </section>

      <div className="space-y-8">
        {grouped.length === 0 ? (
          <ShowcaseEmptyState
            title={
              search.trim() || activeTemplate
                ? "Nothing answers the present inquiry"
                : "The archive stands empty"
            }
            description={
              search.trim() || activeTemplate
                ? "No entry matches the selected shelf or search phrase. Widen the query or return to the full archive."
                : "No public codex entries have been published yet."
            }
            actions={
              search.trim() || activeTemplate ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className={showcaseButtonClassNames.secondary}
                >
                  Reset the archive
                </button>
              ) : undefined
            }
          />
        ) : (
          grouped.map(([template, items]) => {
            const tone = TEMPLATE_COLORS[template];
            return (
              <section
                key={template}
                className="rounded-[1.5rem] border border-border-muted/35 bg-[linear-gradient(180deg,rgba(19,20,30,0.76),rgba(12,12,20,0.94))] px-5 py-5 shadow-[var(--shadow-deep)] sm:px-6"
              >
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border-muted/25 pb-4">
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-[0.32em]" style={{ color: tone }}>
                      {activeTemplate ? "Selected shelf" : "Archive shelf"}
                    </p>
                    <h2 className="mt-2 font-display text-2xl text-accent-emphasis">
                      {TEMPLATE_LABELS[template]}
                    </h2>
                  </div>
                  <p className="text-sm text-text-muted">
                    {new Intl.NumberFormat().format(items.length)} entr
                    {items.length === 1 ? "y" : "ies"}
                  </p>
                </div>

                {view === "list" ? (
                  <div className="mt-4 divide-y divide-border-muted/15">
                    {items.map((article) => (
                      <Link
                        key={article.id}
                        to={`/articles/${encodeURIComponent(article.id)}`}
                        className="group grid gap-4 px-1 py-4 transition-colors duration-300 hover:bg-white/[0.015] sm:grid-cols-[minmax(0,1fr)_auto]"
                      >
                        <div className="flex min-w-0 items-start gap-4">
                          <div className="mt-1 h-10 w-1 shrink-0 rounded-full" style={{ backgroundColor: tone }} />
                          {article.imageUrl ? (
                            <img
                              src={article.imageUrl}
                              alt=""
                              loading="lazy"
                              className="hidden h-16 w-16 shrink-0 rounded-2xl object-cover sm:block"
                            />
                          ) : null}
                          <div className="min-w-0">
                            <h3 className="break-words font-display text-xl text-accent-emphasis transition-colors duration-300 group-hover:text-[var(--color-aurum-pale)]">
                              {article.title}
                            </h3>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {article.tags.slice(0, 4).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full border bg-white/[0.03] px-3 py-1 text-[0.72rem] tracking-[0.14em]"
                                  style={{ borderColor: tone, color: tone }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-4 sm:justify-end">
                          <span className="text-[0.72rem] uppercase tracking-[0.24em] text-text-muted">
                            {TEMPLATE_LABELS[article.template]}
                          </span>
                          <span className="text-sm text-[var(--color-aurum)] transition-transform duration-300 group-hover:translate-x-1">
                            Read entry
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {items.map((article) => (
                      <Link
                        key={article.id}
                        to={`/articles/${encodeURIComponent(article.id)}`}
                        className="group overflow-hidden rounded-[1.35rem] border border-border-muted/25 bg-bg-secondary/55 transition-transform duration-500 hover:-translate-y-1 hover:border-[var(--color-aurum)]/25"
                      >
                        {article.imageUrl ? (
                          <div className="aspect-[4/3] overflow-hidden bg-bg-tertiary/40">
                            <img
                              src={article.imageUrl}
                              alt={article.title}
                              loading="lazy"
                              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                            />
                          </div>
                        ) : (
                          <div
                            className="aspect-[4/3] bg-[linear-gradient(135deg,rgba(214,177,90,0.14),transparent_55%),linear-gradient(160deg,rgba(31,32,47,0.96),rgba(12,12,19,0.88))]"
                            aria-hidden="true"
                          />
                        )}
                        <div className="space-y-3 px-5 py-5">
                          <p className="text-[0.65rem] uppercase tracking-[0.28em]" style={{ color: tone }}>
                            {TEMPLATE_LABELS[article.template]}
                          </p>
                          <h3 className="line-clamp-3 break-words font-display text-xl text-accent-emphasis transition-colors duration-300 group-hover:text-[var(--color-aurum-pale)]">
                            {article.title}
                          </h3>
                          {article.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {article.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full border bg-white/[0.03] px-3 py-1 text-[0.72rem]"
                                  style={{ borderColor: tone, color: tone }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-text-muted">No public tags recorded for this entry.</p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
