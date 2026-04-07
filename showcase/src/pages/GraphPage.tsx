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
import { ShowcaseEmptyState, showcaseButtonClassNames } from "@/components/ShowcasePrimitives";
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
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.9fr)]">
        <div className="rounded-[1.75rem] border border-[var(--color-aurum)]/22 bg-[radial-gradient(circle_at_top_left,rgba(214,177,90,0.14),transparent_42%),linear-gradient(155deg,rgba(17,18,27,0.98),rgba(9,10,17,0.94))] px-6 py-7 shadow-[var(--shadow-deep)] sm:px-8">
          <p className="text-[0.68rem] uppercase tracking-[0.38em] text-[var(--color-aurum)]/80">Threadwork chamber</p>
          <h1 className="mt-3 max-w-3xl font-display text-3xl leading-tight text-[var(--color-aurum-pale)] sm:text-4xl">
            Watch alliances, rivalries, and place-bonds gather into a visible web.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-text-secondary sm:text-[0.95rem]">
            Filters now live in a side dock so the graph can read as a chamber instead of a technical canvas with a row
            of buttons above it.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <div className="rounded-[1.5rem] border border-[var(--color-aurum)]/18 bg-bg-secondary/70 px-5 py-5">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-text-muted">Nodes</p>
            <p className="mt-3 font-display text-3xl text-[var(--color-aurum-pale)]">
              {new Intl.NumberFormat().format(nodes.length)}
            </p>
            <p className="mt-2 text-sm text-text-secondary">Visible lore anchors under the current filter state.</p>
          </div>
          <div className="rounded-[1.5rem] border border-border-muted/40 bg-bg-secondary/55 px-5 py-5">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-text-muted">Threads</p>
            <p className="mt-3 font-display text-3xl text-accent-emphasis">
              {new Intl.NumberFormat().format(edges.length)}
            </p>
            <p className="mt-2 text-sm text-text-secondary">Edges currently connecting people, orders, and regions.</p>
          </div>
          <div className="rounded-[1.5rem] border border-border-muted/40 bg-bg-secondary/55 px-5 py-5">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-text-muted">Mode</p>
            <p className="mt-3 font-display text-2xl text-accent-emphasis">
              {hasActiveFilters ? "Filtered view" : "Full weave"}
            </p>
            <p className="mt-2 text-sm text-text-secondary">Tighten or widen the weave from the side dock.</p>
          </div>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-[1.5rem] border border-border-muted/40 bg-[linear-gradient(180deg,rgba(16,17,27,0.94),rgba(9,10,17,0.98))] px-5 py-5 shadow-[var(--shadow-deep)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.3em] text-text-muted">Filter dock</p>
                <h2 className="mt-2 font-display text-xl text-accent-emphasis">Thread selectors</h2>
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

            <div className="mt-6 space-y-6">
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.26em] text-text-muted">Article families</p>
                <div className="mt-3 flex flex-wrap gap-2">
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

              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.26em] text-text-muted">Relation types</p>
                <div className="mt-3 flex flex-wrap gap-2">
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

              <div className="rounded-[1.2rem] border border-border-muted/30 bg-bg-secondary/45 px-4 py-4">
                <p className="text-[0.68rem] uppercase tracking-[0.26em] text-text-muted">Reading note</p>
                <p className="mt-3 text-sm leading-7 text-text-secondary">
                  Dense graphs render only visible elements on larger datasets. The interaction model stays read-only so
                  the route behaves like a viewing instrument, not an editor.
                </p>
              </div>
            </div>
          </div>
        </aside>

        <section className="space-y-5">
          <div className="rounded-[1.6rem] border border-border-muted/35 bg-[linear-gradient(180deg,rgba(18,18,28,0.92),rgba(10,10,18,0.98))] px-5 py-5 shadow-[var(--shadow-deep)] sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border-muted/25 pb-4">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[var(--color-aurum)]/80">Current weave</p>
                <h2 className="mt-2 font-display text-3xl text-[var(--color-aurum-pale)]">
                  {hasActiveFilters ? "Filtered relationship field" : "Full relationship field"}
                </h2>
              </div>
              <div className="grid gap-3 text-sm text-text-secondary sm:grid-cols-2 sm:text-right">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">Render mode</p>
                  <p className="mt-1 font-display text-xl text-accent-emphasis">
                    {shouldVirtualizeGraph ? "Virtualized" : "Full scene"}
                  </p>
                </div>
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">Scope</p>
                  <p className="mt-1 font-display text-xl text-accent-emphasis">
                    {hasActiveFilters ? "Focused" : "Survey"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 h-[min(78vh,760px)] overflow-hidden rounded-[1.35rem] border border-border-muted/25 bg-[var(--color-graph-bg)]">
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
                  <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--color-graph-grid)" />
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
          </div>
        </section>
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
