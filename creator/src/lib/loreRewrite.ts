import { invoke } from "@tauri-apps/api/core";
import type { Article } from "@/types/lore";
import { TEMPLATE_SCHEMAS } from "@/lib/loreTemplates";
import { buildWorldContext } from "@/lib/loreGeneration";
import { tiptapToPlainText, plainTextToTiptap } from "@/lib/loreRelations";
import { getRewriteSystemPrompt } from "@/lib/lorePrompts";
import { AI_ENABLED } from "@/lib/featureFlags";
import { retrieveLoreContext } from "@/lib/rag";
import { formatContextForPrompt } from "@/lib/rag/promptAssembly";

/**
 * Pick the most relevant lore context for a rewrite. Prefers RAG retrieval
 * (query = article title + instructions), filters out the article being
 * rewritten so the retrieved chunks complement rather than echo the input,
 * and falls back to the legacy `buildWorldContext()` slice when the index
 * is empty or retrieval fails.
 */
async function buildRewriteContext(
  article: Article,
  instructions: string,
): Promise<string> {
  try {
    const query = `${article.title}\n${instructions}`;
    const chunks = await retrieveLoreContext({ query, k: 10 });
    const filtered = chunks.filter((c) => c.source_id !== article.id);
    if (filtered.length > 0) {
      return formatContextForPrompt(filtered, 8000);
    }
  } catch (e) {
    console.warn("[loreRewrite] RAG retrieval failed; falling back to legacy context", e);
  }
  return buildWorldContext().slice(0, 1500);
}

export interface RewriteResult {
  content: string; // TipTap JSON string
  fields: Record<string, unknown>; // Only changed fields
}

export async function rewriteArticle(
  article: Article,
  instructions: string,
): Promise<RewriteResult> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");
  const schema = TEMPLATE_SCHEMAS[article.template];
  const worldContext = await buildRewriteContext(article, instructions);
  const currentContent = tiptapToPlainText(article.content);

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
    };
  }

  return {
    content: parsed.content ? plainTextToTiptap(parsed.content) : article.content,
    fields: parsed.fields ?? {},
  };
}
