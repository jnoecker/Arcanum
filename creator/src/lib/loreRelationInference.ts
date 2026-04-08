import type { Article } from "@/types/lore";

export interface RelationSuggestion {
  sourceId: string;
  targetId: string;
  type: string;
  label?: string;
  /** Why this was inferred */
  evidence: string;
  confidence: "high" | "medium";
}

/**
 * Scan articles for implicit relationships that should exist as formal relations.
 * Phase 1: deterministic field-based inference only.
 */
export function inferRelations(
  articles: Record<string, Article>,
): RelationSuggestion[] {
  const suggestions: RelationSuggestion[] = [];
  const articleList = Object.values(articles).filter(
    (a): a is Article => a != null && typeof a.title === "string",
  );

  // Build title→id map for text-field matching (leader, territory, etc.)
  const titleToId = new Map<string, string>();
  for (const a of articleList) {
    if (a.title) titleToId.set(a.title.toLowerCase(), a.id);
  }

  for (const article of articleList) {
    const existingRelations = new Set(
      (article.relations ?? []).map((r) => `${r.targetId}:${r.type}`),
    );

    // 1. Affiliation field (article_ref → stores article ID) → member_of
    if (article.template === "character") {
      const affiliationId = article.fields.affiliation as string | undefined;
      if (affiliationId && articles[affiliationId] && !existingRelations.has(`${affiliationId}:member_of`)) {
        suggestions.push({
          sourceId: article.id,
          targetId: affiliationId,
          type: "member_of",
          evidence: `Character "${article.title}" has affiliation "${articles[affiliationId]!.title}"`,
          confidence: "high",
        });
      }
    }

    // 2. Profession field (article_ref → stores article ID) → related
    if (article.template === "ability") {
      const professionId = article.fields.profession as string | undefined;
      if (professionId && articles[professionId] && !existingRelations.has(`${professionId}:related`)) {
        suggestions.push({
          sourceId: article.id,
          targetId: professionId,
          type: "related",
          label: "used by",
          evidence: `Ability "${article.title}" is linked to profession "${articles[professionId]!.title}"`,
          confidence: "high",
        });
      }
    }

    // 3. Participants / speakers / keyAbilities (article_refs → store article ID arrays) → related
    for (const [fieldName, label] of [
      ["participants", "participated in"],
      ["speakers", "speaks"],
      ["keyAbilities", "key ability of"],
    ] as const) {
      const ids = article.fields[fieldName] as string[] | undefined;
      if (Array.isArray(ids)) {
        for (const targetId of ids) {
          if (articles[targetId] && !existingRelations.has(`${targetId}:related`)) {
            suggestions.push({
              sourceId: article.id,
              targetId,
              type: "related",
              label,
              evidence: `"${article.title}" references "${articles[targetId]!.title}" in ${fieldName} field`,
              confidence: "high",
            });
          }
        }
      }
    }

    // 4. Text-based location fields (territory, habitat) → located_in via title matching
    for (const fieldName of ["territory", "habitat"]) {
      const value = article.fields[fieldName] as string | undefined;
      if (value) {
        const targetId = titleToId.get(value.toLowerCase());
        if (targetId && targetId !== article.id && !existingRelations.has(`${targetId}:located_in`)) {
          suggestions.push({
            sourceId: article.id,
            targetId,
            type: "located_in",
            evidence: `"${article.title}" has ${fieldName} field "${value}"`,
            confidence: "high",
          });
        }
      }
    }

    // 5. Leader field (text) → related via title matching
    if (article.template === "organization") {
      const leader = article.fields.leader as string | undefined;
      if (leader) {
        const targetId = titleToId.get(leader.toLowerCase());
        if (targetId && targetId !== article.id && !existingRelations.has(`${targetId}:related`)) {
          suggestions.push({
            sourceId: article.id,
            targetId,
            type: "related",
            label: "led by",
            evidence: `Organization "${article.title}" has leader "${leader}"`,
            confidence: "high",
          });
        }
      }
    }

    // 6. Parent article → located_in for location/organization children of locations
    if (
      article.parentId &&
      articles[article.parentId] &&
      (article.template === "location" || article.template === "organization") &&
      articles[article.parentId]!.template === "location" &&
      !existingRelations.has(`${article.parentId}:located_in`)
    ) {
      suggestions.push({
        sourceId: article.id,
        targetId: article.parentId,
        type: "located_in",
        evidence: `"${article.title}" is a child of location "${articles[article.parentId]!.title}"`,
        confidence: "high",
      });
    }

    // 7. Bidirectional gaps: if A→B ally/rival exists but B→A doesn't
    for (const rel of article.relations ?? []) {
      if (rel.type === "ally" || rel.type === "rival") {
        const target = articles[rel.targetId];
        if (target) {
          const targetRels = new Set(
            (target.relations ?? []).map((r) => `${r.targetId}:${r.type}`),
          );
          if (!targetRels.has(`${article.id}:${rel.type}`)) {
            suggestions.push({
              sourceId: rel.targetId,
              targetId: article.id,
              type: rel.type,
              label: rel.label,
              evidence: `"${article.title}" is ${rel.type} of "${target.title}" but not reciprocated`,
              confidence: "medium",
            });
          }
        }
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return suggestions.filter((s) => {
    const key = `${s.sourceId}:${s.targetId}:${s.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
