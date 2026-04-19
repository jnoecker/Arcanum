import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useAssetStore } from "@/stores/assetStore";
import { ALL_PANELS, panelTab } from "@/lib/panelRegistry";
import { AI_ENABLED } from "@/lib/featureFlags";
import { useFocusTrap } from "@/lib/useFocusTrap";

type PaletteItemType =
  | "panel"
  | "article"
  | "zone"
  | "action"
  | "room"
  | "mob"
  | "item"
  | "shop"
  | "trainer"
  | "quest"
  | "gather"
  | "recipe"
  | "puzzle";

interface PaletteItem {
  id: string;
  type: PaletteItemType;
  title: string;
  subtitle: string;
  /** Extra text matched by the filter but not displayed (e.g. entity id). */
  searchText?: string;
  action: () => void;
}

/** Types that only appear in results when the user has typed a query. */
const ENTITY_TYPES: ReadonlySet<PaletteItemType> = new Set([
  "room",
  "mob",
  "item",
  "shop",
  "trainer",
  "quest",
  "gather",
  "recipe",
  "puzzle",
]);

function scoreMatch(item: PaletteItem, q: string): number {
  const title = item.title.toLowerCase();
  if (title === q) return 100;
  if (title.startsWith(q)) return 80;
  if (title.includes(q)) return 60;
  if (item.subtitle.toLowerCase().includes(q)) return 40;
  if (item.searchText && item.searchText.toLowerCase().includes(q)) return 20;
  return 0;
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const openTab = useProjectStore((s) => s.openTab);
  const navigateTo = useProjectStore((s) => s.navigateTo);
  const setShowMudImport = useProjectStore((s) => s.setShowMudImport);
  const setShowImportZone = useProjectStore((s) => s.setShowImportZone);
  const openGenerator = useAssetStore((s) => s.openGenerator);
  const openGallery = useAssetStore((s) => s.openGallery);
  const setLoreChatOpen = useProjectStore((s) => s.setLoreChatOpen);
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
    if (AI_ENABLED) {
      result.push({
        id: "action:render-art",
        type: "action",
        title: "Render Art",
        subtitle: "Open the asset generator",
        action: () => openGenerator(),
      });
    }
    result.push({
      id: "action:browse-gallery",
      type: "action",
      title: "Browse Asset Gallery",
      subtitle: "Open the asset gallery",
      action: () => openGallery(),
    });
    if (AI_ENABLED) {
      result.push({
        id: "action:ask-your-world",
        type: "action",
        title: "Ask your world",
        subtitle: "Open the lore chat assistant (Ctrl+/)",
        searchText: "chat archivist lore question",
        action: () => setLoreChatOpen(true),
      });
    }

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

    // Entities across all loaded zones (rooms, mobs, items, shops, trainers,
    // quests, gathering nodes, recipes, puzzles). Only surfaced when the user
    // types a query — see `filtered` below — so the palette's resting state
    // stays focused on navigation.
    for (const [zoneId, zoneState] of zones.entries()) {
      const zone = zoneState.data;
      const zoneName = zone.zone || zoneId;

      for (const [roomId, room] of Object.entries(zone.rooms ?? {})) {
        result.push({
          id: `room:${zoneId}:${roomId}`,
          type: "room",
          title: room.title || roomId,
          subtitle: `${roomId} · ${zoneName}`,
          searchText: roomId,
          action: () => navigateTo({ zoneId, roomId }),
        });
      }
      for (const [mobId, mob] of Object.entries(zone.mobs ?? {})) {
        result.push({
          id: `mob:${zoneId}:${mobId}`,
          type: "mob",
          title: mob.name || mobId,
          subtitle: zoneName,
          searchText: mobId,
          action: () => navigateTo({ zoneId, entityKind: "mob", entityId: mobId }),
        });
      }
      for (const [itemId, item] of Object.entries(zone.items ?? {})) {
        result.push({
          id: `item:${zoneId}:${itemId}`,
          type: "item",
          title: item.displayName || itemId,
          subtitle: zoneName,
          searchText: itemId,
          action: () => navigateTo({ zoneId, entityKind: "item", entityId: itemId }),
        });
      }
      for (const [shopId, shop] of Object.entries(zone.shops ?? {})) {
        result.push({
          id: `shop:${zoneId}:${shopId}`,
          type: "shop",
          title: shop.name || shopId,
          subtitle: zoneName,
          searchText: shopId,
          action: () => navigateTo({ zoneId, entityKind: "shop", entityId: shopId }),
        });
      }
      for (const [trainerId, trainer] of Object.entries(zone.trainers ?? {})) {
        result.push({
          id: `trainer:${zoneId}:${trainerId}`,
          type: "trainer",
          title: trainer.name || trainerId,
          subtitle: zoneName,
          searchText: trainerId,
          action: () => navigateTo({ zoneId, entityKind: "trainer", entityId: trainerId }),
        });
      }
      for (const [questId, quest] of Object.entries(zone.quests ?? {})) {
        result.push({
          id: `quest:${zoneId}:${questId}`,
          type: "quest",
          title: quest.name || questId,
          subtitle: zoneName,
          searchText: questId,
          action: () => navigateTo({ zoneId, entityKind: "quest", entityId: questId }),
        });
      }
      for (const [nodeId, node] of Object.entries(zone.gatheringNodes ?? {})) {
        result.push({
          id: `gather:${zoneId}:${nodeId}`,
          type: "gather",
          title: node.displayName || nodeId,
          subtitle: zoneName,
          searchText: nodeId,
          action: () => navigateTo({ zoneId, entityKind: "gatheringNode", entityId: nodeId }),
        });
      }
      for (const [recipeId, recipe] of Object.entries(zone.recipes ?? {})) {
        result.push({
          id: `recipe:${zoneId}:${recipeId}`,
          type: "recipe",
          title: recipe.displayName || recipeId,
          subtitle: zoneName,
          searchText: recipeId,
          action: () => navigateTo({ zoneId, entityKind: "recipe", entityId: recipeId }),
        });
      }
      for (const [puzzleId, puzzle] of Object.entries(zone.puzzles ?? {})) {
        result.push({
          id: `puzzle:${zoneId}:${puzzleId}`,
          type: "puzzle",
          title: puzzleId,
          subtitle: `${puzzle.type} · ${zoneName}`,
          searchText: puzzleId,
          action: () => navigateTo({ zoneId, entityKind: "puzzle", entityId: puzzleId }),
        });
      }
    }

    return result;
  }, [articles, zones, openTab, navigateTo, selectArticle, setShowMudImport, setShowImportZone, openGenerator, openGallery, setLoreChatOpen]);

  // Filter. With no query, hide entity results so the resting palette stays
  // focused on navigation. Once a query is present, rank by match quality so
  // exact/prefix hits surface above loose substring matches.
  const filtered = useMemo(() => {
    if (!query.trim()) {
      return items.filter((item) => !ENTITY_TYPES.has(item.type)).slice(0, 12);
    }
    const q = query.toLowerCase();
    const scored: Array<{ item: PaletteItem; score: number }> = [];
    for (const item of items) {
      const score = scoreMatch(item, q);
      if (score > 0) scored.push({ item, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 20).map((s) => s.item);
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
    // Color buckets: rooms = aurum (spatial), mobs/trainers/shops = terracotta
    // (living things with names), remaining content kinds = violet.
    const colors: Record<string, string> = {
      panel: "bg-stellar-blue/20 text-stellar-blue",
      article: "bg-accent/15 text-accent",
      zone: "bg-status-success/20 text-status-success",
      action: "bg-warm/20 text-warm",
      room: "bg-aurum/20 text-aurum",
      mob: "bg-status-danger/20 text-status-danger",
      trainer: "bg-status-danger/20 text-status-danger",
      shop: "bg-status-danger/20 text-status-danger",
      item: "bg-violet/25 text-violet",
      quest: "bg-violet/25 text-violet",
      gather: "bg-violet/25 text-violet",
      recipe: "bg-violet/25 text-violet",
      puzzle: "bg-violet/25 text-violet",
    };
    return colors[type] ?? "bg-[var(--chrome-highlight-strong)] text-text-muted";
  };

  const typeGlyph = (type: string) => {
    const glyphs: Record<string, string> = {
      panel: "\u25A4", // ▤ (panel/layout)
      article: "\u00B6", // ¶ (pilcrow, article)
      zone: "\u2302", // ⌂ (house/zone)
      action: "\u25B8", // ▸ (action)
      room: "\u25AB", // ▫ (room)
      mob: "\u2620", // ☠ (mob/creature)
      trainer: "\u2694", // ⚔ (trainer / combat)
      shop: "\u2696", // ⚖ (shop / commerce)
      item: "\u25C6", // ◆ (item)
      quest: "\u2726", // ✦ (quest goal)
      gather: "\u273F", // ✿ (gathering node)
      recipe: "\u270E", // ✎ (recipe)
      puzzle: "\u2699", // ⚙ (puzzle)
    };
    return glyphs[type] ?? "\u25CB";
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-surface-scrim" />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-lg rounded-2xl border border-[var(--chrome-stroke)] bg-bg-primary shadow-[var(--shadow-dialog)]"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Jump to room, mob, item, article, panel..."
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
          className="max-h-[min(360px,60vh)] overflow-y-auto py-2"
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
        <div className="border-t border-[var(--chrome-stroke)] px-5 py-2 text-3xs text-text-muted" role="note" aria-label="Keyboard shortcuts">
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
