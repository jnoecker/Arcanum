import { useRef, useState, useEffect, useCallback } from "react";
import { useZoneStore, type ZoneState } from "@/stores/zoneStore";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import type { Tab, ConfigSubTab } from "@/types/project";
import type { WorldFile } from "@/types/world";
import { useGlobalSearch, ENTITY_TYPE_LABELS } from "@/lib/useGlobalSearch";
import { NewZoneDialog } from "./NewZoneDialog";
import panelHeader from "@/assets/panel-header.jpg";
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
}: {
  zoneId: string;
  zoneState: ZoneState;
  isActive: boolean;
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
    <li>
      <div className="flex items-center">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-4 shrink-0 text-center text-[10px] text-text-muted"
        >
          {expanded ? "\u25BE" : "\u25B8"}
        </button>
        <button
          onClick={handleZoneClick}
          className={`min-w-0 flex-1 rounded px-1.5 py-1 text-left text-xs transition-colors ${
            isActive
              ? "bg-bg-hover text-text-primary"
              : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          }`}
        >
          <span className="truncate">{zoneId}</span>
          {zoneState.dirty && <span className="ml-1 text-accent">*</span>}
        </button>
      </div>

      {expanded && (
        <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-border-default pl-2">
          {CATEGORIES.map((cat) => {
            const collection = world[cat.collection] as Record<string, Record<string, unknown>> | undefined;
            const entries = collection ? Object.entries(collection) : [];
            if (entries.length === 0 && !cat.addFn) return null;

            return (
              <div key={cat.key}>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-text-muted">
                    {cat.label}
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {entries.length}
                  </span>
                  {cat.addFn && (
                    <button
                      onClick={() => handleAdd(cat)}
                      className="ml-auto rounded px-1 text-[10px] text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
                      title={`Add ${cat.label.replace(/s$/, "").toLowerCase()}`}
                    >
                      +
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
                            className="w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary"
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
  const configDirty = useConfigStore((s) => s.dirty);
  const openTab = useProjectStore((s) => s.openTab);
  const setConfigSubTab = useProjectStore((s) => s.setConfigSubTab);
  const activeTabId = useProjectStore((s) => s.activeTabId);

  const { query, setQuery, clearQuery, grouped, isSearching } =
    useGlobalSearch();
  const searchRef = useRef<HTMLInputElement>(null);
  const [showNewZone, setShowNewZone] = useState(false);
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

  const sortedZones = [...zones.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <div className="flex h-full w-56 shrink-0 flex-col border-r border-border-default bg-bg-secondary">
      {/* Search */}
      <div className="shrink-0 border-b border-border-default px-3 py-2">
        <div className="relative">
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search... (Ctrl+K)"
            className="h-7 w-full rounded border border-border-default bg-bg-primary px-2 pr-6 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
          />
          {query && (
            <button
              onClick={clearQuery}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-text-primary"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Zones section (or search results) */}
      <div className="flex-1 overflow-y-auto">
        {isSearching ? (
          <div className="px-3 py-2">
            {grouped.size === 0 ? (
              <p className="text-xs text-text-muted">No results</p>
            ) : (
              [...grouped.entries()].map(([zoneId, entries]) => (
                <div key={zoneId} className="mb-3">
                  <h3 className="mb-1 font-display text-xs text-text-muted">
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
                            clearQuery();
                          }}
                          className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs transition-colors text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                        >
                          <span className="shrink-0 rounded bg-bg-elevated px-1 py-0.5 font-mono text-[10px] text-text-muted">
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
        <div className="px-3 py-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-xs uppercase tracking-widest text-text-muted">
              Zones
            </h2>
            {hasProject && (
              <button
                onClick={() => setShowNewZone(true)}
                className="rounded px-1.5 py-0.5 text-xs text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
                title="New Zone"
              >
                +
              </button>
            )}
          </div>
          {sortedZones.length === 0 ? (
            <p className="text-xs text-text-muted">No zones loaded</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {sortedZones.map(([zoneId, zoneState]) => (
                <ZoneTree
                  key={zoneId}
                  zoneId={zoneId}
                  zoneState={zoneState}
                  isActive={activeTabId === `zone:${zoneId}`}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Decorative divider */}
        <div className="mx-3 my-1 h-6 overflow-hidden rounded">
          <img
            src={panelHeader}
            alt=""
            className="h-full w-full object-cover opacity-40"
          />
        </div>

        {/* Config section */}
        <div className="px-3 py-2">
          <h2 className="mb-2 font-display text-xs uppercase tracking-widest text-text-muted">
            Config
          </h2>
          <ul className="flex flex-col gap-0.5">
            {(
              [
                { label: "Game Config", subTab: "server" as ConfigSubTab },
                { label: "Classes", subTab: "classes" as ConfigSubTab },
                { label: "Races", subTab: "races" as ConfigSubTab },
                { label: "Equipment", subTab: "equipmentSlots" as ConfigSubTab },
              ]
            ).map((entry) => (
              <li key={entry.subTab}>
                <button
                  onClick={() => {
                    setConfigSubTab(entry.subTab);
                    openTab({ id: "config", kind: "config", label: "Config" });
                  }}
                  className={`w-full rounded px-2 py-1 text-left text-sm transition-colors ${
                    activeTabId === "config"
                      ? "bg-bg-hover text-text-primary"
                      : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  }`}
                >
                  {entry.label}
                  {entry.subTab === "server" && configDirty && (
                    <span className="ml-1 text-accent">*</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
        </>
        )}
      </div>

      {/* Console shortcut at bottom */}
      <div className="border-t border-border-default px-3 py-2">
        <button
          onClick={() =>
            openTab({ id: "console", kind: "console", label: "Console" })
          }
          className={`w-full rounded px-2 py-1 text-left text-sm transition-colors ${
            activeTabId === "console"
              ? "bg-bg-hover text-text-primary"
              : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          }`}
        >
          Console
        </button>
      </div>

      {showNewZone && <NewZoneDialog onClose={() => setShowNewZone(false)} />}
    </div>
  );
}
