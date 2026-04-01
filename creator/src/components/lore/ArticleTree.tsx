import { useMemo, useState, useCallback, useRef } from "react";
import { Tree, type NodeRendererProps, type TreeApi } from "react-arborist";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
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
  profession: "P",
  ability: "Ab",
  freeform: "F",
};

const TEMPLATE_COLORS: Record<ArticleTemplate, string> = {
  world_setting: "text-accent",
  character: "text-violet",
  location: "text-stellar-blue",
  organization: "text-class-bulwark",
  item: "text-arcane-teal",
  species: "text-class-warden",
  event: "text-status-warning",
  language: "text-text-muted",
  profession: "text-class-herald",
  ability: "text-class-starweaver",
  freeform: "text-text-muted",
};

// ─── Tree data shape ────────────────────────────────────────────────

interface TreeNode {
  id: string;
  name: string;
  template: ArticleTemplate;
  draft?: boolean;
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
      draft: a.draft,
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
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={node.children && node.children.length > 0 ? node.isOpen : undefined}
      tabIndex={0}
      className={`flex cursor-pointer items-center gap-1.5 rounded px-2 py-1.5 text-xs transition-colors focus-visible:ring-1 focus-visible:ring-accent/50 ${
        isSelected
          ? "bg-accent/15 text-text-primary"
          : "text-text-secondary hover:bg-bg-tertiary"
      }`}
      onClick={() => selectArticle(node.data.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectArticle(node.data.id);
        }
      }}
    >
      {node.children && node.children.length > 0 ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            node.toggle();
          }}
          aria-label={node.isOpen ? "Collapse" : "Expand"}
          className="flex h-5 w-5 items-center justify-center rounded text-text-muted hover:bg-bg-tertiary"
        >
          <span className="text-2xs">{node.isOpen ? "\u25BE" : "\u25B8"}</span>
        </button>
      ) : (
        <span className="w-5" />
      )}
      <span className={`w-5 text-center text-2xs font-bold ${colorClass}`}>
        {icon}
      </span>
      <span className={`min-w-0 truncate ${node.data.draft ? "italic opacity-60" : ""}`}>{node.data.name}</span>
      {node.data.draft && <span className="shrink-0 text-[9px] text-text-muted uppercase">draft</span>}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────

export function ArticleTree() {
  const articles = useLoreStore(selectArticles);
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
        aria-label="Search articles"
        className="mb-2 w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50"
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
          rowHeight={32}
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
            aria-label="New article title"
            className="min-w-0 flex-1 rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="New article title"
          />
          <button
            onClick={handleAdd}
            disabled={!newTitle.trim()}
            aria-label="Add article"
            className="rounded border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary disabled:opacity-40"
          >
            +
          </button>
        </div>
        <select
          aria-label="Article template type"
          className="rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-secondary outline-none focus:border-accent/50"
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
