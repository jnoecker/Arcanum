import { invoke } from "@tauri-apps/api/core";
import type { Article } from "@/types/lore";
import { getTemplateSchema } from "@/lib/loreTemplates";
import { useLoreStore } from "@/stores/loreStore";
import { buildWorldContext } from "@/lib/loreGeneration";
import { tiptapToPlainText, plainTextToTiptap } from "@/lib/loreRelations";
import { getEffectiveSections } from "@/lib/loreSections";
import { getRewriteSystemPrompt } from "@/lib/lorePrompts";
import { AI_ENABLED } from "@/lib/featureFlags";
import { buildRagContext, type RetrievalDiagnostic } from "@/lib/rag/loreContext";

export type { RetrievalDiagnostic } from "@/lib/rag/loreContext";

/**
 * Read the article body the way the editor sees it: pull from richtext
 * sections (skipping private ones), falling back to the legacy `content`
 * field for articles that haven't been migrated yet. Multi-section
 * articles get all public richtext bodies concatenated.
 */
function readArticleBody(article: Article): string {
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

export interface RewriteResult {
  content: string; // TipTap JSON string
  fields: Record<string, unknown>; // Only changed fields
  diagnostic: RetrievalDiagnostic;
}

export async function rewriteArticle(
  article: Article,
  instructions: string,
): Promise<RewriteResult> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");
  const schema = getTemplateSchema(article.template, useLoreStore.getState().lore?.customTemplates);
  const { context: worldContext, diagnostic } = await buildRagContext({
    query: `${article.title}\n${instructions}`,
    excludeSourceIds: [article.id],
    fallback: () => buildWorldContext().slice(0, 1500),
  });
  const currentContent = readArticleBody(article);

  const fieldSummary = schema
    ? schema.fields
        .map((f) => {
          const val = article.fields[f.key];
          return val ? `${f.label}: ${Array.isArray(val) ? val.join(", ") : String(val)}` : null;
        })
        .filter(Boolean)
        .join("\n")
    : "";

  const userPrompt = [
    `Article: "${article.title}" (template: ${article.template})`,
    fieldSummary ? `\nCurrent fields:\n${fieldSummary}` : "",
    `\nCurrent content:\n${currentContent}`,
    `\nWorld context:\n${worldContext}`,
    `\n---\nInstructions: ${instructions}`,
  ].join("");

  const raw = await invoke<string>("llm_complete", {
    systemPrompt: getRewriteSystemPrompt(),
    userPrompt,
  });

  // Parse JSON response
  const cleaned = raw.trim().replace(/^```json?\s*/i, "").replace(/\s*```$/, "");
  let parsed: { content?: string; fields?: Record<string, unknown> };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // If the model didn't return JSON, treat entire response as rewritten content
    return {
      content: plainTextToTiptap(raw.trim()),
      fields: {},
      diagnostic,
    };
  }

  return {
    content: parsed.content ? plainTextToTiptap(parsed.content) : article.content,
    fields: parsed.fields ?? {},
    diagnostic,
  };
}
