import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import { useShowcase } from "@/lib/DataContext";
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

  const featured = [...articles]
    .filter((a) => a.imageUrl && a.template !== "world_setting")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);

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
        if (e.key === "Escape") { setSearch(""); setIsOpen(false); }
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
    [isOpen, searchResults, activeIndex, navigateToResult],
  );

  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  useEffect(() => { setActiveIndex(-1); }, [searchResults]);
  useEffect(() => { setIsOpen(search.trim().length > 0); }, [search]);

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
      {/* ── Hero ── */}
      <section className="relative mb-16">
        {heroImage && (
          <div className="relative -mx-5 sm:-mx-8 -mt-10 sm:-mt-14 mb-10 overflow-hidden">
            <img
              src={heroImage}
              alt={bannerTitle}
              className="w-full h-[360px] sm:h-[440px] object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg-abyss via-bg-abyss/50 to-bg-abyss/10" />
            <div className="absolute bottom-0 inset-x-0 px-5 sm:px-8 pb-8 sm:pb-12">
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-[0.12em] text-accent-emphasis mb-3 drop-shadow-lg animate-fade-in-up">
                {bannerTitle}
              </h1>
              {bannerSubtitle && (
                <p className="text-text-secondary text-lg sm:text-xl max-w-2xl drop-shadow-md animate-fade-in-up" style={{ animationDelay: "100ms" }}>
                  {bannerSubtitle}
                </p>
              )}
            </div>
          </div>
        )}

        {!heroImage && (
          <div className="py-16 sm:py-20 mb-8">
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-[0.12em] text-accent-emphasis mb-4 animate-fade-in-up">
              {bannerTitle}
            </h1>
            {bannerSubtitle && (
              <p className="text-text-secondary text-lg sm:text-xl max-w-2xl animate-fade-in-up" style={{ animationDelay: "100ms" }}>
                {bannerSubtitle}
              </p>
            )}
          </div>
        )}

        {/* World overview */}
        {worldSetting?.contentHtml && (
          <div
            className="prose max-w-3xl mb-12"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(worldSetting.contentHtml) }}
          />
        )}

        {/* Search */}
        <div className="opacity-80 focus-within:opacity-100 transition-opacity duration-300">
        <div ref={searchContainerRef} className="relative max-w-md">
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
            className="w-full bg-bg-secondary/60 border border-border-muted/60 rounded-lg px-4 py-3 text-sm
                       text-text-primary placeholder:text-text-muted/70
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:border-accent/40
                       transition-colors duration-300"
          />
          {isOpen && searchResults.length > 0 && (
            <div
              ref={listRef}
              id={listboxId}
              role="listbox"
              className="absolute z-20 top-full mt-2 w-full bg-bg-primary/98 border border-border-muted/60
                         rounded-lg shadow-[var(--shadow-panel)] max-h-80 overflow-y-auto
                         animate-[fadeIn_120ms_ease-out]"
            >
              {searchResults.map((a, i) => (
                <div
                  key={a.id}
                  id={`search-result-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onClick={() => navigateToResult(a.id)}
                  className={`cursor-pointer flex items-center gap-3 px-4 py-3 transition-colors duration-150 ${
                    i === activeIndex ? "bg-bg-hover" : "hover:bg-bg-hover"
                  }`}
                >
                  {a.imageUrl && (
                    <img src={a.imageUrl} alt="" className="w-9 h-9 rounded-md object-cover shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-text-primary text-sm truncate">{a.title}</div>
                    <div className="text-text-muted text-xs">{TEMPLATE_LABELS[a.template]}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {isOpen && search.trim() && searchResults.length === 0 && (
            <div className="absolute z-20 top-full mt-2 w-full bg-bg-primary/98 border border-border-muted/60
                            rounded-lg shadow-[var(--shadow-panel)] px-4 py-4 text-text-muted text-sm
                            animate-[fadeIn_120ms_ease-out]">
              No entries found for "{search}"
            </div>
          )}
        </div>
        </div>
      </section>

      {/* ── Navigation links ── */}
      <section className="flex flex-wrap items-center divide-x divide-border-muted/30 mb-20">
        <Link
          to="/articles"
          className="group flex items-center gap-3 px-5 py-3 text-text-secondary text-sm font-display
                     tracking-[0.14em] hover:text-accent transition-colors duration-300 first:pl-0
                     focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:rounded"
        >
          Codex <span className="text-text-muted group-hover:text-accent/60 transition-colors">({articles.filter((a) => a.template !== "world_setting").length})</span>
        </Link>
        {(maps?.length ?? 0) > 0 && (
          <Link
            to="/maps"
            className="group flex items-center gap-3 px-5 py-3 text-text-secondary text-sm font-display
                       tracking-[0.14em] hover:text-accent transition-colors duration-300 pl-5
                       focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:rounded"
          >
            Maps <span className="text-text-muted group-hover:text-accent/60 transition-colors">({maps.length})</span>
          </Link>
        )}
        {(data.timelineEvents?.length ?? 0) > 0 && (
          <Link
            to="/timeline"
            className="group flex items-center gap-3 px-5 py-3 text-text-secondary text-sm font-display
                       tracking-[0.14em] hover:text-accent transition-colors duration-300 pl-5
                       focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:rounded"
          >
            Timeline <span className="text-text-muted group-hover:text-accent/60 transition-colors">({data.timelineEvents!.length})</span>
          </Link>
        )}
        <Link
          to="/graph"
          className="group flex items-center gap-3 px-5 py-3 text-text-secondary text-sm font-display
                     tracking-[0.14em] hover:text-accent transition-colors duration-300 pl-5
                     focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:rounded"
        >
          Connections
        </Link>
      </section>

      {/* ── Featured ── */}
      {featured.length > 0 && (
        <section>
          <div className="flex items-center gap-4 mb-8">
            <h2 className="font-display text-accent text-sm tracking-[0.22em] uppercase">
              Explore Further
            </h2>
            <div className="flex-1 h-px bg-border-muted/40" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Hero featured article — double-width portrait */}
            {featured[0] && (() => {
              const a = featured[0];
              const color = TEMPLATE_COLORS[a.template];
              return (
                <Link
                  key={a.id}
                  to={`/articles/${encodeURIComponent(a.id)}`}
                  className="group relative col-span-2 row-span-2 overflow-hidden rounded-xl transition-shadow duration-500
                             hover:shadow-[0_16px_48px_rgba(168,151,210,0.18)]
                             focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  {a.imageUrl && (
                    <div className="h-full overflow-hidden bg-bg-tertiary/30">
                      <img
                        src={a.imageUrl}
                        alt={a.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700 ease-out"
                      />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-bg-abyss/90 via-bg-abyss/20 to-transparent" />
                  <div className="absolute bottom-0 inset-x-0 p-5 sm:p-6">
                    <div className="text-[10px] tracking-[0.16em] uppercase mb-2 transition-colors duration-300" style={{ color }}>
                      {TEMPLATE_LABELS[a.template]}
                    </div>
                    <h3 className="font-display text-accent-emphasis text-xl sm:text-2xl group-hover:text-accent transition-colors duration-300">
                      {a.title}
                    </h3>
                  </div>
                </Link>
              );
            })()}

            {/* Remaining featured — portrait cards filling the grid */}
            {featured.slice(1).map((a) => {
              const color = TEMPLATE_COLORS[a.template];
              return (
                <Link
                  key={a.id}
                  to={`/articles/${encodeURIComponent(a.id)}`}
                  className="group overflow-hidden rounded-lg transition-shadow duration-500
                             hover:shadow-[0_8px_28px_rgba(168,151,210,0.12)]
                             focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  {a.imageUrl && (
                    <div className="aspect-[3/4] overflow-hidden bg-bg-tertiary/30">
                      <img
                        src={a.imageUrl}
                        alt={a.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out"
                      />
                    </div>
                  )}
                  <div className="px-3 py-2.5 bg-bg-secondary/40">
                    <div className="text-[9px] tracking-[0.14em] uppercase mb-0.5 transition-colors duration-300" style={{ color }}>
                      {TEMPLATE_LABELS[a.template]}
                    </div>
                    <h3 className="font-display text-accent-emphasis text-[13px] leading-tight group-hover:text-accent transition-colors duration-300 line-clamp-2">
                      {a.title}
                    </h3>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
