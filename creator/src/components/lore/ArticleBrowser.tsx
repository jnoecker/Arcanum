import { useState } from "react";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import { ArticleEditor } from "./ArticleEditor";
import { ArticleGenerator } from "./ArticleGenerator";
import { WorldSeedWizard } from "./WorldSeedWizard";

export function ArticleBrowser() {
  const selectedArticleId = useLoreStore((s) => s.selectedArticleId);
  const articles = useLoreStore(selectArticles);
  const articleCount = Object.keys(articles).length;
  const [showGenerator, setShowGenerator] = useState(false);
  const [showSeedWizard, setShowSeedWizard] = useState(false);

  return (
    <>
      <section className="panel-surface min-h-[32rem] rounded-[24px] p-5">
        {selectedArticleId ? (
          <ArticleEditor articleId={selectedArticleId} />
        ) : (
          <div className="flex min-h-[28rem] flex-col items-center justify-center gap-6 px-6 py-12 text-center">
            <div className="mx-auto h-px w-16 bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
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
              <button
                onClick={() => setShowGenerator(true)}
                title="Generate article with AI"
                className={`focus-ring ${articleCount === 0 ? "action-button action-button-secondary action-button-sm" : "action-button action-button-primary action-button-md"}`}
              >
                Generate Article
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Dialogs */}
      {showGenerator && (
        <ArticleGenerator onClose={() => setShowGenerator(false)} />
      )}
      {showSeedWizard && (
        <WorldSeedWizard onClose={() => setShowSeedWizard(false)} />
      )}
    </>
  );
}
