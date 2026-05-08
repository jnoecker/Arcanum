import { ArticleTree } from "../lore/ArticleTree";
import { BulkActionsBar } from "../lore/BulkActionsBar";

export function ArticlesPanel() {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-3">
      <BulkActionsBar />
      <ArticleTree />
    </div>
  );
}
