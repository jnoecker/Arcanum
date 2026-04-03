import type { Article } from "@/types/lore";

export interface MentionSuggestion {
  /** Article containing the plain-text reference */
  sourceId: string;
  /** Article being referenced */
  targetId: string;
  targetTitle: string;
  /** The matched text in the source */
  matchText: string;
  /** Surrounding context (~40 chars each side) */
  context: string;
  /** Match quality: "exact" title match or "partial" */
  quality: "exact" | "partial";
}

/**
 * Scan all articles for plain-text references to other article titles
 * that aren't already formal @mentions.
 */
export function scanForMissingSuggestions(
  articles: Record<string, Article>,
): MentionSuggestion[] {
  const suggestions: MentionSuggestion[] = [];
  const articleList = Object.values(articles);

  // Build title lookup, filter out very short titles (< 4 chars) to reduce false positives
  const targets = articleList.filter((a) => a.title.length >= 4);

  for (const source of articleList) {
    // Extract plain text from TipTap content
    const plainText = tiptapToSearchText(source.content);
    if (!plainText) continue;

    // Get existing @mention target IDs to exclude
    const existingMentions = extractExistingMentionIds(source.content);

    for (const target of targets) {
      // Don't suggest self-references
      if (target.id === source.id) continue;
      // Skip if already mentioned
      if (existingMentions.has(target.id)) continue;

      // Case-insensitive word-boundary search
      const regex = new RegExp(`\\b${escapeRegex(target.title)}\\b`, "gi");
      let match: RegExpExecArray | null;
      while ((match = regex.exec(plainText)) !== null) {
        const start = Math.max(0, match.index - 40);
        const end = Math.min(
          plainText.length,
          match.index + match[0].length + 40,
        );
        const context =
          (start > 0 ? "..." : "") +
          plainText.slice(start, end) +
          (end < plainText.length ? "..." : "");

        suggestions.push({
          sourceId: source.id,
          targetId: target.id,
          targetTitle: target.title,
          matchText: match[0],
          context,
          quality:
            match[0].toLowerCase() === target.title.toLowerCase()
              ? "exact"
              : "partial",
        });
        break; // One suggestion per source-target pair
      }
    }
  }

  // Sort: exact matches first, then by source article
  suggestions.sort((a, b) => {
    if (a.quality !== b.quality) return a.quality === "exact" ? -1 : 1;
    return a.sourceId.localeCompare(b.sourceId);
  });

  return suggestions;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Extract plain text from TipTap JSON content for searching */
function tiptapToSearchText(content: string): string {
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
  // Skip mention nodes (they're already linked)
  if (node.type === "mention") return "";
  const children = node.content as Record<string, unknown>[] | undefined;
  if (!children) return "";
  return children.map(extractText).join(" ");
}

/** Extract IDs of existing @mention nodes in TipTap content */
function extractExistingMentionIds(content: string): Set<string> {
  const ids = new Set<string>();
  if (!content || !content.startsWith("{")) return ids;
  try {
    const doc = JSON.parse(content);
    collectMentionIds(doc, ids);
  } catch {
    /* ignore */
  }
  return ids;
}

function collectMentionIds(
  node: Record<string, unknown>,
  ids: Set<string>,
): void {
  if (node.type === "mention") {
    const attrs = node.attrs as Record<string, unknown> | undefined;
    if (attrs?.id) ids.add(String(attrs.id));
  }
  const children = node.content as Record<string, unknown>[] | undefined;
  if (children) {
    for (const child of children) collectMentionIds(child, ids);
  }
}
