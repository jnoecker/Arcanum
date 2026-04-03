import type { ArticleTemplate } from "@/types/lore";

// ─── Types ──────────────────────────────────────────────────────────

export interface ImportCandidate {
  /** Relative file path within the selected folder */
  filePath: string;
  /** Parsed title (from front-matter or filename) */
  title: string;
  /** Auto-detected template */
  template: ArticleTemplate;
  /** Front-matter fields mapped to article fields */
  fields: Record<string, unknown>;
  /** Markdown body (raw, pre-conversion) */
  markdownBody: string;
  /** TipTap JSON content (converted from markdown) */
  tiptapContent: string;
  /** Tags from front-matter */
  tags: string[];
  /** Whether to import (user can toggle) */
  selected: boolean;
}

// ─── Public API ─────────────────────────────────────────────────────

/** Parse a markdown file with optional YAML front-matter. */
export function parseMarkdownFile(
  filename: string,
  content: string,
): ImportCandidate {
  let fields: Record<string, unknown> = {};
  let body = content;
  let tags: string[] = [];
  let title = filename.replace(/\.md$/i, "").replace(/.*[/\\]/, "");

  // Parse YAML front-matter delimited by --- ... ---
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (fmMatch) {
    const fmText = fmMatch[1] ?? "";
    body = fmMatch[2] ?? "";

    let currentListKey: string | undefined;
    const listValues: Record<string, string[]> = {};

    for (const line of fmText.split(/\r?\n/)) {
      // Key: value pair
      const kv = line.match(/^(\w[\w-]*)\s*:\s*(.+)$/);
      if (kv) {
        currentListKey = undefined;
        const key = kv[1]!;
        const value = kv[2]!;
        const trimmed = value.trim().replace(/^["']|["']$/g, "");
        if (key === "title") {
          title = trimmed;
        } else if (key === "tags" || key === "aliases") {
          // Inline array: tags: [a, b, c]
          if (trimmed.startsWith("[")) {
            const parsed = trimmed
              .replace(/^\[|\]$/g, "")
              .split(",")
              .map((t) => t.trim().replace(/^["']|["']$/g, ""))
              .filter(Boolean);
            if (key === "tags") tags = parsed;
            else fields[key.toLowerCase()] = parsed;
          } else {
            // Could be a single value or start of a YAML list
            currentListKey = key;
            listValues[key] = [trimmed].filter(Boolean);
          }
        } else {
          fields[key.toLowerCase()] = trimmed;
        }
        continue;
      }

      // Key with empty value (start of a YAML list)
      const emptyKey = line.match(/^(\w[\w-]*)\s*:\s*$/);
      if (emptyKey) {
        currentListKey = emptyKey[1]!;
        listValues[currentListKey] = [];
        continue;
      }

      // YAML list item
      const listItem = line.match(/^\s*-\s+(.+)$/);
      const listArr = currentListKey ? listValues[currentListKey] : undefined;
      if (listItem && listArr) {
        listArr.push(listItem[1]!.trim().replace(/^["']|["']$/g, ""));
      }
    }

    // Apply collected list values
    if (listValues.tags && listValues.tags.length > 0) {
      tags = listValues.tags;
    }
    for (const [key, values] of Object.entries(listValues)) {
      if (key !== "tags" && values.length > 0) {
        fields[key.toLowerCase()] = values;
      }
    }
  }

  const template = detectTemplate(fields, filename);
  const tiptapContent = markdownToTiptap(body);

  return {
    filePath: filename,
    title,
    template,
    fields,
    markdownBody: body,
    tiptapContent,
    tags,
    selected: true,
  };
}

// ─── Template detection ─────────────────────────────────────────────

function detectTemplate(
  fields: Record<string, unknown>,
  path: string,
): ArticleTemplate {
  const type = String(fields.type ?? fields.category ?? "").toLowerCase();
  const pathLower = path.toLowerCase();

  if (
    type.includes("character") ||
    type.includes("npc") ||
    type.includes("person") ||
    pathLower.includes("/characters/")
  )
    return "character";
  if (
    type.includes("location") ||
    type.includes("place") ||
    pathLower.includes("/locations/") ||
    pathLower.includes("/places/")
  )
    return "location";
  if (
    type.includes("organization") ||
    type.includes("faction") ||
    pathLower.includes("/factions/") ||
    pathLower.includes("/organizations/")
  )
    return "organization";
  if (
    type.includes("species") ||
    type.includes("race") ||
    type.includes("creature") ||
    pathLower.includes("/species/")
  )
    return "species";
  if (
    type.includes("item") ||
    type.includes("artifact") ||
    pathLower.includes("/items/")
  )
    return "item";
  if (
    type.includes("event") ||
    pathLower.includes("/events/") ||
    pathLower.includes("/history/")
  )
    return "event";
  if (type.includes("language") || pathLower.includes("/languages/"))
    return "language";
  if (
    type.includes("profession") ||
    type.includes("class") ||
    pathLower.includes("/classes/")
  )
    return "profession";
  if (
    type.includes("ability") ||
    type.includes("spell") ||
    pathLower.includes("/abilities/")
  )
    return "ability";

  return "freeform";
}

// ─── Markdown → TipTap JSON ────────────────────────────────────────

/** Convert markdown text to a TipTap-compatible JSON string. */
function markdownToTiptap(md: string): string {
  const nodes: Record<string, unknown>[] = [];
  const lines = md.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      nodes.push({
        type: "heading",
        attrs: { level: headingMatch[1]!.length },
        content: parseInline(headingMatch[2]!),
      });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      nodes.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    // Blockquote (collect consecutive > lines)
    if (line.startsWith("> ") || line === ">") {
      const quoteLines: string[] = [];
      while (
        i < lines.length &&
        (lines[i]!.startsWith("> ") || lines[i] === ">")
      ) {
        quoteLines.push(lines[i]!.replace(/^>\s?/, ""));
        i++;
      }
      nodes.push({
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: parseInline(quoteLines.join(" ")),
          },
        ],
      });
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s/.test(line)) {
      const listItems: Record<string, unknown>[] = [];
      while (i < lines.length && /^\s*[-*+]\s/.test(lines[i]!)) {
        const text = lines[i]!.replace(/^\s*[-*+]\s+/, "");
        listItems.push({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInline(text) }],
        });
        i++;
      }
      nodes.push({ type: "bulletList", content: listItems });
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s/.test(line)) {
      const listItems: Record<string, unknown>[] = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i]!)) {
        const text = lines[i]!.replace(/^\s*\d+\.\s+/, "");
        listItems.push({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInline(text) }],
        });
        i++;
      }
      nodes.push({ type: "orderedList", content: listItems });
      continue;
    }

    // Empty line — skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph — collect until a block boundary or empty line
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !lines[i]!.match(/^#{1,6}\s/) &&
      !lines[i]!.match(/^\s*[-*+]\s/) &&
      !lines[i]!.match(/^\s*\d+\.\s/) &&
      !lines[i]!.startsWith("> ") &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i]!.trim())
    ) {
      paraLines.push(lines[i]!);
      i++;
    }
    if (paraLines.length > 0) {
      nodes.push({
        type: "paragraph",
        content: parseInline(paraLines.join(" ")),
      });
    }
  }

  if (nodes.length === 0) {
    return "";
  }

  return JSON.stringify({ type: "doc", content: nodes });
}

// ─── Inline markdown parsing ────────────────────────────────────────

/**
 * Parse inline markdown (bold, italic, code, wiki-links) into
 * TipTap-compatible text/mark/mention nodes.
 */
function parseInline(text: string): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  // Matches: **bold**, *italic*, `code`, [[wiki-link]], [[target|display]]
  const regex =
    /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[\[([^|\]]+?)(?:\|([^\]]+?))?\]\])/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      nodes.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    if (match[2] != null) {
      // **bold**
      nodes.push({
        type: "text",
        text: match[2],
        marks: [{ type: "bold" }],
      });
    } else if (match[3] != null) {
      // *italic*
      nodes.push({
        type: "text",
        text: match[3],
        marks: [{ type: "italic" }],
      });
    } else if (match[4] != null) {
      // `code`
      nodes.push({
        type: "text",
        text: match[4],
        marks: [{ type: "code" }],
      });
    } else if (match[5] != null) {
      // [[wiki-link]] or [[target|display]]
      const targetTitle = match[5].trim();
      const displayName = (match[6] ?? match[5]).trim();
      const id = targetTitle
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");
      nodes.push({
        type: "mention",
        attrs: { id, label: displayName },
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    nodes.push({ type: "text", text: text.slice(lastIndex) });
  }

  return nodes.length > 0 ? nodes : [{ type: "text", text }];
}
