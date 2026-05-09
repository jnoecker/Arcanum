import { useState } from "react";
import type { ArticleSection, ArticleSectionType } from "@/types/lore";
import { plainTextFromBody } from "@/lib/loreSections";

interface SectionRailProps {
  sections: ArticleSection[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: (type: ArticleSectionType) => void;
  onDelete: (id: string) => void;
  onReorder: (dragId: string, dropBeforeId: string) => void;
  onCollapse: () => void;
  onExpand: () => void;
}

const SECTION_TYPES: ReadonlyArray<{
  id: ArticleSectionType;
  icon: string;
  name: string;
  hint: string;
}> = [
  { id: "richtext", icon: "¶", name: "Rich Text", hint: "Prose, headings, mentions, quotes." },
  { id: "image",    icon: "◇", name: "Image · Caption", hint: "One image from the archive with a caption." },
  { id: "gallery",  icon: "▦", name: "Gallery", hint: "Many images. Same image can appear in multiple sections." },
];

function iconForType(type: ArticleSectionType): string {
  return SECTION_TYPES.find((t) => t.id === type)?.icon ?? "·";
}

function previewFor(section: ArticleSection): string {
  if (section.type === "richtext") {
    const txt = plainTextFromBody(section.body);
    if (!txt) return "Empty.";
    const words = txt.split(/\s+/).length;
    return `${words} ${words === 1 ? "word" : "words"}`;
  }
  if (section.type === "image") {
    return section.primary ? "Visage selected" : "No visage chosen";
  }
  // gallery
  const n = section.images.length;
  return n === 0 ? "Empty gallery" : `${n} ${n === 1 ? "image" : "images"}`;
}

export function SectionRail({
  sections,
  activeId,
  onSelect,
  onAdd,
  onDelete,
  onReorder,
  onCollapse,
  onExpand,
}: SectionRailProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  return (
    <nav className="ae-rail" aria-label="Article sections">
      {/* Stub shown when collapsed — clicking expands. */}
      <div className="ae-rail__stub">
        <button
          type="button"
          className="ae-collapse-btn"
          onClick={onExpand}
          title="Expand section rail"
          aria-label="Expand section rail"
        >
          ›
        </button>
      </div>

      <div className="ae-rail__title">
        <span className="ae-rail__title__group">
          <span>Sections</span>
          <span className="ae-rail__title__count">
            {String(sections.length).padStart(2, "0")}
          </span>
        </span>
        <button
          type="button"
          className="ae-collapse-btn"
          onClick={onCollapse}
          title="Collapse section rail"
          aria-label="Collapse section rail"
        >
          ‹
        </button>
      </div>
      <p className="ae-rail__hint">
        Click to focus. Drag to reorder. Each becomes a block on export.
      </p>

      <div className="ae-rail__list">
        {sections.map((section, i) => (
          <button
            type="button"
            key={section.id}
            className="ae-sec"
            data-active={activeId === section.id || undefined}
            data-private={section.private || undefined}
            data-dragging={dragId === section.id || undefined}
            data-dropbefore={(overId === section.id && dragId !== section.id) || undefined}
            draggable
            onDragStart={(e) => {
              setDragId(section.id);
              e.dataTransfer.effectAllowed = "move";
              try {
                e.dataTransfer.setData("text/plain", section.id);
              } catch {
                // Some browsers throw on setData in certain contexts; ignore.
              }
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            onDragOver={(e) => {
              if (dragId && dragId !== section.id) {
                e.preventDefault();
                setOverId(section.id);
              }
            }}
            onDragLeave={() => {
              if (overId === section.id) setOverId(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId && dragId !== section.id) onReorder(dragId, section.id);
              setDragId(null);
              setOverId(null);
            }}
            onClick={() => onSelect(section.id)}
          >
            <span className="ae-sec__handle" aria-hidden>⋮⋮</span>
            <span className="ae-sec__icon" aria-hidden>{iconForType(section.type)}</span>
            <span className="ae-sec__body">
              <span className="ae-sec__title">{section.title || "Untitled"}</span>
              <span className="ae-sec__meta">
                {previewFor(section)}
                {section.private ? " · private" : ""}
              </span>
            </span>
            <span className="ae-sec__tail">
              <span className="ae-sec__num">{String(i + 1).padStart(2, "0")}</span>
              {!section.required && (
                <span
                  role="button"
                  tabIndex={0}
                  className="ae-sec__del"
                  aria-label={`Remove section ${section.title || "Untitled"}`}
                  title="Remove section"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Remove section "${section.title || "Untitled"}"?`)) {
                      onDelete(section.id);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      if (window.confirm(`Remove section "${section.title || "Untitled"}"?`)) {
                        onDelete(section.id);
                      }
                    }
                  }}
                >
                  ×
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      <div className="ae-rail__add" data-open={addOpen || undefined}>
        <button
          type="button"
          onClick={() => setAddOpen((o) => !o)}
          aria-expanded={addOpen}
          aria-haspopup="menu"
          style={{
            background: "none",
            border: "none",
            color: "inherit",
            font: "inherit",
            letterSpacing: "inherit",
            textTransform: "inherit",
            padding: 0,
            cursor: "pointer",
          }}
        >
          + Add a section
        </button>
        {addOpen && (
          <div
            className="ae-rail__addmenu"
            role="menu"
            onClick={(e) => e.stopPropagation()}
          >
            {SECTION_TYPES.map((t) => (
              <button
                type="button"
                key={t.id}
                className="ae-rail__addmenu__item"
                role="menuitem"
                onClick={() => {
                  onAdd(t.id);
                  setAddOpen(false);
                }}
              >
                <span className="ae-rail__addmenu__item__icon">{t.icon}</span>
                <span>
                  <span className="ae-rail__addmenu__item__name">{t.name}</span>
                  <span className="ae-rail__addmenu__item__hint">{t.hint}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
