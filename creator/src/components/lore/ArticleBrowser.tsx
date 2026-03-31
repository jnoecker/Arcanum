import { useLoreStore } from "@/stores/loreStore";
import { ArticleTree } from "./ArticleTree";
import { ArticleEditor } from "./ArticleEditor";

export function ArticleBrowser() {
  const selectedArticleId = useLoreStore((s) => s.selectedArticleId);

  return (
    <div className="grid min-h-[32rem] gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
      {/* Left: tree sidebar */}
      <div className="rounded-[24px] border border-white/8 bg-black/12 p-4">
        <p className="mb-3 text-[11px] uppercase tracking-ui text-text-muted">Articles</p>
        <ArticleTree />
      </div>

      {/* Right: article editor */}
      <div className="rounded-[24px] border border-white/8 bg-black/12 p-5">
        {selectedArticleId ? (
          <ArticleEditor articleId={selectedArticleId} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-text-muted">
            Select or create an article to start editing.
          </div>
        )}
      </div>
    </div>
  );
}
