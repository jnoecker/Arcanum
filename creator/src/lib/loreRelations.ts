import type { ArticleRelation } from "@/types/lore";

/**
 * Extract @mention relations from Tiptap JSON content.
 * Scans for nodes of type "mention" with attrs.id and produces
 * ArticleRelation entries with type "mentioned".
 */
export function extractMentions(content: string): ArticleRelation[] {
  if (!content) return [];

  // If content is plain text (not JSON), no mentions to extract
  if (!content.startsWith("{")) return [];

  try {
    const doc = JSON.parse(content);
    const mentions: ArticleRelation[] = [];
    const seen = new Set<string>();

    function walk(node: unknown) {
      if (!node || typeof node !== "object") return;
      const n = node as Record<string, unknown>;

      if (n.type === "mention" && n.attrs) {
        const attrs = n.attrs as Record<string, unknown>;
        const id = typeof attrs.id === "string" ? attrs.id : null;
        if (id && !seen.has(id)) {
          seen.add(id);
          mentions.push({ targetId: id, type: "mentioned" });
        }
      }

      if (Array.isArray(n.content)) {
        for (const child of n.content) walk(child);
      }
    }

    walk(doc);
    return mentions;
  } catch {
    return [];
  }
}

/**
 * Convert Tiptap JSON content to plain text (for LLM prompts).
 * Strips formatting, renders mentions as their labels.
 */
export function tiptapToPlainText(content: string): string {
  if (!content) return "";
  if (!content.startsWith("{")) return content;

  try {
    const doc = JSON.parse(content);
    const parts: string[] = [];

    function walk(node: unknown) {
      if (!node || typeof node !== "object") return;
      const n = node as Record<string, unknown>;

      if (n.type === "text" && typeof n.text === "string") {
        parts.push(n.text);
        return;
      }

      if (n.type === "mention" && n.attrs) {
        const label = (n.attrs as Record<string, unknown>).label;
        parts.push(typeof label === "string" ? label : "");
        return;
      }

      if (n.type === "paragraph" || n.type === "heading") {
        if (parts.length > 0 && !parts[parts.length - 1]!.endsWith("\n")) {
          parts.push("\n");
        }
      }

      if (n.type === "bulletList" || n.type === "orderedList") {
        if (parts.length > 0 && !parts[parts.length - 1]!.endsWith("\n")) {
          parts.push("\n");
        }
      }

      if (n.type === "listItem") {
        parts.push("- ");
      }

      if (Array.isArray(n.content)) {
        for (const child of n.content) walk(child);
      }

      if (n.type === "paragraph" || n.type === "heading" || n.type === "listItem") {
        parts.push("\n");
      }
    }

    walk(doc);
    return parts.join("").trim();
  } catch {
    return content;
  }
}

/**
 * Wrap plain text in a minimal Tiptap document JSON structure.
 */
export function plainTextToTiptap(text: string): string {
  if (!text) return "";
  // If already JSON, return as-is
  if (text.startsWith("{")) return text;

  const paragraphs = text.split(/\n\n+/);
  const content = paragraphs.map((p) => ({
    type: "paragraph",
    content: p.trim() ? [{ type: "text", text: p.trim() }] : undefined,
  }));

  return JSON.stringify({ type: "doc", content });
}
