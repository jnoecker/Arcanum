import { useMemo, useState } from "react";
import { EditorContent, useEditor, type Content } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Mention from "@tiptap/extension-mention";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { DialogShell, ActionButton, Spinner } from "@/components/ui/FormWidgets";
import {
  rewriteArticle,
  type RewriteResult,
  type RetrievalDiagnostic,
} from "@/lib/loreRewrite";
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
      widthClassName={result ? "max-w-6xl" : "max-w-2xl"}
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
          <RetrievalBanner diagnostic={result.diagnostic} />

          {Object.keys(result.fields).length > 0 && (
            <div>
              <h4 className="mb-1 font-display text-2xs uppercase tracking-wider text-text-muted">
                Changed fields
              </h4>
              <ul className="flex flex-col gap-1">
                {Object.entries(result.fields).map(([key, val]) => (
                  <li key={key} className="text-xs text-text-secondary">
                    <span className="text-accent">{key}</span>:{" "}
                    {Array.isArray(val) ? val.join(", ") : String(val)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ContentPane label="Original" content={article.content} />
            <ContentPane label="Rewritten" content={result.content} tone="accent" />
          </div>
        </div>
      )}
    </DialogShell>
  );
}

function RetrievalBanner({ diagnostic }: { diagnostic: RetrievalDiagnostic }) {
  const [expanded, setExpanded] = useState(false);
  const { usedRag, sources } = diagnostic;

  if (!usedRag) {
    return (
      <div className="rounded-lg border border-status-warning/30 bg-status-warning/[0.06] px-3 py-2">
        <p className="text-xs text-status-warning">
          Used legacy world summary (no lore index built yet).
        </p>
        <p className="mt-0.5 text-2xs text-text-muted">
          Rebuild the index from the Lore Index panel for retrieval-aware
          rewrites that draw on related articles, timeline events, and map
          regions.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-accent/25 bg-accent/[0.05] px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-text-secondary">
          <span className="text-accent">Used {sources.length} lore source{sources.length === 1 ? "" : "s"}</span> from your index as context.
        </p>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="focus-ring rounded text-2xs uppercase tracking-wider text-text-muted transition hover:text-text-primary"
        >
          {expanded ? "Hide" : "Show"} sources
        </button>
      </div>
      {expanded && (
        <ul className="mt-2 flex flex-col gap-1">
          {sources.map((s) => (
            <li
              key={`${s.kind}:${s.id}`}
              className="flex items-center gap-2 text-2xs"
            >
              <span className="inline-flex h-4 min-w-12 items-center justify-center rounded bg-bg-tertiary px-1.5 font-mono text-3xs uppercase tracking-wider text-text-muted">
                {s.kind}
              </span>
              <span className="text-text-secondary">{s.title}</span>
              <span className="ml-auto font-mono text-3xs text-text-muted">
                {s.score.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ContentPane({
  label,
  content,
  tone,
}: {
  label: string;
  content: string;
  tone?: "accent";
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <h4
        className={`mb-1 font-display text-2xs uppercase tracking-wider ${
          tone === "accent" ? "text-accent" : "text-text-muted"
        }`}
      >
        {label}
      </h4>
      <div
        className={`ae-prose max-h-[60vh] min-h-[18rem] overflow-y-auto rounded border bg-bg-primary px-4 py-3 text-sm text-text-secondary ${
          tone === "accent" ? "border-accent/30" : "border-border-muted"
        }`}
      >
        <ReadOnlyContent content={content} />
      </div>
    </div>
  );
}

function ReadOnlyContent({ content }: { content: string }) {
  const doc = useMemo(() => parseTiptapJson(content), [content]);
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: { class: "text-accent underline" },
        }),
        Mention.configure({ HTMLAttributes: { class: "mention" } }),
      ],
      content: doc,
      editable: false,
    },
    [doc],
  );

  if (!editor) return null;
  return <EditorContent editor={editor} />;
}

function parseTiptapJson(raw: string): Content {
  if (!raw) return { type: "doc", content: [] };
  if (!raw.startsWith("{")) {
    return {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: raw }] }],
    };
  }
  try {
    return JSON.parse(raw) as Content;
  } catch {
    return {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: raw }] }],
    };
  }
}
