import { useMemo, useState, useRef, useCallback } from "react";
import { useZoneStore } from "@/stores/zoneStore";

export type EntityType =
  | "zone"
  | "room"
  | "mob"
  | "item"
  | "shop"
  | "quest"
  | "gatheringNode"
  | "recipe";

export interface SearchEntry {
  zoneId: string;
  entityType: EntityType;
  entityId: string;
  displayName: string;
  searchText: string;
}

function buildIndex(zones: Map<string, { data: import("@/types/world").WorldFile }>): SearchEntry[] {
  const entries: SearchEntry[] = [];

  for (const [zoneId, { data }] of zones) {
    // Zone itself
    entries.push({
      zoneId,
      entityType: "zone",
      entityId: zoneId,
      displayName: data.zone,
      searchText: `${zoneId} ${data.zone}`.toLowerCase(),
    });

    // Rooms
    for (const [roomId, room] of Object.entries(data.rooms)) {
      entries.push({
        zoneId,
        entityType: "room",
        entityId: roomId,
        displayName: room.title,
        searchText: `${roomId} ${room.title}`.toLowerCase(),
      });
    }

    // Mobs
    if (data.mobs) {
      for (const [mobId, mob] of Object.entries(data.mobs)) {
        entries.push({
          zoneId,
          entityType: "mob",
          entityId: mobId,
          displayName: mob.name,
          searchText: `${mobId} ${mob.name}`.toLowerCase(),
        });
      }
    }

    // Items
    if (data.items) {
      for (const [itemId, item] of Object.entries(data.items)) {
        entries.push({
          zoneId,
          entityType: "item",
          entityId: itemId,
          displayName: item.displayName,
          searchText: `${itemId} ${item.displayName}`.toLowerCase(),
        });
      }
    }

    // Shops
    if (data.shops) {
      for (const [shopId, shop] of Object.entries(data.shops)) {
        entries.push({
          zoneId,
          entityType: "shop",
          entityId: shopId,
          displayName: shop.name,
          searchText: `${shopId} ${shop.name}`.toLowerCase(),
        });
      }
    }

    // Quests
    if (data.quests) {
      for (const [questId, quest] of Object.entries(data.quests)) {
        entries.push({
          zoneId,
          entityType: "quest",
          entityId: questId,
          displayName: quest.name,
          searchText: `${questId} ${quest.name}`.toLowerCase(),
        });
      }
    }

    // Gathering Nodes
    if (data.gatheringNodes) {
      for (const [nodeId, node] of Object.entries(data.gatheringNodes)) {
        entries.push({
          zoneId,
          entityType: "gatheringNode",
          entityId: nodeId,
          displayName: node.displayName,
          searchText: `${nodeId} ${node.displayName}`.toLowerCase(),
        });
      }
    }

    // Recipes
    if (data.recipes) {
      for (const [recipeId, recipe] of Object.entries(data.recipes)) {
        entries.push({
          zoneId,
          entityType: "recipe",
          entityId: recipeId,
          displayName: recipe.displayName,
          searchText: `${recipeId} ${recipe.displayName}`.toLowerCase(),
        });
      }
    }
  }

  return entries;
}

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  zone: "Zone",
  room: "Room",
  mob: "Mob",
  item: "Item",
  shop: "Shop",
  quest: "Quest",
  gatheringNode: "Node",
  recipe: "Recipe",
};

export { ENTITY_TYPE_LABELS };

export function useGlobalSearch() {
  const zones = useZoneStore((s) => s.zones);
  const [query, setQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const index = useMemo(() => buildIndex(zones), [zones]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value);
    }, 150);
  }, []);

  const clearQuery = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const results = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return [];
    return index.filter((entry) => entry.searchText.includes(q));
  }, [index, debouncedQuery]);

  // Group results by zone
  const grouped = useMemo(() => {
    const map = new Map<string, SearchEntry[]>();
    for (const entry of results) {
      const list = map.get(entry.zoneId);
      if (list) {
        list.push(entry);
      } else {
        map.set(entry.zoneId, [entry]);
      }
    }
    return map;
  }, [results]);

  return {
    query,
    setQuery: handleQueryChange,
    clearQuery,
    results,
    grouped,
    isSearching: debouncedQuery.trim().length > 0,
  };
}
