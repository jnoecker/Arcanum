import { useState, useCallback, useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { invoke } from "@tauri-apps/api/core";
import { useZoneStore, type ZoneState } from "@/stores/zoneStore";
import { useProjectStore } from "@/stores/projectStore";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import type { WorldFile } from "@/types/world";
import { ArticleTree } from "./lore/ArticleTree";
import { BulkActionsBar } from "./lore/BulkActionsBar";
import { NewZoneDialog } from "./NewZoneDialog";
import { ImportZoneDialog } from "./ImportZoneDialog";
import { RenameZoneDialog } from "./RenameZoneDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { CosmicBackdrop } from "./ui/CosmicBackdrop";
import {
  addRoom,
  addMob,
  addItem,
  addShop,
  addTrainer,
  addQuest,
  addGatheringNode,
  addRecipe,
  setDungeon,
  generateEntityId,
  generateRoomId,
} from "@/lib/zoneEdits";
import type {
  MobFile,
  ItemFile,
  ShopFile,
  TrainerFile,
  QuestFile,
  GatheringNodeFile,
  RecipeFile,
} from "@/types/world";


// ─── Zone entity categories ─────────────────────────────────────────

interface CategoryDef {
  key: string;
  label: string;
  collection: keyof WorldFile;
  nameField: string;
  addFn?: (world: WorldFile, zoneId: string) => WorldFile;
  singular?: boolean;
  targetView?: string;
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
  {
    key: "trainer",
    label: "Trainers",
    collection: "trainers",
    nameField: "name",
    addFn: (world) => {
      const id = generateEntityId(world, "trainers");
      const firstRoom = Object.keys(world.rooms)[0] ?? "";
      return addTrainer(world, id, { name: id, room: firstRoom } as TrainerFile);
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
    key: "quest",
    label: "Quests",
    collection: "quests",
    nameField: "name",
    addFn: (world) => {
      const id = generateEntityId(world, "quests");
      return addQuest(world, id, { name: id, giver: "" } as QuestFile);
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


// ─── Zone tree node ─────────────────────────────────────────────────

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

  return (
    <li className="group/zone">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse zone" : "Expand zone"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-2xs text-text-muted transition hover:bg-[var(--chrome-highlight-strong)] hover:text-text-primary"
        >
          {expanded ? "\u25BE" : "\u25B8"}
        </button>
        <button
          onClick={handleZoneClick}
          className={`min-w-0 flex-1 rounded-2xl border px-3 py-2 text-left text-sm transition ${
            isActive
              ? "border-border-active bg-gradient-active text-text-primary"
              : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] text-text-secondary hover:bg-[var(--chrome-highlight-strong)] hover:text-text-primary"
          }`}
        >
          <span className="truncate font-medium" title={zoneState.data.zone || zoneId}>{zoneState.data.zone || zoneId}</span>
          <span className="ml-2 truncate text-2xs text-text-muted" title={zoneId}>{zoneId}</span>
          {zoneState.dirty && <span className="ml-2 shrink-0 text-2xs text-text-dirty">Unsaved</span>}
        </button>
        <button
          onClick={() => onRename(zoneId)}
          className="shrink-0 rounded-full border border-[var(--chrome-stroke)] px-2.5 py-1.5 text-2xs text-text-muted opacity-0 transition hover:border-accent/40 hover:text-accent focus:opacity-100 group-hover/zone:opacity-100 group-focus-within/zone:opacity-100"
          title="Rename zone"
          aria-label="Rename zone"
        >
          Rename
        </button>
        <button
          onClick={() => onDelete(zoneId)}
          className="shrink-0 rounded-full border border-[var(--chrome-stroke)] px-2.5 py-1.5 text-2xs text-text-muted opacity-0 transition hover:border-status-danger/40 hover:text-status-danger focus:opacity-100 group-hover/zone:opacity-100 group-focus-within/zone:opacity-100"
          title="Delete zone"
          aria-label="Delete zone"
        >
          Remove
        </button>
      </div>

      {expanded && (
        <div className="ml-10 mt-2 flex flex-col gap-2.5 border-l border-accent/15 pl-4">
          {CATEGORIES.map((cat) => {
            if (cat.singular) {
              const data = world[cat.collection] as Record<string, unknown> | undefined;
              const present = !!data;
              if (!present && !cat.addFn) return null;
              const name = present && data ? (data[cat.nameField] as string | undefined) : undefined;
              return (
                <div key={cat.key} className="border-t border-[var(--chrome-stroke)] pt-2 first:border-t-0 first:pt-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-semibold text-2xs uppercase tracking-label text-text-secondary">
                      {cat.label}
                    </span>
                    <span className="text-2xs text-text-muted">{present ? 1 : 0}</span>
                    {!present && cat.addFn && (
                      <button
                        onClick={() => handleAdd(cat)}
                        className="ml-auto rounded-full border border-[var(--chrome-stroke)] px-2 py-1 text-2xs text-text-muted transition hover:bg-[var(--chrome-highlight-strong)] hover:text-text-primary"
                        title={`Add ${cat.label.toLowerCase()}`}
                        aria-label={`Add ${cat.label.toLowerCase()}`}
                      >
                        Add
                      </button>
                    )}
                  </div>
                  {present && (
                    <ul className="flex flex-col">
                      <li>
                        <button
                          onClick={() => handleEntityClick(cat, cat.key)}
                          className="w-full truncate rounded-xl px-2 py-1.5 text-left text-xs text-text-muted transition hover:bg-accent/8 hover:text-text-primary"
                          title={name || cat.label}
                        >
                          {name || cat.label}
                        </button>
                      </li>
                    </ul>
                  )}
                </div>
              );
            }

            const collection = world[cat.collection] as Record<string, Record<string, unknown>> | undefined;
            const entries = collection ? Object.entries(collection) : [];
            if (entries.length === 0 && !cat.addFn) return null;

            return (
              <div key={cat.key} className="border-t border-[var(--chrome-stroke)] pt-2 first:border-t-0 first:pt-0">
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
                      className="ml-auto rounded-full border border-[var(--chrome-stroke)] px-2 py-1 text-2xs text-text-muted transition hover:bg-[var(--chrome-highlight-strong)] hover:text-text-primary"
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


// ─── Sidebar ────────────────────────────────────────────────────────

export function Sidebar() {
  const zones = useZoneStore((s) => s.zones);
  const { tabs: openTabs, activeTabId, project } = useProjectStore(
    useShallow((s) => ({ tabs: s.tabs, activeTabId: s.activeTabId, project: s.project })),
  );
  const closeTab = useProjectStore((s) => s.closeTab);
  const removeZone = useZoneStore((s) => s.removeZone);
  const articles = useLoreStore(selectArticles);
  const articleCount = Object.keys(articles).length;
  const [showNewZone, setShowNewZone] = useState(false);
  const showImportZone = useProjectStore((s) => s.showImportZone);
  const setShowImportZone = useProjectStore((s) => s.setShowImportZone);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const hasProject = !!project;

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
    <aside className="relative flex min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-3xl border border-[var(--chrome-stroke)] bg-gradient-panel shadow-panel lg:w-[23rem]">
      <CosmicBackdrop variant="panel" className="opacity-90" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-glow-top" />

      {/* ── Stats bar ────────────────────────────────────────────── */}
      <div className="relative z-10 shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center gap-3 px-1 text-3xs text-text-muted">
          <span>{zones.size} zones</span>
          <span className="text-border-default">&middot;</span>
          <span>{articleCount} lore</span>
          <span className="text-border-default">&middot;</span>
          <span>{openTabs.length} open</span>
        </div>
      </div>

      {/* ── Two-pane layout: Articles on top, Cartography on bottom ── */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {/* ── Articles (top half) ──────────────────────────────────
             ArticleTree has its own search bar and scroll container,
             so we do NOT add overflow-y-auto here. */}
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-3">
          <div className="mb-1 mt-1 shrink-0 flex items-center justify-between">
            <h2 className="text-2xs font-medium uppercase tracking-label text-text-secondary">
              Articles
              <span className="ml-2 text-3xs font-normal text-text-muted">{articleCount}</span>
            </h2>
          </div>
          <BulkActionsBar />
          <ArticleTree />
        </div>

        {/* ── Divider ── */}
        <div className="shrink-0 mx-4 border-t border-accent/20" />

        {/* ── Cartography (bottom half) ────────────────────────── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-2xs font-medium uppercase tracking-label text-text-secondary">Cartography</h2>
            <div className="flex items-center gap-2">
              {hasProject && (
                <span className="text-2xs uppercase tracking-label text-text-muted">
                  {sortedZones.length} zone{sortedZones.length === 1 ? "" : "s"}
                </span>
              )}
              <button
                onClick={() => setShowImportZone(true)}
                className="focus-ring shell-pill rounded-full px-3 py-1 text-2xs font-medium"
                title="Import zone YAML files"
              >
                Import
              </button>

              <button
                onClick={() => setShowNewZone(true)}
                className="focus-ring shell-pill rounded-full px-3 py-1 text-2xs font-medium"
                title="New zone"
              >
                New zone
              </button>
            </div>
          </div>
          {sortedZones.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-5 text-sm text-text-muted">
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
      </div>

      {/* ── Footer hints ─────────────────────────────────────────── */}
      <div className="relative z-10 border-t border-[var(--chrome-stroke)] px-4 py-3 text-2xs text-text-muted">
        Ctrl+M map | Ctrl+K palette | Ctrl+, settings
      </div>

      {showNewZone && <NewZoneDialog onClose={() => setShowNewZone(false)} />}
      {showImportZone && <ImportZoneDialog onClose={() => setShowImportZone(false)} />}

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
