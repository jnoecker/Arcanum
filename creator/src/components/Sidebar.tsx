import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { invoke } from "@tauri-apps/api/core";
import { useZoneStore, type ZoneState } from "@/stores/zoneStore";
import { useProjectStore } from "@/stores/projectStore";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import type { Tab } from "@/types/project";
import type { WorldFile } from "@/types/world";
import { useGlobalSearch, ENTITY_TYPE_LABELS } from "@/lib/useGlobalSearch";
import { WORLDMAKER_GROUPS, LORE_GROUPS, panelTab, type Workspace, type PanelDef } from "@/lib/panelRegistry";
import { loadCollapsedSections, saveCollapsedSections } from "@/lib/uiPersistence";
import { ArticleTree } from "./lore/ArticleTree";
import { BulkActionsBar } from "./lore/BulkActionsBar";
import { NewZoneDialog } from "./NewZoneDialog";
import { RenameZoneDialog } from "./RenameZoneDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  addRoom,
  addMob,
  addItem,
  addShop,
  generateEntityId,
  generateRoomId,
} from "@/lib/zoneEdits";
import type { MobFile, ItemFile, ShopFile } from "@/types/world";


interface CategoryDef {
  key: string;
  label: string;
  collection: keyof WorldFile;
  nameField: string;
  addFn?: (world: WorldFile, zoneId: string) => WorldFile;
}

const CATEGORIES: CategoryDef[] = [
  {
    key: "room",
    label: "Rooms",
    collection: "rooms",
    nameField: "title",
    addFn: (world) => {
      const id = generateRoomId(world);
      return addRoom(world, id, { title: id, description: "", exits: {} });
    },
  },
  {
    key: "mob",
    label: "Mobs",
    collection: "mobs",
    nameField: "name",
    addFn: (world) => {
      const id = generateEntityId(world, "mobs");
      const firstRoom = Object.keys(world.rooms)[0] ?? "";
      return addMob(world, id, { name: id, room: firstRoom, tier: "standard", level: 1 } as MobFile);
    },
  },
  {
    key: "item",
    label: "Items",
    collection: "items",
    nameField: "displayName",
    addFn: (world) => {
      const id = generateEntityId(world, "items");
      return addItem(world, id, { displayName: id, description: "", keyword: id } as ItemFile);
    },
  },
  {
    key: "shop",
    label: "Shops",
    collection: "shops",
    nameField: "name",
    addFn: (world) => {
      const id = generateEntityId(world, "shops");
      const firstRoom = Object.keys(world.rooms)[0] ?? "";
      return addShop(world, id, { name: id, room: firstRoom, items: [] } as ShopFile);
    },
  },
  { key: "quest", label: "Quests", collection: "quests", nameField: "name" },
  { key: "gatheringNode", label: "Gathering", collection: "gatheringNodes", nameField: "skill" },
  { key: "recipe", label: "Recipes", collection: "recipes", nameField: "displayName" },
];


function ZoneTree({
  zoneId,
  zoneState,
  isActive,
  onDelete,
  onRename,
}: {
  zoneId: string;
  zoneState: ZoneState;
  isActive: boolean;
  onDelete: (zoneId: string) => void;
  onRename: (zoneId: string) => void;
}) {
  const openTab = useProjectStore((s) => s.openTab);
  const navigateTo = useProjectStore((s) => s.navigateTo);
  const updateZone = useZoneStore((s) => s.updateZone);
  const [expanded, setExpanded] = useState(false);

  const world = zoneState.data;

  const handleZoneClick = () => {
    openTab({ id: `zone:${zoneId}`, kind: "zone", label: zoneId });
  };

  const handleEntityClick = (cat: CategoryDef, entityId: string) => {
    if (cat.key === "room") {
      navigateTo({ zoneId, roomId: entityId });
    } else {
      navigateTo({ zoneId, entityKind: cat.key, entityId });
    }
  };

  const handleAdd = (cat: CategoryDef) => {
    if (!cat.addFn) return;
    try {
      const next = cat.addFn(world, zoneId);
      updateZone(zoneId, next);
      const collection = next[cat.collection] as Record<string, unknown> | undefined;
      const oldCollection = world[cat.collection] as Record<string, unknown> | undefined;
      if (collection && oldCollection) {
        const newId = Object.keys(collection).find((k) => !(k in oldCollection));
        if (newId) {
          if (cat.key === "room") {
            navigateTo({ zoneId, roomId: newId });
          } else {
            navigateTo({ zoneId, entityKind: cat.key, entityId: newId });
          }
        }
      }
    } catch {
      // ignore duplicate ID errors etc.
    }
  };

  return (
    <li className="group/zone">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse zone" : "Expand zone"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-2xs text-text-muted transition hover:bg-white/8 hover:text-text-primary"
        >
          {expanded ? "\u25BE" : "\u25B8"}
        </button>
        <button
          onClick={handleZoneClick}
          className={`min-w-0 flex-1 rounded-2xl border px-3 py-2 text-left text-sm transition ${
            isActive
              ? "border-border-active bg-gradient-active text-text-primary"
              : "border-white/8 bg-black/10 text-text-secondary hover:bg-white/8 hover:text-text-primary"
          }`}
        >
          <span className="truncate font-medium" title={zoneState.data.zone || zoneId}>{zoneState.data.zone || zoneId}</span>
          <span className="ml-2 truncate text-2xs text-text-muted" title={zoneId}>{zoneId}</span>
          {zoneState.dirty && <span className="ml-2 shrink-0 text-2xs text-text-dirty">Unsaved</span>}
        </button>
        <button
          onClick={() => onRename(zoneId)}
          className="shrink-0 rounded-full border border-white/8 px-2.5 py-1.5 text-2xs text-text-muted opacity-0 transition hover:border-accent/40 hover:text-accent focus:opacity-100 group-hover/zone:opacity-100 group-focus-within/zone:opacity-100"
          title="Rename zone"
          aria-label="Rename zone"
        >
          Rename
        </button>
        <button
          onClick={() => onDelete(zoneId)}
          className="shrink-0 rounded-full border border-white/8 px-2.5 py-1.5 text-2xs text-text-muted opacity-0 transition hover:border-status-danger/40 hover:text-status-danger focus:opacity-100 group-hover/zone:opacity-100 group-focus-within/zone:opacity-100"
          title="Delete zone"
          aria-label="Delete zone"
        >
          Remove
        </button>
      </div>

      {expanded && (
        <div className="ml-10 mt-2 flex flex-col gap-2.5 border-l border-accent/15 pl-4">
          {CATEGORIES.map((cat) => {
            const collection = world[cat.collection] as Record<string, Record<string, unknown>> | undefined;
            const entries = collection ? Object.entries(collection) : [];
            if (entries.length === 0 && !cat.addFn) return null;

            return (
              <div key={cat.key} className="border-t border-white/5 pt-2 first:border-t-0 first:pt-0">
                <div className="flex items-center gap-2">
                  <span className="font-display font-semibold text-2xs uppercase tracking-label text-text-secondary">
                    {cat.label}
                  </span>
                  <span className="text-2xs text-text-muted">
                    {entries.length}
                  </span>
                  {cat.addFn && (
                    <button
                      onClick={() => handleAdd(cat)}
                      className="ml-auto rounded-full border border-white/8 px-2 py-1 text-2xs text-text-muted transition hover:bg-white/8 hover:text-text-primary"
                      title={`Add ${cat.label.replace(/s$/, "").toLowerCase()}`}
                      aria-label={`Add ${cat.label.replace(/s$/, "").toLowerCase()}`}
                    >
                      Add
                    </button>
                  )}
                </div>
                {entries.length > 0 && (
                  <ul className="flex flex-col">
                    {entries.map(([id, entity]) => {
                      const name = (entity as Record<string, unknown>)[cat.nameField] as string | undefined;
                      return (
                        <li key={id}>
                          <button
                            onClick={() => handleEntityClick(cat, id)}
                            className="w-full truncate rounded-xl px-2 py-1.5 text-left text-xs text-text-muted transition hover:bg-accent/8 hover:text-text-primary"
                            title={name || id}
                          >
                            {name || id}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </li>
  );
}


const PILL_COLLAPSE_THRESHOLD = 8;
const PILL_COLLAPSE_MIN_HIDDEN = 3;

/** Group panels by their subGroup field, preserving order of first appearance. */
function groupBySubGroup(panels: PanelDef[]): { subGroup: string | null; panels: PanelDef[] }[] {
  const result: { subGroup: string | null; panels: PanelDef[] }[] = [];
  const map = new Map<string | null, PanelDef[]>();
  for (const p of panels) {
    const key = p.subGroup ?? null;
    if (!map.has(key)) {
      const arr: PanelDef[] = [];
      map.set(key, arr);
      result.push({ subGroup: key, panels: arr });
    }
    map.get(key)!.push(p);
  }
  return result;
}

function PanelPill({ panel, activeTabId, openTab, compact }: {
  panel: PanelDef;
  activeTabId: string | null;
  openTab: (tab: Tab) => void;
  compact?: boolean;
}) {
  const tab = panelTab(panel.id);
  const isActive = activeTabId === tab.id;
  return (
    <button
      onClick={() => openTab(tab)}
      aria-current={isActive ? "page" : undefined}
      title={panel.description}
      className={`focus-ring rounded-full border font-medium leading-tight transition ${
        compact ? "px-2 py-1.5 text-3xs" : "px-2.5 py-2 text-2xs"
      } ${
        isActive
          ? "border-[var(--border-glow-strong)] bg-[linear-gradient(135deg,rgba(168,151,210,0.25),rgba(140,174,201,0.15))] text-text-primary shadow-glow"
          : "border-white/8 bg-white/[0.04] text-text-muted hover:border-white/14 hover:bg-white/8 hover:text-text-primary"
      }`}
    >
      {panel.label}
    </button>
  );
}

function PanelButtonGrid({
  groups,
  activeTabId,
  openTab,
}: {
  groups: { id: string; label: string; panels: PanelDef[] }[];
  activeTabId: string | null;
  openTab: (tab: Tab) => void;
}) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(loadCollapsedSections()),
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Persist collapsed sections
  useEffect(() => {
    saveCollapsedSections([...collapsedSections]);
  }, [collapsedSections]);

  const toggleSection = useCallback((id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Determine which section the active tab belongs to
  const activeSectionId = useMemo(() => {
    if (!activeTabId) return null;
    const panelId = activeTabId.replace(/^panel:/, "");
    for (const group of groups) {
      if (group.panels.some((p) => p.id === panelId)) return group.id;
    }
    return null;
  }, [activeTabId, groups]);

  return (
    <nav className="flex flex-col gap-1">
      {groups.map((group) => {
        const isCollapsed = collapsedSections.has(group.id);
        const hasSubGroups = group.panels.some((p) => p.subGroup);
        const isActiveSection = activeSectionId === group.id;

        // For flat sections (no sub-groups), use pill collapse
        const expanded = expandedGroups.has(group.id);
        const hiddenCount = group.panels.length - PILL_COLLAPSE_THRESHOLD;
        const needsCollapse = !hasSubGroups && hiddenCount >= PILL_COLLAPSE_MIN_HIDDEN;
        const visiblePanels = needsCollapse && !expanded
          ? group.panels.slice(0, PILL_COLLAPSE_THRESHOLD)
          : group.panels;

        return (
          <section
            key={group.id}
            className={`border-t border-white/8 pt-1.5 first:border-t-0 first:pt-0 ${
              isActiveSection ? "border-l-2 border-l-accent/30 pl-1" : ""
            }`}
          >
            {/* Accordion header */}
            <button
              onClick={() => toggleSection(group.id)}
              aria-expanded={!isCollapsed}
              aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${group.label}`}
              className="mb-1 flex w-full items-center gap-1.5 rounded-md px-1 py-1 transition hover:bg-white/4"
            >
              <svg
                className={`h-3 w-3 shrink-0 text-text-muted transition-transform duration-150 ${isCollapsed ? "" : "rotate-90"}`}
                viewBox="0 0 12 12"
                fill="currentColor"
              >
                <path d="M4.5 2L9 6L4.5 10z" />
              </svg>
              <h3 className="text-2xs font-medium uppercase tracking-label text-text-secondary">{group.label}</h3>
              <span className="ml-auto shrink-0 text-3xs text-text-muted">{group.panels.length}</span>
            </button>

            {/* Collapsed: show nothing. Expanded: pills with optional sub-groups */}
            {!isCollapsed && (
              hasSubGroups ? (
                // Sub-grouped layout (Characters, World)
                <div className="flex flex-col gap-2 pb-1">
                  {groupBySubGroup(group.panels as PanelDef[]).map(({ subGroup, panels }) => (
                    <div key={subGroup ?? "_"}>
                      {subGroup && (
                        <div className="mb-1 mt-0.5 flex items-center gap-2">
                          <div className="h-px flex-1 bg-white/6" />
                          <span className="text-3xs uppercase tracking-label text-text-muted/50">{subGroup}</span>
                          <div className="h-px flex-1 bg-white/6" />
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {panels.map((panel) => (
                          <PanelPill key={panel.id} panel={panel} activeTabId={activeTabId} openTab={openTab} compact />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Flat layout with optional "+N more" collapse
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {(visiblePanels as PanelDef[]).map((panel) => (
                    <PanelPill key={panel.id} panel={panel} activeTabId={activeTabId} openTab={openTab} />
                  ))}
                  {needsCollapse && !expanded && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedGroups((s) => new Set(s).add(group.id)); }}
                      aria-label={`Show ${hiddenCount} more panels`}
                      aria-expanded={false}
                      className="rounded-full border border-dashed border-white/10 px-2.5 py-1.5 text-2xs text-text-muted transition hover:border-white/20 hover:text-text-secondary"
                    >
                      +{hiddenCount} more
                    </button>
                  )}
                  {needsCollapse && expanded && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedGroups((s) => { const next = new Set(s); next.delete(group.id); return next; });
                      }}
                      className="rounded-full border border-dashed border-white/10 px-2.5 py-1.5 text-2xs text-text-muted transition hover:border-white/20 hover:text-text-secondary"
                    >
                      Less
                    </button>
                  )}
                </div>
              )
            )}
          </section>
        );
      })}
    </nav>
  );
}


export function Sidebar({ workspace }: { workspace: Workspace }) {
  const zones = useZoneStore((s) => s.zones);
  const openTab = useProjectStore((s) => s.openTab);
  const { tabs: openTabs, activeTabId, project } = useProjectStore(
    useShallow((s) => ({ tabs: s.tabs, activeTabId: s.activeTabId, project: s.project })),
  );
  const navigateTo = useProjectStore((s) => s.navigateTo);
  const closeTab = useProjectStore((s) => s.closeTab);
  const removeZone = useZoneStore((s) => s.removeZone);
  const articles = useLoreStore(selectArticles);
  const articleCount = Object.keys(articles).length;
  const { query, setQuery, clearQuery, grouped, isSearching } =
    useGlobalSearch();
  const searchRef = useRef<HTMLInputElement>(null);
  const [showNewZone, setShowNewZone] = useState(false);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const hasProject = !!project;

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        clearQuery();
        searchRef.current?.blur();
      }
    },
    [clearQuery],
  );

  const handleDeleteZone = useCallback(async (zoneId: string) => {
    const zoneState = zones.get(zoneId);
    if (!zoneState) return;
    try {
      if (project?.format === "standalone") {
        await invoke("delete_zone_directory", {
          projectDir: project.mudDir,
          zoneId,
        });
      } else {
        await invoke("delete_zone_file", { filePath: zoneState.filePath });
      }
    } catch (err) {
      console.error("Failed to delete zone:", err);
    }
    closeTab(`zone:${zoneId}`);
    removeZone(zoneId);
    setDeleteTarget(null);
  }, [zones, closeTab, removeZone, project]);

  const sortedZones = useMemo(
    () => [...zones.entries()].sort(([a], [b]) => a.localeCompare(b)),
    [zones],
  );

  return (
    <aside className="relative flex w-full shrink-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-panel shadow-[0_18px_56px_rgba(8,10,18,0.32)] lg:h-full lg:w-[23rem]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-glow-top" />

      <div className="relative z-10 shrink-0 px-4 pt-4">
        <div className="flex items-center gap-3 px-1 text-3xs text-text-muted">
          <span>{zones.size} zones</span>
          <span className="text-border-default">·</span>
          <span>{articleCount} lore</span>
          <span className="text-border-default">·</span>
          <span>{openTabs.length} open</span>
        </div>
      </div>

      <div
        className="relative z-10 min-h-0 max-h-[22rem] shrink overflow-y-auto border-b border-white/10 px-4 py-4 lg:max-h-[45%]"
        style={{ maskImage: "linear-gradient(to bottom, transparent 0, black 8px, black calc(100% - 16px), transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, transparent 0, black 8px, black calc(100% - 16px), transparent 100%)" }}
      >
        {workspace === "worldmaker" ? (
          <>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-2xs font-medium uppercase tracking-label text-text-secondary">Surfaces</h2>
              <button
                onClick={() => setShowNewZone(true)}
                className="focus-ring shell-pill rounded-full px-3 py-1 text-2xs font-medium"
                title="New zone"
              >
                New zone
              </button>
            </div>
            <PanelButtonGrid groups={WORLDMAKER_GROUPS} activeTabId={activeTabId} openTab={openTab} />
          </>
        ) : (
          <>
            <div className="mb-2">
              <h2 className="text-2xs font-medium uppercase tracking-label text-text-secondary">Surfaces</h2>
            </div>
            <PanelButtonGrid groups={LORE_GROUPS} activeTabId={activeTabId} openTab={openTab} />
          </>
        )}
      </div>

      {/* ── Search (worldmaker only — lore has its own article search) ── */}
      {workspace === "worldmaker" && <div className="relative z-10 shrink-0 px-4 py-3">
        <div className="relative">
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            aria-label="Search entities"
            placeholder="Seek rooms, mobs, quests..."
            className="ornate-input h-10 w-full rounded-full px-4 pr-10 text-sm text-text-primary"
          />
          {query && (
            <button
              aria-label="Clear search"
              onClick={clearQuery}
              className="focus-ring absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-sm text-text-muted hover:text-text-primary"
            >
              ✕
            </button>
          )}
        </div>
      </div>}

      {/* ── Bottom: zones or articles list ── */}
      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {isSearching ? (
          <div className="py-2">
            {grouped.size === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-6 text-sm text-text-muted">
                Nothing matches that query across your zones.
              </p>
            ) : (
              [...grouped.entries()].map(([zoneId, entries]) => (
                <div key={zoneId} className="mb-4">
                  <h3 className="mb-2 text-2xs font-medium uppercase tracking-label text-text-secondary">{zoneId}</h3>
                  <ul className="flex flex-col gap-0.5">
                    {entries.map((entry) => (
                      <li key={`${entry.entityType}:${entry.entityId}`}>
                        <button
                          onClick={() => {
                            const tab: Tab = { id: `zone:${entry.zoneId}`, kind: "zone", label: entry.zoneId };
                            openTab(tab);
                            if (entry.entityType === "room") {
                              navigateTo({ zoneId: entry.zoneId, roomId: entry.entityId });
                            } else {
                              navigateTo({ zoneId: entry.zoneId, entityKind: entry.entityType, entityId: entry.entityId });
                            }
                            clearQuery();
                          }}
                          className="flex w-full items-center gap-2 rounded-2xl border border-white/8 bg-black/10 px-3 py-2 text-left text-xs transition hover:bg-white/8 hover:text-text-primary"
                        >
                          <span className="shrink-0 rounded-full bg-white/8 px-2 py-1 font-mono text-2xs text-text-muted">
                            {ENTITY_TYPE_LABELS[entry.entityType]}
                          </span>
                          <span className="truncate" title={entry.displayName}>{entry.displayName}</span>
                          {entry.entityId !== entry.displayName && (
                            <span className="ml-auto shrink-0 text-2xs text-text-muted">{entry.entityId}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        ) : workspace === "worldmaker" ? (
          <div className="py-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-2xs font-medium uppercase tracking-label text-text-secondary">Cartography</h2>
              {hasProject ? (
                <span className="text-2xs uppercase tracking-label text-text-muted">
                  {sortedZones.length} zone{sortedZones.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
            {sortedZones.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-5 text-sm text-text-muted">
                {hasProject ? (
                  <>
                    <p className="mb-3 leading-relaxed">
                      This world has no zones yet. Create your first zone to
                      begin shaping it.
                    </p>
                    <button
                      onClick={() => setShowNewZone(true)}
                      className="focus-ring rounded-full bg-accent px-4 py-1.5 text-2xs font-medium text-accent-emphasis transition-[box-shadow,filter] hover:shadow-[var(--glow-aurum)] hover:brightness-110"
                    >
                      Create your first zone
                    </button>
                  </>
                ) : (
                  <p className="leading-relaxed">Open a world to begin shaping it.</p>
                )}
              </div>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {sortedZones.map(([zoneId, zoneState]) => (
                  <ZoneTree
                    key={zoneId}
                    zoneId={zoneId}
                    zoneState={zoneState}
                    isActive={activeTabId === `zone:${zoneId}`}
                    onDelete={(id) => setDeleteTarget(id)}
                    onRename={(id) => setRenameTarget(id)}
                  />
                ))}
              </ul>
            )}
          </div>
        ) : (
          /* Lore workspace: article tree */
          <div className="py-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-2xs font-medium uppercase tracking-label text-text-secondary">
                Canon roots
                <span className="ml-2 text-3xs font-normal text-text-muted">{articleCount}</span>
              </h2>
            </div>
            <BulkActionsBar />
            <ArticleTree />
          </div>
        )}
      </div>

      <div className="relative z-10 border-t border-white/10 px-4 py-3 text-2xs text-text-muted">
        `Ctrl+K` command palette | `Ctrl+S` commit | `Ctrl+,` tune the instrument
      </div>

      {showNewZone && <NewZoneDialog onClose={() => setShowNewZone(false)} />}
      {renameTarget && (
        <RenameZoneDialog
          zoneId={renameTarget}
          onClose={() => setRenameTarget(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Zone"
          message={`Delete zone "${deleteTarget}"? This will remove the YAML file from disk. Any cross-zone references to this zone will break.`}
          confirmLabel="Delete"
          destructive
          onConfirm={() => handleDeleteZone(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </aside>
  );
}
