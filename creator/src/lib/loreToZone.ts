import type { Article } from "@/types/lore";
import type { NewZoneDialogPrefill } from "@/components/NewZoneDialog";
import { tiptapToPlainText, plainTextToTiptap } from "@/lib/loreRelations";
import { getEffectiveSections } from "@/lib/loreSections";
import { slugifyZoneId, findFreeZoneId } from "@/lib/createZoneFromPlan";
import { buildRagContext, type RetrievalDiagnostic } from "@/lib/rag/loreContext";

const MAX_BACKGROUND_CHARS = 8000;

export interface ZonePrefillFromArticleResult {
  prefill: NewZoneDialogPrefill;
  diagnostic: RetrievalDiagnostic;
}

/**
 * Read the article body the editor sees: concatenate public richtext
 * sections (skipping private ones), falling back to the legacy `content`
 * field for unmigrated articles.
 */
function articleBodyPlainText(article: Article): string {
  const sections = getEffectiveSections(article);
  const richtext = sections.filter((s) => s.type === "richtext" && !s.private);
  if (richtext.length === 0) return tiptapToPlainText(article.content);
  return richtext
    .map((s) => {
      const heading = s.title ? `## ${s.title}\n` : "";
      const body = tiptapToPlainText(("body" in s ? s.body : "") ?? "");
      return `${heading}${body}`.trim();
    })
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Build a `NewZoneDialogPrefill` from a Location lore article. The zone id
 * is derived from the article title, deduped against currently loaded
 * zones. The description is the article body wrapped as TipTap JSON so the
 * NewZoneDialog's rich-text field receives it. backgroundNotes is built
 * from RAG retrieval — pulls characters/factions/events/geography around
 * the region so the zone generator has the full lore neighborhood.
 */
export async function buildZonePrefillFromArticle(
  article: Article,
): Promise<ZonePrefillFromArticleResult> {
  const baseSlug = slugifyZoneId(article.title) ?? "zone";
  const zoneId = findFreeZoneId(baseSlug);
  const body = articleBodyPlainText(article);
  const description = body
    ? plainTextToTiptap(body)
    : plainTextToTiptap(`The ${article.title}.`);

  const query = [
    `${article.title} — region, inhabitants, factions, history, landmarks`,
    body.slice(0, 1200),
  ]
    .filter(Boolean)
    .join("\n");

  const { context: ragContext, diagnostic } = await buildRagContext({
    query,
    excludeSourceIds: [article.id],
    k: 14,
    maxChars: MAX_BACKGROUND_CHARS,
    fallback: () => "",
  });

  const backgroundParts: string[] = [`Region: ${article.title}.`];
  if (article.fields && Object.keys(article.fields).length > 0) {
    const fieldLines: string[] = [];
    for (const [k, v] of Object.entries(article.fields)) {
      if (v == null || v === "") continue;
      const rendered = Array.isArray(v) ? v.join(", ") : String(v);
      if (!rendered) continue;
      fieldLines.push(`- ${k}: ${rendered}`);
    }
    if (fieldLines.length > 0) {
      backgroundParts.push("Region facts:", fieldLines.join("\n"));
    }
  }
  if (ragContext) {
    backgroundParts.push(
      "Related lore — characters, factions, events, and adjacent geography:",
      ragContext,
    );
  }

  return {
    prefill: {
      zoneId,
      description,
      backgroundNotes: backgroundParts.join("\n\n"),
    },
    diagnostic,
  };
}
