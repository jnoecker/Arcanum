import { MarkerType, type Node, type Edge } from "@xyflow/react";
import type { WorldFile, ExitValue } from "@/types/world";
import { OPPOSITE } from "@/lib/zoneEdits";

// ─── Graph color tokens (match --color-graph-* in index.css) ────────

const GRAPH = {
  bg:     "#080c1c",
  edge:   "#6a7aac",
  edgeUp: "#7a5fc0",
  cross:  "#c8972e",
  door:   "#e2bc6a",
  grid:   "#1e2748",
  node:   "#2a3460",
} as const;

export { GRAPH };

// ─── Node data types ────────────────────────────────────────────────

export interface EntitySprite {
  id: string;
  kind: "mob" | "item" | "shop";
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
  station?: string;
  image?: string;
  entities: EntitySprite[];
}

export interface CrossZoneNodeData extends Record<string, unknown> {
  zone: string;
  room: string;
  label: string;
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

  for (const mob of Object.values(world.mobs ?? {})) {
    mobsPerRoom.set(mob.room, (mobsPerRoom.get(mob.room) ?? 0) + 1);
  }
  for (const item of Object.values(world.items ?? {})) {
    if (item.room) {
      itemsPerRoom.set(item.room, (itemsPerRoom.get(item.room) ?? 0) + 1);
    }
  }
  for (const shop of Object.values(world.shops ?? {})) {
    shopsPerRoom.set(shop.room, (shopsPerRoom.get(shop.room) ?? 0) + 1);
  }

  // Collect entity sprites per room
  const entitiesPerRoom = new Map<string, EntitySprite[]>();
  const pushEntity = (roomId: string, sprite: EntitySprite) => {
    let arr = entitiesPerRoom.get(roomId);
    if (!arr) { arr = []; entitiesPerRoom.set(roomId, arr); }
    arr.push(sprite);
  };
  for (const [id, mob] of Object.entries(world.mobs ?? {})) {
    pushEntity(mob.room, { id, kind: "mob", name: mob.name, image: mob.image });
  }
  for (const [id, item] of Object.entries(world.items ?? {})) {
    if (item.room) {
      pushEntity(item.room, { id, kind: "item", name: item.displayName, image: item.image });
    }
  }
  for (const [id, shop] of Object.entries(world.shops ?? {})) {
    pushEntity(shop.room, { id, kind: "shop", name: shop.name, image: shop.image });
  }

  // Build room nodes
  const nodes: Node[] = [];
  for (const [roomId, room] of Object.entries(world.rooms)) {
    nodes.push({
      id: roomId,
      type: "room",
      position: { x: 0, y: 0 },
      data: {
        roomId,
        title: room.title,
        description: room.description,
        isStartRoom: roomId === world.startRoom,
        mobCount: mobsPerRoom.get(roomId) ?? 0,
        itemCount: itemsPerRoom.get(roomId) ?? 0,
        shopCount: shopsPerRoom.get(roomId) ?? 0,
        station: room.station,
        image: room.image,
        entities: entitiesPerRoom.get(roomId) ?? [],
      } satisfies RoomNodeData,
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
      type: "smoothstep",
      label,
      animated: isCrossZone || isVertical,
      markerEnd: isBidirectional
        ? undefined
        : { type: MarkerType.ArrowClosed, color: isVertical ? GRAPH.edgeUp : GRAPH.edge },
      style: {
        stroke: isCrossZone ? GRAPH.cross : isVertical ? GRAPH.edgeUp : exit.hasDoor ? GRAPH.door : GRAPH.edge,
        strokeDasharray: exit.hasDoor ? "6 3" : isVertical ? "4 4" : undefined,
        strokeWidth: isVertical ? 2 : 1.5,
      },
      labelStyle: {
        fill: GRAPH.edge,
        fontSize: 10,
        fontWeight: 500,
      },
      labelBgStyle: {
        fill: GRAPH.bg,
        fillOpacity: 0.9,
      },
    });
  }

  return { nodes, edges };
}
