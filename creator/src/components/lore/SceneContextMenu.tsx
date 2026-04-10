import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLoreStore } from "@/stores/loreStore";
import { getAllSceneTemplates } from "@/lib/sceneTemplates";
import type { SceneTemplateId } from "@/types/story";

interface SceneContextMenuProps {
  x: number;
  y: number;
  sceneId: string;
  currentTemplate?: SceneTemplateId;
  onDuplicate: (sceneId: string) => void;
  onDelete: (sceneId: string) => void;
  onApplyTemplate: (sceneId: string, template: SceneTemplateId) => void;
  onClearTemplate: (sceneId: string) => void;
  onClose: () => void;
}

// ─── Inline SVG icons ──────────────────────────────────────────────

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 11V3.5A1.5 1.5 0 014.5 2H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M3 5h10M6 5V3.5A1.5 1.5 0 017.5 2h1A1.5 1.5 0 0110 3.5V5m1.5 0v7a1.5 1.5 0 01-1.5 1.5H6A1.5 1.5 0 014.5 12V5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Context Menu ──────────────────────────────────────────────────

export function SceneContextMenu({
  x,
  y,
  sceneId,
  currentTemplate,
  onDuplicate,
  onDelete,
  onApplyTemplate,
  onClearTemplate,
  onClose,
}: SceneContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showTemplateSubmenu, setShowTemplateSubmenu] = useState(false);
  const customTemplates = useLoreStore((s) => s.lore?.customSceneTemplates);
  const templates = getAllSceneTemplates(customTemplates);

  // Dismiss on outside click or Escape
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Focus on mount
  useEffect(() => {
    menuRef.current?.focus();
  }, []);

  const menuItemClass =
    "w-full px-3 py-2 flex items-center gap-2 text-2xs text-text-primary hover:bg-bg-hover transition-colors duration-[160ms] text-left";

  return createPortal(
    <div
      ref={menuRef}
      tabIndex={-1}
      className="animate-unfurl-in bg-bg-elevated border border-border-default rounded-lg min-w-[180px] py-1 shadow-[var(--shadow-panel)] outline-none"
      style={{ position: "fixed", left: x, top: y, zIndex: 60 }}
    >
      {/* Duplicate Scene */}
      <button
        type="button"
        className={menuItemClass}
        onClick={() => {
          onDuplicate(sceneId);
          onClose();
        }}
      >
        <CopyIcon />
        Duplicate Scene
      </button>

      {/* Apply Template with submenu */}
      <div
        className="relative"
        onMouseEnter={() => setShowTemplateSubmenu(true)}
        onMouseLeave={() => setShowTemplateSubmenu(false)}
      >
        <button type="button" className={menuItemClass}>
          <SparkleIcon />
          Apply Template
          <span className="ml-auto text-text-muted">&#x25B8;</span>
        </button>

        {showTemplateSubmenu && (
          <div
            className="absolute left-full top-0 bg-bg-elevated border border-border-default rounded-lg min-w-[180px] py-1 shadow-[var(--shadow-panel)]"
            style={{ zIndex: 61 }}
          >
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className={menuItemClass}
                onClick={() => {
                  onApplyTemplate(sceneId, tpl.id);
                  onClose();
                }}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: tpl.badgeColor }}
                />
                {tpl.label}
                {tpl.isCustom && (
                  <span className="ml-auto text-[8px] uppercase tracking-wider text-text-muted">
                    custom
                  </span>
                )}
              </button>
            ))}

            {currentTemplate && (
              <>
                <div className="border-t border-border-muted my-1" />
                <button
                  type="button"
                  className={`${menuItemClass} text-text-muted`}
                  onClick={() => {
                    onClearTemplate(sceneId);
                    onClose();
                  }}
                >
                  Clear Template
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-border-muted my-1" />

      {/* Delete Scene */}
      <button
        type="button"
        className={`${menuItemClass} text-status-danger`}
        onClick={() => {
          onDelete(sceneId);
          onClose();
        }}
      >
        <TrashIcon />
        Delete Scene
      </button>
    </div>,
    document.body,
  );
}
