import { useMemo, useState, useCallback, useRef } from "react";
import { Tree, type NodeRendererProps, type TreeApi } from "react-arborist";
import { useLoreStore } from "@/stores/loreStore";
import type { Article, ArticleTemplate } from "@/types/lore";
import { TEMPLATE_SCHEMAS } from "@/lib/loreTemplates";

// ─── Template icon labels ───────────────────────────────────────────

const TEMPLATE_ICONS: Record<ArticleTemplate, string> = {
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

const TEMPLATE_COLORS: Record<ArticleTemplate, string> = {
  world_setting: "text-accent",
  character: "text-violet",
  location: "text-stellar-blue",
  organization: "text-[#bea873]",
  item: "text-arcane-teal",
  species: "text-[#c4956a]",
  event: "text-status-warning",
  language: "text-text-muted",
  freeform: "text-text-muted",
};

// ─── Tree data shape ────────────────────────────────────────────────

interface TreeNode {
  id: string;
  name: string;
  template: ArticleTemplate;
  children?: TreeNode[];
}

function buildTree(articles: Record<string, Article>): TreeNode[] {
  const childMap = new Map<string | undefined, Article[]>();
  for (const a of Object.values(articles)) {
    const parent = a.parentId ?? undefined;
    const list = childMap.get(parent) ?? [];
    list.push(a);
    childMap.set(parent, list);
  }

  function buildChildren(parentId: string | undefined): TreeNode[] {
    const children = childMap.get(parentId) ?? [];
    children.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return children.map((a) => ({
      id: a.id,
      name: a.title || "(untitled)",
      template: a.template,
      children: buildChildren(a.id),
    }));
  }

  return buildChildren(undefined);
}

// ─── Node renderer ──────────────────────────────────────────────────

function Node({ node, style, dragHandle }: NodeRendererProps<TreeNode>) {
  const selectedArticleId = useLoreStore((s) => s.selectedArticleId);
  const selectArticle = useLoreStore((s) => s.selectArticle);
  const isSelected = selectedArticleId === node.data.id;
  const icon = TEMPLATE_ICONS[node.data.template];
  const colorClass = TEMPLATE_COLORS[node.data.template];

  return (
    <div
      ref={dragHandle}
      style={style}
      className={`flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors ${
        isSelected
          ? "bg-accent/15 text-text-primary"
          : "text-text-secondary hover:bg-bg-tertiary"
      }`}
      onClick={() => selectArticle(node.data.id)}
    >
      {node.children && node.children.length > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            node.toggle();
          }}
          className="w-3 text-center text-text-muted"
        >
          {node.isOpen ? "v" : ">"}
        </button>
      )}
      {(!node.children || node.children.length === 0) && (
        <span className="w-3" />
      )}
      <span className={`w-5 text-center text-2xs font-bold ${colorClass}`}>
        {icon}
      </span>
      <span className="min-w-0 truncate">{node.data.name}</span>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────

export function ArticleTree() {
  const articles = useLoreStore((s) => s.lore?.articles ?? {});
  const createArticle = useLoreStore((s) => s.createArticle);
  const moveArticle = useLoreStore((s) => s.moveArticle);
  const selectArticle = useLoreStore((s) => s.selectArticle);

  const [search, setSearch] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newTemplate, setNewTemplate] = useState<ArticleTemplate>("freeform");
  const treeRef = useRef<TreeApi<TreeNode>>(null);

  const treeData = useMemo(() => buildTree(articles), [articles]);

  const filteredData = useMemo(() => {
    if (!search.trim()) return treeData;
    const q = search.toLowerCase();

    function filterNodes(nodes: TreeNode[]): TreeNode[] {
      const result: TreeNode[] = [];
      for (const node of nodes) {
        const childMatches = filterNodes(node.children ?? []);
        if (
          node.name.toLowerCase().includes(q) ||
          node.template.includes(q) ||
          childMatches.length > 0
        ) {
          result.push({
            ...node,
            children: childMatches.length > 0 ? childMatches : node.children,
          });
        }
      }
      return result;
    }

    return filterNodes(treeData);
  }, [treeData, search]);

  const handleAdd = useCallback(() => {
    const title = newTitle.trim();
    if (!title) return;
    const id = title.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (!id || articles[id]) return;

    const now = new Date().toISOString();
    createArticle({
      id,
      template: newTemplate,
      title,
      fields: {},
      content: "",
      createdAt: now,
      updatedAt: now,
    });
    selectArticle(id);
    setNewTitle("");
  }, [newTitle, newTemplate, articles, createArticle, selectArticle]);

  const handleMove = useCallback(
    ({ dragIds, parentId, index }: { dragIds: string[]; parentId: string | null; index: number }) => {
      for (const id of dragIds) {
        moveArticle(id, parentId ?? undefined, index);
      }
    },
    [moveArticle],
  );

  const templateOptions = Object.entries(TEMPLATE_SCHEMAS)
    .filter(([key]) => key !== "world_setting")
    .map(([key, s]) => ({ value: key, label: s.label }));

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <input
        className="mb-2 w-full rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent/50"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search articles..."
      />

      {/* Tree */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Tree<TreeNode>
          ref={treeRef}
          data={filteredData}
          onMove={handleMove}
          openByDefault={true}
          width="100%"
          indent={16}
          rowHeight={28}
          overscanCount={10}
          disableDrag={!!search.trim()}
          disableDrop={!!search.trim()}
        >
          {Node}
        </Tree>
        {filteredData.length === 0 && (
          <div className="px-2 py-4 text-xs text-text-muted">
            {search ? "No matching articles" : "No articles yet. Create one below."}
          </div>
        )}
      </div>

      {/* Add new article */}
      <div className="mt-2 flex flex-col gap-1.5 border-t border-border-muted pt-2">
        <div className="flex gap-1.5">
          <input
            className="min-w-0 flex-1 rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent/50"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="New article title"
          />
          <button
            onClick={handleAdd}
            disabled={!newTitle.trim()}
            className="rounded border border-border-default px-2 py-1 text-xs text-text-secondary hover:bg-bg-tertiary disabled:opacity-40"
          >
            +
          </button>
        </div>
        <select
          className="rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-secondary outline-none focus:border-accent/50"
          value={newTemplate}
          onChange={(e) => setNewTemplate(e.target.value as ArticleTemplate)}
        >
          {templateOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
