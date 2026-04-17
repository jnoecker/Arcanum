import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchHubIndex, type HubIndexWorld } from "@/lib/hubMode";
import { ShowcaseEmptyState } from "@/components/ShowcasePrimitives";

type SortKey = "recent" | "alphabetical" | "content";

function formatDate(ms: number | null): string {
  if (!ms) return "";
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function contentScore(w: HubIndexWorld): number {
  // A loose "how much is in here" signal: articles count more than
  // maps because a world with one illustrated article can be
  // meaningful, while a world with nothing but maps usually isn't.
  return w.articleCount * 2 + w.mapCount + Math.min(w.imageCount, 30) / 10;
}

export function HubIndexPage() {
  const [worlds, setWorlds] = useState<HubIndexWorld[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("recent");

  useEffect(() => {
    const controller = new AbortController();
    fetchHubIndex(controller.signal)
      .then((res) => setWorlds(res.worlds))
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => controller.abort();
  }, []);

  // Aggregate tag universe for the filter chip bar. Sorted by
  // frequency so the most broadly useful filters surface first,
  // capped so we don't render a wall of chips on large hubs.
  const topTags = useMemo(() => {
    if (!worlds) return [] as { tag: string; count: number }[];
    const counts = new Map<string, number>();
    for (const w of worlds) {
      for (const t of w.tags) {
        const key = t.toLowerCase();
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
      .slice(0, 16);
  }, [worlds]);

  const filtered = useMemo(() => {
    if (!worlds) return null;
    const q = query.trim().toLowerCase();
    const tagLower = activeTag?.toLowerCase() ?? null;
    const out = worlds.filter((w) => {
      if (tagLower && !w.tags.some((t) => t.toLowerCase() === tagLower)) return false;
      if (!q) return true;
      const haystack = [
        w.displayName,
        w.tagline ?? "",
        w.description ?? "",
        w.authorDisplayName ?? "",
        w.slug,
        w.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
    const sorted = [...out];
    if (sort === "alphabetical") {
      sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));
    } else if (sort === "content") {
      sorted.sort((a, b) => contentScore(b) - contentScore(a));
    } else {
      sorted.sort((a, b) => (b.lastPublishAt ?? 0) - (a.lastPublishAt ?? 0));
    }
    return sorted;
  }, [worlds, query, activeTag, sort]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <ShowcaseEmptyState
          className="max-w-md"
          title="Hub unavailable"
          description={error}
        />
      </div>
    );
  }

  if (!worlds || !filtered) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <ShowcaseEmptyState
          className="max-w-md animate-pulse"
          title="Loading the atlas"
          description="Fetching worlds from the hub directory."
        />
      </div>
    );
  }

  const totalWorlds = worlds.length;
  const filterActive = query.trim().length > 0 || activeTag !== null;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 sm:px-8 py-12 sm:py-16">
      <header className="mb-10 text-center">
        <div className="text-[9px] uppercase tracking-[0.34em] text-text-muted/80">
          Arcanum
        </div>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl tracking-[0.18em] uppercase text-[var(--color-aurum-pale)]">
          The Hub Directory
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-text-secondary text-sm leading-relaxed">
          A living atlas of worlds built in Arcanum. Each entry links to its own
          showcase — lore, maps, and stories published directly from the tool.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3 text-xs">
          <Link
            to="/signup"
            className="rounded-full border border-accent/50 bg-accent/10 px-5 py-2 uppercase tracking-[0.18em] text-accent transition hover:bg-accent/20"
          >
            Get started free
          </Link>
          <Link
            to="/account"
            className="rounded-full border border-border-muted/50 px-5 py-2 uppercase tracking-[0.18em] text-text-muted transition hover:border-accent/50 hover:text-text-primary"
          >
            Sign in
          </Link>
        </div>
      </header>

      {totalWorlds > 0 && (
        <div className="mb-8 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search worlds, authors, tags…"
                aria-label="Search worlds"
                className="w-full rounded-xl border border-border-muted/50 bg-bg-elevated/40 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted/70 focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/40"
              />
            </div>
            <label className="flex items-center gap-2 text-2xs uppercase tracking-[0.24em] text-text-muted">
              <span>Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-lg border border-border-muted/50 bg-bg-elevated/40 px-2.5 py-1.5 text-xs text-text-primary focus:border-accent/60 focus:outline-none"
              >
                <option value="recent">Recently published</option>
                <option value="alphabetical">Alphabetical</option>
                <option value="content">Most content</option>
              </select>
            </label>
          </div>

          {topTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-2xs uppercase tracking-[0.24em] text-text-muted/80 mr-1">
                Tags
              </span>
              {topTags.map(({ tag, count }) => {
                const active = activeTag?.toLowerCase() === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setActiveTag(active ? null : tag)}
                    className={
                      active
                        ? "rounded-full border border-accent/60 bg-accent/15 px-2.5 py-0.5 text-2xs text-accent"
                        : "rounded-full border border-border-muted/40 bg-bg-elevated/30 px-2.5 py-0.5 text-2xs text-text-secondary hover:border-accent/40 hover:text-accent"
                    }
                  >
                    {tag}
                    <span className="ml-1 text-text-muted/70">{count}</span>
                  </button>
                );
              })}
              {activeTag && (
                <button
                  type="button"
                  onClick={() => setActiveTag(null)}
                  className="ml-1 text-2xs uppercase tracking-[0.24em] text-text-muted hover:text-accent"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {filterActive && (
            <div className="text-2xs uppercase tracking-[0.22em] text-text-muted">
              {filtered.length} of {totalWorlds} worlds
            </div>
          )}
        </div>
      )}

      {totalWorlds === 0 ? (
        <ShowcaseEmptyState
          className="mx-auto max-w-md"
          title="No worlds yet"
          description="Be the first to publish — run Arcanum and click 'Publish to Hub' in the toolbar."
        />
      ) : filtered.length === 0 ? (
        <ShowcaseEmptyState
          className="mx-auto max-w-md"
          title="Nothing matches"
          description="Try a different search or clear the active tag."
        />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((w) => (
            <li key={w.slug}>
              <WorldCard world={w} onTagClick={setActiveTag} activeTag={activeTag} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────

interface WorldCardProps {
  world: HubIndexWorld;
  activeTag: string | null;
  onTagClick: (tag: string) => void;
}

function WorldCard({ world: w, activeTag, onTagClick }: WorldCardProps) {
  const displayTags = w.tags.slice(0, 4);
  const remainingTagCount = Math.max(0, w.tags.length - displayTags.length);

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border-muted/50 bg-bg-elevated/40 transition hover:border-accent/40 hover:bg-bg-elevated/60">
      <a href={w.url} className="block" aria-label={`Open ${w.displayName}`}>
        <div className="relative aspect-[16/9] overflow-hidden border-b border-border-muted/40 bg-bg-deep/60">
          {w.coverImageUrl ? (
            <img
              src={w.coverImageUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-bg-deep/60 to-bg-elevated/30">
              <span className="font-display text-4xl tracking-[0.22em] uppercase text-[var(--color-aurum-pale)]/30">
                {w.displayName.slice(0, 1)}
              </span>
            </div>
          )}
          {w.lastPublishAt && (
            <div className="absolute left-3 top-3 rounded-full bg-bg-deep/70 px-2.5 py-0.5 text-[9px] uppercase tracking-[0.22em] text-text-muted backdrop-blur">
              {formatDate(w.lastPublishAt)}
            </div>
          )}
        </div>
        <div className="p-5">
          <h2 className="font-display text-lg tracking-[0.12em] uppercase text-[var(--color-aurum-pale)] leading-snug">
            {w.displayName}
          </h2>
          {w.authorDisplayName && (
            <div className="mt-1 text-2xs uppercase tracking-[0.22em] text-text-muted">
              by {w.authorDisplayName}
            </div>
          )}
          {(w.description || w.tagline) && (
            <p className="mt-3 line-clamp-3 text-sm text-text-secondary leading-relaxed">
              {w.description ?? w.tagline}
            </p>
          )}
          <div className="mt-4 flex items-center gap-3 text-2xs uppercase tracking-[0.18em] text-text-muted">
            {w.articleCount > 0 && (
              <span>
                <span className="text-text-primary">{w.articleCount}</span>{" "}
                {w.articleCount === 1 ? "article" : "articles"}
              </span>
            )}
            {w.mapCount > 0 && (
              <span>
                <span className="text-text-primary">{w.mapCount}</span>{" "}
                {w.mapCount === 1 ? "map" : "maps"}
              </span>
            )}
            {w.articleCount === 0 && w.mapCount === 0 && <span>published</span>}
          </div>
        </div>
      </a>
      {displayTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 pb-5">
          {displayTags.map((t) => {
            const active = activeTag?.toLowerCase() === t.toLowerCase();
            return (
              <button
                key={t}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onTagClick(t);
                }}
                className={
                  active
                    ? "rounded-full border border-accent/60 bg-accent/15 px-2 py-0.5 text-[10px] text-accent"
                    : "rounded-full border border-border-muted/40 bg-bg-elevated/20 px-2 py-0.5 text-[10px] text-text-secondary hover:border-accent/40 hover:text-accent"
                }
              >
                {t}
              </button>
            );
          })}
          {remainingTagCount > 0 && (
            <span className="rounded-full border border-border-muted/30 bg-bg-elevated/20 px-2 py-0.5 text-[10px] text-text-muted">
              +{remainingTagCount}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
