import { MarkerType, type Node, type Edge } from "@xyflow/react";
import type { WorldFile, ExitValue } from "@/types/world";

// ─── Node data types ────────────────────────────────────────────────

export interface RoomNodeData extends Record<string, unknown> {
  roomId: string;
  title: string;
  description: string;
  isStartRoom: boolean;
  mobCount: number;
  itemCount: number;
  shopCount: number;
  station?: string;
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

const OPPOSITE: Record<string, string> = {
  n: "s",
  s: "n",
  e: "w",
  w: "e",
  ne: "sw",
  sw: "ne",
  nw: "se",
  se: "nw",
  u: "d",
  d: "u",
};

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
      animated: isCrossZone,
      markerEnd: isBidirectional
        ? undefined
        : { type: MarkerType.ArrowClosed, color: "#8b949e" },
      style: {
        stroke: isCrossZone ? "#a371f7" : exit.hasDoor ? "#e3b341" : "#8b949e",
        strokeDasharray: exit.hasDoor ? "6 3" : undefined,
        strokeWidth: 1.5,
      },
      labelStyle: {
        fill: "#8b949e",
        fontSize: 10,
        fontWeight: 500,
      },
      labelBgStyle: {
        fill: "#0d1117",
        fillOpacity: 0.9,
      },
    });
  }

  return { nodes, edges };
}
