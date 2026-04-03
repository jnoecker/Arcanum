import type { WorldLore } from "@/types/lore";

export type AuditSeverity = "error" | "warning" | "info";

export interface AuditIssue {
  severity: AuditSeverity;
  category: string;
  message: string;
  articleIds: string[];
}

export function auditLore(lore: WorldLore): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const articles = lore.articles;
  const articleIds = new Set(Object.keys(articles));

  // 1. Orphaned relations — pointing to nonexistent articles
  for (const article of Object.values(articles)) {
    for (const rel of article.relations ?? []) {
      if (!articleIds.has(rel.targetId)) {
        issues.push({
          severity: "error",
          category: "Orphaned relation",
          message: `"${article.title}" has a ${rel.type} relation to "${rel.targetId}" which doesn't exist`,
          articleIds: [article.id],
        });
      }
    }
  }

  // 2. Orphaned @mentions in content
  for (const article of Object.values(articles)) {
    const mentionIds = extractMentionIds(article.content);
    for (const mid of mentionIds) {
      if (!articleIds.has(mid)) {
        issues.push({
          severity: "warning",
          category: "Orphaned mention",
          message: `"${article.title}" @mentions "${mid}" which doesn't exist`,
          articleIds: [article.id],
        });
      }
    }
  }

  // 3. Duplicate titles
  const titleMap = new Map<string, string[]>();
  for (const article of Object.values(articles)) {
    const key = article.title.toLowerCase().trim();
    if (!titleMap.has(key)) titleMap.set(key, []);
    titleMap.get(key)!.push(article.id);
  }
  for (const [, ids] of titleMap) {
    if (ids.length > 1) {
      issues.push({
        severity: "warning",
        category: "Duplicate title",
        message: `${ids.length} articles share the title "${articles[ids[0]!]?.title}"`,
        articleIds: ids,
      });
    }
  }

  // 4. Empty content — articles with no body text
  for (const article of Object.values(articles)) {
    if (!article.content || article.content === "" || article.content === '{"type":"doc","content":[]}') {
      if (article.template !== "world_setting") {
        issues.push({
          severity: "info",
          category: "Empty content",
          message: `"${article.title}" has no body content`,
          articleIds: [article.id],
        });
      }
    }
  }

  // 5. Bidirectional relation gaps (ally/rival should be reciprocal)
  for (const article of Object.values(articles)) {
    for (const rel of article.relations ?? []) {
      if (["ally", "rival"].includes(rel.type)) {
        const target = articles[rel.targetId];
        if (target) {
          const reciprocal = (target.relations ?? []).some(
            (r) => r.targetId === article.id && r.type === rel.type
          );
          if (!reciprocal) {
            issues.push({
              severity: "info",
              category: "Missing reciprocal",
              message: `"${article.title}" is ${rel.type} of "${target.title}" but not vice versa`,
              articleIds: [article.id, rel.targetId],
            });
          }
        }
      }
    }
  }

  // 6. Timeline events outside era ranges
  if (lore.timelineEvents && lore.calendarSystems) {
    const eras = new Map<string, { start: number; end: number }>();
    for (const cal of lore.calendarSystems) {
      const sortedEras = [...cal.eras].sort((a, b) => a.startYear - b.startYear);
      for (let i = 0; i < sortedEras.length; i++) {
        const era = sortedEras[i]!;
        const nextStart = sortedEras[i + 1]?.startYear ?? Infinity;
        eras.set(era.id, { start: era.startYear, end: nextStart - 1 });
      }
    }
    for (const event of lore.timelineEvents) {
      const eraRange = eras.get(event.eraId);
      if (eraRange && (event.year < eraRange.start || event.year > eraRange.end)) {
        issues.push({
          severity: "warning",
          category: "Timeline mismatch",
          message: `Event "${event.title}" (year ${event.year}) is outside its era's range (${eraRange.start}–${eraRange.end})`,
          articleIds: event.articleId ? [event.articleId] : [],
        });
      }
    }
  }

  // 7. Orphaned map pins
  if (lore.maps) {
    for (const map of lore.maps) {
      for (const pin of map.pins) {
        if (pin.articleId && !articleIds.has(pin.articleId)) {
          issues.push({
            severity: "warning",
            category: "Orphaned pin",
            message: `Pin "${pin.label ?? pin.id}" on map "${map.title}" links to nonexistent article "${pin.articleId}"`,
            articleIds: [],
          });
        }
      }
    }
  }

  // 8. Timeline events referencing nonexistent articles
  if (lore.timelineEvents) {
    for (const event of lore.timelineEvents) {
      if (event.articleId && !articleIds.has(event.articleId)) {
        issues.push({
          severity: "warning",
          category: "Orphaned event link",
          message: `Timeline event "${event.title}" references nonexistent article "${event.articleId}"`,
          articleIds: [],
        });
      }
    }
  }

  // Sort: errors first, then warnings, then info
  const severityOrder: Record<AuditSeverity, number> = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return issues;
}

function extractMentionIds(content: string): string[] {
  if (!content || !content.startsWith("{")) return [];
  const ids: string[] = [];
  try {
    const doc = JSON.parse(content);
    collectMentions(doc, ids);
  } catch { /* ignore malformed content */ }
  return ids;
}

function collectMentions(node: Record<string, unknown>, ids: string[]): void {
  if (node.type === "mention") {
    const attrs = node.attrs as Record<string, unknown> | undefined;
    if (attrs?.id) ids.push(String(attrs.id));
  }
  const children = node.content as Record<string, unknown>[] | undefined;
  if (children) for (const child of children) collectMentions(child, ids);
}
