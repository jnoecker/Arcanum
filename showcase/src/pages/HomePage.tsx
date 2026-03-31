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
    document.title = data?.meta.worldName ?? "World Lore";
  }, [data?.meta.worldName]);

  if (!data) return null;

  const { meta, articles, maps } = data;

  // Find the world setting article for the hero
  const worldSetting = articles.find((a) => a.template === "world_setting");

  // Featured articles: most recently updated, with images, excluding world_setting
  const featured = [...articles]
    .filter((a) => a.imageUrl && a.template !== "world_setting")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);

  // Search results
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

  const listboxId = "search-results";

  return (
    <div className="space-y-16">
      {/* ── Hero: World Setting ── */}
      <section className="relative">
        {/* World setting hero image */}
        {worldSetting?.imageUrl && (
          <div className="relative -mx-4 sm:-mx-6 -mt-8 mb-8 overflow-hidden rounded-b-2xl">
            <img
              src={worldSetting.imageUrl}
              alt={meta.worldName}
              className="w-full h-[320px] sm:h-[400px] object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg-abyss via-bg-abyss/60 to-transparent" />
            <div className="absolute bottom-0 inset-x-0 p-6 sm:p-10">
              <h1 className="font-display text-4xl sm:text-5xl tracking-[0.14em] text-accent-emphasis mb-2 drop-shadow-lg">
                {meta.worldName}
              </h1>
              {meta.tagline && (
                <p className="text-text-secondary text-lg max-w-2xl drop-shadow-md">{meta.tagline}</p>
              )}
            </div>
          </div>
        )}

        {/* Fallback hero without image */}
        {!worldSetting?.imageUrl && (
          <div className="text-center py-12">
            <h1 className="font-display text-4xl sm:text-5xl tracking-[0.14em] text-accent-emphasis mb-3">
              {meta.worldName}
            </h1>
            {meta.tagline && (
              <p className="text-text-secondary text-lg max-w-xl mx-auto">{meta.tagline}</p>
            )}
          </div>
        )}

        {/* World overview prose */}
        {worldSetting && worldSetting.contentHtml && (
          <div
            className="prose max-w-3xl mx-auto mb-8"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(worldSetting.contentHtml) }}
          />
        )}

        {/* Search */}
        <div className="relative max-w-md mx-auto">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => search.trim() && setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 150)}
            placeholder="Search the codex..."
            role="combobox"
            aria-expanded={isOpen && searchResults.length > 0}
            aria-controls={listboxId}
            aria-activedescendant={activeIndex >= 0 ? `search-result-${activeIndex}` : undefined}
            aria-autocomplete="list"
            className="w-full bg-bg-tertiary/60 border border-border-muted rounded-lg px-4 py-2.5 text-sm
                       text-text-primary placeholder:text-text-muted
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:border-accent/60
                       text-center"
          />
          {isOpen && searchResults.length > 0 && (
            <div
              ref={listRef}
              id={listboxId}
              role="listbox"
              className="absolute z-20 top-full mt-1 w-full bg-bg-primary/95 border border-border-muted
                         rounded-lg shadow-[var(--shadow-panel)] max-h-80 overflow-y-auto text-left
                         animate-[fadeIn_120ms_ease-out]"
            >
              {searchResults.map((a, i) => (
                <Link
                  key={a.id}
                  id={`search-result-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  to={`/articles/${encodeURIComponent(a.id)}`}
                  onClick={() => { setSearch(""); setIsOpen(false); }}
                  className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                    i === activeIndex ? "bg-bg-hover" : "hover:bg-bg-hover"
                  }`}
                >
                  {a.imageUrl && (
                    <img src={a.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-text-primary text-sm truncate">{a.title}</div>
                    <div className="text-text-muted text-xs">{TEMPLATE_LABELS[a.template]}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {isOpen && search.trim() && searchResults.length === 0 && (
            <div className="absolute z-20 top-full mt-1 w-full bg-bg-primary/95 border border-border-muted
                            rounded-lg shadow-[var(--shadow-panel)] px-4 py-3 text-text-muted text-sm text-center
                            animate-[fadeIn_120ms_ease-out]">
              No results found
            </div>
          )}
        </div>
      </section>

      {/* ── Quick links to sections ── */}
      <section className="flex flex-wrap justify-center gap-3">
        <Link
          to="/articles"
          className="px-4 py-2 rounded-lg border border-border-muted text-text-secondary text-sm font-display
                     tracking-[0.12em] hover:border-accent/40 hover:text-accent transition-colors"
        >
          Codex ({articles.filter((a) => a.template !== "world_setting").length})
        </Link>
        {(maps?.length ?? 0) > 0 && (
          <Link
            to="/maps"
            className="px-4 py-2 rounded-lg border border-border-muted text-text-secondary text-sm font-display
                       tracking-[0.12em] hover:border-accent/40 hover:text-accent transition-colors"
          >
            Maps ({maps.length})
          </Link>
        )}
        {(data.timelineEvents?.length ?? 0) > 0 && (
          <Link
            to="/timeline"
            className="px-4 py-2 rounded-lg border border-border-muted text-text-secondary text-sm font-display
                       tracking-[0.12em] hover:border-accent/40 hover:text-accent transition-colors"
          >
            Timeline ({data.timelineEvents!.length})
          </Link>
        )}
        <Link
          to="/graph"
          className="px-4 py-2 rounded-lg border border-border-muted text-text-secondary text-sm font-display
                     tracking-[0.12em] hover:border-accent/40 hover:text-accent transition-colors"
        >
          Connections
        </Link>
      </section>

      {/* ── Featured: Explore Further ── */}
      {featured.length > 0 && (
        <section>
          <h2 className="font-display text-accent text-lg tracking-[0.18em] uppercase mb-6">
            Explore Further
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {featured.map((a) => {
              const color = TEMPLATE_COLORS[a.template];
              return (
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
                    <div className="text-xs tracking-[0.12em] uppercase mb-1" style={{ color }}>
                      {TEMPLATE_LABELS[a.template]}
                    </div>
                    <h3 className="font-display text-accent-emphasis text-sm">{a.title}</h3>
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
