import { useState } from "react";
import { useLoreStore } from "@/stores/loreStore";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export function BulkActionsBar() {
  const selectedIds = useLoreStore((s) => s.selectedArticleIds);
  const clearSelection = useLoreStore((s) => s.clearArticleSelection);
  const bulkDelete = useLoreStore((s) => s.bulkDelete);
  const bulkSetDraft = useLoreStore((s) => s.bulkSetDraft);
  const bulkAddTags = useLoreStore((s) => s.bulkAddTags);
  const [showDelete, setShowDelete] = useState(false);
  const [showTag, setShowTag] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const ids = [...selectedIds];
  if (ids.length < 2) return null;

  return (
    <div className="relative mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2">
      <span className="text-2xs font-medium text-accent">
        {ids.length} selected
      </span>

      <button
        onClick={() => bulkSetDraft(ids, true)}
        className="rounded-full border border-white/8 px-2 py-0.5 text-[10px] text-text-secondary hover:bg-white/8"
      >
        Draft
      </button>
      <button
        onClick={() => bulkSetDraft(ids, false)}
        className="rounded-full border border-white/8 px-2 py-0.5 text-[10px] text-text-secondary hover:bg-white/8"
      >
        Publish
      </button>
      <button
        onClick={() => setShowTag(true)}
        className="rounded-full border border-white/8 px-2 py-0.5 text-[10px] text-text-secondary hover:bg-white/8"
      >
        Tag
      </button>
      <button
        onClick={() => setShowDelete(true)}
        className="rounded-full border border-white/8 px-2 py-0.5 text-[10px] text-status-danger hover:bg-status-danger/10"
      >
        Delete
      </button>
      <button
        onClick={clearSelection}
        className="ml-auto text-[10px] text-text-muted hover:text-text-primary"
      >
        Clear
      </button>

      {showTag && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-white/10 bg-bg-primary p-3 shadow-lg">
          <div className="flex gap-1.5">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Tag to add..."
              className="ornate-input min-w-0 flex-1 rounded px-2 py-1 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && tagInput.trim()) {
                  bulkAddTags(ids, [tagInput.trim()]);
                  setTagInput("");
                  setShowTag(false);
                }
                if (e.key === "Escape") setShowTag(false);
              }}
              autoFocus
            />
            <button
              onClick={() => {
                if (tagInput.trim()) {
                  bulkAddTags(ids, [tagInput.trim()]);
                  setTagInput("");
                }
                setShowTag(false);
              }}
              className="rounded-full border border-accent/30 bg-accent/10 px-2 py-1 text-[10px] text-accent"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {showDelete && (
        <ConfirmDialog
          title="Delete Articles"
          message={`Delete ${ids.length} articles? This cannot be undone.`}
          confirmLabel={`Delete ${ids.length}`}
          destructive
          onConfirm={() => {
            bulkDelete(ids);
            setShowDelete(false);
          }}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}
