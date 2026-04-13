import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { useLoreStore } from "@/stores/loreStore";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { parseMarkdownFile, type ImportCandidate } from "@/lib/loreImport";
import type { ArticleTemplate } from "@/types/lore";
import { TEMPLATE_SCHEMAS } from "@/lib/loreTemplates";

type WizardStep = "select" | "review" | "done";

/** Recursively collect all .md files from a directory tree. */
async function collectMarkdownFiles(
  dir: string,
  rootDir: string,
  errors: string[] = [],
): Promise<{ relativePath: string; fullPath: string }[]> {
  const results: { relativePath: string; fullPath: string }[] = [];
  try {
    const entries = await readDir(dir);
    for (const entry of entries) {
      if (!entry.name) continue;
      const fullPath = `${dir}/${entry.name}`;
      if (entry.isDirectory) {
        // Recurse into subdirectories (skip hidden folders like .obsidian)
        if (!entry.name.startsWith(".")) {
          const nested = await collectMarkdownFiles(fullPath, rootDir, errors);
          results.push(...nested);
        }
      } else if (entry.name.endsWith(".md")) {
        // Build a relative path from the root folder
        const relative = fullPath.slice(rootDir.length + 1).replace(/\\/g, "/");
        results.push({ relativePath: relative, fullPath });
      }
    }
  } catch (err) {
    const relative = dir.slice(rootDir.length + 1).replace(/\\/g, "/") || dir;
    console.warn(`Failed to read directory ${dir}:`, err);
    errors.push(relative);
  }
  return results;
}

export function ImportWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<WizardStep>("select");
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [scanErrors, setScanErrors] = useState<string[]>([]);
  const createArticle = useLoreStore((s) => s.createArticle);
  const articles = useLoreStore((s) => s.lore?.articles ?? {});
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  const handleSelectFolder = useCallback(async () => {
    const folder = await open({
      directory: true,
      title: "Select Markdown folder",
    });
    if (!folder || typeof folder !== "string") return;

    setLoading(true);
    setScanErrors([]);
    try {
      const dirErrors: string[] = [];
      const files = await collectMarkdownFiles(folder, folder, dirErrors);
      const parsed: ImportCandidate[] = [];
      const errors: string[] = [...dirErrors];
      for (const file of files) {
        try {
          const content = await readTextFile(file.fullPath);
          parsed.push(parseMarkdownFile(file.relativePath, content));
        } catch (err) {
          console.warn(`Failed to read ${file.relativePath}:`, err);
          errors.push(file.relativePath);
        }
      }
      setScanErrors(errors);
      setCandidates(parsed);
      setStep("review");
    } catch (err) {
      console.error("Failed to scan folder:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleImport = useCallback(() => {
    const selected = candidates.filter((c) => c.selected);
    const now = new Date().toISOString();
    // Snapshot current article IDs plus any we create during this loop
    const usedIds = new Set(Object.keys(articles));
    let count = 0;

    for (const candidate of selected) {
      let id = candidate.title
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");
      if (!id) id = "untitled";

      // Avoid duplicates
      if (usedIds.has(id)) {
        let suffix = 2;
        while (usedIds.has(`${id}_${suffix}`)) suffix++;
        id = `${id}_${suffix}`;
      }
      usedIds.add(id);

      createArticle({
        id,
        template: candidate.template,
        title: candidate.title,
        fields: candidate.fields,
        content: candidate.tiptapContent,
        tags: candidate.tags.length > 0 ? candidate.tags : undefined,
        draft: true,
        createdAt: now,
        updatedAt: now,
      });
      count++;
    }

    setImportedCount(count);
    setStep("done");
  }, [candidates, articles, createArticle]);

  const toggleCandidate = (idx: number) => {
    setCandidates((prev) =>
      prev.map((c, i) =>
        i === idx ? { ...c, selected: !c.selected } : c,
      ),
    );
  };

  const setTemplate = (idx: number, template: ArticleTemplate) => {
    setCandidates((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, template } : c)),
    );
  };

  const toggleAll = () => {
    const allSelected = candidates.every((c) => c.selected);
    setCandidates((prev) => prev.map((c) => ({ ...c, selected: !allSelected })));
  };

  const templateOptions = Object.entries(TEMPLATE_SCHEMAS).map(([key, s]) => ({
    value: key,
    label: s.label,
  }));
  const selectedCount = candidates.filter((c) => c.selected).length;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-surface-scrim"
        onClick={onClose}
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Import Markdown files"
        className="relative flex w-full max-w-2xl max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-[var(--chrome-stroke)] bg-bg-primary shadow-[var(--shadow-dialog)]"
      >
        {/* Header */}
        <div className="shrink-0 border-b border-[var(--chrome-stroke)] px-6 py-4">
          <h2 className="font-display text-lg text-text-primary">
            Import Markdown
          </h2>
          <p className="mt-1 text-2xs text-text-secondary">
            {step === "select" &&
              "Select a folder of Markdown files to import as lore articles."}
            {step === "review" &&
              `${candidates.length} file${candidates.length !== 1 ? "s" : ""} found. Review and import.`}
            {step === "done" &&
              `${importedCount} article${importedCount !== 1 ? "s" : ""} imported as drafts.`}
          </p>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {step === "select" && (
            <div className="flex flex-col items-center gap-4 py-12">
              <p className="text-sm text-text-muted">
                Supports Obsidian vaults, plain Markdown, and Notion exports.
              </p>
              <button
                onClick={handleSelectFolder}
                disabled={loading}
                className="focus-ring rounded-full border border-accent/30 bg-accent/10 px-6 py-3 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:opacity-40"
              >
                {loading ? "Scanning..." : "Choose Folder"}
              </button>
            </div>
          )}

          {step === "review" && (
            <div className="flex flex-col gap-2">
              {scanErrors.length > 0 && (
                <div className="mb-3 rounded-lg border border-status-warning/30 bg-status-warning/5 px-4 py-2 text-2xs text-status-warning">
                  {scanErrors.length} file{scanErrors.length !== 1 ? "s" : ""} couldn't be read and were skipped.
                </div>
              )}
              {candidates.length > 1 && (
                <button
                  onClick={toggleAll}
                  className="mb-1 self-start text-2xs text-text-muted hover:text-text-secondary transition"
                >
                  {candidates.every((c) => c.selected)
                    ? "Deselect all"
                    : "Select all"}
                </button>
              )}
              {candidates.map((c, i) => (
                <div
                  key={c.filePath}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                    c.selected
                      ? "border-accent/20 bg-accent/5"
                      : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] opacity-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={c.selected}
                    onChange={() => toggleCandidate(i)}
                    className="accent-accent"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-text-primary">
                      {c.title}
                    </span>
                    <span className="block truncate text-3xs text-text-muted">
                      {c.filePath}
                    </span>
                    {c.tags.length > 0 && (
                      <span className="block truncate text-3xs text-text-muted/60">
                        {c.tags.join(", ")}
                      </span>
                    )}
                  </div>
                  <select
                    value={c.template}
                    onChange={(e) =>
                      setTemplate(i, e.target.value as ArticleTemplate)
                    }
                    className="ornate-input px-2 py-1 text-xs"
                  >
                    {templateOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {candidates.length === 0 && (
                <p className="py-6 text-center text-sm text-text-muted">
                  No .md files found in the selected folder.
                </p>
              )}
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-12">
              <p className="font-display text-lg text-accent">
                {importedCount} article{importedCount !== 1 ? "s" : ""} imported
              </p>
              <p className="text-sm text-text-secondary">
                All imported articles are marked as drafts for review.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[var(--chrome-stroke)] px-6 py-3 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs text-text-muted hover:text-text-primary transition"
          >
            {step === "done" ? "Close" : "Cancel"}
          </button>
          <div className="flex gap-2">
            {step === "review" && candidates.length === 0 && (
              <button
                onClick={() => setStep("select")}
                className="text-xs text-text-muted hover:text-text-primary transition"
              >
                Back
              </button>
            )}
            {step === "review" && (
              <button
                onClick={handleImport}
                disabled={selectedCount === 0}
                className="focus-ring rounded-full border border-accent/30 bg-accent/10 px-5 py-2 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:opacity-40"
              >
                Import {selectedCount} article
                {selectedCount !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
