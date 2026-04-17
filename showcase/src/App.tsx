import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { useShowcase } from "@/lib/DataContext";
import { Layout } from "@/components/Layout";
import { ShowcaseEmptyState, showcaseButtonClassNames } from "@/components/ShowcasePrimitives";

const HomePage = lazy(() => import("@/pages/HomePage").then(m => ({ default: m.HomePage })));
const ArticlesPage = lazy(() => import("@/pages/ArticlesPage").then(m => ({ default: m.ArticlesPage })));
const ArticlePage = lazy(() => import("@/pages/ArticlePage").then(m => ({ default: m.ArticlePage })));
const MapsPage = lazy(() => import("@/pages/MapsPage").then(m => ({ default: m.MapsPage })));
const TimelinePage = lazy(() => import("@/pages/TimelinePage").then(m => ({ default: m.TimelinePage })));
const GraphPage = lazy(() => import("@/pages/GraphPage").then(m => ({ default: m.GraphPage })));
const StoriesPage = lazy(() => import("@/pages/StoriesPage").then(m => ({ default: m.StoriesPage })));
const StoryPlayerPage = lazy(() => import("@/pages/StoryPlayerPage").then(m => ({ default: m.StoryPlayerPage })));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage").then(m => ({ default: m.NotFoundPage })));
const HubIndexPage = lazy(() => import("@/pages/HubIndexPage").then(m => ({ default: m.HubIndexPage })));
const SignupPage = lazy(() => import("@/pages/SignupPage").then(m => ({ default: m.SignupPage })));
const AccountPage = lazy(() => import("@/pages/AccountPage").then(m => ({ default: m.AccountPage })));
const PrivacyPage = lazy(() => import("@/pages/PrivacyPage").then(m => ({ default: m.PrivacyPage })));

export function App() {
  const { loading, error, reload, isHubRoot } = useShowcase();
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  // Hub root: no per-world data. Small router for the landing +
  // signup/account pages, all rendered without the per-world Layout
  // (which depends on world metadata that doesn't exist here).
  if (isHubRoot) {
    return (
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<HubIndexPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="*" element={<HubIndexPage />} />
        </Routes>
      </Suspense>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <ShowcaseEmptyState
          className="max-w-md animate-pulse"
          title="Loading World Data"
          description="Preparing the codex, maps, and stories for this world."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <ShowcaseEmptyState
          className="max-w-md"
          title="Failed to Load"
          description={
            <>
              <p className="break-words text-text-secondary">{error}</p>
              <p className="mt-3">
                Make sure <code>public/data/showcase.json</code> exists.
              </p>
              {isOffline && (
                <p className="mt-2">
                  Your device appears to be offline. Reconnect and try again.
                </p>
              )}
            </>
          }
          actions={
            <>
              <button type="button" onClick={reload} className={showcaseButtonClassNames.primary}>
                Try again
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className={showcaseButtonClassNames.secondary}
              >
                Reload page
              </button>
            </>
          }
        />
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
