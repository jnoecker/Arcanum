import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useLoreStore, selectDocuments } from "@/stores/loreStore";
import type { LoreDocument } from "@/types/lore";
import { ActionButton, Spinner } from "@/components/ui/FormWidgets";
import { exportLoreBible } from "@/lib/exportLoreBible";
import { loreBibleToHtml } from "@/lib/loreBibleHtml";
import { ImportWizard } from "./ImportWizard";
import { WorldbuilderImportWizard } from "./WorldbuilderImportWizard";
import { ConfirmDialog } from "@/components/ConfirmDialog";

// ─── Popout shell ────────────────────────────────────────────────────

function Popout({
  label,
  ariaLabel,
  width = "w-64",
  children,
}: {
  label: ReactNode;
  ariaLabel: string;
  width?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <ActionButton
        variant="secondary"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        {label}
      </ActionButton>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            aria-label={ariaLabel}
            className={`absolute right-0 top-full z-20 mt-1 ${width} overflow-hidden rounded-lg border border-[var(--chrome-stroke-strong)] bg-bg-secondary shadow-panel`}
          >
            {children(() => setOpen(false))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Import popout ───────────────────────────────────────────────────

function ImportPopout({
  onQuickImportMd,
  onOpenMarkdownWizard,
  onOpenWorldbuilderWizard,
}: {
  onQuickImportMd: () => void;
  onOpenMarkdownWizard: () => void;
  onOpenWorldbuilderWizard: () => void;
}) {
  return (
    <Popout label="Import" ariaLabel="Import documents">
      {(close) => (
        <>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              onQuickImportMd();
            }}
            className="block w-full border-b border-border-muted px-3 py-2 text-left text-xs text-text-primary transition hover:bg-bg-hover"
          >
            <span className="font-medium">Quick import .md</span>
            <span className="mt-0.5 block text-2xs text-text-muted">
              Pick a single Markdown file
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              onOpenMarkdownWizard();
            }}
            className="block w-full border-b border-border-muted px-3 py-2 text-left text-xs text-text-primary transition hover:bg-bg-hover"
          >
            <span className="font-medium">Markdown wizard</span>
            <span className="mt-0.5 block text-2xs text-text-muted">
              Map headings to articles, eras, or events
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              onOpenWorldbuilderWizard();
            }}
            className="block w-full px-3 py-2 text-left text-xs text-text-primary transition hover:bg-bg-hover"
          >
            <span className="font-medium">Worldbuilder import</span>
            <span className="mt-0.5 block text-2xs text-text-muted">
              Bring in articles from a Worldbuilder export
            </span>
          </button>
        </>
      )}
    </Popout>
  );
}

// ─── Export popout (Lore Bible) ──────────────────────────────────────

function ExportPopout() {
  const lore = useLoreStore((s) => s.lore);
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [exporting, setExporting] = useState<"md" | "pdf" | null>(null);

  const handleExportMarkdown = useCallback(async () => {
    if (!lore) return;
    setExporting("md");
    try {
      const markdown = exportLoreBible(lore, {
        includeDrafts,
        includePrivateNotes: includeNotes,
      });
      const path = await save({
        filters: [{ name: "Markdown", extensions: ["md"] }],
        defaultPath: "lore-bible.md",
      });
      if (path) {
        await writeTextFile(path, markdown);
      }
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(null);
    }
  }, [includeDrafts, includeNotes, lore]);

  const handleExportPdf = useCallback(async () => {
    if (!lore) return;
    setExporting("pdf");
    try {
      const html = loreBibleToHtml(lore, {
        includeDrafts,
        includePrivateNotes: includeNotes,
      });
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 1000);
      }
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExporting(null);
    }
  }, [includeDrafts, includeNotes, lore]);

  return (
    <Popout label="Export" ariaLabel="Export lore" width="w-72">
      {() => (
        <div className="flex flex-col gap-3 p-3">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.18em] text-text-secondary">
              Lore Bible
            </p>
            <p className="mt-1 text-2xs text-text-muted">
              Export the entire lore corpus as a readable document.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={includeDrafts}
                onChange={(e) => setIncludeDrafts(e.target.checked)}
                className="accent-accent"
              />
              Include draft articles
            </label>
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={includeNotes}
                onChange={(e) => setIncludeNotes(e.target.checked)}
                className="accent-accent"
              />
              Include private notes
            </label>
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleExportMarkdown}
              disabled={!lore || exporting !== null}
              className="focus-ring flex items-center justify-center gap-2 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:opacity-40"
            >
              {exporting === "md" ? <Spinner /> : null}
              {exporting === "md" ? "Exporting…" : "Export as Markdown"}
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={!lore || exporting !== null}
              className="focus-ring flex items-center justify-center gap-2 rounded-md border border-[var(--chrome-stroke)] px-3 py-2 text-xs font-medium text-text-secondary transition hover:bg-[var(--chrome-highlight-strong)] hover:text-text-primary disabled:opacity-40"
            >
              {exporting === "pdf" ? <Spinner /> : null}
              {exporting === "pdf" ? "Preparing…" : "Export as PDF"}
            </button>
          </div>
        </div>
      )}
    </Popout>
  );
}

// ─── Document list ───────────────────────────────────────────────────

function DocumentList({
  documents,
  selectedId,
  onSelect,
}: {
  documents: LoreDocument[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (documents.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-8 text-center text-2xs leading-relaxed text-text-muted">
        No documents yet. Use Import or + New to add one.
      </div>
    );
  }
  return (
    <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1.5 py-1">
      {documents.map((doc) => {
        const selected = doc.id === selectedId;
        return (
          <li key={doc.id}>
            <button
              type="button"
              onClick={() => onSelect(doc.id)}
              aria-current={selected}
              className={`focus-ring block w-full rounded-md px-2.5 py-2 text-left transition ${
                selected
                  ? "bg-accent/15 text-text-primary"
                  : "text-text-secondary hover:bg-[var(--chrome-highlight-strong)]"
              }`}
            >
              <div className="truncate text-xs font-medium">{doc.title}</div>
              {doc.filename && (
                <div className="truncate text-[0.625rem] text-text-muted">{doc.filename}</div>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Editor ─────────────────────────────────────────────────────────

function DocumentEditor({
  document: doc,
  onPatch,
  onDelete,
}: {
  document: LoreDocument;
  onPatch: (patch: Partial<LoreDocument>) => void;
  onDelete: () => void;
}) {
  const [titleDraft, setTitleDraft] = useState(doc.title);
  const [contentDraft, setContentDraft] = useState(doc.content);
  const [contentFocused, setContentFocused] = useState(false);
  const [titleFocused, setTitleFocused] = useState(false);

  // Sync external changes when the user isn't actively editing.
  if (!titleFocused && titleDraft !== doc.title) setTitleDraft(doc.title);
  if (!contentFocused && contentDraft !== doc.content) setContentDraft(doc.content);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <input
          className="w-full bg-transparent font-display text-xl text-text-primary outline-none placeholder:text-text-muted/50 focus-visible:ring-2 focus-visible:ring-border-active"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onFocus={() => setTitleFocused(true)}
          onBlur={() => {
            setTitleFocused(false);
            if (titleDraft !== doc.title) {
              onPatch({ title: titleDraft, updatedAt: new Date().toISOString() });
            }
          }}
          placeholder="Document title"
          aria-label="Document title"
        />
        <button
          type="button"
          onClick={onDelete}
          className="focus-ring shrink-0 rounded-full border border-status-danger/40 bg-status-danger/10 px-3 py-1.5 text-2xs text-status-danger transition hover:bg-status-danger/20"
        >
          Delete
        </button>
      </div>
      <textarea
        value={contentDraft}
        onChange={(e) => setContentDraft(e.target.value)}
        onFocus={() => setContentFocused(true)}
        onBlur={() => {
          setContentFocused(false);
          if (contentDraft !== doc.content) {
            onPatch({ content: contentDraft, updatedAt: new Date().toISOString() });
          }
        }}
        placeholder="Write your notes here (Markdown supported)…"
        className="ornate-input min-h-0 flex-1 w-full resize-none px-4 py-3 text-base leading-[1.7] font-serif text-text-primary"
        aria-label="Document content"
      />
      <p className="text-2xs text-text-muted">
        Last updated: {new Date(doc.updatedAt).toLocaleString()}
      </p>
    </div>
  );
}

// ─── Panel ──────────────────────────────────────────────────────────

const PANEL_CARD_CLASSES =
  "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] shadow-[0_1px_0_rgb(var(--highlight-rgb)/0.04)_inset,0_8px_24px_-12px_rgb(0_0_0/0.35)] backdrop-blur-sm";

export function DocumentLibraryPanel() {
  const documents = useLoreStore(selectDocuments);
  const createDocument = useLoreStore((s) => s.createDocument);
  const updateDocument = useLoreStore((s) => s.updateDocument);
  const deleteDocument = useLoreStore((s) => s.deleteDocument);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showWorldbuilderWizard, setShowWorldbuilderWizard] = useState(false);

  const selected = selectedId ? documents.find((d) => d.id === selectedId) ?? null : null;

  const handleQuickImportMd = useCallback(async () => {
    try {
      const filePath = await open({
        multiple: false,
        filters: [
          { name: "Documents", extensions: ["md", "txt", "markdown"] },
          { name: "All files", extensions: ["*"] },
        ],
      });
      if (!filePath) return;

      const content = await invoke<string>("read_text_file", { filePath: String(filePath) });
      const filename = filePath.split(/[/\\]/).pop() ?? "document.md";
      const title = filename
        .replace(/\.\w+$/, "")
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase());
      const now = new Date().toISOString();
      const doc: LoreDocument = {
        id: `doc_${Date.now()}`,
        title,
        content,
        filename,
        createdAt: now,
        updatedAt: now,
      };
      createDocument(doc);
      setSelectedId(doc.id);
    } catch (err) {
      console.error("Document import failed:", err);
    }
  }, [createDocument]);

  const handleCreate = useCallback(() => {
    const now = new Date().toISOString();
    const doc: LoreDocument = {
      id: `doc_${Date.now()}`,
      title: "Untitled Document",
      content: "",
      createdAt: now,
      updatedAt: now,
    };
    createDocument(doc);
    setSelectedId(doc.id);
  }, [createDocument]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.6rem] uppercase tracking-[0.32em] text-[var(--color-warm)]/80">
            Archive
          </p>
          <h1 className="mt-0.5 font-display text-2xl text-text-primary">Documents</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-2xs uppercase tracking-[0.2em] text-text-muted sm:inline">
            {documents.length} {documents.length === 1 ? "document" : "documents"}
          </span>
          <ActionButton variant="primary" size="sm" onClick={handleCreate}>
            + New
          </ActionButton>
          <ImportPopout
            onQuickImportMd={handleQuickImportMd}
            onOpenMarkdownWizard={() => setShowImportWizard(true)}
            onOpenWorldbuilderWizard={() => setShowWorldbuilderWizard(true)}
          />
          <ExportPopout />
        </div>
      </header>

      {/* Body */}
      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className={PANEL_CARD_CLASSES}>
          <DocumentList
            documents={documents}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </aside>

        <section className={PANEL_CARD_CLASSES}>
          {selected ? (
            <DocumentEditor
              document={selected}
              onPatch={(patch) => updateDocument(selected.id, patch)}
              onDelete={() => setConfirmDelete(true)}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 py-16 text-center text-sm text-text-muted">
              Select a document on the left, or use <span className="mx-1 font-medium text-text-secondary">+ New</span>
              to start one.
            </div>
          )}
        </section>
      </div>

      {confirmDelete && selected && (
        <ConfirmDialog
          title="Delete document"
          message={`Delete "${selected.title}"? The document and its contents will be removed from this project.`}
          confirmLabel="Delete"
          cancelLabel="Keep it"
          destructive
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            deleteDocument(selected.id);
            setSelectedId(null);
          }}
        />
      )}

      {showImportWizard && (
        <ImportWizard onClose={() => setShowImportWizard(false)} />
      )}
      {showWorldbuilderWizard && (
        <WorldbuilderImportWizard onClose={() => setShowWorldbuilderWizard(false)} />
      )}
    </div>
  );
}
