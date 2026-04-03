import type { WorldLore, Article, ArticleTemplate } from "@/types/lore";

export interface LoreGap {
  category: string;
  message: string;
  /** Which articles are involved */
  articleIds: string[];
  /** Suggested fix action */
  suggestion?: string;
}

export function analyzeLoreGaps(lore: WorldLore): LoreGap[] {
  const gaps: LoreGap[] = [];
  const articles = Object.values(lore.articles);
  const byTemplate = new Map<ArticleTemplate, Article[]>();

  for (const a of articles) {
    if (!byTemplate.has(a.template)) byTemplate.set(a.template, []);
    byTemplate.get(a.template)!.push(a);
  }

  // 1. Template coverage -- which template types are empty?
  const expectedTemplates: { template: ArticleTemplate; label: string }[] = [
    { template: "character", label: "Characters" },
    { template: "location", label: "Locations" },
    { template: "organization", label: "Organizations" },
    { template: "species", label: "Species" },
    { template: "event", label: "Events" },
    { template: "item", label: "Items" },
    { template: "profession", label: "Professions" },
    { template: "language", label: "Languages" },
  ];
  for (const { template, label } of expectedTemplates) {
    const count = byTemplate.get(template)?.length ?? 0;
    if (count === 0) {
      gaps.push({
        category: "Missing template",
        message: `No ${label.toLowerCase()} articles exist yet`,
        articleIds: [],
        suggestion: `Create a ${label.toLowerCase().replace(/s$/, "")} article`,
      });
    }
  }

  // 2. Organizations without any members
  const orgs = byTemplate.get("organization") ?? [];
  for (const org of orgs) {
    const hasMembers = articles.some(
      (a) =>
        a.template === "character" &&
        ((a.relations ?? []).some(
          (r) => r.targetId === org.id && r.type === "member_of",
        ) ||
          (a.fields.affiliation as string)?.toLowerCase() ===
            org.title.toLowerCase()),
    );
    if (!hasMembers) {
      gaps.push({
        category: "Leaderless faction",
        message: `Organization "${org.title}" has no character members`,
        articleIds: [org.id],
        suggestion: `Create a character with affiliation to ${org.title}`,
      });
    }
  }

  // 3. Species with no characters
  const species = byTemplate.get("species") ?? [];
  for (const sp of species) {
    const hasChars = articles.some(
      (a) =>
        a.template === "character" &&
        ((a.relations ?? []).some((r) => r.targetId === sp.id) ||
          (a.fields.race as string)?.toLowerCase() ===
            sp.title.toLowerCase() ||
          (a.fields.species as string)?.toLowerCase() ===
            sp.title.toLowerCase()),
    );
    if (!hasChars) {
      gaps.push({
        category: "Unrepresented species",
        message: `Species "${sp.title}" has no associated character articles`,
        articleIds: [sp.id],
        suggestion: `Create a character of species ${sp.title}`,
      });
    }
  }

  // 4. Locations with no children or linked content
  const locations = byTemplate.get("location") ?? [];
  for (const loc of locations) {
    const hasChildren = articles.some((a) => a.parentId === loc.id);
    const hasInbound = articles.some(
      (a) =>
        a.id !== loc.id &&
        (a.relations ?? []).some((r) => r.targetId === loc.id),
    );
    if (!hasChildren && !hasInbound) {
      gaps.push({
        category: "Isolated location",
        message: `Location "${loc.title}" has no child articles and nothing references it`,
        articleIds: [loc.id],
        suggestion: `Add sub-locations or link characters/events to ${loc.title}`,
      });
    }
  }

  // 5. Characters without any relations
  const characters = byTemplate.get("character") ?? [];
  for (const char of characters) {
    const hasRelations = (char.relations ?? []).length > 0;
    const hasInbound = articles.some(
      (a) =>
        a.id !== char.id &&
        (a.relations ?? []).some((r) => r.targetId === char.id),
    );
    if (!hasRelations && !hasInbound) {
      gaps.push({
        category: "Unconnected character",
        message: `Character "${char.title}" has no relationships to other articles`,
        articleIds: [char.id],
        suggestion: `Add affiliations, allies, or location links for ${char.title}`,
      });
    }
  }

  // 6. World setting missing key fields
  const ws = articles.find((a) => a.template === "world_setting");
  if (!ws) {
    gaps.push({
      category: "Missing foundation",
      message: "No world setting article exists",
      articleIds: [],
      suggestion:
        "Create a world_setting article with name, overview, and themes",
    });
  } else {
    const keyFields = ["name", "overview", "history", "themes"];
    const missing = keyFields.filter((f) => !ws.fields[f]);
    if (missing.length > 0) {
      gaps.push({
        category: "Incomplete world setting",
        message: `World setting is missing: ${missing.join(", ")}`,
        articleIds: [ws.id],
        suggestion: `Fill in the ${missing.join(", ")} fields on the world setting`,
      });
    }
  }

  // 7. No timeline events
  if (!lore.timelineEvents || lore.timelineEvents.length === 0) {
    if (articles.length > 5) {
      gaps.push({
        category: "No timeline",
        message: "No timeline events exist despite having articles",
        articleIds: [],
        suggestion:
          "Add calendar systems and timeline events to establish history",
      });
    }
  }

  // 8. No maps
  if (!lore.maps || lore.maps.length === 0) {
    if ((byTemplate.get("location")?.length ?? 0) >= 3) {
      gaps.push({
        category: "No maps",
        message: `${byTemplate.get("location")!.length} location articles but no maps`,
        articleIds: [],
        suggestion: "Upload a world map and pin locations to it",
      });
    }
  }

  return gaps;
}
