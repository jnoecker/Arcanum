import { useMemo, useState, useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ReactFlowProvider,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Link } from "react-router-dom";
import { useShowcase } from "@/lib/DataContext";
import { buildShowcaseGraph, type GraphFilters } from "@/lib/buildGraph";
import { ShowcaseNode } from "@/components/ShowcaseNode";
import { TEMPLATE_LABELS } from "@/lib/templates";
import type { ArticleTemplate } from "@/types/showcase";

const nodeTypes: NodeTypes = {
  showcaseNode: ShowcaseNode,
};

const RELATION_TYPE_OPTIONS = [
  { value: "ally", label: "Ally" },
  { value: "rival", label: "Rival" },
  { value: "member_of", label: "Member of" },
  { value: "located_in", label: "Located in" },
  { value: "related", label: "Related" },
  { value: "mentioned", label: "Mentioned" },
];

function GraphInner() {
  const { data, articleById } = useShowcase();
  const [templateFilters, setTemplateFilters] = useState<Set<ArticleTemplate>>(new Set());
  const [relationFilters, setRelationFilters] = useState<Set<string>>(new Set());

  useEffect(() => {
    document.title = `Connections — ${data?.meta.worldName ?? "World Lore"}`;
  }, [data?.meta.worldName]);

  const templates = useMemo(() => {
    if (!data) return [];
    const set = new Set<ArticleTemplate>();
    for (const a of data.articles) {
      if (a.template !== "world_setting") set.add(a.template);
    }
    return [...set].sort((a, b) => TEMPLATE_LABELS[a].localeCompare(TEMPLATE_LABELS[b]));
  }, [data]);

  const filters: GraphFilters | undefined = useMemo(() => {
    const f: GraphFilters = {};
    if (templateFilters.size > 0) f.templates = templateFilters;
    if (relationFilters.size > 0) f.relationTypes = relationFilters;
    return f.templates || f.relationTypes ? f : undefined;
  }, [templateFilters, relationFilters]);

  const { nodes, edges } = useMemo(
    () => (data ? buildShowcaseGraph(data.articles, articleById, filters) : { nodes: [], edges: [] }),
    [data, articleById, filters],
  );

  const toggleTemplate = useCallback((t: ArticleTemplate) => {
    setTemplateFilters((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }, []);

  const toggleRelation = useCallback((r: string) => {
    setRelationFilters((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-accent text-2xl tracking-[0.18em]">Connections</h1>

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-text-muted">Templates:</span>
          {templates.map((t) => (
            <button
              key={t}
              onClick={() => toggleTemplate(t)}
              aria-pressed={templateFilters.size === 0 || templateFilters.has(t)}
              className={`rounded-full px-2.5 py-1 text-xs transition ${
                templateFilters.size === 0 || templateFilters.has(t)
                  ? "bg-accent/15 text-accent"
                  : "text-text-muted hover:bg-bg-tertiary"
              }`}
            >
              {TEMPLATE_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-text-muted">Relations:</span>
          {RELATION_TYPE_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => toggleRelation(o.value)}
              aria-pressed={relationFilters.size === 0 || relationFilters.has(o.value)}
              className={`rounded-full px-2.5 py-1 text-xs transition ${
                relationFilters.size === 0 || relationFilters.has(o.value)
                  ? "bg-accent/15 text-accent"
                  : "text-text-muted hover:bg-bg-tertiary"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Graph */}
      <div className="h-[min(75vh,700px)] rounded-lg border border-border-muted bg-[var(--color-graph-bg)]">
        {nodes.length > 0 ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e2748" />
            <Controls showInteractive={false} position="bottom-left" />
            <MiniMap
              style={{ background: "#262f47" }}
              maskColor="rgba(8, 12, 28, 0.8)"
              nodeColor="#a897d2"
            />
          </ReactFlow>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-text-muted">
            <span>No threads of fate connect these entries... yet.</span>
            <Link to="/articles" className="text-text-link text-xs hover:text-accent transition-colors">
              Explore the Codex
            </Link>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-text-muted">
        <span>{nodes.length} nodes</span>
        <span>{edges.length} connections</span>
      </div>
    </div>
  );
}

export function GraphPage() {
  return (
    <ReactFlowProvider>
      <GraphInner />
    </ReactFlowProvider>
  );
}
