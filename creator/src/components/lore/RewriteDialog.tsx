import { useState } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { DialogShell, ActionButton, Spinner } from "@/components/ui/FormWidgets";
import { rewriteArticle, type RewriteResult } from "@/lib/loreRewrite";
import type { Article } from "@/types/lore";

interface RewriteDialogProps {
  article: Article;
  onAccept: (result: RewriteResult) => void;
  onClose: () => void;
}

export function RewriteDialog({ article, onAccept, onClose }: RewriteDialogProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RewriteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRewrite = async () => {
    if (!instructions.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await rewriteArticle(article, instructions);
      setResult(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (result) {
      onAccept(result);
      onClose();
    }
  };

  return (
    <DialogShell
      dialogRef={trapRef}
      titleId="rewrite-dialog-title"
      title="Rewrite with Instructions"
      subtitle={article.title}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <ActionButton variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </ActionButton>
          {result ? (
            <ActionButton variant="primary" size="sm" onClick={handleAccept}>
              Accept Rewrite
            </ActionButton>
          ) : (
            <ActionButton
              variant="primary"
              size="sm"
              onClick={handleRewrite}
              disabled={!instructions.trim() || loading}
            >
              {loading ? <><Spinner /> Rewriting...</> : "Rewrite"}
            </ActionButton>
          )}
        </div>
      }
    >
      {!result ? (
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="rewrite-instructions" className="mb-1 block text-2xs uppercase tracking-wider text-text-muted">
              Instructions
            </label>
            <textarea
              id="rewrite-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Rewrite this article with Kirot as an Archae instead of an Alorae, and update the personality to reflect their crystalline nature..."
              rows={4}
              className="w-full resize-y rounded border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
              autoFocus
            />
            <p className="mt-1 text-2xs text-text-muted">
              Describe what to change. The AI will rewrite the article content and update relevant fields.
            </p>
          </div>
          {error && (
            <p className="text-xs text-status-error">{error}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-status-success">Rewrite complete. Review and accept, or close to discard.</p>
          {Object.keys(result.fields).length > 0 && (
            <div>
              <h4 className="mb-1 text-2xs uppercase tracking-wider text-text-muted">Changed fields</h4>
              <ul className="flex flex-col gap-1">
                {Object.entries(result.fields).map(([key, val]) => (
                  <li key={key} className="text-xs text-text-secondary">
                    <span className="text-accent">{key}</span>: {Array.isArray(val) ? val.join(", ") : String(val)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h4 className="mb-1 text-2xs uppercase tracking-wider text-text-muted">Rewritten content preview</h4>
            <div className="max-h-60 overflow-y-auto rounded border border-border-muted bg-bg-primary p-3 text-sm text-text-secondary">
              {result.content.length > 200 ? result.content.slice(0, 200) + "..." : result.content}
            </div>
          </div>
        </div>
      )}
    </DialogShell>
  );
}
