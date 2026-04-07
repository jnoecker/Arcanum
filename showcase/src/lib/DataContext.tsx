import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { ShowcaseData, ShowcaseArticle, ShowcaseStory } from "@/types/showcase";
import { applyBranding } from "@/lib/applyBranding";
import { injectManifest } from "@/lib/pwaManifest";

interface DataContextValue {
  data: ShowcaseData | null;
  loading: boolean;
  error: string | null;
  articleById: Map<string, ShowcaseArticle>;
  storyById: Map<string, ShowcaseStory>;
  reload: () => void;
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
});

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ShowcaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [articleById, setArticleById] = useState<Map<string, ShowcaseArticle>>(new Map());
  const [storyById, setStoryById] = useState<Map<string, ShowcaseStory>>(new Map());
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const configResp = await fetch("/config.json", { cache: "no-store", signal });
        let runtimeUrl: string | undefined;
        if (configResp.ok) {
          const config = await configResp.json() as RuntimeConfig;
          runtimeUrl = config.showcaseUrl?.trim() || undefined;
        }

        const dataUrl = runtimeUrl || import.meta.env.VITE_SHOWCASE_URL || "/data/showcase.json";
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
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useShowcase() {
  return useContext(DataContext);
}
