import { useEffect, useRef, useState } from "react";
import type { ArticleSection, ArticleSectionType } from "@/types/lore";
import { plainTextFromBody } from "@/lib/loreSections";
import { ConfirmDialog } from "@/components/ConfirmDialog";

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
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);

  const addBtnRef = useRef<HTMLButtonElement | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);

  // Close add-menu on Escape, outside click, and focus the first item on open.
  useEffect(() => {
    if (!addOpen) return;

    const firstItem = addMenuRef.current?.querySelector<HTMLButtonElement>(
      "[role='menuitem']",
    );
    firstItem?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setAddOpen(false);
        addBtnRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (addMenuRef.current?.contains(t)) return;
      if (addBtnRef.current?.contains(t)) return;
      setAddOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [addOpen]);

  const focusMenuItemAt = (delta: 1 | -1) => {
    const items = Array.from(
      addMenuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']") ?? [],
    );
    if (items.length === 0) return;
    const current = document.activeElement as HTMLElement | null;
    const idx = current ? items.indexOf(current as HTMLButtonElement) : -1;
    const next = (idx + delta + items.length) % items.length;
    items[next]?.focus();
  };

  const requestDelete = (section: ArticleSection) => {
    setPendingDelete({ id: section.id, title: section.title || "Untitled" });
  };

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
        Click to focus. Drag, or hold Alt and use ↑/↓, to reorder.
      </p>

      <ul className="ae-rail__list" role="list">
        {sections.map((section, i) => {
          const isActive = activeId === section.id;
          const onRowKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(section.id);
            }
          };
          return (
            <li key={section.id} className="ae-sec__wrap">
              <div
                className="ae-sec"
                role="button"
                tabIndex={0}
                aria-pressed={isActive}
                aria-label={`${section.title || "Untitled"} section${section.private ? ", private" : ""}`}
                data-active={isActive || undefined}
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
                onKeyDown={onRowKey}
              >
                <span className="ae-sec__handle" aria-hidden>⋮⋮</span>
                <span className="ae-sec__icon" aria-hidden>{iconForType(section.type)}</span>
                <span className="ae-sec__body">
                  <span className="ae-sec__title">
                    {section.title || "Untitled"}
                    {section.private && (
                      <span className="ae-sec__lock" aria-hidden title="Private — creator's eyes only">
                        ◐
                      </span>
                    )}
                  </span>
                  <span className="ae-sec__meta">
                    {previewFor(section)}
                    {section.private ? " · private" : ""}
                  </span>
                </span>
                <span className="ae-sec__tail">
                  <span className="ae-sec__num" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                  {!section.required && (
                    <button
                      type="button"
                      className="ae-sec__del"
                      aria-label={`Remove section ${section.title || "Untitled"}`}
                      title="Remove section"
                      onClick={(e) => {
                        e.stopPropagation();
                        requestDelete(section);
                      }}
                    >
                      ×
                    </button>
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="ae-rail__add" data-open={addOpen || undefined}>
        <button
          ref={addBtnRef}
          type="button"
          className="ae-rail__add__trigger"
          onClick={() => setAddOpen((o) => !o)}
          aria-expanded={addOpen}
          aria-haspopup="menu"
        >
          + Add a section
        </button>
        {addOpen && (
          <div
            ref={addMenuRef}
            className="ae-rail__addmenu"
            role="menu"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                focusMenuItemAt(1);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                focusMenuItemAt(-1);
              } else if (e.key === "Tab") {
                // Tab out closes the menu rather than trapping; cleaner for keyboard flow.
                setAddOpen(false);
              }
            }}
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
                  addBtnRef.current?.focus();
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

      {pendingDelete && (
        <ConfirmDialog
          title="Remove section"
          message={`Remove section "${pendingDelete.title}"? This cannot be undone.`}
          confirmLabel="Remove"
          cancelLabel="Keep it"
          destructive
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const id = pendingDelete.id;
            setPendingDelete(null);
            onDelete(id);
          }}
        />
      )}
    </nav>
  );
}
