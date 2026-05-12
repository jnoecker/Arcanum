import type { Article, WorldLore } from "@/types/lore";
import type { AppConfig } from "@/types/config";

export interface LegacyTemplateMigrationResult {
  /** The lore with legacy template ids rerouted in place. Returns the same
   *  reference when nothing changed, so callers can use referential equality
   *  to decide whether to write to disk. */
  lore: WorldLore;
  /** species → ancestry (matched a race) or bestiary (no match). */
  speciesToAncestry: number;
  speciesToBestiary: number;
  /** profession → class (matched a class) or occupation (no match). */
  professionToClass: number;
  professionToOccupation: number;
  /** ability → talent (linked to a class) or creature_power (orphan). */
  abilityToTalent: number;
  abilityToCreaturePower: number;
}

/**
 * Reroute legacy `species` and `profession` articles to the playable /
 * non-playable variants introduced by #236.
 *
 * - If gameplay races/classes exist, compare the article's title
 *   (case-insensitive) against `config.races[*]` / `config.classes[*]`.
 *   A match → playable variant (ancestry / class). No match → non-playable
 *   variant (bestiary / occupation).
 * - If gameplay races/classes do NOT exist yet (lore-first projects), we
 *   default to the playable variant. The whole point of writing the lore
 *   first is to scaffold gameplay from it; routing everything to bestiary
 *   would frustrate that flow. The user can flip individual articles
 *   back to bestiary/occupation via the Inspector's template picker.
 *
 * Pure transform — the loaded YAML on disk only changes once the caller
 * persists the returned lore.
 */
export function migrateLegacyTemplates(
  lore: WorldLore,
  config: AppConfig | null | undefined,
): LegacyTemplateMigrationResult {
  const articles = lore.articles ?? {};
  const racesByKey = buildKeyLookup(config?.races, (r) => r.displayName);
  const classesByKey = buildKeyLookup(config?.classes, (c) => c.displayName);
  const hasRaces = racesByKey.size > 0;
  const hasClasses = classesByKey.size > 0;

  let speciesToAncestry = 0;
  let speciesToBestiary = 0;
  let professionToClass = 0;
  let professionToOccupation = 0;
  let abilityToTalent = 0;
  let abilityToCreaturePower = 0;
  let changed = false;
  const nextArticles: Record<string, Article> = {};

  // First pass: migrate species and profession. The result of this pass is
  // what the ability migration consults when checking whether an ability's
  // `profession` field points at a now-class article.
  for (const [id, article] of Object.entries(articles)) {
    if (article.template === "species") {
      const target = hasRaces
        ? matches(article.title, racesByKey) ? "ancestry" : "bestiary"
        : "ancestry"; // lore-first default — assume the article is a playable people
      if (target === "ancestry") speciesToAncestry++;
      else speciesToBestiary++;
      nextArticles[id] = { ...article, template: target };
      changed = true;
    } else if (article.template === "profession") {
      const target = hasClasses
        ? matches(article.title, classesByKey) ? "class" : "occupation"
        : "class"; // lore-first default — assume the article is a playable class
      if (target === "class") professionToClass++;
      else professionToOccupation++;
      nextArticles[id] = { ...article, template: target };
      changed = true;
    } else {
      nextArticles[id] = article;
    }
  }

  // Second pass: migrate legacy ability articles. An ability whose
  // `profession` ref points at a (now) Class article becomes a Talent.
  // Lore-first projects (no gameplay classes) default to Talent so the
  // lore-to-config arc keeps flowing. The user can flip the rare
  // creature_power case via the Inspector template picker.
  for (const [id, article] of Object.entries(nextArticles)) {
    if (article.template !== "ability") continue;
    const professionRef = typeof article.fields.profession === "string"
      ? article.fields.profession
      : "";
    const linkedArticle = professionRef ? nextArticles[professionRef] : undefined;
    let target: "talent" | "creature_power";
    if (linkedArticle?.template === "class") {
      target = "talent";
    } else if (linkedArticle?.template === "occupation" || linkedArticle?.template === "bestiary") {
      target = "creature_power";
    } else if (!hasClasses) {
      // Lore-first: optimistically a player talent.
      target = "talent";
    } else if (professionRef) {
      // Profession ref pointed somewhere — but not a Class. Probably a
      // miswritten ref or a vestigial occupation; non-player.
      target = "creature_power";
    } else {
      // No ref at all and the project has gameplay classes — treat as a
      // creature power until proven otherwise.
      target = "creature_power";
    }
    if (target === "talent") abilityToTalent++;
    else abilityToCreaturePower++;
    nextArticles[id] = { ...article, template: target };
    changed = true;
  }

  return {
    lore: changed ? { ...lore, articles: nextArticles } : lore,
    speciesToAncestry,
    speciesToBestiary,
    professionToClass,
    professionToOccupation,
    abilityToTalent,
    abilityToCreaturePower,
  };
}

function buildKeyLookup<T>(
  source: Record<string, T> | undefined,
  getDisplayName: (entry: T) => string | undefined,
): Set<string> {
  const keys = new Set<string>();
  if (!source) return keys;
  for (const [id, entry] of Object.entries(source)) {
    keys.add(id.toLowerCase().trim());
    const display = getDisplayName(entry);
    if (display) keys.add(display.toLowerCase().trim());
  }
  return keys;
}

function matches(title: string, keys: Set<string>): boolean {
  const norm = title.toLowerCase().trim();
  if (!norm) return false;
  return keys.has(norm);
}
