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
      <div className="flex min-h-[32rem] flex-col gap-5">
        {/* Top: article editor */}
        <div className="rounded-[24px] border border-white/8 bg-black/12 p-5">
          {selectedArticleId ? (
            <ArticleEditor articleId={selectedArticleId} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-sm text-text-muted">
              <p>Select or create an article to start editing.</p>
              {articleCount === 0 && (
                <button
                  onClick={() => setShowSeedWizard(true)}
                  className="rounded-full border border-[rgba(184,216,232,0.28)] bg-gradient-active-strong px-5 py-2 text-xs font-medium text-text-primary transition hover:shadow-glow-sm"
                >
                  Seed a World with AI
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bottom: compact article list */}
        <div className="rounded-[24px] border border-white/8 bg-black/12 p-4 max-h-[18rem] min-h-0 flex flex-col">
          <div className="mb-2 flex items-center justify-between shrink-0">
            <p className="text-[11px] uppercase tracking-ui text-text-muted">Articles</p>
            <div className="flex gap-1">
              <button
                onClick={() => setShowGenerator(true)}
                title="Generate article with AI"
                className="rounded px-1.5 py-0.5 text-2xs text-accent transition hover:bg-accent/10"
              >
                AI
              </button>
              {articleCount === 0 && (
                <button
                  onClick={() => setShowSeedWizard(true)}
                  title="Generate a starter world with AI"
                  className="rounded px-1.5 py-0.5 text-2xs text-accent transition hover:bg-accent/10"
                >
                  Seed
                </button>
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ArticleTree />
          </div>
        </div>
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
