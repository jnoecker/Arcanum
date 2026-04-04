import type { WorldLore, ArticleTemplate } from "@/types/lore";

/** Section ordering for the lore bible */
const SECTION_ORDER: { template: ArticleTemplate | "timeline"; label: string }[] = [
  { template: "world_setting", label: "World Overview" },
  { template: "location", label: "Geography" },
  { template: "species", label: "Peoples & Species" },
  { template: "organization", label: "Factions & Organizations" },
  { template: "character", label: "Notable Characters" },
  { template: "timeline", label: "History & Timeline" },
  { template: "profession", label: "Professions" },
  { template: "ability", label: "Abilities & Powers" },
  { template: "language", label: "Languages & Culture" },
  { template: "item", label: "Items & Artifacts" },
  { template: "event", label: "Historical Events" },
  { template: "freeform", label: "Other Lore" },
];

export interface LoreBibleOptions {
  includeDrafts: boolean;
  includePrivateNotes: boolean;
}

export function exportLoreBible(
  lore: WorldLore,
  options: LoreBibleOptions = { includeDrafts: false, includePrivateNotes: false },
): string {
  const lines: string[] = [];
  const articles = Object.values(lore.articles).filter(
    (a) => options.includeDrafts || !a.draft,
  );

  // Title
  const ws = articles.find((a) => a.template === "world_setting");
  const worldName =
    (ws?.fields?.name as string) ?? ws?.title ?? "Untitled World";
  const tagline = (ws?.fields?.tagline as string) ?? "";

  lines.push(`# ${worldName}`);
  if (tagline) lines.push(`\n*${tagline}*`);
  lines.push(`\n---\n`);

  // Table of contents
  lines.push(`## Table of Contents\n`);
  for (const section of SECTION_ORDER) {
    const count =
      section.template === "timeline"
        ? (lore.timelineEvents?.length ?? 0)
        : articles.filter((a) => a.template === section.template).length;
    if (count > 0) {
      lines.push(
        `- [${section.label}](#${section.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")})`,
      );
    }
  }
  lines.push("");

  // Sections by template
  for (const section of SECTION_ORDER) {
    if (section.template === "timeline") {
      // Timeline section
      const events = lore.timelineEvents ?? [];
      if (events.length === 0) continue;

      lines.push(`## ${section.label}\n`);

      // Calendar systems
      if (lore.calendarSystems?.length) {
        for (const cal of lore.calendarSystems) {
          lines.push(`### ${cal.name}\n`);
          if (cal.eras.length) {
            lines.push(
              `**Eras:** ${cal.eras.map((e) => e.name).join(", ")}\n`,
            );
          }
        }
      }

      // Events sorted by year
      const sorted = [...events].sort((a, b) => a.year - b.year);
      for (const event of sorted) {
        const era = lore.calendarSystems
          ?.flatMap((c) => c.eras)
          .find((e) => e.id === event.eraId);
        const eraName = era ? ` (${era.name})` : "";
        const importance =
          event.importance === "legendary"
            ? " \u2605"
            : event.importance === "major"
              ? " \u25CF"
              : "";
        lines.push(
          `- **Year ${event.year}${eraName}${importance}**: ${event.title}`,
        );
        if (event.description) lines.push(`  ${event.description}`);
      }
      lines.push("");
      continue;
    }

    const sectionArticles = articles
      .filter((a) => a.template === section.template)
      .sort((a, b) => a.title.localeCompare(b.title));

    if (sectionArticles.length === 0) continue;

    lines.push(`## ${section.label}\n`);

    for (const article of sectionArticles) {
      lines.push(`### ${article.title}\n`);

      // Fields
      const fields = Object.entries(article.fields).filter(
        ([, v]) => v !== undefined && v !== null && v !== "",
      );
      if (fields.length > 0) {
        for (const [key, value] of fields) {
          const label = key
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (s) => s.toUpperCase())
            .trim();
          const text = Array.isArray(value) ? value.join(", ") : String(value);
          lines.push(`**${label}:** ${text}  `);
        }
        lines.push("");
      }

      // Content
      const content = tiptapToMarkdown(article.content);
      if (content) {
        lines.push(content);
        lines.push("");
      }

      // Relations
      if (article.relations?.length) {
        const relGroups = new Map<string, string[]>();
        for (const rel of article.relations) {
          const target = lore.articles[rel.targetId];
          const name = target?.title ?? rel.targetId;
          const type = rel.label ?? rel.type;
          if (!relGroups.has(type)) relGroups.set(type, []);
          relGroups.get(type)!.push(name);
        }
        for (const [type, names] of relGroups) {
          lines.push(
            `**${type.charAt(0).toUpperCase() + type.slice(1)}:** ${names.join(", ")}  `,
          );
        }
        lines.push("");
      }

      // Private notes
      if (options.includePrivateNotes && article.privateNotes) {
        const notes = tiptapToMarkdown(article.privateNotes);
        if (notes) {
          lines.push(`> **Creator's Notes:**`);
          for (const line of notes.split("\n")) {
            lines.push(`> ${line}`);
          }
          lines.push("");
        }
      }

      lines.push("---\n");
    }
  }

  // Footer
  lines.push(
    `\n*Exported from Arcanum on ${new Date().toLocaleDateString()}*`,
  );

  return lines.join("\n");
}

/** Convert TipTap JSON to Markdown */
function tiptapToMarkdown(content: string): string {
  if (!content) return "";
  if (!content.startsWith("{")) return content;
  try {
    const doc = JSON.parse(content);
    return nodeToMd(doc).trim();
  } catch {
    return content;
  }
}

function nodeToMd(node: Record<string, unknown>): string {
  const type = node.type as string;
  const attrs = node.attrs as Record<string, unknown> | undefined;
  const content = node.content as Record<string, unknown>[] | undefined;
  const childMd = content ? content.map(nodeToMd).join("") : "";

  switch (type) {
    case "doc":
      return childMd;
    case "paragraph":
      return `${childMd}\n\n`;
    case "heading": {
      const level = Math.min(Math.max(Number(attrs?.level ?? 2), 1), 6);
      // Offset by 3 since article title is h3
      const hashes = "#".repeat(Math.min(level + 3, 6));
      return `${hashes} ${childMd}\n\n`;
    }
    case "text": {
      let text = String(node.text ?? "");
      const marks = node.marks as { type: string }[] | undefined;
      if (marks) {
        for (const mark of marks) {
          if (mark.type === "bold") text = `**${text}**`;
          else if (mark.type === "italic") text = `*${text}*`;
          else if (mark.type === "code") text = `\`${text}\``;
        }
      }
      return text;
    }
    case "mention": {
      const label = String(attrs?.label ?? attrs?.id ?? "");
      return `**${label}**`;
    }
    case "bulletList":
      return childMd;
    case "orderedList":
      return childMd;
    case "listItem":
      return `- ${childMd.trim()}\n`;
    case "blockquote": {
      return (
        childMd
          .split("\n")
          .map((l) => `> ${l}`)
          .join("\n") + "\n\n"
      );
    }
    case "horizontalRule":
      return "---\n\n";
    case "hardBreak":
      return "\n";
    default:
      return childMd;
  }
}
