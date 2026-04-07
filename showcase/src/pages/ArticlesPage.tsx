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

    return [...byTemplate.entries()].sort((a, b) => TEMPLATE_LABELS[a[0]].localeCompare(TEMPLATE_LABELS[b[0]]));
  }, [activeTemplate, articles, search]);

  const totalCount = grouped.reduce((sum, [, group]) => sum + group.length, 0);
  const totalCountLabel = useMemo(() => new Intl.NumberFormat().format(totalCount), [totalCount]);
  const routeCountLabel = useMemo(
    () => new Intl.NumberFormat().format(articles.filter((article) => article.template !== "world_setting").length),
    [articles],
  );

  if (!data) {
    return null;
  }

  const clearFilters = () => {
    setSearch("");
    setSearchParams({});
  };

  return (
    <div className="space-y-10">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.9fr)]">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-[var(--color-aurum)]/25 bg-[radial-gradient(circle_at_top_left,rgba(214,177,90,0.16),transparent_45%),linear-gradient(160deg,rgba(18,18,28,0.98),rgba(9,10,18,0.92))] px-6 py-7 shadow-[var(--shadow-deep)] sm:px-8">
          <p className="text-[0.68rem] uppercase tracking-[0.38em] text-[var(--color-aurum)]/80">Archive wing</p>
          <h1 className="mt-3 max-w-3xl font-display text-3xl leading-tight text-[var(--color-aurum-pale)] sm:text-4xl">
            A reading room for names, houses, relics, and disputed histories.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-text-secondary sm:text-[0.95rem]">
            The codex no longer opens as a generic grid. Each shelf is ordered by kind, with a quieter control rail for
            readers who already know what they seek.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <div className="rounded-[1.5rem] border border-[var(--color-aurum)]/18 bg-bg-secondary/70 px-5 py-5">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-text-muted">Holdings</p>
            <p className="mt-3 font-display text-3xl text-[var(--color-aurum-pale)]">{routeCountLabel}</p>
            <p className="mt-2 text-sm text-text-secondary">Published entries currently indexed in the public archive.</p>
          </div>
          <div className="rounded-[1.5rem] border border-border-muted/40 bg-bg-secondary/55 px-5 py-5">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-text-muted">Shelves</p>
            <p className="mt-3 font-display text-3xl text-accent-emphasis">{templates.length}</p>
            <p className="mt-2 text-sm text-text-secondary">Distinct article families arranged by template and role.</p>
          </div>
          <div className="rounded-[1.5rem] border border-border-muted/40 bg-bg-secondary/55 px-5 py-5">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-text-muted">Selected</p>
            <p className="mt-3 font-display text-2xl text-accent-emphasis">
              {activeTemplate ? TEMPLATE_LABELS[activeTemplate] : "All entries"}
            </p>
            <p className="mt-2 text-sm text-text-secondary">Switch shelves or narrow the room to a single lineage.</p>
          </div>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-[1.5rem] border border-border-muted/45 bg-[linear-gradient(180deg,rgba(17,18,28,0.92),rgba(10,11,18,0.98))] px-5 py-5 shadow-[var(--shadow-deep)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.3em] text-text-muted">Reading rail</p>
                <h2 className="mt-2 font-display text-xl text-accent-emphasis">Guide the archive</h2>
              </div>
              <span className="rounded-full border border-[var(--color-aurum)]/30 px-3 py-1 text-[0.65rem] uppercase tracking-[0.24em] text-[var(--color-aurum)]/85">
                {totalCountLabel} shown
              </span>
            </div>

            <label className="mt-5 block">
              <span className="text-[0.68rem] uppercase tracking-[0.26em] text-text-muted">Search titles and tags</span>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Seek a person, place, or rite"
                aria-label="Search articles"
                className="mt-2 min-h-12 w-full rounded-2xl border border-border-muted/50 bg-bg-abyss/80 px-4 py-3 text-sm text-text-primary placeholder:text-text-muted/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-aurum)]/35 focus-visible:border-[var(--color-aurum)]/35"
              />
            </label>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[0.68rem] uppercase tracking-[0.26em] text-text-muted">Shelves</span>
                {(activeTemplate || search.trim()) && (
                  <button type="button" onClick={clearFilters} className={showcaseButtonClassNames.quiet}>
                    Reset
                  </button>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 xl:flex-col">
                <button
                  type="button"
                  onClick={() => setSearchParams({})}
                  aria-pressed={!activeTemplate}
                  className="showcase-pill justify-start"
                  data-active={!activeTemplate}
                >
                  All shelves
                </button>
                {templates.map((template) => (
                  <button
                    key={template}
                    type="button"
                    onClick={() => setSearchParams({ template })}
                    aria-pressed={activeTemplate === template}
                    className="showcase-pill justify-start text-left"
                    data-active={activeTemplate === template}
                  >
                    {TEMPLATE_LABELS[template]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 border-t border-border-muted/30 pt-5">
              <span className="text-[0.68rem] uppercase tracking-[0.26em] text-text-muted">Display mode</span>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setView("list")}
                  aria-pressed={view === "list"}
                  className={`min-h-12 rounded-2xl border px-4 py-3 text-left transition-colors duration-300 ${
                    view === "list"
                      ? "border-[var(--color-aurum)]/35 bg-[var(--color-aurum)]/10 text-[var(--color-aurum-pale)]"
                      : "border-border-muted/40 bg-bg-secondary/50 text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <span className="block text-[0.7rem] uppercase tracking-[0.24em]">Shelf</span>
                  <span className="mt-1 block text-sm">Reading list</span>
                </button>
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  aria-pressed={view === "grid"}
                  className={`min-h-12 rounded-2xl border px-4 py-3 text-left transition-colors duration-300 ${
                    view === "grid"
                      ? "border-[var(--color-aurum)]/35 bg-[var(--color-aurum)]/10 text-[var(--color-aurum-pale)]"
                      : "border-border-muted/40 bg-bg-secondary/50 text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <span className="block text-[0.7rem] uppercase tracking-[0.24em]">Cabinet</span>
                  <span className="mt-1 block text-sm">Illustrated grid</span>
                </button>
              </div>
            </div>
          </div>
        </aside>

        <div className="space-y-8">
          {grouped.length === 0 ? (
            <ShowcaseEmptyState
              title={search.trim() || activeTemplate ? "Nothing answers the present inquiry" : "The archive stands empty"}
              description={
                search.trim() || activeTemplate
                  ? "No entry matches the selected shelf or search phrase. Widen the query or return to the full archive."
                  : "No public codex entries have been published yet."
              }
              actions={
                search.trim() || activeTemplate ? (
                  <button type="button" onClick={clearFilters} className={showcaseButtonClassNames.secondary}>
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
                      <h2 className="mt-2 font-display text-2xl text-accent-emphasis">{TEMPLATE_LABELS[template]}</h2>
                    </div>
                    <p className="text-sm text-text-muted">
                      {new Intl.NumberFormat().format(items.length)} entr{items.length === 1 ? "y" : "ies"}
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
                                    style={{
                                      borderColor: tone,
                                      color: tone,
                                    }}
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
                                    style={{
                                      borderColor: tone,
                                      color: tone,
                                    }}
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
    </div>
  );
}
