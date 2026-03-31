import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useNavigate } from "react-router-dom";
import { useCallback } from "react";
import { TEMPLATE_NODE_COLORS, TEMPLATE_SHORT } from "@/lib/buildGraph";
import type { ArticleTemplate } from "@/types/showcase";

interface ShowcaseNodeData {
  label: string;
  template: ArticleTemplate;
  articleId: string;
  [key: string]: unknown;
}

export function ShowcaseNode({ data }: NodeProps) {
  const d = data as ShowcaseNodeData;
  const color = TEMPLATE_NODE_COLORS[d.template] ?? "#95a0bf";
  const icon = TEMPLATE_SHORT[d.template] ?? "?";
  const navigate = useNavigate();

  const handleClick = useCallback(() => {
    navigate(`/articles/${encodeURIComponent(d.articleId)}`);
  }, [navigate, d.articleId]);

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: color, border: "none", width: 6, height: 6 }}
      />
      <div
        onClick={handleClick}
        className="flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer hover:brightness-125 transition"
        style={{
          borderColor: `${color}40`,
          background: `${color}12`,
          minWidth: 120,
          maxWidth: 200,
        }}
      >
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
          style={{ backgroundColor: `${color}30`, color }}
        >
          {icon}
        </span>
        <span className="min-w-0 truncate text-xs" style={{ color: "#dbe3f8" }}>
          {d.label}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: color, border: "none", width: 6, height: 6 }}
      />
    </>
  );
}
