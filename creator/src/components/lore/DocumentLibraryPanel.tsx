import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useLoreStore, selectDocuments } from "@/stores/loreStore";
import type { LoreDocument } from "@/types/lore";
import { Section, CommitTextarea } from "@/components/ui/FormWidgets";

export function DocumentLibraryPanel() {
  const documents = useLoreStore(selectDocuments);
  const createDocument = useLoreStore((s) => s.createDocument);
  const updateDocument = useLoreStore((s) => s.updateDocument);
  const deleteDocument = useLoreStore((s) => s.deleteDocument);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const selected = selectedId ? documents.find((d) => d.id === selectedId) ?? null : null;

  const handleImport = useCallback(async () => {
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
      const title = filename.replace(/\.\w+$/, "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
    const title = newTitle.trim() || "Untitled Document";
    const now = new Date().toISOString();
    const doc: LoreDocument = {
      id: `doc_${Date.now()}`,
      title,
      content: "",
      createdAt: now,
      updatedAt: now,
    };
    createDocument(doc);
    setSelectedId(doc.id);
    setNewTitle("");
  }, [newTitle, createDocument]);

  return (
    <div className="flex gap-6">
      {/* Sidebar list */}
      <div className="w-64 shrink-0 space-y-3">
        <div className="flex gap-2">
          <button
            onClick={handleImport}
            className="rounded-full border border-[rgba(184,216,232,0.28)] bg-gradient-active-strong px-3 py-1.5 text-xs text-text-primary transition hover:shadow-glow-sm"
          >
            Import .md
          </button>
          <button
            onClick={handleCreate}
            className="rounded border border-border-default bg-bg-secondary px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary"
          >
            New
          </button>
        </div>

        <div className="space-y-1">
          {documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setSelectedId(doc.id)}
              className={`w-full rounded px-2.5 py-2 text-left transition ${
                selectedId === doc.id
                  ? "bg-accent/15 text-text-primary"
                  : "text-text-secondary hover:bg-bg-tertiary"
              }`}
            >
              <div className="text-xs font-medium truncate">{doc.title}</div>
              {doc.filename && (
                <div className="text-[10px] text-text-muted truncate">{doc.filename}</div>
              )}
            </button>
          ))}
          {documents.length === 0 && (
            <p className="px-2 py-4 text-xs text-text-muted">
              No documents yet. Import a .md file or create a new one.
            </p>
          )}
        </div>
      </div>

      {/* Detail editor */}
      <div className="min-w-0 flex-1">
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <input
                className="w-full bg-transparent font-display text-xl text-text-primary outline-none placeholder:text-text-muted/50"
                value={selected.title}
                onChange={(e) => updateDocument(selected.id, { title: e.target.value, updatedAt: new Date().toISOString() })}
                placeholder="Document title"
              />
              <button
                onClick={() => {
                  if (window.confirm(`Delete "${selected.title}"?`)) {
                    deleteDocument(selected.id);
                    setSelectedId(null);
                  }
                }}
                className="shrink-0 rounded-full border border-status-danger/40 bg-status-danger/10 px-3 py-1.5 text-2xs text-status-danger hover:bg-status-danger/15"
              >
                Delete
              </button>
            </div>

            <Section title="Content" defaultExpanded>
              <CommitTextarea
                label=""
                value={selected.content}
                onCommit={(v) => updateDocument(selected.id, { content: v, updatedAt: new Date().toISOString() })}
                placeholder="Write your notes here (Markdown supported)..."
                rows={24}
              />
            </Section>

            <div className="text-2xs text-text-muted">
              Last updated: {new Date(selected.updatedAt).toLocaleString()}
            </div>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-text-muted">
            Select a document or create a new one.
          </div>
        )}
      </div>
    </div>
  );
}
