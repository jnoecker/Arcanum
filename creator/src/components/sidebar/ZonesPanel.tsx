import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useZoneStore, type ZoneState } from "@/stores/zoneStore";
import { useProjectStore, type ActiveSelection } from "@/stores/projectStore";
import { useSidebarStore, catExpansionKey } from "@/stores/sidebarStore";
import { useToastStore } from "@/stores/toastStore";
import { saveZone } from "@/lib/saveZone";
import type { WorldFile } from "@/types/world";
import { NewZoneDialog } from "../NewZoneDialog";
import { ImportZoneDialog } from "../ImportZoneDialog";
import { RenameZoneDialog } from "../RenameZoneDialog";
import { DuplicateZoneDialog } from "../DuplicateZoneDialog";
import { ConfirmDialog } from "../ConfirmDialog";
import {
  addRoom,
  addMob,
  addItem,
  addShop,
  addQuest,
  addGatheringNode,
  addRecipe,
  addPuzzle,
  setDungeon,
  generateEntityId,
  generateRoomId,
} from "@/lib/zoneEdits";
import type {
  MobFile,
  ItemFile,
  ShopFile,
  QuestFile,
  GatheringNodeFile,
  RecipeFile,
  PuzzleFile,
} from "@/types/world";

interface CategoryDef {
  key: string;
  label: string;
  collection: keyof WorldFile;
  nameField: string;
  addFn?: (world: WorldFile, zoneId: string) => WorldFile;
  singular?: boolean;
  targetView?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  room: "var(--color-entity-room)",
  mob: "var(--color-entity-mob)",
  item: "var(--color-entity-item)",
  shop: "var(--color-entity-shop)",
  quest: "var(--color-entity-quest)",
  gatheringNode: "var(--color-entity-gather)",
  recipe: "var(--color-entity-recipe)",
  puzzle: "var(--color-entity-puzzle)",
  dungeon: "var(--color-entity-dungeon)",
};

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
  {
    key: "quest",
    label: "Quests",
    collection: "quests",
    nameField: "name",
    addFn: (world) => {
      const id = generateEntityId(world, "quests");
      const firstMob = Object.keys(world.mobs ?? {})[0] ?? "";
      return addQuest(world, id, { name: id, giver: firstMob } as QuestFile);
    },
  },
  {
    key: "gatheringNode",
    label: "Gathering Nodes",
    collection: "gatheringNodes",
    nameField: "displayName",
    addFn: (world) => {
      const id = generateEntityId(world, "gatheringNodes");
      const firstRoom = Object.keys(world.rooms)[0] ?? "";
      return addGatheringNode(world, id, {
        displayName: id,
        skill: "",
        yields: [],
        room: firstRoom,
      } as GatheringNodeFile);
    },
  },
  {
    key: "recipe",
    label: "Recipes",
    collection: "recipes",
    nameField: "displayName",
    addFn: (world) => {
      const id = generateEntityId(world, "recipes");
      return addRecipe(world, id, {
        displayName: id,
        skill: "",
        materials: [],
        outputItemId: "",
      } as RecipeFile);
    },
  },
  {
    key: "puzzle",
    label: "Puzzles",
    collection: "puzzles",
    nameField: "question",
    addFn: (world) => {
      const id = generateEntityId(world, "puzzles");
      const firstRoom = Object.keys(world.rooms)[0] ?? "";
      return addPuzzle(world, id, {
        type: "riddle",
        roomId: firstRoom,
        question: "",
        answer: "",
        reward: { type: "give_gold", gold: 10 },
      } as PuzzleFile);
    },
  },
  {
    key: "dungeon",
    label: "Dungeon",
    collection: "dungeon",
    nameField: "name",
    singular: true,
    targetView: "dungeon",
    addFn: (world) =>
      setDungeon(world, {
        name: `${world.zone} Dungeon`,
        roomCountMin: 20,
        roomCountMax: 25,
      }),
  },
];

interface EntityRow {
  id: string;
  name?: string;
}

interface CategoryView {
  cat: CategoryDef;
  /** Sorted rows; narrowed to matches when a query is active. */
  entries: EntityRow[];
  total: number;
}

function entityName(entity: unknown, nameField: string): string | undefined {
  if (!entity || typeof entity !== "object") return undefined;
  const value = (entity as Record<string, unknown>)[nameField];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function rowMatches(row: EntityRow, query: string): boolean {
  return (
    row.id.toLowerCase().includes(query) ||
    (row.name !== undefined && row.name.toLowerCase().includes(query))
  );
}

function buildCategoryViews(world: WorldFile, query: string): CategoryView[] {
  return CATEGORIES.map((cat) => {
    if (cat.singular) {
      const data = world[cat.collection] as Record<string, unknown> | undefined;
      const all: EntityRow[] = data ? [{ id: cat.key, name: entityName(data, cat.nameField) }] : [];
      const entries = query ? all.filter((row) => rowMatches(row, query)) : all;
      return { cat, entries, total: all.length };
    }
    const collection = world[cat.collection] as Record<string, Record<string, unknown>> | undefined;
    const all: EntityRow[] = collection
      ? Object.entries(collection).map(([id, entity]) => ({
          id,
          name: entityName(entity, cat.nameField),
        }))
      : [];
    all.sort((a, b) =>
      (a.name ?? a.id).localeCompare(b.name ?? b.id, undefined, { sensitivity: "base" }),
    );
    const entries = query ? all.filter((row) => rowMatches(row, query)) : all;
    return { cat, entries, total: all.length };
  });
}

function zoneMatchesQuery(zoneId: string, world: WorldFile, query: string): boolean {
  if ((world.zone || zoneId).toLowerCase().includes(query)) return true;
  if (zoneId.toLowerCase().includes(query)) return true;
  return buildCategoryViews(world, query).some((view) => view.entries.length > 0);
}

function CategorySection({
  zoneId,
  view,
  filtering,
  selectedId,
  startRoomId,
  onEntityClick,
  onAdd,
}: {
  zoneId: string;
  view: CategoryView;
  filtering: boolean;
  selectedId: string | undefined;
  startRoomId: string | undefined;
  onEntityClick: (cat: CategoryDef, entityId: string) => void;
  onAdd: (cat: CategoryDef) => void;
}) {
  const { cat, entries, total } = view;
  const toggleCatExpanded = useSidebarStore((s) => s.toggleCatExpanded);
  const storedOpen = useSidebarStore((s) => !!s.expandedCats[catExpansionKey(zoneId, cat.key)]);
  const open = filtering || storedOpen;
  const listId = `sidebar-cat-${zoneId}-${cat.key}`;

  const selectedRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  const canAdd = !!cat.addFn && !filtering && (!cat.singular || total === 0);

  return (
    <div className="border-t border-[var(--chrome-stroke)] pt-1 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-1">
        <button
          onClick={() => toggleCatExpanded(zoneId, cat.key)}
          disabled={filtering}
          aria-expanded={open}
          aria-controls={listId}
          className="focus-ring flex h-8 min-w-0 flex-1 items-center gap-2 rounded-xl px-1.5 text-left transition hover:bg-[var(--chrome-highlight)] disabled:cursor-default disabled:hover:bg-transparent"
        >
          <span aria-hidden="true" className="w-3 shrink-0 text-center text-3xs text-text-muted">
            {open ? "▾" : "▸"}
          </span>
          <span
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: CATEGORY_COLORS[cat.key] }}
            aria-hidden="true"
          />
          <span className="truncate font-display text-2xs font-semibold uppercase tracking-label text-text-secondary">
            {cat.label}
          </span>
          <span className="shrink-0 text-2xs text-text-muted">
            {filtering && entries.length !== total ? `${entries.length}/${total}` : total}
          </span>
        </button>
        {canAdd && (
          <button
            onClick={() => onAdd(cat)}
            className="shrink-0 rounded-full border border-[var(--chrome-stroke)] px-2 py-1 text-2xs text-text-muted transition hover:bg-[var(--chrome-highlight-strong)] hover:text-text-primary"
            title={`Add ${cat.label.replace(/s$/, "").toLowerCase()}`}
            aria-label={`Add ${cat.label.replace(/s$/, "").toLowerCase()}`}
          >
            Add
          </button>
        )}
      </div>
      {open && (
        <ul id={listId} className="flex flex-col pb-1">
          {entries.length === 0 ? (
            <li className="px-6 py-1 text-2xs italic text-text-muted">
              {filtering ? "No matches" : `No ${cat.label.toLowerCase()} yet`}
            </li>
          ) : (
            entries.map((row) => {
              const isSelected = selectedId !== undefined && selectedId === row.id;
              const isStart = cat.key === "room" && startRoomId === row.id;
              const showId = !cat.singular && row.name !== undefined && row.name !== row.id;
              return (
                <li key={row.id}>
                  <button
                    ref={isSelected ? selectedRef : undefined}
                    onClick={() => onEntityClick(cat, row.id)}
                    aria-current={isSelected ? "true" : undefined}
                    className={`flex w-full items-center gap-2 rounded-xl border px-2 py-1.5 text-left text-xs transition ${
                      isSelected
                        ? "selected-pill text-text-primary"
                        : "border-transparent text-text-muted hover:bg-accent/8 hover:text-text-primary"
                    }`}
                    title={row.name ? `${row.name} — ${row.id}` : row.id}
                  >
                    <span className="min-w-0 flex-1 truncate">{row.name || row.id}</span>
                    {isStart && (
                      <span className="shrink-0 text-3xs text-warm-pale" title="Start room">
                        ✦ start
                      </span>
                    )}
                    {showId && (
                      <span className="max-w-[8rem] shrink-0 truncate text-3xs text-text-muted">
                        {row.id}
                      </span>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

function ZoneTree({
  zoneId,
  zoneState,
  isActive,
  query,
  onDelete,
  onRename,
  onDuplicate,
}: {
  zoneId: string;
  zoneState: ZoneState;
  isActive: boolean;
  query: string;
  onDelete: (zoneId: string) => void;
  onRename: (zoneId: string) => void;
  onDuplicate: (zoneId: string) => void;
}) {
  const openTab = useProjectStore((s) => s.openTab);
  const navigateTo = useProjectStore((s) => s.navigateTo);
  const activeSelection = useProjectStore((s) => s.activeSelection);
  const updateZone = useZoneStore((s) => s.updateZone);
  const storedExpanded = useSidebarStore((s) => !!s.expandedZones[zoneId]);
  const toggleZoneExpanded = useSidebarStore((s) => s.toggleZoneExpanded);
  const setZoneExpanded = useSidebarStore((s) => s.setZoneExpanded);
  const setCatExpanded = useSidebarStore((s) => s.setCatExpanded);
  const [saving, setSaving] = useState(false);

  const world = zoneState.data;
  const zoneName = world.zone || zoneId;

  const zoneNameMatch =
    query !== "" &&
    (zoneName.toLowerCase().includes(query) || zoneId.toLowerCase().includes(query));
  // When the zone itself matched, show its full contents rather than nothing.
  const effectiveQuery = zoneNameMatch ? "" : query;
  const filtering = effectiveQuery !== "";

  const catViews = useMemo(
    () => buildCategoryViews(world, effectiveQuery),
    [world, effectiveQuery],
  );
  const entityMatches = filtering
    ? catViews.reduce((n, view) => n + view.entries.length, 0)
    : 0;

  const expanded = filtering ? entityMatches > 0 || storedExpanded : storedExpanded;

  const selection: ActiveSelection | null =
    isActive && activeSelection?.zoneId === zoneId ? activeSelection : null;
  const selectionCatKey = selection
    ? (selection.entityKind ?? (selection.roomId ? "room" : null))
    : null;
  const selectionId = selection?.entityId ?? selection?.roomId ?? null;

  // Reveal the selection in the tree whenever it changes in the editor.
  useEffect(() => {
    if (!selectionCatKey || !selectionId) return;
    setZoneExpanded(zoneId, true);
    setCatExpanded(zoneId, selectionCatKey, true);
  }, [zoneId, selectionCatKey, selectionId, setZoneExpanded, setCatExpanded]);

  const handleZoneClick = () => {
    openTab({ id: `zone:${zoneId}`, kind: "zone", label: zoneId });
    setZoneExpanded(zoneId, true);
  };

  const handleEntityClick = (cat: CategoryDef, entityId: string) => {
    if (cat.targetView) {
      navigateTo({ zoneId, view: cat.targetView });
    } else if (cat.key === "room") {
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
      setCatExpanded(zoneId, cat.key, true);
      if (cat.singular) {
        if (cat.targetView) navigateTo({ zoneId, view: cat.targetView });
        return;
      }
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

  const handleSaveZone = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveZone(zoneId);
      useToastStore.getState().show({
        kicker: "Saved",
        message: zoneState.data.zone || zoneId,
        variant: "astral",
      });
    } catch (err) {
      console.error("Zone save failed:", err);
      useToastStore.getState().show({
        kicker: "Save failed",
        message: err instanceof Error ? err.message : "Unknown error",
        variant: "ember",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="group/zone">
      <div className="flex items-center gap-1">
        <button
          onClick={() => toggleZoneExpanded(zoneId)}
          disabled={filtering}
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${zoneName}` : `Expand ${zoneName}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-2xs text-text-muted transition hover:bg-[var(--chrome-highlight-strong)] hover:text-text-primary disabled:cursor-default disabled:hover:bg-transparent"
        >
          {expanded ? "▾" : "▸"}
        </button>
        <button
          onClick={handleZoneClick}
          aria-current={isActive ? "true" : undefined}
          className={`flex min-w-0 flex-1 items-baseline gap-2 rounded-2xl border px-3 py-2 text-left text-sm transition ${
            isActive
              ? "border-border-active bg-gradient-active text-text-primary"
              : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] text-text-secondary hover:bg-[var(--chrome-highlight-strong)] hover:text-text-primary"
          }`}
        >
          <span className="min-w-0 truncate font-medium" title={zoneName}>{zoneName}</span>
          <span className="shrink-0 text-2xs text-text-muted" title={zoneId}>{zoneId}</span>
        </button>
        {zoneState.dirty && (
          <button
            onClick={handleSaveZone}
            disabled={saving}
            className="shrink-0 rounded-full border border-accent/50 bg-accent/12 px-2.5 py-1.5 text-2xs font-semibold uppercase tracking-label text-accent shadow-[0_0_12px_rgb(var(--accent-rgb)/0.25)] transition hover:border-accent hover:bg-accent/20 hover:shadow-[0_0_18px_rgb(var(--accent-rgb)/0.45)] disabled:opacity-60 animate-warm-breathe"
            title={`Save ${zoneName}`}
            aria-label={`Save ${zoneName}`}
          >
            {saving ? "…" : "Save"}
          </button>
        )}
      </div>

      {expanded && (
        <div className="ml-10 mt-2 flex flex-col gap-1.5 border-l border-accent/15 pl-4">
          {!filtering && (
            <div className="flex items-center gap-1.5 pb-1">
              <button
                onClick={() => onRename(zoneId)}
                className="rounded-full border border-[var(--chrome-stroke)] px-2.5 py-1 text-2xs text-text-muted transition hover:border-accent/40 hover:text-accent"
                title="Rename zone"
                aria-label="Rename zone"
              >
                Rename
              </button>
              <button
                onClick={() => onDuplicate(zoneId)}
                className="rounded-full border border-[var(--chrome-stroke)] px-2.5 py-1 text-2xs text-text-muted transition hover:border-accent/40 hover:text-accent"
                title="Duplicate zone"
                aria-label="Duplicate zone"
              >
                Duplicate
              </button>
              <button
                onClick={() => onDelete(zoneId)}
                className="rounded-full border border-[var(--chrome-stroke)] px-2.5 py-1 text-2xs text-text-muted transition hover:border-status-danger/40 hover:text-status-danger"
                title="Delete zone"
                aria-label="Delete zone"
              >
                Remove
              </button>
            </div>
          )}
          {catViews.map((view) => {
            if (filtering && view.entries.length === 0) return null;
            if (view.total === 0 && !view.cat.addFn) return null;
            return (
              <CategorySection
                key={view.cat.key}
                zoneId={zoneId}
                view={view}
                filtering={filtering}
                selectedId={
                  selectionCatKey === view.cat.key && selectionId !== null
                    ? selectionId
                    : undefined
                }
                startRoomId={world.startRoom}
                onEntityClick={handleEntityClick}
                onAdd={handleAdd}
              />
            );
          })}
        </div>
      )}
    </li>
  );
}

export function ZonesPanel() {
  const zones = useZoneStore((s) => s.zones);
  const project = useProjectStore((s) => s.project);
  const activeTabId = useProjectStore((s) => s.activeTabId);
  const closeTab = useProjectStore((s) => s.closeTab);
  const removeZone = useZoneStore((s) => s.removeZone);
  const showImportZone = useProjectStore((s) => s.showImportZone);
  const setShowImportZone = useProjectStore((s) => s.setShowImportZone);
  const [showNewZone, setShowNewZone] = useState(false);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const hasProject = !!project;
  const query = filter.trim().toLowerCase();

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

  const visibleZones = useMemo(
    () =>
      query === ""
        ? sortedZones
        : sortedZones.filter(([zoneId, zoneState]) =>
            zoneMatchesQuery(zoneId, zoneState.data, query),
          ),
    [sortedZones, query],
  );

  return (
    <section aria-label="Zones" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 pt-1">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {hasProject ? (
          <span className="whitespace-nowrap text-2xs uppercase tracking-label text-text-muted">
            {query !== ""
              ? `${visibleZones.length} of ${sortedZones.length} zone${sortedZones.length === 1 ? "" : "s"}`
              : `${sortedZones.length} zone${sortedZones.length === 1 ? "" : "s"}`}
          </span>
        ) : (
          <span aria-hidden="true" />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowImportZone(true)}
            className="focus-ring shell-pill whitespace-nowrap rounded-full px-3 py-1 text-2xs font-medium"
            title="Import zone YAML files"
            aria-label="Import zone YAML files"
          >
            Import
          </button>
          <button
            onClick={() => setShowNewZone(true)}
            className="focus-ring shell-pill whitespace-nowrap rounded-full px-3 py-1 text-2xs font-medium"
            title="New zone"
          >
            New zone
          </button>
        </div>
      </div>

      {hasProject && sortedZones.length > 0 && (
        <div className="relative mb-3">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && filter) {
                e.stopPropagation();
                setFilter("");
              }
            }}
            placeholder="Filter zones and entities…"
            aria-label="Filter zones and entities"
            className="focus-ring w-full rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] py-1.5 pl-3.5 pr-8 text-xs text-text-primary transition placeholder:text-text-muted focus:border-accent/40"
          />
          {filter && (
            <button
              onClick={() => setFilter("")}
              className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-2xs text-text-muted transition hover:bg-[var(--chrome-highlight-strong)] hover:text-text-primary"
              title="Clear filter"
              aria-label="Clear filter"
            >
              ×
            </button>
          )}
        </div>
      )}

      {sortedZones.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-5 text-sm text-text-muted">
          {hasProject ? (
            <>
              <p className="mb-3 leading-relaxed">
                This world has no zones yet. Create your first zone to begin shaping it.
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
      ) : visibleZones.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-5 text-sm text-text-muted">
          <p className="leading-relaxed">No zones or entities match “{filter.trim()}”.</p>
          <button
            onClick={() => setFilter("")}
            className="focus-ring mt-2 rounded-full border border-[var(--chrome-stroke)] px-3 py-1 text-2xs text-text-muted transition hover:border-accent/40 hover:text-accent"
          >
            Clear filter
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {visibleZones.map(([zoneId, zoneState]) => (
            <ZoneTree
              key={zoneId}
              zoneId={zoneId}
              zoneState={zoneState}
              isActive={activeTabId === `zone:${zoneId}`}
              query={query}
              onDelete={(id) => setDeleteTarget(id)}
              onRename={(id) => setRenameTarget(id)}
              onDuplicate={(id) => setDuplicateTarget(id)}
            />
          ))}
        </ul>
      )}

      {showNewZone && <NewZoneDialog onClose={() => setShowNewZone(false)} />}
      {showImportZone && <ImportZoneDialog onClose={() => setShowImportZone(false)} />}

      {duplicateTarget && (
        <DuplicateZoneDialog
          zoneId={duplicateTarget}
          onClose={() => setDuplicateTarget(null)}
        />
      )}
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
    </section>
  );
}
