import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useAssetStore } from "@/stores/assetStore";
import { ALL_PANELS, panelTab } from "@/lib/panelRegistry";
import { useFocusTrap } from "@/lib/useFocusTrap";

interface PaletteItem {
  id: string;
  type: "panel" | "article" | "zone" | "action";
  title: string;
  subtitle: string;
  action: () => void;
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const openTab = useProjectStore((s) => s.openTab);
  const setShowMudImport = useProjectStore((s) => s.setShowMudImport);
  const setShowImportZone = useProjectStore((s) => s.setShowImportZone);
  const openGenerator = useAssetStore((s) => s.openGenerator);
  const openGallery = useAssetStore((s) => s.openGallery);
  const selectArticle = useLoreStore((s) => s.selectArticle);
  const articles = useLoreStore(selectArticles);
  const zones = useZoneStore((s) => s.zones);

  // Build searchable items
  const items = useMemo<PaletteItem[]>(() => {
    const result: PaletteItem[] = [];

    // Actions (global commands)
    result.push({
      id: "action:import-mud-zone",
      type: "action",
      title: "Import MUD Zone",
      subtitle: "Import a zone from an existing AmbonMUD checkout",
      action: () => setShowMudImport(true),
    });
    result.push({
      id: "action:import-zone-yaml",
      type: "action",
      title: "Import Zone YAML",
      subtitle: "Import AmbonMUD zone YAML files into the project",
      action: () => setShowImportZone(true),
    });
    result.push({
      id: "action:render-art",
      type: "action",
      title: "Render Art",
      subtitle: "Open the asset generator",
      action: () => openGenerator(),
    });
    result.push({
      id: "action:browse-gallery",
      type: "action",
      title: "Browse Asset Gallery",
      subtitle: "Open the asset gallery",
      action: () => openGallery(),
    });

    // Panels
    for (const panel of ALL_PANELS) {
      result.push({
        id: `panel:${panel.id}`,
        type: "panel",
        title: panel.label,
        subtitle: panel.description,
        action: () => openTab(panelTab(panel.id)),
      });
    }

    // Articles
    for (const article of Object.values(articles)) {
      result.push({
        id: `article:${article.id}`,
        type: "article",
        title: article.title,
        subtitle: article.template,
        action: () => {
          selectArticle(article.id);
          openTab(panelTab("lore"));
        },
      });
    }

    // Zones
    for (const [zoneId, zoneState] of zones.entries()) {
      result.push({
        id: `zone:${zoneId}`,
        type: "zone",
        title: zoneState.data.zone || zoneId,
        subtitle: `${Object.keys(zoneState.data.rooms).length} rooms`,
        action: () =>
          openTab({ id: `zone:${zoneId}`, kind: "zone", label: zoneId }),
      });
    }

    return result;
  }, [articles, zones, openTab, selectArticle, setShowMudImport, setShowImportZone, openGenerator, openGallery]);

  // Filter
  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 12);
    const q = query.toLowerCase();
    return items
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [items, query]);
  const listboxId = "command-palette-results";
  const statusId = "command-palette-status";
  const activeOptionId =
    selectedIndex >= 0 && selectedIndex < filtered.length
      ? `command-palette-option-${selectedIndex}`
      : undefined;

  // Reset selection when results change
  useEffect(() => setSelectedIndex(0), [filtered]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as
      | HTMLElement
      | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const activate = useCallback(
    (item: PaletteItem) => {
      item.action();
      onClose();
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) activate(filtered[selectedIndex]);
      }
    },
    [filtered, selectedIndex, activate, onClose],
  );

  const typeBadge = (type: string) => {
    const colors: Record<string, string> = {
      panel: "bg-stellar-blue/20 text-stellar-blue",
      article: "bg-accent/15 text-accent",
      zone: "bg-status-success/20 text-status-success",
      action: "bg-warm/20 text-warm",
    };
    return colors[type] ?? "bg-[var(--chrome-highlight-strong)] text-text-muted";
  };

  const typeGlyph = (type: string) => {
    const glyphs: Record<string, string> = {
      panel: "\u25A4", // ▤ (panel/layout)
      article: "\u00B6", // ¶ (pilcrow, article)
      zone: "\u2302", // ⌂ (house/zone)
      action: "\u25B8", // ▸ (action)
    };
    return glyphs[type] ?? "\u25CB";
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-[var(--chrome-fill-soft)]0 backdrop-blur-sm" />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-lg rounded-2xl border border-[var(--chrome-stroke)] bg-bg-primary shadow-[0_24px_80px_rgba(8,10,18,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Jump to article, panel, or zone..."
          role="combobox"
          aria-label="Command palette search"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-describedby={statusId}
          aria-expanded={filtered.length > 0}
          aria-activedescendant={activeOptionId}
          className="w-full rounded-t-2xl border-b border-[var(--chrome-stroke)] bg-transparent px-5 py-4 text-sm text-text-primary placeholder:text-text-muted outline-none focus-visible:ring-2 focus-visible:ring-border-active"
        />
        <p id={statusId} role="status" aria-live="polite" className="sr-only">
          {filtered.length === 0
            ? "No results available."
            : `${filtered.length} result${filtered.length === 1 ? "" : "s"} available.`}
        </p>
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Command palette results"
          className="max-h-[360px] overflow-y-auto py-2"
        >
          {filtered.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-text-muted">
              No matches found
            </p>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.id}
                id={`command-palette-option-${i}`}
                type="button"
                onClick={() => activate(item)}
                onMouseEnter={() => setSelectedIndex(i)}
                role="option"
                aria-selected={i === selectedIndex}
                tabIndex={-1}
                className={`flex w-full items-center gap-3 px-5 py-2.5 text-left transition ${
                  i === selectedIndex ? "bg-[var(--chrome-highlight-strong)]" : "hover:bg-[var(--chrome-highlight)]"
                }`}
              >
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-3xs font-medium uppercase ${typeBadge(item.type)}`}
                >
                  <span aria-hidden="true" className="text-xs leading-none">
                    {typeGlyph(item.type)}
                  </span>
                  {item.type}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-text-primary">
                    {item.title}
                  </span>
                  <span className="block truncate text-2xs text-text-muted">
                    {item.subtitle}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
        <div className="border-t border-[var(--chrome-stroke)] px-5 py-2 text-3xs text-text-muted">
          <kbd className="rounded bg-[var(--chrome-highlight-strong)] px-1.5 py-0.5">&uarr;&darr;</kbd>{" "}
          navigate
          <span className="mx-2">&middot;</span>
          <kbd className="rounded bg-[var(--chrome-highlight-strong)] px-1.5 py-0.5">&crarr;</kbd> open
          <span className="mx-2">&middot;</span>
          <kbd className="rounded bg-[var(--chrome-highlight-strong)] px-1.5 py-0.5">esc</kbd> close
        </div>
      </div>
    </div>
  );
}
