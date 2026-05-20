import { MarkerType, type Node, type Edge } from "@xyflow/react";
import type { WorldFile, ExitValue } from "@/types/world";
import { OPPOSITE } from "@/lib/zoneEdits";
import { graphTokens } from "@/lib/cssTokens";

// ─── Graph color tokens (read from --color-graph-* CSS variables) ────

const GRAPH_FALLBACK = {
  bg:     "#080c1c",
  edge:   "#6a7aac",
  edgeUp: "#7a5fc0",
  cross:  "#c8972e",
  door:   "#e2bc6a",
  grid:   "#1e2748",
  node:   "#2a3460",
} as const;

let _graph: ReturnType<typeof graphTokens> | null = null;

/** Lazy-init graph colors from CSS tokens (falls back to defaults in tests). */
export function GRAPH() {
  if (!_graph) {
    const tokens = graphTokens();
    _graph = tokens.bg ? tokens : GRAPH_FALLBACK;
  }
  return _graph;
}

// ─── Node data types ────────────────────────────────────────────────

export interface EntitySprite {
  id: string;
  kind: "mob" | "item" | "shop" | "gatheringNode";
  name: string;
  image?: string;
}

export interface RoomNodeData extends Record<string, unknown> {
  roomId: string;
  title: string;
  description: string;
  isStartRoom: boolean;
  mobCount: number;
  itemCount: number;
  shopCount: number;
  gatheringNodeCount: number;
  station?: string;
  bank?: boolean;
  tavern?: boolean;
  inn?: boolean;
  dungeon?: boolean;
  auction?: boolean;
  stylist?: boolean;
  housingBroker?: boolean;
  image?: string;
  entities: EntitySprite[];
}

export interface CrossZoneNodeData extends Record<string, unknown> {
  zone: string;
  room: string;
  label: string;
}

// ─── Per-room memoization ───────────────────────────────────────────
//
// Without this, every call to `zoneToGraph` (one per edit) produces fresh
// `RoomNodeData` objects for *every* room. RoomNode's `memo()` then can't
// short-circuit, so every node re-renders and re-runs its image-loading
// effects even when only one unrelated room changed. The cache here keys
// on a fingerprint of every field RoomNode actually reads and returns the
// previous data reference when nothing displayed has changed.

interface RoomCacheEntry {
  fingerprint: string;
  data: RoomNodeData;
}

const roomDataCache = new Map<string, RoomCacheEntry>();

function buildEntityFingerprint(entities: EntitySprite[]): string {
  // Order is preserved by zoneToGraph's insertion sequence (mobs, items,
  // shops, gathering nodes) so a stable fingerprint requires no sort.
  return entities.map((e) => `${e.kind}:${e.id}:${e.image ?? ""}`).join(",");
}

function cachedRoomData(
  roomId: string,
  build: () => RoomNodeData & { _fingerprint: string },
): RoomNodeData {
  const next = build();
  const fingerprint = next._fingerprint;
  const cached = roomDataCache.get(roomId);
  if (cached && cached.fingerprint === fingerprint) {
    return cached.data;
  }
  // Strip the internal fingerprint field — RoomNodeData doesn't carry it.
  const { _fingerprint: _ignore, ...data } = next;
  void _ignore;
  roomDataCache.set(roomId, { fingerprint, data });
  return data;
}

/** Free room-data cache entries. Call when switching projects so the cache
 *  doesn't pin memory for rooms that no longer exist. */
export function clearRoomDataCache(): void {
  roomDataCache.clear();
}

// ─── Helpers ────────────────────────────────────────────────────────

function resolveExit(exit: string | ExitValue): {
  target: string;
  hasDoor: boolean;
  isLocked: boolean;
} {
  if (typeof exit === "string") {
    return { target: exit, hasDoor: false, isLocked: false };
  }
  return {
    target: exit.to,
    hasDoor: !!exit.door,
    isLocked: !!exit.door?.locked,
  };
}

function oppositeDir(dir: string): string {
  return OPPOSITE[dir] ?? "n";
}

interface RawExit {
  source: string;
  target: string;
  direction: string;
  hasDoor: boolean;
  isLocked: boolean;
}

// ─── Main conversion ────────────────────────────────────────────────

export function zoneToGraph(
  world: WorldFile,
): {
  nodes: Node[];
  edges: Edge[];
} {
  // Count entities per room
  const mobsPerRoom = new Map<string, number>();
  const itemsPerRoom = new Map<string, number>();
  const shopsPerRoom = new Map<string, number>();
  const gatheringNodesPerRoom = new Map<string, number>();

  for (const mob of Object.values(world.mobs ?? {})) {
    for (const spawn of mob.spawns ?? []) {
      const n = spawn.count ?? 1;
      mobsPerRoom.set(spawn.room, (mobsPerRoom.get(spawn.room) ?? 0) + n);
    }
  }
  for (const item of Object.values(world.items ?? {})) {
    if (item.room) {
      itemsPerRoom.set(item.room, (itemsPerRoom.get(item.room) ?? 0) + 1);
    }
  }
  for (const shop of Object.values(world.shops ?? {})) {
    shopsPerRoom.set(shop.room, (shopsPerRoom.get(shop.room) ?? 0) + 1);
  }
  for (const node of Object.values(world.gatheringNodes ?? {})) {
    gatheringNodesPerRoom.set(node.room, (gatheringNodesPerRoom.get(node.room) ?? 0) + 1);
  }

  // Collect entity sprites per room
  const entitiesPerRoom = new Map<string, EntitySprite[]>();
  const pushEntity = (roomId: string, sprite: EntitySprite) => {
    let arr = entitiesPerRoom.get(roomId);
    if (!arr) { arr = []; entitiesPerRoom.set(roomId, arr); }
    arr.push(sprite);
  };
  for (const [id, mob] of Object.entries(world.mobs ?? {})) {
    const seenRooms = new Set<string>();
    for (const spawn of mob.spawns ?? []) {
      if (seenRooms.has(spawn.room)) continue;
      seenRooms.add(spawn.room);
      pushEntity(spawn.room, { id, kind: "mob", name: mob.name, image: mob.image });
    }
  }
  for (const [id, item] of Object.entries(world.items ?? {})) {
    if (item.room) {
      pushEntity(item.room, { id, kind: "item", name: item.displayName, image: item.image });
    }
  }
  for (const [id, shop] of Object.entries(world.shops ?? {})) {
    pushEntity(shop.room, { id, kind: "shop", name: shop.name, image: shop.image });
  }
  for (const [id, node] of Object.entries(world.gatheringNodes ?? {})) {
    pushEntity(node.room, { id, kind: "gatheringNode", name: node.displayName, image: node.image });
  }

  // Build room nodes
  const nodes: Node[] = [];
  for (const [roomId, room] of Object.entries(world.rooms)) {
    const isStartRoom = roomId === world.startRoom;
    const mobCount = mobsPerRoom.get(roomId) ?? 0;
    const itemCount = itemsPerRoom.get(roomId) ?? 0;
    const shopCount = shopsPerRoom.get(roomId) ?? 0;
    const gatheringNodeCount = gatheringNodesPerRoom.get(roomId) ?? 0;
    const entities = entitiesPerRoom.get(roomId) ?? [];

    const data = cachedRoomData(roomId, () => {
      // Fingerprint of every field RoomNode renders. `description` is
      // intentionally excluded — it's authored frequently but not displayed
      // in the graph node, so editing it shouldn't bust the memo.
      const flags = `${room.bank ? 1 : 0}${room.tavern ? 1 : 0}${room.inn ? 1 : 0}${room.dungeon ? 1 : 0}${room.auction ? 1 : 0}${room.stylist ? 1 : 0}${room.housingBroker ? 1 : 0}`;
      const fingerprint = [
        room.title,
        room.image ?? "",
        room.station ?? "",
        flags,
        isStartRoom ? 1 : 0,
        mobCount,
        itemCount,
        shopCount,
        gatheringNodeCount,
        buildEntityFingerprint(entities),
      ].join("|");
      return {
        roomId,
        title: room.title,
        description: room.description,
        isStartRoom,
        mobCount,
        itemCount,
        shopCount,
        gatheringNodeCount,
        station: room.station,
        bank: room.bank,
        tavern: room.tavern,
        inn: room.inn,
        dungeon: room.dungeon,
        auction: room.auction,
        stylist: room.stylist,
        housingBroker: room.housingBroker,
        image: room.image,
        entities,
        _fingerprint: fingerprint,
      };
    });

    nodes.push({
      id: roomId,
      type: "room",
      position: { x: 0, y: 0 },
      data,
    });
  }

  // Collect all exits
  const sameZoneExits: RawExit[] = [];
  const crossZoneSet = new Set<string>();

  for (const [roomId, room] of Object.entries(world.rooms)) {
    for (const [dir, exitVal] of Object.entries(room.exits ?? {})) {
      const { target, hasDoor, isLocked } = resolveExit(exitVal);

      if (target.includes(":")) {
        // Cross-zone exit
        const ghostId = `xzone:${target}`;
        if (!crossZoneSet.has(ghostId)) {
          crossZoneSet.add(ghostId);
          const colonIdx = target.indexOf(":");
          const zone = target.substring(0, colonIdx);
          const rm = target.substring(colonIdx + 1);
          nodes.push({
            id: ghostId,
            type: "crossZone",
            position: { x: 0, y: 0 },
            data: { zone, room: rm, label: target } satisfies CrossZoneNodeData,
          });
        }

        sameZoneExits.push({
          source: roomId,
          target: ghostId,
          direction: dir,
          hasDoor,
          isLocked,
        });
      } else if (world.rooms[target]) {
        sameZoneExits.push({
          source: roomId,
          target,
          direction: dir,
          hasDoor,
          isLocked,
        });
      }
    }
  }

  // Deduplicate bidirectional exits: show one edge per room pair
  const edges: Edge[] = [];
  const seen = new Set<string>();

  for (const exit of sameZoneExits) {
    const pairKey = [exit.source, exit.target].sort().join("|");
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);

    // Look for the reverse exit
    const reverse = sameZoneExits.find(
      (e) => e.source === exit.target && e.target === exit.source,
    );

    const isBidirectional = !!reverse;
    const isCrossZone = exit.target.startsWith("xzone:");
    const isVertical = exit.direction === "u" || exit.direction === "d";

    const label = isBidirectional
      ? `${exit.direction.toUpperCase()} / ${reverse!.direction.toUpperCase()}`
      : exit.direction.toUpperCase();

    edges.push({
      id: `${exit.source}-${exit.direction}-${exit.target}`,
      source: exit.source,
      target: exit.target,
      sourceHandle: `source-${exit.direction}`,
      targetHandle: reverse
        ? `target-${reverse.direction}`
        : `target-${oppositeDir(exit.direction)}`,
      type: "exitEdge",
      label,
      animated: isCrossZone || isVertical,
      markerEnd: isBidirectional
        ? undefined
        : { type: MarkerType.ArrowClosed, color: isVertical ? GRAPH().edgeUp : GRAPH().edge },
      style: {
        stroke: isCrossZone ? GRAPH().cross : isVertical ? GRAPH().edgeUp : exit.hasDoor ? GRAPH().door : GRAPH().edge,
        strokeDasharray: exit.hasDoor ? "6 3" : isVertical ? "4 4" : undefined,
        strokeWidth: isVertical ? 2 : 1.5,
      },
      data: {
        sourceRoom: exit.source,
        direction: exit.direction,
      },
    });
  }

  return { nodes, edges };
}
