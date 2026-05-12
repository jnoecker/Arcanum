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
}

/**
 * Reroute legacy `species` and `profession` articles to the playable /
 * non-playable variants introduced by #236. The heuristic compares the
 * article's title (case-insensitive) against the project's gameplay race
 * and class definitions:
 *
 * - `species` whose title matches a `config.races[*]` displayName or id
 *   becomes an `ancestry` article. Otherwise it becomes a `bestiary` entry.
 * - `profession` whose title matches a `config.classes[*]` displayName or
 *   id becomes a `class` article. Otherwise it becomes an `occupation`.
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

  let speciesToAncestry = 0;
  let speciesToBestiary = 0;
  let professionToClass = 0;
  let professionToOccupation = 0;
  let changed = false;
  const nextArticles: Record<string, Article> = {};

  for (const [id, article] of Object.entries(articles)) {
    if (article.template === "species") {
      const target = matches(article.title, racesByKey) ? "ancestry" : "bestiary";
      if (target === "ancestry") speciesToAncestry++;
      else speciesToBestiary++;
      nextArticles[id] = { ...article, template: target };
      changed = true;
    } else if (article.template === "profession") {
      const target = matches(article.title, classesByKey) ? "class" : "occupation";
      if (target === "class") professionToClass++;
      else professionToOccupation++;
      nextArticles[id] = { ...article, template: target };
      changed = true;
    } else {
      nextArticles[id] = article;
    }
  }

  return {
    lore: changed ? { ...lore, articles: nextArticles } : lore,
    speciesToAncestry,
    speciesToBestiary,
    professionToClass,
    professionToOccupation,
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
