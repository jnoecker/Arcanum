import type { Article } from "@/types/lore";

export interface SearchResult {
  articleId: string;
  title: string;
  template: string;
  /** The matching snippet with highlighted term context (±50 chars) */
  snippet: string;
  /** Where the match was found */
  matchIn: "title" | "content" | "fields" | "tags" | "notes";
}

/** Extract searchable plain text from an article */
export function buildSearchText(article: Article): string {
  const parts: string[] = [article.title];

  // Tags
  if (article.tags) parts.push(...article.tags);

  // Field values
  for (const [, value] of Object.entries(article.fields)) {
    if (typeof value === "string") parts.push(value);
    else if (Array.isArray(value))
      parts.push(value.filter((v) => typeof v === "string").join(" "));
  }

  // TipTap content -> plain text
  if (article.content) {
    parts.push(tiptapToPlainText(article.content));
  }

  // Private notes
  if (article.privateNotes) {
    parts.push(tiptapToPlainText(article.privateNotes));
  }

  return parts.join("\n").toLowerCase();
}

function tiptapToPlainText(content: string): string {
  if (!content) return "";
  if (!content.startsWith("{")) return content;
  try {
    const doc = JSON.parse(content);
    return extractText(doc);
  } catch {
    return content;
  }
}

function extractText(node: Record<string, unknown>): string {
  if (node.type === "text") return String(node.text ?? "");
  if (node.type === "mention") {
    const attrs = node.attrs as Record<string, unknown> | undefined;
    return String(attrs?.label ?? attrs?.id ?? "");
  }
  const children = node.content as Record<string, unknown>[] | undefined;
  if (!children) return "";
  return children.map(extractText).join(" ");
}

/** Search articles by query string, returning results with snippets */
export function searchArticles(
  articles: Record<string, Article>,
  query: string,
): SearchResult[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results: SearchResult[] = [];

  for (const article of Object.values(articles)) {
    // Check title
    if (article.title.toLowerCase().includes(q)) {
      results.push({
        articleId: article.id,
        title: article.title,
        template: article.template,
        snippet: article.title,
        matchIn: "title",
      });
      continue; // Title match is sufficient
    }

    // Check tags
    if (article.tags?.some((t) => t.toLowerCase().includes(q))) {
      const tag = article.tags.find((t) => t.toLowerCase().includes(q))!;
      results.push({
        articleId: article.id,
        title: article.title,
        template: article.template,
        snippet: `Tag: ${tag}`,
        matchIn: "tags",
      });
      continue;
    }

    // Check field values
    let fieldMatch: string | null = null;
    for (const [key, value] of Object.entries(article.fields)) {
      const text =
        typeof value === "string"
          ? value
          : Array.isArray(value)
            ? value.join(", ")
            : "";
      if (text.toLowerCase().includes(q)) {
        fieldMatch = `${key}: ${text.slice(0, 100)}`;
        break;
      }
    }
    if (fieldMatch) {
      results.push({
        articleId: article.id,
        title: article.title,
        template: article.template,
        snippet: fieldMatch,
        matchIn: "fields",
      });
      continue;
    }

    // Check content body
    const plainContent = tiptapToPlainText(article.content);
    const contentLower = plainContent.toLowerCase();
    const idx = contentLower.indexOf(q);
    if (idx !== -1) {
      const start = Math.max(0, idx - 50);
      const end = Math.min(plainContent.length, idx + q.length + 50);
      const snippet =
        (start > 0 ? "..." : "") +
        plainContent.slice(start, end) +
        (end < plainContent.length ? "..." : "");
      results.push({
        articleId: article.id,
        title: article.title,
        template: article.template,
        snippet,
        matchIn: "content",
      });
      continue;
    }

    // Check private notes
    if (article.privateNotes) {
      const notesPlain = tiptapToPlainText(article.privateNotes);
      const notesIdx = notesPlain.toLowerCase().indexOf(q);
      if (notesIdx !== -1) {
        const start = Math.max(0, notesIdx - 50);
        const end = Math.min(notesPlain.length, notesIdx + q.length + 50);
        const snippet =
          (start > 0 ? "..." : "") +
          notesPlain.slice(start, end) +
          (end < notesPlain.length ? "..." : "");
        results.push({
          articleId: article.id,
          title: article.title,
          template: article.template,
          snippet,
          matchIn: "notes",
        });
      }
    }
  }

  // Sort: title matches first, then by title alpha
  results.sort((a, b) => {
    if (a.matchIn === "title" && b.matchIn !== "title") return -1;
    if (a.matchIn !== "title" && b.matchIn === "title") return 1;
    return a.title.localeCompare(b.title);
  });

  return results;
}
