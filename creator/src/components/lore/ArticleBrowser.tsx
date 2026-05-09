import { useState, useEffect } from "react";
import { useLoreStore, selectArticleCount, selectArticles } from "@/stores/loreStore";
import { ArticleEditorV2 } from "./editor/ArticleEditorV2";
import { ArticleGenerator } from "./ArticleGenerator";
import { NewArticleDialog } from "./NewArticleDialog";
import { WorldSeedWizard } from "./WorldSeedWizard";
import { StoryEditorPanel } from "./StoryEditorPanel";

export function ArticleBrowser() {
  const selectedArticleId = useLoreStore((s) => s.selectedArticleId);
  const selectArticle = useLoreStore((s) => s.selectArticle);
  const articles = useLoreStore(selectArticles);
  const articleCount = useLoreStore(selectArticleCount);
  const selectedArticle = selectedArticleId ? articles[selectedArticleId] : null;
  const [showGenerator, setShowGenerator] = useState(false);
  const [showNewArticle, setShowNewArticle] = useState(false);
  const [showSeedWizard, setShowSeedWizard] = useState(false);

  useEffect(() => {
    if (!selectedArticleId && articleCount === 1) {
      const onlyId = Object.keys(articles)[0];
      if (onlyId) selectArticle(onlyId);
    }
  }, [selectedArticleId, articleCount, articles, selectArticle]);

  // The new ArticleEditorV2 owns its own chrome (topbar, status bar, scroll containers),
  // so it bypasses the panel-surface wrapper below to use the full height.
  if (selectedArticle?.template === "story" && typeof selectedArticle.fields.storyId === "string" && selectedArticle.fields.storyId) {
    return (
      <section className="panel-surface min-h-[32rem] rounded-3xl p-5">
        <StoryEditorPanel storyId={selectedArticle.fields.storyId} />
      </section>
    );
  }
  if (selectedArticleId) {
    return (
      <div className="flex h-full min-h-[42rem] flex-1 flex-col">
        <ArticleEditorV2 articleId={selectedArticleId} />
      </div>
    );
  }

  return (
    <>
      <section className="panel-surface min-h-[32rem] rounded-3xl p-5">
        <div className="flex min-h-[28rem] flex-col items-center justify-center gap-6 px-6 py-12 text-center">
          <div className="ornate-divider" />
          <div>
            <p className="font-display text-lg text-text-primary">
              {articleCount === 0 ? "Begin the canon" : "Choose an article"}
            </p>
            <p className="mt-2 max-w-sm text-sm leading-7 text-text-muted">
              {articleCount === 0
                ? "Every world starts with a single entry. Seed an entire setting or write the first article by hand."
                : "Select an article from the sidebar, or create a new one below."}
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            {articleCount === 0 && (
              <button
                onClick={() => setShowSeedWizard(true)}
                className="focus-ring action-button action-button-primary action-button-md"
              >
                Seed the Setting
              </button>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setShowNewArticle(true)}
                title="Create a blank article"
                className={`focus-ring action-button ${articleCount === 0 ? "action-button-secondary action-button-sm" : "action-button-primary action-button-md"}`}
              >
                New Article
              </button>
              <button
                onClick={() => setShowGenerator(true)}
                title="Generate article with AI"
                className={`focus-ring action-button ${articleCount === 0 ? "action-button-secondary action-button-sm" : "action-button-secondary action-button-md"}`}
              >
                Generate Article
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Dialogs */}
      {showGenerator && (
        <ArticleGenerator onClose={() => setShowGenerator(false)} />
      )}
      {showNewArticle && (
        <NewArticleDialog onClose={() => setShowNewArticle(false)} />
      )}
      {showSeedWizard && (
        <WorldSeedWizard onClose={() => setShowSeedWizard(false)} />
      )}
    </>
  );
}
