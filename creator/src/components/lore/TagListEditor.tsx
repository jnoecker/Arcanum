import { useState } from "react";

// ─── Reusable string-list editor (tags, keywords, themes, etc.) ───

interface TagListEditorProps {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  label?: string;
}

export function TagListEditor({
  items,
  onChange,
  placeholder = "Add tag\u2026",
  label,
}: TagListEditorProps) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setDraft("");
  };

  return (
    <div>
      {label && (
        <div className="mb-1 text-xs font-medium text-text-secondary">{label}</div>
      )}
      {items.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {items.map((t, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 rounded-full border border-border-muted bg-bg-tertiary px-2 py-0.5 text-2xs text-text-secondary"
            >
              {t}
              <button
                aria-label="Remove tag"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="ml-0.5 text-text-muted hover:text-status-danger"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <input
          className="flex-1 rounded border border-border-default bg-bg-primary px-2 py-0.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={placeholder}
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          className="rounded border border-border-default px-2 py-0.5 text-xs text-text-secondary hover:bg-bg-tertiary disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}
