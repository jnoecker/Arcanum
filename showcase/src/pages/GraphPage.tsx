import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Link } from "react-router-dom";
import {
  ShowcaseEmptyState,
  showcaseButtonClassNames,
  showcaseSurfaceClassNames,
} from "@/components/ShowcasePrimitives";
import { ShowcaseNode } from "@/components/ShowcaseNode";
import { useShowcase } from "@/lib/DataContext";
import { buildShowcaseGraph, type GraphFilters } from "@/lib/buildGraph";
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
    document.title = `Connections - ${data?.meta.worldName ?? "World Lore"}`;
  }, [data?.meta.worldName]);

  const articles = data?.articles ?? [];

  const templates = useMemo(() => {
    const set = new Set<ArticleTemplate>();
    for (const article of articles) {
      if (article.template !== "world_setting") {
        set.add(article.template);
      }
    }
    return [...set].sort((a, b) => TEMPLATE_LABELS[a].localeCompare(TEMPLATE_LABELS[b]));
  }, [articles]);

  const filters: GraphFilters | undefined = useMemo(() => {
    const next: GraphFilters = {};
    if (templateFilters.size > 0) {
      next.templates = templateFilters;
    }
    if (relationFilters.size > 0) {
      next.relationTypes = relationFilters;
    }
    return next.templates || next.relationTypes ? next : undefined;
  }, [relationFilters, templateFilters]);

  const { nodes, edges } = useMemo(
    () => (data ? buildShowcaseGraph(articles, articleById, filters) : { nodes: [], edges: [] }),
    [articleById, articles, data, filters],
  );

  const shouldVirtualizeGraph = nodes.length > 36 || edges.length > 72;
  const hasActiveFilters = templateFilters.size > 0 || relationFilters.size > 0;

  const toggleTemplate = useCallback((template: ArticleTemplate) => {
    setTemplateFilters((previous) => {
      const next = new Set(previous);
      if (next.has(template)) {
        next.delete(template);
      } else {
        next.add(template);
      }
      return next;
    });
  }, []);

  const toggleRelation = useCallback((relation: string) => {
    setRelationFilters((previous) => {
      const next = new Set(previous);
      if (next.has(relation)) {
        next.delete(relation);
      } else {
        next.add(relation);
      }
      return next;
    });
  }, []);

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      <section className={`${showcaseSurfaceClassNames.hero} px-6 py-7 sm:px-8`}>
        <h1 className="mt-3 max-w-3xl font-display text-3xl leading-tight text-[var(--color-aurum-pale)] sm:text-4xl">
          Survey alliances, feuds, blood ties, and territorial claims as a living weave.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-text-secondary sm:text-[0.95rem]">
          This chamber shows how a court leans on a city, how a ruin keeps appearing in rival chronicles, and where
          one name is only a passing mention instead of a binding thread.
        </p>
        <p className="mt-6 text-sm leading-7 text-text-muted">
          {new Intl.NumberFormat().format(nodes.length)} visible nodes and {new Intl.NumberFormat().format(edges.length)} visible threads
          {hasActiveFilters ? " under the current filters." : " in the full survey."}
        </p>
      </section>

      <section className={`${showcaseSurfaceClassNames.section} px-5 py-5 sm:px-6`}>
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border-muted/25 pb-4">
          <div>
            <h2 className="mt-2 font-display text-3xl text-[var(--color-aurum-pale)]">
              {hasActiveFilters ? "Filtered relationship field" : "Full relationship field"}
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-text-muted lg:text-right">
            {hasActiveFilters ? "The view is narrowed." : "The full relationship field is visible."}{" "}
            {shouldVirtualizeGraph ? "Large exports render visible elements only." : "The full graph is rendered at once."}
          </p>
        </div>

        <div className="showcase-viewport mt-5 overflow-hidden rounded-[1.35rem] border border-border-muted/25 bg-[var(--color-graph-bg)]">
          {nodes.length > 0 ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              minZoom={0.2}
              maxZoom={2}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              onlyRenderVisibleElements={shouldVirtualizeGraph}
              proOptions={{ hideAttribution: true }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1}
                color="var(--color-graph-grid)"
              />
              <Controls showInteractive={false} position="bottom-left" />
              <MiniMap
                style={{ background: "var(--color-bg-secondary)" }}
                maskColor="var(--graph-minimap-mask)"
                nodeColor="var(--color-accent)"
              />
            </ReactFlow>
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <ShowcaseEmptyState
                className="w-full max-w-xl"
                title={hasActiveFilters ? "No matching connections" : "No visible weave yet"}
                description={
                  hasActiveFilters
                    ? "No connections match the selected article families and relation types."
                    : "No threads of fate connect these entries yet."
                }
                actions={
                  <>
                    {hasActiveFilters ? (
                      <button
                        type="button"
                        onClick={() => {
                          setTemplateFilters(new Set());
                          setRelationFilters(new Set());
                        }}
                        className={showcaseButtonClassNames.secondary}
                      >
                        Reset filters
                      </button>
                    ) : null}
                    <Link to="/articles" className={showcaseButtonClassNames.quiet}>
                      Explore the codex
                    </Link>
                  </>
                }
              />
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(18rem,0.8fr)]">
        <div className={`${showcaseSurfaceClassNames.sectionSoft} px-5 py-5`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[0.68rem] uppercase tracking-[0.3em] text-text-muted">Article type</p>
              <h2 className="mt-2 font-display text-xl text-accent-emphasis">Filter the graph</h2>
            </div>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() => {
                  setTemplateFilters(new Set());
                  setRelationFilters(new Set());
                }}
                className={showcaseButtonClassNames.quiet}
              >
                Reset
              </button>
            ) : null}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {templates.map((template) => (
              <button
                key={template}
                type="button"
                onClick={() => toggleTemplate(template)}
                aria-pressed={templateFilters.size === 0 || templateFilters.has(template)}
                className="showcase-pill"
                data-active={templateFilters.size === 0 || templateFilters.has(template)}
              >
                {TEMPLATE_LABELS[template]}
              </button>
            ))}
          </div>
        </div>

        <div className={`${showcaseSurfaceClassNames.sectionSoft} px-5 py-5`}>
          <p className="text-[0.68rem] uppercase tracking-[0.3em] text-text-muted">Relation</p>
          <h2 className="mt-2 font-display text-xl text-accent-emphasis">Choose the thread</h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {RELATION_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleRelation(option.value)}
                aria-pressed={relationFilters.size === 0 || relationFilters.has(option.value)}
                className="showcase-pill"
                data-active={relationFilters.size === 0 || relationFilters.has(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className={`${showcaseSurfaceClassNames.sectionSoft} px-5 py-5`}>
          <p className="text-[0.68rem] uppercase tracking-[0.3em] text-text-muted">How to read it</p>
          <p className="mt-3 font-display text-xl text-[var(--color-aurum-pale)]">Follow weight before noise.</p>
          <p className="mt-3 text-sm leading-7 text-text-secondary">
            Dense exports render only visible elements at scale, keeping the chamber responsive while still exposing the
            strongest bonds first.
          </p>
        </div>
      </section>
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
