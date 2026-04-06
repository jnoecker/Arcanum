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
});

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ShowcaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [articleById, setArticleById] = useState<Map<string, ShowcaseArticle>>(new Map());
  const [storyById, setStoryById] = useState<Map<string, ShowcaseStory>>(new Map());

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const configResp = await fetch("/config.json", { cache: "no-store" });
        let runtimeUrl: string | undefined;
        if (configResp.ok) {
          const config = await configResp.json() as RuntimeConfig;
          runtimeUrl = config.showcaseUrl?.trim() || undefined;
        }

        const dataUrl = runtimeUrl || import.meta.env.VITE_SHOWCASE_URL || "/data/showcase.json";
        const r = await fetch(dataUrl);
        if (!r.ok) throw new Error(`Failed to load showcase data (${r.status})`);
        const d: ShowcaseData = await r.json();

        // Pre-compute search text once at load time
        for (const a of d.articles) {
          a.searchText = a.contentHtml.replace(/<[^>]+>/g, "").toLowerCase();
        }

        if (cancelled) return;

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
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DataContext.Provider value={{ data, loading, error, articleById, storyById }}>
      {children}
    </DataContext.Provider>
  );
}

export function useShowcase() {
  return useContext(DataContext);
}
