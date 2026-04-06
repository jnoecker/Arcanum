import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { useShowcase } from "@/lib/DataContext";
import { Layout } from "@/components/Layout";

const HomePage = lazy(() => import("@/pages/HomePage").then(m => ({ default: m.HomePage })));
const ArticlesPage = lazy(() => import("@/pages/ArticlesPage").then(m => ({ default: m.ArticlesPage })));
const ArticlePage = lazy(() => import("@/pages/ArticlePage").then(m => ({ default: m.ArticlePage })));
const MapsPage = lazy(() => import("@/pages/MapsPage").then(m => ({ default: m.MapsPage })));
const TimelinePage = lazy(() => import("@/pages/TimelinePage").then(m => ({ default: m.TimelinePage })));
const GraphPage = lazy(() => import("@/pages/GraphPage").then(m => ({ default: m.GraphPage })));
const StoriesPage = lazy(() => import("@/pages/StoriesPage").then(m => ({ default: m.StoriesPage })));
const StoryPlayerPage = lazy(() => import("@/pages/StoryPlayerPage").then(m => ({ default: m.StoryPlayerPage })));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage").then(m => ({ default: m.NotFoundPage })));

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
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/articles" element={<ArticlesPage />} />
          <Route path="/articles/:id" element={<ArticlePage />} />
          <Route path="/maps" element={<MapsPage />} />
          <Route path="/maps/:id" element={<MapsPage />} />
          <Route path="/stories" element={<StoriesPage />} />
          <Route path="/stories/:id" element={<StoryPlayerPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
