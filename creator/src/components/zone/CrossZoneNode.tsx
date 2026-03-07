import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { CrossZoneNodeData } from "@/lib/zoneToGraph";

type CrossZoneNodeType = Node<CrossZoneNodeData, "crossZone">;

const handleStyle: React.CSSProperties = {
  width: 6,
  height: 6,
  background: "transparent",
  border: "none",
};

export function CrossZoneNode({ data }: NodeProps<CrossZoneNodeType>) {
  const d = data as CrossZoneNodeData;

  return (
    <div
      className="rounded-full border border-accent/60 bg-accent/10 px-3 py-1.5"
      style={{ minWidth: 120 }}
    >
      {/* Generic handles on all sides */}
      {([Position.Top, Position.Bottom, Position.Left, Position.Right] as const).map(
        (pos) => (
          <Handle
            key={`target-${pos}`}
            type="target"
            position={pos}
            id={`target-${pos === Position.Top ? "n" : pos === Position.Bottom ? "s" : pos === Position.Left ? "w" : "e"}`}
            style={handleStyle}
            isConnectable={false}
          />
        ),
      )}

      <div className="text-center">
        <div className="text-[10px] text-accent/80">{d.zone}</div>
        <div className="truncate text-xs text-accent">{d.room}</div>
      </div>
    </div>
  );
}
