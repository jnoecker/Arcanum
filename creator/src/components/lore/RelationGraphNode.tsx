import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ArticleTemplate } from "@/types/lore";

const TEMPLATE_COLORS: Record<ArticleTemplate, string> = {
  world_setting: "#a897d2",
  character: "#a897d2",
  location: "#8caec9",
  organization: "#bea873",
  item: "#a3c48e",
  species: "#c4956a",
  event: "#bea873",
  language: "#95a0bf",
  freeform: "#95a0bf",
};

const TEMPLATE_LABELS: Record<ArticleTemplate, string> = {
  world_setting: "W",
  character: "C",
  location: "L",
  organization: "O",
  item: "I",
  species: "S",
  event: "E",
  language: "La",
  freeform: "F",
};

interface RelationNodeData {
  label: string;
  template: ArticleTemplate;
  [key: string]: unknown;
}

export function RelationGraphNode({ data }: NodeProps) {
  const d = data as RelationNodeData;
  const color = TEMPLATE_COLORS[d.template] ?? "#95a0bf";
  const icon = TEMPLATE_LABELS[d.template] ?? "?";

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: color, border: "none", width: 6, height: 6 }} />
      <div
        className="flex items-center gap-2 rounded-xl border px-3 py-2"
        style={{
          borderColor: `${color}40`,
          background: `${color}12`,
          minWidth: 120,
          maxWidth: 200,
        }}
      >
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-2xs font-bold"
          style={{ backgroundColor: `${color}30`, color }}
        >
          {icon}
        </span>
        <span
          className="min-w-0 truncate text-xs"
          style={{ color: "#dbe3f8" }}
        >
          {d.label}
        </span>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: color, border: "none", width: 6, height: 6 }} />
    </>
  );
}
