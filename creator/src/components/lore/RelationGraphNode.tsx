import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ArticleTemplate } from "@/types/lore";

// Colors mirror CSS custom properties in index.css (--color-template-*)
const TEMPLATE_COLORS: Record<ArticleTemplate, string> = {
  world_setting: "#a897d2",
  character: "#a897d2",
  location: "#8caec9",
  organization: "#bea873",
  item: "#a3c48e",
  species: "#c4956a",
  event: "#bea873",
  language: "#95a0bf",
  profession: "#d4c8a0",
  ability: "#b88faa",
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
  profession: "P",
  ability: "Ab",
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
      <Handle type="target" position={Position.Left} style={{ background: color, border: "none", width: 8, height: 8 }} />
      <div
        className="flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 shadow-md"
        style={{
          borderColor: `${color}50`,
          background: `linear-gradient(135deg, ${color}20, ${color}10)`,
          minWidth: 140,
          maxWidth: 220,
          backdropFilter: "blur(8px)",
        }}
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style={{ backgroundColor: `${color}40`, color }}
        >
          {icon}
        </span>
        <span
          className="min-w-0 truncate text-sm font-medium text-text-primary"
        >
          {d.label}
        </span>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: color, border: "none", width: 8, height: 8 }} />
    </>
  );
}
