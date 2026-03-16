import { useRef, useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useZoneStore, type ZoneState } from "@/stores/zoneStore";
import { useProjectStore } from "@/stores/projectStore";
import type { Tab } from "@/types/project";
import type { WorldFile } from "@/types/world";
import { useGlobalSearch, ENTITY_TYPE_LABELS } from "@/lib/useGlobalSearch";
import { NewZoneDialog } from "./NewZoneDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import sidebarBg from "@/assets/sidebar-bg.png";
import {
  addRoom,
  addMob,
  addItem,
  addShop,
  generateEntityId,
  generateRoomId,
} from "@/lib/zoneEdits";
import type { MobFile, ItemFile, ShopFile } from "@/types/world";

// ─── Entity category definitions ────────────────────────────────────

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

// ─── Zone tree item ─────────────────────────────────────────────────

function ZoneTree({
  zoneId,
  zoneState,
  isActive,
  onDelete,
}: {
  zoneId: string;
  zoneState: ZoneState;
  isActive: boolean;
  onDelete: (zoneId: string) => void;
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
      // Navigate to the newly created entity
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
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] text-text-muted transition hover:bg-white/8 hover:text-text-primary"
        >
          {expanded ? "\u25BE" : "\u25B8"}
        </button>
        <button
          onClick={handleZoneClick}
          className={`min-w-0 flex-1 rounded-2xl border px-3 py-2 text-left text-sm transition ${
            isActive
              ? "border-[rgba(184,216,232,0.35)] bg-[linear-gradient(135deg,rgba(168,151,210,0.16),rgba(140,174,201,0.12))] text-text-primary"
              : "border-white/8 bg-black/10 text-text-secondary hover:bg-white/8 hover:text-text-primary"
          }`}
        >
          <span className="truncate font-medium">{zoneState.data.zone || zoneId}</span>
          <span className="ml-2 truncate text-[11px] text-text-muted">{zoneId}</span>
          {zoneState.dirty && <span className="ml-2 text-[11px] text-[rgb(214,177,193)]">Unsaved</span>}
        </button>
        <button
          onClick={() => onDelete(zoneId)}
          className="hidden rounded-full border border-white/8 px-2 py-1 text-[10px] text-text-muted transition hover:border-status-danger/40 hover:text-status-danger group-hover/zone:block"
          title="Delete zone"
        >
          Remove
        </button>
      </div>

      {expanded && (
        <div className="ml-10 mt-2 flex flex-col gap-2 border-l border-white/8 pl-4">
          {CATEGORIES.map((cat) => {
            const collection = world[cat.collection] as Record<string, Record<string, unknown>> | undefined;
            const entries = collection ? Object.entries(collection) : [];
            if (entries.length === 0 && !cat.addFn) return null;

            return (
              <div key={cat.key}>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-[0.22em] text-text-muted">
                    {cat.label}
                  </span>
                  <span className="text-[11px] text-text-muted">
                    {entries.length}
                  </span>
                  {cat.addFn && (
                    <button
                      onClick={() => handleAdd(cat)}
                      className="ml-auto rounded-full border border-white/8 px-2 py-1 text-[10px] text-text-muted transition hover:bg-white/8 hover:text-text-primary"
                      title={`Add ${cat.label.replace(/s$/, "").toLowerCase()}`}
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
                            className="w-full truncate rounded-xl px-2 py-1 text-left text-[12px] text-text-muted transition hover:bg-white/8 hover:text-text-secondary"
                            title={id}
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

// ─── Main Sidebar ───────────────────────────────────────────────────

export function Sidebar() {
  const zones = useZoneStore((s) => s.zones);
  const openTab = useProjectStore((s) => s.openTab);
  const activeTabId = useProjectStore((s) => s.activeTabId);
  const navigateTo = useProjectStore((s) => s.navigateTo);
  const closeTab = useProjectStore((s) => s.closeTab);
  const removeZone = useZoneStore((s) => s.removeZone);
  const { query, setQuery, clearQuery, grouped, isSearching } =
    useGlobalSearch();
  const searchRef = useRef<HTMLInputElement>(null);
  const [showNewZone, setShowNewZone] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const hasProject = !!useProjectStore((s) => s.project);

  // Ctrl+K to focus search
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        clearQuery();
        searchRef.current?.blur();
      }
    },
    [clearQuery],
  );

  const project = useProjectStore((s) => s.project);

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

  const sortedZones = [...zones.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <aside className="relative flex h-full w-[21rem] shrink-0 flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(165deg,rgba(53,63,92,0.92),rgba(37,45,68,0.95))] shadow-[0_18px_56px_rgba(8,10,18,0.32)]">
      <img
        src={sidebarBg}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.14]"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[linear-gradient(180deg,rgba(168,151,210,0.18),transparent)]" />

      <div className="relative z-10 border-b border-white/10 px-4 py-4">
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-[0.32em] text-text-muted">
            Workspace
          </p>
          <h2 className="mt-2 font-display text-2xl text-text-primary">
            Worldmaker
          </h2>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            Build zones, tune systems, and review assets.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { id: "studio", label: "Studio", kind: "studio" as const },
            { id: "config", label: "Character", kind: "config" as const },
            { id: "sprites", label: "Sprites", kind: "sprites" as const },
            { id: "console", label: "Console", kind: "console" as const },
          ].map((entry) => (
            <button
              key={entry.id}
              onClick={() => {
                if (entry.id === "config") useProjectStore.getState().setConfigSubTab("characterStudio");
                openTab({ id: entry.id, kind: entry.kind, label: entry.label });
              }}
              className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                activeTabId === entry.id
                  ? "border-[rgba(184,216,232,0.35)] bg-[linear-gradient(135deg,rgba(168,151,210,0.16),rgba(140,174,201,0.12))] text-text-primary"
                  : "border-white/8 bg-black/10 text-text-secondary hover:bg-white/8 hover:text-text-primary"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-10 shrink-0 px-4 py-3">
        <div className="relative">
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search... (Ctrl+K)"
            className="h-10 w-full rounded-full border border-white/10 bg-black/15 px-4 pr-10 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-[rgba(184,216,232,0.38)]"
          />
          {query && (
            <button
              onClick={clearQuery}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted hover:text-text-primary"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-4">
        {isSearching ? (
          <div className="py-2">
            {grouped.size === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-6 text-sm text-text-muted">
                No results for that search yet.
              </p>
            ) : (
              [...grouped.entries()].map(([zoneId, entries]) => (
                <div key={zoneId} className="mb-4">
                  <h3 className="mb-2 font-display text-sm text-text-primary">
                    {zoneId}
                  </h3>
                  <ul className="flex flex-col gap-0.5">
                    {entries.map((entry) => (
                      <li key={`${entry.entityType}:${entry.entityId}`}>
                        <button
                          onClick={() => {
                            const tab: Tab = {
                              id: `zone:${entry.zoneId}`,
                              kind: "zone",
                              label: entry.zoneId,
                            };
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
                          <span className="shrink-0 rounded-full bg-white/8 px-2 py-1 font-mono text-[10px] text-text-muted">
                            {ENTITY_TYPE_LABELS[entry.entityType]}
                          </span>
                          <span className="truncate">{entry.displayName}</span>
                          {entry.entityId !== entry.displayName && (
                            <span className="ml-auto shrink-0 text-[10px] text-text-muted">
                              {entry.entityId}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        ) : (
        <>
        <div className="py-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-sm text-text-primary">
              Zones
            </h2>
            {hasProject && (
              <button
                onClick={() => setShowNewZone(true)}
                className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs text-text-secondary transition hover:bg-white/8 hover:text-text-primary"
                title="New Zone"
              >
                New zone
              </button>
            )}
          </div>
          {sortedZones.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-6 text-sm text-text-muted">
              No zones loaded.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {sortedZones.map(([zoneId, zoneState]) => (
                <ZoneTree
                  key={zoneId}
                  zoneId={zoneId}
                  zoneState={zoneState}
                  isActive={activeTabId === `zone:${zoneId}`}
                  onDelete={(id) => setDeleteTarget(id)}
                />
              ))}
            </ul>
          )}
        </div>
        </>
        )}
      </div>

      <div className="relative z-10 border-t border-white/10 px-4 py-3 text-[11px] text-text-muted">
        `Ctrl+K` search • `Ctrl+S` save • `Ctrl+,` settings
      </div>

      {showNewZone && <NewZoneDialog onClose={() => setShowNewZone(false)} />}
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
