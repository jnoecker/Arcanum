import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import { useShowcase } from "@/lib/DataContext";
import { showcaseButtonClassNames, showcaseSurfaceClassNames } from "@/components/ShowcasePrimitives";
import { TEMPLATE_LABELS, TEMPLATE_COLORS } from "@/lib/templates";
import type { ArticleTemplate } from "@/types/showcase";

export function HomePage() {
  const { data } = useShowcase();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = data?.meta.showcase?.bannerTitle ?? data?.meta.worldName ?? "World Lore";
  }, [data]);

  if (!data) return null;

  const { meta, articles, maps } = data;
  const bannerTitle = meta.showcase?.bannerTitle ?? meta.worldName;
  const bannerSubtitle = meta.showcase?.bannerSubtitle ?? meta.tagline;
  const worldSetting = articles.find((a) => a.template === "world_setting");
  const heroImage = meta.showcase?.bannerImage ?? worldSetting?.imageUrl;
  const articleCount = articles.filter((a) => a.template !== "world_setting").length;
  const timelineCount = data.timelineEvents?.length ?? 0;
  const mapCount = maps?.length ?? 0;

  const featured = [...articles]
    .filter((a) => a.imageUrl && a.template !== "world_setting")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 9);
  const spotlight = featured[0];
  const sideFeatures = featured.slice(1, 3);
  const ledgerFeatures = featured.slice(3, 8);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return articles
      .filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q)) ||
          (a.searchText ?? "").includes(q),
      )
      .slice(0, 12);
  }, [articles, search]);

  const navigateToResult = useCallback(
    (id: string) => {
      setSearch("");
      setIsOpen(false);
      setActiveIndex(-1);
      navigate(`/articles/${encodeURIComponent(id)}`);
    },
    [navigate],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || searchResults.length === 0) {
        if (e.key === "Escape") {
          setSearch("");
          setIsOpen(false);
        }
        return;
      }
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((i) => Math.min(i + 1, searchResults.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < searchResults.length) {
            navigateToResult(searchResults[activeIndex].id);
          } else if (searchResults.length > 0) {
            navigateToResult(searchResults[0].id);
          }
          break;
        case "Escape":
          e.preventDefault();
          setSearch("");
          setIsOpen(false);
          setActiveIndex(-1);
          break;
      }
    },
    [activeIndex, isOpen, navigateToResult, searchResults],
  );

  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [searchResults]);

  useEffect(() => {
    setIsOpen(search.trim().length > 0);
  }, [search]);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const listboxId = "search-results";

  return (
    <div>
      <section className="relative mb-16">
        <div className={`${showcaseSurfaceClassNames.hero} relative overflow-hidden shadow-[var(--shadow-hero)]`}>
          {heroImage && (
            <>
              <img
                src={heroImage}
                alt={bannerTitle}
                className="absolute inset-0 h-full w-full object-cover opacity-32"
              />
              <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(15,20,40,0.96),rgba(15,20,40,0.74),rgba(15,20,40,0.88))]" />
            </>
          )}

          <div className="relative grid gap-8 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:gap-10 lg:px-10 xl:grid-cols-[minmax(0,1.2fr)_minmax(21rem,0.82fr)]">
            <div className="max-w-3xl">
              <h1 className="mt-4 font-display text-4xl leading-[1.03] text-accent-emphasis sm:text-5xl lg:text-6xl">
                {bannerTitle}
              </h1>
              {bannerSubtitle && (
                <p className="mt-4 max-w-2xl text-base leading-8 text-text-secondary sm:text-lg">
                  {bannerSubtitle}
                </p>
              )}
              <p className="mt-6 max-w-2xl text-sm leading-7 text-text-muted">
                Start with {articleCount} published entries
                {mapCount > 0 ? `, ${mapCount} mapped regions` : ""}
                {timelineCount > 0 ? `, and ${timelineCount} dated events` : ""}.
              </p>
            </div>

            <div
              ref={searchContainerRef}
              className={`${showcaseSurfaceClassNames.note} relative self-end p-5`}
            >
              <h2 className="mt-3 font-display text-2xl text-[var(--color-aurum-pale)]">
                Find a person, place, or relic
              </h2>
              <p className="mt-2 text-sm leading-7 text-text-secondary">
                Search the archive directly, or open the codex and browse by type.
              </p>

              <div className="mt-5 opacity-90 transition-opacity duration-300 focus-within:opacity-100">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search the codex..."
                  role="combobox"
                  aria-expanded={isOpen && searchResults.length > 0}
                  aria-controls={listboxId}
                  aria-activedescendant={activeIndex >= 0 ? `search-result-${activeIndex}` : undefined}
                  aria-autocomplete="list"
                  className="w-full rounded-2xl border border-[var(--border-aurum)] bg-bg-abyss/70 px-4 py-3 text-sm text-text-primary placeholder:text-text-muted/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-aurum)]/35"
                />
                {isOpen && searchResults.length > 0 && (
                  <div
                    ref={listRef}
                    id={listboxId}
                    role="listbox"
                    className="absolute inset-x-5 top-[calc(100%-0.15rem)] z-20 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-border-muted/60 bg-bg-primary/98 shadow-[var(--shadow-panel)] animate-[fadeIn_120ms_ease-out]"
                  >
                    {searchResults.map((a, i) => (
                      <button
                        type="button"
                        key={a.id}
                        id={`search-result-${i}`}
                        role="option"
                        aria-selected={i === activeIndex}
                        tabIndex={-1}
                        onClick={() => navigateToResult(a.id)}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 ${
                          i === activeIndex ? "bg-bg-hover" : "hover:bg-bg-hover"
                        }`}
                      >
                        {a.imageUrl && (
                          <img src={a.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                        )}
                        <div className="min-w-0">
                          <div className="truncate text-sm text-text-primary">{a.title}</div>
                          <div className="text-xs text-text-muted">{TEMPLATE_LABELS[a.template]}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {isOpen && search.trim() && searchResults.length === 0 && (
                  <div className="absolute inset-x-5 top-[calc(100%-0.15rem)] z-20 mt-2 rounded-2xl border border-border-muted/60 bg-bg-primary/98 px-4 py-4 text-sm text-text-muted shadow-[var(--shadow-panel)] animate-[fadeIn_120ms_ease-out]">
                    No entries found for "{search}"
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link to="/articles" className={showcaseButtonClassNames.primary}>
                  Browse the codex
                </Link>
                {mapCount > 0 && (
                  <Link to="/maps" className={showcaseButtonClassNames.secondary}>
                    Open maps
                  </Link>
                )}
                {timelineCount > 0 && (
                  <Link to="/timeline" className={showcaseButtonClassNames.secondary}>
                    Read the timeline
                  </Link>
                )}
                <Link to="/graph" className={showcaseButtonClassNames.quiet}>
                  View connections
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-20 grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(18rem,0.92fr)]">
        <div className="min-w-0">
          {worldSetting?.contentHtml ? (
            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(worldSetting.contentHtml) }}
            />
          ) : (
            <div className="px-1">
              <p className="text-base leading-8 text-text-secondary">
                Enter through the codex, map the terrain, and follow the line of events through the world&apos;s own record.
              </p>
            </div>
          )}
        </div>

        <aside className="grid gap-5 self-start">
          <Link
            to="/articles"
            className={`${showcaseSurfaceClassNames.note} group overflow-hidden px-5 py-5 transition-transform duration-300 hover:-translate-y-0.5`}
          >
            <h2 className="font-display text-2xl text-accent-emphasis">Browse the codex</h2>
            <p className="mt-2 text-sm leading-7 text-text-secondary">
              Move through characters, places, factions, and relics in whatever order opens the world fastest.
            </p>
            <p className="mt-4 text-sm text-text-muted">
              {articleCount} linked entries
            </p>
          </Link>

          <div className="border-t border-border-muted/25 pt-4">
            <p className="text-xs uppercase tracking-[0.24em] text-text-muted">Other ways in</p>
            <div className="mt-3 space-y-2">
            {mapCount > 0 && (
              <Link
                to="/maps"
                className="flex items-start justify-between gap-4 rounded-2xl px-3 py-3 transition-colors duration-300 hover:bg-white/6"
              >
                <div>
                  <h3 className="font-display text-xl text-[var(--color-aurum-pale)]">Maps</h3>
                  <p className="mt-1 text-sm leading-7 text-text-secondary">{mapCount} regions with linked pins and places.</p>
                </div>
                <span className="pt-1 text-[var(--color-aurum-pale)]">↗</span>
              </Link>
            )}
            {timelineCount > 0 && (
              <Link
                to="/timeline"
                className="flex items-start justify-between gap-4 rounded-2xl px-3 py-3 transition-colors duration-300 hover:bg-white/6"
              >
                <div>
                  <h3 className="font-display text-xl text-accent">Timeline</h3>
                  <p className="mt-1 text-sm leading-7 text-text-secondary">{timelineCount} events arranged across eras and ages.</p>
                </div>
                <span className="pt-1 text-[var(--color-aurum-pale)]">↗</span>
              </Link>
            )}
            <Link
              to="/graph"
              className="flex items-start justify-between gap-4 rounded-2xl px-3 py-3 transition-colors duration-300 hover:bg-white/6"
            >
              <div>
                <h3 className="font-display text-xl text-accent">Connections</h3>
                <p className="mt-1 text-sm leading-7 text-text-secondary">Follow alliances, rivalries, and associations across the canon.</p>
              </div>
              <span className="pt-1 text-[var(--color-aurum-pale)]">↗</span>
            </Link>
            </div>
          </div>
        </aside>
      </section>

      {spotlight && (
        <section>
          <div className="mb-8 flex items-center gap-4">
            <h2 className="font-display text-sm uppercase tracking-[0.28em] text-[var(--color-aurum-pale)]">
              Recent entries
            </h2>
            <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(200,151,46,0.35),rgba(57,69,95,0.16))]" />
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)]">
            <Link
              to={`/articles/${encodeURIComponent(spotlight.id)}`}
              className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-bg-secondary/30 shadow-[var(--shadow-image)]"
            >
              {spotlight.imageUrl && (
                <img
                  src={spotlight.imageUrl}
                  alt={spotlight.title}
                  loading="lazy"
                  className="h-[22rem] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02] sm:h-[28rem]"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-bg-abyss via-bg-abyss/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                <p className="text-[10px] uppercase tracking-[0.24em]" style={{ color: TEMPLATE_COLORS[spotlight.template] }}>
                  {TEMPLATE_LABELS[spotlight.template]}
                </p>
                <h3 className="mt-3 font-display text-2xl text-accent-emphasis transition-colors duration-300 group-hover:text-[var(--color-aurum-pale)] sm:text-3xl">
                  {spotlight.title}
                </h3>
              </div>
            </Link>

            <div className="grid gap-4">
              {sideFeatures.map((a) => (
                <Link
                  key={a.id}
                  to={`/articles/${encodeURIComponent(a.id)}`}
                  className={`${showcaseSurfaceClassNames.sectionSoft} group flex min-h-[11rem] flex-col overflow-hidden sm:flex-row`}
                >
                  {a.imageUrl && (
                    <div className="h-40 w-full shrink-0 overflow-hidden sm:h-auto sm:w-[42%]">
                      <img
                        src={a.imageUrl}
                        alt={a.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                      />
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col justify-end p-5">
                    <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color: TEMPLATE_COLORS[a.template] }}>
                      {TEMPLATE_LABELS[a.template]}
                    </p>
                    <h3 className="mt-3 font-display text-xl leading-tight text-accent-emphasis transition-colors duration-300 group-hover:text-[var(--color-aurum-pale)]">
                      {a.title}
                    </h3>
                  </div>
                </Link>
              ))}

              {ledgerFeatures.length > 0 && (
                <div className={`${showcaseSurfaceClassNames.sectionSoft} p-4`}>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">More to explore</p>
                  <div className="mt-3 space-y-2">
                    {ledgerFeatures.map((a) => (
                      <Link
                        key={a.id}
                        to={`/articles/${encodeURIComponent(a.id)}`}
                        className="flex items-center justify-between gap-4 rounded-2xl px-3 py-3 transition-colors duration-300 hover:bg-white/6"
                      >
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: TEMPLATE_COLORS[a.template] }}>
                            {TEMPLATE_LABELS[a.template]}
                          </p>
                          <p className="mt-1 truncate font-display text-sm text-accent-emphasis">{a.title}</p>
                        </div>
                        <span className="shrink-0 text-[var(--color-aurum-pale)]">↗</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
