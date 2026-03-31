import type { WorldLore, Article, ArticleRelation } from "@/types/lore";
import { extractMentions } from "@/lib/loreRelations";

// ─── Showcase data types ───────────────────────────────────────────

export interface ShowcaseData {
  meta: {
    worldName: string;
    tagline?: string;
    exportedAt: string;
    imageBaseUrl: string;
  };
  articles: ShowcaseArticle[];
  maps: ShowcaseMap[];
  calendarSystems: WorldLore["calendarSystems"];
  timelineEvents: WorldLore["timelineEvents"];
  colorLabels: WorldLore["colorLabels"];
}

export interface ShowcaseArticle {
  id: string;
  template: Article["template"];
  title: string;
  fields: Record<string, unknown>;
  contentHtml: string;
  tags: string[];
  relations: ArticleRelation[];
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShowcaseMap {
  id: string;
  title: string;
  imageUrl: string;
  width: number;
  height: number;
  pins: {
    id: string;
    articleId?: string;
    position: [number, number];
    label?: string;
    color?: string;
  }[];
}

// ─── TipTap JSON → HTML converter ─────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

function wrapMarks(html: string, marks?: TipTapMark[]): string {
  if (!marks || marks.length === 0) return html;
  let result = html;
  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        result = `<strong>${result}</strong>`;
        break;
      case "italic":
        result = `<em>${result}</em>`;
        break;
      case "code":
        result = `<code>${result}</code>`;
        break;
      case "link": {
        const href = escapeHtml(String(mark.attrs?.href ?? ""));
        const target = href.startsWith("http") ? ' target="_blank" rel="noopener noreferrer"' : "";
        result = `<a href="${href}"${target}>${result}</a>`;
        break;
      }
    }
  }
  return result;
}

function nodeToHtml(node: Record<string, unknown>): string {
  const type = node.type as string;
  const attrs = node.attrs as Record<string, unknown> | undefined;
  const content = node.content as Record<string, unknown>[] | undefined;
  const childrenHtml = content ? content.map(nodeToHtml).join("") : "";

  switch (type) {
    case "doc":
      return childrenHtml;

    case "paragraph":
      return `<p>${childrenHtml}</p>`;

    case "heading": {
      const level = Math.min(Math.max(Number(attrs?.level ?? 2), 1), 6);
      return `<h${level}>${childrenHtml}</h${level}>`;
    }

    case "text": {
      const text = escapeHtml(String(node.text ?? ""));
      return wrapMarks(text, node.marks as TipTapMark[] | undefined);
    }

    case "mention": {
      const id = String(attrs?.id ?? "");
      const label = escapeHtml(String(attrs?.label ?? id));
      return `<a href="/articles/${encodeURIComponent(id)}" class="mention">${label}</a>`;
    }

    case "bulletList":
      return `<ul>${childrenHtml}</ul>`;

    case "orderedList":
      return `<ol>${childrenHtml}</ol>`;

    case "listItem":
      return `<li>${childrenHtml}</li>`;

    case "blockquote":
      return `<blockquote>${childrenHtml}</blockquote>`;

    case "horizontalRule":
      return "<hr />";

    case "hardBreak":
      return "<br />";

    default:
      return childrenHtml;
  }
}

export function tiptapToHtml(content: string): string {
  if (!content) return "";
  if (!content.startsWith("{")) {
    // Plain text fallback — wrap in paragraphs
    return content
      .split(/\n\n+/)
      .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
      .join("");
  }
  try {
    const doc = JSON.parse(content);
    return nodeToHtml(doc);
  } catch {
    return `<p>${escapeHtml(content)}</p>`;
  }
}

// ─── Export pipeline ───────────────────────────────────────────────

export function exportShowcaseData(lore: WorldLore, imageBaseUrl: string): ShowcaseData {
  const baseUrl = imageBaseUrl.replace(/\/+$/, "");

  function resolveImage(filename: string | undefined): string | undefined {
    if (!filename) return undefined;
    if (filename.startsWith("http")) return filename;
    return `${baseUrl}/${filename}`;
  }

  // Extract world metadata from world_setting article
  const ws = Object.values(lore.articles).find((a) => a.template === "world_setting");
  const worldName = (ws?.fields?.name as string) ?? ws?.title ?? "Untitled World";
  const tagline = (ws?.fields?.tagline as string) ?? undefined;

  // Convert articles
  const articles: ShowcaseArticle[] = Object.values(lore.articles).map((a) => {
    // Merge explicit relations + extracted mentions
    const explicit = a.relations ?? [];
    const mentions = extractMentions(a.content);
    const seenTargets = new Set(explicit.map((r) => `${r.targetId}:${r.type}`));
    const merged = [...explicit];
    for (const m of mentions) {
      const key = `${m.targetId}:${m.type}`;
      if (!seenTargets.has(key)) {
        seenTargets.add(key);
        merged.push(m);
      }
    }

    return {
      id: a.id,
      template: a.template,
      title: a.title,
      fields: a.fields,
      contentHtml: tiptapToHtml(a.content),
      tags: a.tags ?? [],
      relations: merged,
      imageUrl: resolveImage(a.image),
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  });

  // Convert maps
  const maps: ShowcaseMap[] = (lore.maps ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    imageUrl: resolveImage(m.imageAsset) ?? "",
    width: m.width,
    height: m.height,
    pins: m.pins.map((p) => ({
      id: p.id,
      articleId: p.articleId,
      position: p.position,
      label: p.label,
      color: p.color,
    })),
  }));

  return {
    meta: {
      worldName,
      tagline,
      exportedAt: new Date().toISOString(),
      imageBaseUrl: baseUrl,
    },
    articles,
    maps,
    calendarSystems: lore.calendarSystems,
    timelineEvents: lore.timelineEvents,
    colorLabels: lore.colorLabels,
  };
}
