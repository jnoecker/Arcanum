import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { RoomNodeData } from "@/lib/zoneToGraph";

type RoomNodeType = Node<RoomNodeData, "room">;

/** Handle positions for each compass direction */
const HANDLES: {
  id: string;
  position: Position;
  style: React.CSSProperties;
}[] = [
  { id: "n", position: Position.Top, style: { left: "50%" } },
  { id: "s", position: Position.Bottom, style: { left: "50%" } },
  { id: "e", position: Position.Right, style: { top: "50%" } },
  { id: "w", position: Position.Left, style: { top: "50%" } },
  { id: "ne", position: Position.Top, style: { left: "85%" } },
  { id: "nw", position: Position.Top, style: { left: "15%" } },
  { id: "se", position: Position.Bottom, style: { left: "85%" } },
  { id: "sw", position: Position.Bottom, style: { left: "15%" } },
  { id: "u", position: Position.Right, style: { top: "20%" } },
  { id: "d", position: Position.Right, style: { top: "80%" } },
];

const handleStyle: React.CSSProperties = {
  width: 6,
  height: 6,
  background: "transparent",
  border: "none",
};

export function RoomNode({ data, selected }: NodeProps<RoomNodeType>) {
  const d = data as RoomNodeData;

  return (
    <div
      className={`rounded border px-3 py-2 transition-colors ${
        selected
          ? "border-accent bg-bg-elevated shadow-lg shadow-accent/20"
          : d.isStartRoom
            ? "border-accent/50 bg-bg-elevated"
            : "border-border-default bg-bg-elevated"
      }`}
      style={{ width: 220 }}
    >
      {/* Handles */}
      {HANDLES.map((h) => (
        <Handle
          key={`source-${h.id}`}
          type="source"
          position={h.position}
          id={`source-${h.id}`}
          style={{ ...handleStyle, ...h.style }}
          isConnectable={false}
        />
      ))}
      {HANDLES.map((h) => (
        <Handle
          key={`target-${h.id}`}
          type="target"
          position={h.position}
          id={`target-${h.id}`}
          style={{ ...handleStyle, ...h.style }}
          isConnectable={false}
        />
      ))}

      {/* Title row */}
      <div className="flex items-center gap-1.5">
        {d.isStartRoom && (
          <span className="text-accent text-xs" title="Start room">
            ★
          </span>
        )}
        <span className="truncate text-xs font-medium text-text-primary">
          {d.title}
        </span>
      </div>

      {/* Room ID */}
      <div className="truncate text-[10px] text-text-muted">{d.roomId}</div>

      {/* Entity badges */}
      {(d.mobCount > 0 || d.itemCount > 0 || d.shopCount > 0 || d.station) && (
        <div className="mt-1 flex items-center gap-2 text-[10px] text-text-muted">
          {d.mobCount > 0 && <span title="Mobs">⚔{d.mobCount}</span>}
          {d.itemCount > 0 && <span title="Items">◆{d.itemCount}</span>}
          {d.shopCount > 0 && <span title="Shops">⛋{d.shopCount}</span>}
          {d.station && (
            <span className="text-status-info" title={`Station: ${d.station}`}>
              ⚒
            </span>
          )}
        </div>
      )}
    </div>
  );
}
