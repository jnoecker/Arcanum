import { useState } from "react";
import { useLoreStore } from "@/stores/loreStore";
import { ArticleTree } from "./ArticleTree";
import { ArticleEditor } from "./ArticleEditor";
import { ArticleGenerator } from "./ArticleGenerator";
import { WorldSeedWizard } from "./WorldSeedWizard";

export function ArticleBrowser() {
  const selectedArticleId = useLoreStore((s) => s.selectedArticleId);
  const articleCount = useLoreStore((s) => Object.keys(s.lore?.articles ?? {}).length);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showSeedWizard, setShowSeedWizard] = useState(false);

  return (
    <>
      <div className="grid min-h-[32rem] gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
        {/* Left: tree sidebar */}
        <div className="rounded-[24px] border border-white/8 bg-black/12 p-4">
          <div className="mb-3 flex items-center justify-between">
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
          <ArticleTree />
        </div>

        {/* Right: article editor */}
        <div className="rounded-[24px] border border-white/8 bg-black/12 p-5">
          {selectedArticleId ? (
            <ArticleEditor articleId={selectedArticleId} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-sm text-text-muted">
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
