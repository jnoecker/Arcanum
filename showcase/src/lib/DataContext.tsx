import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { ShowcaseData, ShowcaseArticle, ShowcaseStory } from "@/types/showcase";
import { applyBranding } from "@/lib/applyBranding";
import { injectManifest } from "@/lib/pwaManifest";
import { detectHubMode } from "@/lib/hubMode";

interface DataContextValue {
  data: ShowcaseData | null;
  loading: boolean;
  error: string | null;
  articleById: Map<string, ShowcaseArticle>;
  storyById: Map<string, ShowcaseStory>;
  reload: () => void;
  /** True when running at the hub root domain (no slug). HubIndexPage renders instead of per-world content. */
  isHubRoot: boolean;
}

interface RuntimeConfig {
  showcaseUrl?: string | null;
}

const DataContext = createContext<DataContextValue>({
  data: null,
  loading: true,
  error: null,
  articleById: new Map(),
  storyById: new Map(),
  reload: () => {},
  isHubRoot: false,
});

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ShowcaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [articleById, setArticleById] = useState<Map<string, ShowcaseArticle>>(new Map());
  const [storyById, setStoryById] = useState<Map<string, ShowcaseStory>>(new Map());
  const [reloadToken, setReloadToken] = useState(0);
  const hubMode = detectHubMode();

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        // Hub root: no data to load — the HubIndexPage fetches /api/index directly.
        if (hubMode.kind === "root") {
          setData(null);
          setArticleById(new Map());
          setStoryById(new Map());
          setLoading(false);
          return;
        }

        // Try to read runtime config, but tolerate the SPA fallback returning index.html
        // (Cloudflare Pages rewrites unknown paths to index.html with a 200 status).
        let runtimeUrl: string | undefined;
        try {
          const configResp = await fetch("/config.json", { cache: "no-store", signal });
          const contentType = configResp.headers.get("content-type") ?? "";
          if (configResp.ok && contentType.includes("application/json")) {
            const config = await configResp.json() as RuntimeConfig;
            runtimeUrl = config.showcaseUrl?.trim() || undefined;
          }
        } catch {
          // No runtime config — fall through to hub subdomain, env var, or local file.
        }

        // Hub subdomain mode fetches showcase.json from the same origin —
        // the Worker serves it from R2 keyed by the Host header's slug.
        const hubUrl = hubMode.kind === "world" ? "/showcase.json" : undefined;

        const dataUrl =
          runtimeUrl || hubUrl || import.meta.env.VITE_SHOWCASE_URL || "/data/showcase.json";
        const r = await fetch(dataUrl, { signal });
        if (!r.ok) throw new Error(`Failed to load showcase data (${r.status})`);
        const d: ShowcaseData = await r.json();

        // Pre-compute search text once at load time
        for (const a of d.articles) {
          a.searchText = a.contentHtml.replace(/<[^>]+>/g, "").toLowerCase();
        }

        if (signal.aborted) return;

        setData(d);
        const map = new Map<string, ShowcaseArticle>();
        for (const a of d.articles) map.set(a.id, a);
        setArticleById(map);
        const storyMap = new Map<string, ShowcaseStory>();
        for (const s of d.stories ?? []) storyMap.set(s.id, s);
        setStoryById(storyMap);
        applyBranding(d.meta);
        injectManifest(d.meta);
      } catch (e) {
        if (signal.aborted) return;

        setData(null);
        setArticleById(new Map());
        setStoryById(new Map());
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    };

    load();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  return (
    <DataContext.Provider
      value={{
        data,
        loading,
        error,
        articleById,
        storyById,
        reload: () => setReloadToken((value) => value + 1),
        isHubRoot: hubMode.kind === "root",
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useShowcase() {
  return useContext(DataContext);
}
