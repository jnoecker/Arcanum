import { useMemo, useState, useCallback } from "react";
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
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import type { ArticleTemplate } from "@/types/lore";
import { buildRelationGraph, type RelationGraphFilters } from "@/lib/loreRelations";
import { TEMPLATE_SCHEMAS } from "@/lib/loreTemplates";
import { RelationGraphNode } from "./RelationGraphNode";
import { RelationInferencePanel } from "./RelationInferencePanel";

const nodeTypes: NodeTypes = {
  relationNode: RelationGraphNode,
};

const TEMPLATE_FILTER_OPTIONS: { value: ArticleTemplate; label: string }[] =
  Object.values(TEMPLATE_SCHEMAS)
    .filter((s) => s.template !== "world_setting")
    .map((s) => ({ value: s.template, label: s.label }));

const RELATION_TYPE_OPTIONS = [
  { value: "ally", label: "Ally" },
  { value: "rival", label: "Rival" },
  { value: "member_of", label: "Member of" },
  { value: "located_in", label: "Located in" },
  { value: "related", label: "Related" },
  { value: "mentioned", label: "Mentioned" },
];

function RelationGraphInner() {
  const articles = useLoreStore(selectArticles);
  const selectArticle = useLoreStore((s) => s.selectArticle);

  const [inferenceOpen, setInferenceOpen] = useState(false);
  const [templateFilters, setTemplateFilters] = useState<Set<ArticleTemplate>>(new Set());
  const [relationFilters, setRelationFilters] = useState<Set<string>>(new Set());

  const filters: RelationGraphFilters | undefined = useMemo(() => {
    const f: RelationGraphFilters = {};
    if (templateFilters.size > 0) f.templates = [...templateFilters];
    if (relationFilters.size > 0) f.relationTypes = [...relationFilters];
    return f.templates || f.relationTypes ? f : undefined;
  }, [templateFilters, relationFilters]);

  const { nodes, edges } = useMemo(
    () => buildRelationGraph(articles, filters),
    [articles, filters],
  );

  const toggleTemplate = useCallback((t: ArticleTemplate) => {
    setTemplateFilters((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  }, []);

  const toggleRelation = useCallback((r: string) => {
    setRelationFilters((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r); else next.add(r);
      return next;
    });
  }, []);

  const handleNodeClick = useCallback(
    (_: unknown, node: { id: string }) => {
      selectArticle(node.id);
    },
    [selectArticle],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Relation inference */}
      <div className="rounded-xl border border-border-muted bg-bg-secondary/50 px-4 py-3">
        <button
          onClick={() => setInferenceOpen((o) => !o)}
          className="flex w-full items-center gap-2 text-left text-xs font-medium text-text-secondary transition hover:text-text-primary"
        >
          <span
            className="inline-block transition-transform"
            style={{ transform: inferenceOpen ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            &#9654;
          </span>
          Relation Suggestions
        </button>
        {inferenceOpen && (
          <div className="mt-3">
            <RelationInferencePanel />
          </div>
        )}
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-text-muted">Templates:</span>
          {TEMPLATE_FILTER_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => toggleTemplate(o.value)}
              aria-pressed={templateFilters.size === 0 || templateFilters.has(o.value)}
              className={`rounded-full px-2.5 py-1 text-2xs transition ${
                templateFilters.size === 0 || templateFilters.has(o.value)
                  ? "bg-accent/15 text-accent"
                  : "text-text-muted hover:bg-bg-tertiary"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-text-muted">Relations:</span>
          {RELATION_TYPE_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => toggleRelation(o.value)}
              aria-pressed={relationFilters.size === 0 || relationFilters.has(o.value)}
              className={`rounded-full px-2.5 py-1 text-2xs transition ${
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
      <div className="h-[min(75vh,720px)] rounded-lg border border-border-muted bg-graph-bg">
        {nodes.length > 0 ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={handleNodeClick}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--color-bg-elevated)" />
            <Controls
              showInteractive={false}
              position="bottom-left"
            />
            <MiniMap
              style={{ background: "var(--color-bg-secondary)" }}
              maskColor="rgba(8, 12, 28, 0.8)"
              nodeColor="var(--color-accent)"
            />
          </ReactFlow>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-text-muted">
            {Object.keys(articles).length === 0
              ? "No articles yet. Create some articles with relations to see the graph."
              : "No connections found. Add relations between articles or use @mentions in content."}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-2xs text-text-muted">
        <span>{nodes.length} nodes</span>
        <span>{edges.length} connections</span>
      </div>
    </div>
  );
}

export function RelationGraphPanel() {
  return (
    <ReactFlowProvider>
      <RelationGraphInner />
    </ReactFlowProvider>
  );
}
