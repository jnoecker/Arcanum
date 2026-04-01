import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { ShowcaseData, ShowcaseArticle } from "@/types/showcase";

interface DataContextValue {
  data: ShowcaseData | null;
  loading: boolean;
  error: string | null;
  articleById: Map<string, ShowcaseArticle>;
}

const DataContext = createContext<DataContextValue>({
  data: null,
  loading: true,
  error: null,
  articleById: new Map(),
});

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ShowcaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [articleById, setArticleById] = useState<Map<string, ShowcaseArticle>>(new Map());

  useEffect(() => {
    // Try local data first (for development), fall back to R2
    const dataUrl = import.meta.env.VITE_SHOWCASE_URL || "/data/showcase.json";
    fetch(dataUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load showcase data (${r.status})`);
        return r.json();
      })
      .then((d: ShowcaseData) => {
        // Pre-compute search text once at load time
        for (const a of d.articles) {
          a.searchText = a.contentHtml.replace(/<[^>]+>/g, "").toLowerCase();
        }
        setData(d);
        const map = new Map<string, ShowcaseArticle>();
        for (const a of d.articles) map.set(a.id, a);
        setArticleById(map);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DataContext.Provider value={{ data, loading, error, articleById }}>
      {children}
    </DataContext.Provider>
  );
}

export function useShowcase() {
  return useContext(DataContext);
}
