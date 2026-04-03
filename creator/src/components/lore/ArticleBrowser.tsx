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
          <div className="flex min-h-[28rem] flex-col items-center justify-center gap-4 px-6 py-12 text-center text-sm text-text-muted">
            <p className="max-w-md leading-7">
              Select an article from the sidebar to begin editing.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowGenerator(true)}
                title="Generate article with AI"
                className="focus-ring shell-pill rounded-full px-4 py-2 text-xs font-medium"
              >
                Generate Article
              </button>
              {articleCount === 0 && (
                <button
                  onClick={() => setShowSeedWizard(true)}
                  className="focus-ring shell-pill-primary rounded-full px-4 py-2 text-xs font-medium"
                >
                  Seed the Setting
                </button>
              )}
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
