import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { CrossZoneNodeData } from "@/lib/zoneToGraph";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";

type CrossZoneNodeType = Node<CrossZoneNodeData, "crossZone">;

const handleStyle: React.CSSProperties = {
  width: 6,
  height: 6,
  background: "transparent",
  border: "none",
};

export function CrossZoneNode({ data }: NodeProps<CrossZoneNodeType>) {
  const d = data as CrossZoneNodeData;

  const handleClick = () => {
    const zoneId = d.zone;
    // Only navigate if the target zone is loaded
    const zoneState = useZoneStore.getState().zones.get(zoneId);
    if (!zoneState) return;

    useProjectStore.getState().openTab({
      id: `zone:${zoneId}`,
      kind: "zone",
      label: zoneId,
    });
  };

  return (
    <div
      className="cursor-pointer rounded-full border border-accent/60 bg-accent/10 px-3 py-1.5 transition-colors hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-accent/60"
      style={{ minWidth: 120 }}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      title={`Navigate to ${d.zone}`}
      aria-label={`Navigate to zone ${d.zone}, room ${d.room}`}
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
        <div className="text-2xs text-accent/80">{d.zone}</div>
        <div className="truncate text-xs text-accent">{d.room}</div>
      </div>
    </div>
  );
}
