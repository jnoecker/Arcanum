import { Routes, Route } from "react-router-dom";
import { useShowcase } from "@/lib/DataContext";
import { Layout } from "@/components/Layout";
import { HomePage } from "@/pages/HomePage";
import { ArticlesPage } from "@/pages/ArticlesPage";
import { ArticlePage } from "@/pages/ArticlePage";
import { MapsPage } from "@/pages/MapsPage";
import { TimelinePage } from "@/pages/TimelinePage";
import { GraphPage } from "@/pages/GraphPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export function App() {
  const { loading, error } = useShowcase();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="font-display text-accent text-xl tracking-[0.22em] animate-pulse">
          Loading world data...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <h1 className="font-display text-accent text-xl mb-4">Failed to Load</h1>
          <p className="text-text-secondary text-sm">{error}</p>
          <p className="text-text-muted text-xs mt-4">
            Make sure <code className="bg-black/20 px-1.5 py-0.5 rounded">public/data/showcase.json</code> exists.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/articles" element={<ArticlesPage />} />
        <Route path="/articles/:id" element={<ArticlePage />} />
        <Route path="/maps" element={<MapsPage />} />
        <Route path="/maps/:id" element={<MapsPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/graph" element={<GraphPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}
