import { useMemo, useState } from "react";
import { useLoreStore } from "@/stores/loreStore";
import { useProjectStore } from "@/stores/projectStore";
import { panelTab } from "@/lib/panelRegistry";
import { TEMPLATE_OPTIONS } from "@/lib/loreTemplates";
import { DialogShell, ActionButton } from "@/components/ui/FormWidgets";
import type { ArticleTemplate } from "@/types/lore";

interface NewArticleDialogProps {
  onClose: () => void;
}

export function NewArticleDialog({ onClose }: NewArticleDialogProps) {
  const articles = useLoreStore((s) => s.lore?.articles ?? {});
  const createArticle = useLoreStore((s) => s.createArticle);
  const selectArticle = useLoreStore((s) => s.selectArticle);
  const openTab = useProjectStore((s) => s.openTab);

  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<ArticleTemplate>("freeform");
  const [error, setError] = useState<string | null>(null);

  const idPreview = useMemo(
    () => title.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
    [title],
  );

  const canCreate = idPreview.length > 0 && !articles[idPreview];

  const handleCreate = () => {
    if (!canCreate) return;
    if (articles[idPreview]) {
      setError(`An article with id "${idPreview}" already exists.`);
      return;
    }
    const now = new Date().toISOString();
    createArticle({
      id: idPreview,
      template,
      title: title.trim(),
      fields: {},
      content: "",
      createdAt: now,
      updatedAt: now,
    });
    selectArticle(idPreview);
    openTab(panelTab("lore"));
    onClose();
  };

  return (
    <DialogShell
      titleId="new-article-dialog-title"
      title="New Article"
      widthClassName="max-w-md"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <ActionButton variant="ghost" onClick={onClose}>
            Never Mind
          </ActionButton>
          <ActionButton
            variant="primary"
            onClick={handleCreate}
            disabled={!canCreate}
            className={!canCreate ? "opacity-45 cursor-not-allowed" : ""}
          >
            Create Article
          </ActionButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-article-title" className="text-xs text-text-muted">
            Title
          </label>
          <input
            id="new-article-title"
            type="text"
            placeholder="The Whispering Library"
            autoFocus
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canCreate) handleCreate();
            }}
            className="w-full rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-text-primary placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
          />
          {idPreview && (
            <span className="font-mono text-3xs text-text-muted">id: {idPreview}</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-article-template" className="text-xs text-text-muted">
            Template
          </label>
          <select
            id="new-article-template"
            value={template}
            onChange={(e) => setTemplate(e.target.value as ArticleTemplate)}
            className="w-full rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-text-primary focus:border-accent focus:outline-none"
          >
            {TEMPLATE_OPTIONS.filter((opt) => opt.value !== "story").map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-sm text-status-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </DialogShell>
  );
}
