import { createContext, useContext } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";
import { GRAPH } from "@/lib/zoneToGraph";

export interface ExitEdgeData extends Record<string, unknown> {
  sourceRoom: string;
  direction: string;
}

export type ExitEdgeType = Edge<ExitEdgeData>;

export const ExitDeleteContext = createContext<
  ((sourceRoom: string, direction: string) => void) | null
>(null);

export function ExitEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  label,
  markerEnd,
  data,
  selected,
}: EdgeProps<ExitEdgeType>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const onDelete = useContext(ExitDeleteContext);
  const graph = GRAPH();

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} interactionWidth={20} />
      <EdgeLabelRenderer>
        <div
          className="group/edge nodrag nopan"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
        >
          <div
            className="flex items-center gap-1 rounded px-1.5 py-0.5"
            style={{ backgroundColor: graph.bg, opacity: 0.95 }}
          >
            <span
              style={{
                color: graph.edge,
                fontSize: 10,
                fontWeight: 500,
              }}
            >
              {label}
            </span>
            {onDelete && data?.sourceRoom && data?.direction && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(data.sourceRoom, data.direction);
                }}
                className={`rounded px-0.5 text-xs transition-colors hover:text-status-danger ${
                  selected
                    ? "inline text-text-muted"
                    : "hidden text-text-muted group-hover/edge:inline"
                }`}
                title="Delete exit"
                aria-label="Delete exit"
              >
                &times;
              </button>
            )}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
