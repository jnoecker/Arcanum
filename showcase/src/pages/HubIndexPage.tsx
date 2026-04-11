import { useEffect, useState } from "react";
import { fetchHubIndex, type HubIndexWorld } from "@/lib/hubMode";
import { ShowcaseEmptyState } from "@/components/ShowcasePrimitives";

function formatDate(ms: number | null): string {
  if (!ms) return "";
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function HubIndexPage() {
  const [worlds, setWorlds] = useState<HubIndexWorld[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (!worlds) {
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

  return (
    <div className="mx-auto w-full max-w-5xl px-5 sm:px-8 py-12 sm:py-16">
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
      </header>

      {worlds.length === 0 ? (
        <ShowcaseEmptyState
          className="mx-auto max-w-md"
          title="No worlds yet"
          description="Be the first to publish — run Arcanum and click 'Publish to Hub' in the toolbar."
        />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2">
          {worlds.map((w) => (
            <li
              key={w.slug}
              className="rounded-2xl border border-border-muted/50 bg-bg-elevated/40 p-6 transition hover:border-accent/40 hover:bg-bg-elevated/60"
            >
              <a href={w.url} className="block">
                <div className="mb-2 text-[9px] uppercase tracking-[0.28em] text-text-muted">
                  {formatDate(w.lastPublishAt)}
                </div>
                <h2 className="font-display text-xl tracking-[0.14em] uppercase text-[var(--color-aurum-pale)]">
                  {w.displayName}
                </h2>
                {w.tagline && (
                  <p className="mt-3 text-sm text-text-secondary leading-relaxed">
                    {w.tagline}
                  </p>
                )}
                <div className="mt-4 text-2xs text-text-muted">
                  <code className="font-mono text-accent/70">{w.slug}.hub.arcanum.app</code>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
