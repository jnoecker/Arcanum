import { memo, useCallback, useMemo, useState } from "react";
import type { ZonePlan } from "@/types/lore";

interface TreeNode {
  plan: ZonePlan;
  children: TreeNode[];
  depth: number;
  totalDescendants: number;
}

function buildTree(plans: ZonePlan[]): TreeNode[] {
  const byParent = new Map<string | undefined, ZonePlan[]>();
  for (const p of plans) {
    const key = p.parentId ?? "__root__";
    const list = byParent.get(key) ?? [];
    list.push(p);
    byParent.set(key, list);
  }

  function recurse(parentId: string | undefined, depth: number): TreeNode[] {
    const key = parentId ?? "__root__";
    const children = byParent.get(key) ?? [];
    return children
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((plan) => {
        const kids = recurse(plan.id, depth + 1);
        const totalDescendants = kids.reduce(
          (sum, k) => sum + 1 + k.totalDescendants,
          0,
        );
        return { plan, children: kids, depth, totalDescendants };
      });
  }

  return recurse(undefined, 0);
}

function countAll(nodes: TreeNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countAll(n.children), 0);
}

interface Props {
  plans: ZonePlan[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNavigateScope: (id: string) => void;
  bare?: boolean;
}

export const ZonePlanTree = memo(function ZonePlanTree({
  plans,
  selectedId,
  onSelect,
  onNavigateScope,
  bare = false,
}: Props) {
  const tree = useMemo(() => buildTree(plans), [plans]);
  const total = useMemo(() => countAll(tree), [tree]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setCollapsed(new Set()), []);
  const collapseAll = useCallback(() => {
    const ids = new Set<string>();
    function walk(nodes: TreeNode[]) {
      for (const n of nodes) {
        if (n.children.length > 0) ids.add(n.plan.id);
        walk(n.children);
      }
    }
    walk(tree);
    setCollapsed(ids);
  }, [tree]);

  if (tree.length === 0) return null;

  const header = (
    <div className="flex items-center justify-between border-b border-text-primary/6 px-4 py-3">
      <h3 className="font-display text-sm text-text-primary">
        Region hierarchy
        <span className="ml-2 font-body text-2xs font-normal text-text-muted">
          {total} total
        </span>
      </h3>
      <div className="flex items-center gap-1">
        <button
          onClick={expandAll}
          className="focus-ring rounded px-2 py-1 text-2xs text-text-muted hover:text-text-secondary"
        >
          Expand all
        </button>
        <button
          onClick={collapseAll}
          className="focus-ring rounded px-2 py-1 text-2xs text-text-muted hover:text-text-secondary"
        >
          Collapse all
        </button>
      </div>
    </div>
  );

  const rows = (
    <div className={bare ? "p-2" : "max-h-[50vh] overflow-y-auto p-2"}>
      {tree.map((node) => (
        <TreeRow
          key={node.plan.id}
          node={node}
          selectedId={selectedId}
          collapsed={collapsed}
          onToggle={toggle}
          onSelect={onSelect}
          onNavigateScope={onNavigateScope}
        />
      ))}
    </div>
  );

  if (bare) {
    return (
      <>
        {header}
        {rows}
      </>
    );
  }

  return (
    <div className="rounded-2xl border border-text-primary/8 bg-bg-abyss/15">
      {header}
      {rows}
    </div>
  );
});

function TreeRow({
  node,
  selectedId,
  collapsed,
  onToggle,
  onSelect,
  onNavigateScope,
}: {
  node: TreeNode;
  selectedId: string | null;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onNavigateScope: (id: string) => void;
}) {
  const { plan, children, depth, totalDescendants } = node;
  const isCollapsed = collapsed.has(plan.id);
  const isSelected = plan.id === selectedId;
  const hasChildren = children.length > 0;
  const indent = depth * 20;

  return (
    <>
      <div
        className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors ${
          isSelected
            ? "bg-accent/12 text-text-primary"
            : "text-text-secondary hover:bg-text-primary/5"
        }`}
        style={{ paddingLeft: `${indent + 8}px` }}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            onClick={() => onToggle(plan.id)}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-text-muted hover:bg-text-primary/8 hover:text-text-primary"
            aria-label={isCollapsed ? "Expand" : "Collapse"}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="currentColor"
              className={`transition-transform ${isCollapsed ? "" : "rotate-90"}`}
            >
              <path d="M3 1l5 4-5 4V1z" />
            </svg>
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {/* Name — click to select */}
        <button
          onClick={() => onSelect(plan.id)}
          className="focus-ring min-w-0 flex-1 truncate rounded text-left text-xs"
          title={plan.blurb || plan.name}
        >
          <span className={isSelected ? "font-medium" : ""}>{plan.name}</span>
        </button>

        {/* Child count badge */}
        {totalDescendants > 0 && (
          <span className="shrink-0 rounded-full bg-text-primary/8 px-1.5 py-0.5 text-[9px] tabular-nums text-text-muted">
            {totalDescendants}
          </span>
        )}

        {/* Scope button — visible on hover for plans with a region */}
        {plan.region && (
          <button
            onClick={() => onNavigateScope(plan.id)}
            className="focus-ring shrink-0 rounded px-1.5 py-0.5 text-[9px] text-text-muted opacity-0 transition-opacity hover:bg-accent/15 hover:text-accent group-hover:opacity-100"
            title="Navigate into this region"
          >
            Scope ›
          </button>
        )}
      </div>

      {/* Children */}
      {hasChildren && !isCollapsed &&
        children.map((child) => (
          <TreeRow
            key={child.plan.id}
            node={child}
            selectedId={selectedId}
            collapsed={collapsed}
            onToggle={onToggle}
            onSelect={onSelect}
            onNavigateScope={onNavigateScope}
          />
        ))}
    </>
  );
}
