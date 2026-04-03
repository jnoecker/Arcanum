import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { Tree, type NodeRendererProps, type TreeApi } from "react-arborist";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import { useProjectStore } from "@/stores/projectStore";
import { panelTab } from "@/lib/panelRegistry";
import type { Article, ArticleTemplate } from "@/types/lore";
import { TEMPLATE_SCHEMAS } from "@/lib/loreTemplates";
import { searchArticles } from "@/lib/loreSearch";

const TEMPLATE_DOT_COLORS: Record<ArticleTemplate, string> = {
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

// Tree data shape

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

// Node renderer

function Node({ node, style, dragHandle }: NodeRendererProps<TreeNode>) {
  const selectedArticleId = useLoreStore((s) => s.selectedArticleId);
  const selectArticle = useLoreStore((s) => s.selectArticle);
  const selectedArticleIds = useLoreStore((s) => s.selectedArticleIds);
  const toggleArticleSelection = useLoreStore((s) => s.toggleArticleSelection);
  const openTab = useProjectStore((s) => s.openTab);
  const isSelected = selectedArticleId === node.data.id;
  const isMultiSelected = selectedArticleIds.has(node.data.id);
  const multiSelectActive = selectedArticleIds.size > 0;
  const dotColor = TEMPLATE_DOT_COLORS[node.data.template];

  const handleSelect = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      toggleArticleSelection(node.data.id);
      return;
    }
    selectArticle(node.data.id);
    openTab(panelTab("lore"));
  };

  const handleCheckbox = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleArticleSelection(node.data.id);
  };

  return (
    <div
      ref={dragHandle}
      style={style}
      role="treeitem"
      aria-selected={isSelected || isMultiSelected}
      aria-expanded={node.children && node.children.length > 0 ? node.isOpen : undefined}
      tabIndex={0}
      className={`flex cursor-pointer items-center gap-1.5 rounded px-2 py-1.5 text-xs transition-colors focus-visible:ring-1 focus-visible:ring-accent/50 ${
        isMultiSelected
          ? "bg-accent/10 text-text-primary ring-1 ring-accent/25"
          : isSelected
            ? "bg-accent/15 text-text-primary"
            : "text-text-secondary hover:bg-bg-tertiary"
      }`}
      onClick={handleSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            toggleArticleSelection(node.data.id);
          } else {
            selectArticle(node.data.id);
            openTab(panelTab("lore"));
          }
        }
      }}
    >
      {multiSelectActive && (
        <span
          onClick={handleCheckbox}
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] transition ${
            isMultiSelected
              ? "border-accent/50 bg-accent/20 text-accent"
              : "border-white/20 bg-white/5 text-transparent hover:border-white/30"
          }`}
          aria-label={isMultiSelected ? "Deselect" : "Select"}
        >
          {isMultiSelected ? "\u2713" : ""}
        </span>
      )}
      {node.children && node.children.length > 0 ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            node.toggle();
          }}
          aria-label={node.isOpen ? "Collapse" : "Expand"}
          aria-expanded={node.isOpen}
          className="flex h-5 w-5 items-center justify-center rounded text-text-muted hover:bg-bg-tertiary"
        >
          <span className="text-2xs">{node.isOpen ? "\u25BE" : "\u25B8"}</span>
        </button>
      ) : (
        <span className="w-5" />
      )}
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ background: dotColor }}
      />
      <span className={`min-w-0 truncate ${node.data.draft ? "italic opacity-60" : ""}`}>{node.data.name}</span>
      {node.data.draft && <span className="shrink-0 text-[9px] text-text-muted uppercase">draft</span>}
    </div>
  );
}

// Main component

export function ArticleTree() {
  const articles = useLoreStore(selectArticles);
  const createArticle = useLoreStore((s) => s.createArticle);
  const moveArticle = useLoreStore((s) => s.moveArticle);
  const selectArticle = useLoreStore((s) => s.selectArticle);

  const [search, setSearch] = useState("");
  const [searchContent, setSearchContent] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newTemplate, setNewTemplate] = useState<ArticleTemplate>("freeform");
  const treeRef = useRef<TreeApi<TreeNode>>(null);
  const openTab = useProjectStore((s) => s.openTab);

  // Debounce content search queries
  useEffect(() => {
    if (!searchContent) return;
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search, searchContent]);

  const contentResults = useMemo(
    () =>
      searchContent && debouncedSearch.trim().length >= 3
        ? searchArticles(articles, debouncedSearch)
        : [],
    [articles, debouncedSearch, searchContent],
  );

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
      <div className="mb-2 flex items-center gap-1.5">
        <input
          aria-label="Search articles"
          className="ornate-input min-w-0 flex-1 rounded px-2 py-1.5 text-xs text-text-primary"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchContent ? "Search all content..." : "Search legends..."}
        />
        <button
          onClick={() => setSearchContent((v) => !v)}
          title={searchContent ? "Searching content" : "Searching titles only"}
          className={`shrink-0 rounded px-1.5 py-1 text-[10px] transition ${
            searchContent
              ? "bg-accent/15 text-accent"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          {searchContent ? "Content" : "Titles"}
        </button>
      </div>

      {/* Tree / Content search results */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {searchContent && search.trim().length >= 3 ? (
          <div className="flex flex-col gap-1">
            {contentResults.map((r) => (
              <button
                key={r.articleId}
                onClick={() => {
                  selectArticle(r.articleId);
                  openTab(panelTab("lore"));
                }}
                className="rounded-lg border border-white/6 bg-black/10 px-3 py-2 text-left transition hover:bg-white/6"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background:
                        TEMPLATE_DOT_COLORS[
                          articles[r.articleId]?.template ?? "freeform"
                        ],
                    }}
                  />
                  <span className="truncate text-xs text-text-primary">
                    {r.title}
                  </span>
                  <span className="ml-auto shrink-0 rounded bg-white/8 px-1.5 py-0.5 text-[9px] text-text-muted">
                    {r.matchIn}
                  </span>
                </div>
                <p className="mt-1 truncate text-[11px] leading-4 text-text-muted">
                  {r.snippet}
                </p>
              </button>
            ))}
            {contentResults.length === 0 && (
              <p className="px-2 py-3 text-xs text-text-muted">
                No content matches found.
              </p>
            )}
          </div>
        ) : searchContent && search.trim().length > 0 && search.trim().length < 3 ? (
          <p className="px-2 py-3 text-xs text-text-muted">
            Type at least 3 characters to search content.
          </p>
        ) : (
          <>
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
                {search
                  ? "No matching articles found."
                  : "The first legend remains unwritten."}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add new article */}
      <div className="mt-2 flex flex-col gap-1.5 border-t border-border-muted pt-2">
        <div className="flex gap-1.5">
          <input
            aria-label="New article title"
            className="ornate-input min-w-0 flex-1 rounded px-2 py-1.5 text-xs text-text-primary"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="New article title"
          />
          <button
            onClick={handleAdd}
            disabled={!newTitle.trim()}
            aria-label="Add article"
            className="focus-ring shell-pill rounded-full px-3 py-1.5 text-xs text-text-secondary disabled:opacity-40"
          >
            +
          </button>
        </div>
        <select
          aria-label="Article template type"
          className="ornate-input rounded px-2 py-1.5 text-xs text-text-secondary"
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
