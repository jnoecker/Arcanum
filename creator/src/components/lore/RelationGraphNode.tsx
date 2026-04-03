import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ArticleTemplate } from "@/types/lore";

// Use CSS custom properties defined in index.css (--color-template-*)
const TEMPLATE_COLORS: Record<ArticleTemplate, string> = {
  world_setting: "var(--color-template-world)",
  character: "var(--color-template-character)",
  location: "var(--color-template-location)",
  organization: "var(--color-template-organization)",
  item: "var(--color-template-item)",
  species: "var(--color-template-species)",
  event: "var(--color-template-event)",
  language: "var(--color-template-language)",
  profession: "var(--color-template-profession)",
  ability: "var(--color-template-ability)",
  freeform: "var(--color-template-freeform)",
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
  const color = TEMPLATE_COLORS[d.template] ?? "var(--color-template-freeform)";
  const icon = TEMPLATE_LABELS[d.template] ?? "?";

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: color, border: "none", width: 8, height: 8 }} />
      <div
        className="flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 shadow-md"
        style={{
          borderColor: `color-mix(in srgb, ${color} 31%, transparent)`,
          background: `linear-gradient(135deg, color-mix(in srgb, ${color} 13%, transparent), color-mix(in srgb, ${color} 6%, transparent))`,
          minWidth: 140,
          maxWidth: 220,
          backdropFilter: "blur(8px)",
        }}
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 25%, transparent)`, color }}
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
