import { useState } from "react";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import { ArticleTree } from "./ArticleTree";
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
      <div className="grid min-h-[32rem] gap-5 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
        <aside className="panel-surface rounded-[24px] p-4 xl:sticky xl:top-5 xl:flex xl:max-h-[calc(100vh-17rem)] xl:flex-col xl:overflow-hidden">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-ui text-text-muted">Library</p>
              <h3 className="mt-2 font-display text-xl text-text-primary">World articles</h3>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setShowGenerator(true)}
                title="Generate article with AI"
                className="focus-ring shell-pill rounded-full px-2.5 py-1 text-2xs"
              >
                Generate
              </button>
              {articleCount === 0 && (
                <button
                  onClick={() => setShowSeedWizard(true)}
                  title="Create a starter world"
                  className="focus-ring shell-pill-primary rounded-full px-2.5 py-1 text-2xs"
                >
                  Seed
                </button>
              )}
            </div>
          </div>
          <p className="mb-3 text-xs leading-6 text-text-secondary">
            Keep the world canon close while you write. Select an article on the left and shape it in the main editor.
          </p>
          <div className="min-h-[18rem] xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
            <ArticleTree />
          </div>
        </aside>

        <section className="panel-surface rounded-[24px] p-5">
          {selectedArticleId ? (
            <ArticleEditor articleId={selectedArticleId} />
          ) : (
            <div className="flex min-h-[28rem] flex-col items-center justify-center gap-4 px-6 py-12 text-center text-sm text-text-muted">
              <p className="max-w-md leading-7">
                Select an article from the library or begin the setting with a seeded canon scaffold.
              </p>
              {articleCount === 0 && (
                <button
                  onClick={() => setShowSeedWizard(true)}
                  className="focus-ring shell-pill-primary rounded-full px-5 py-2 text-xs font-medium"
                >
                  Seed the setting
                </button>
              )}
            </div>
          )}
        </section>
      </div>

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
