import { invoke } from "@tauri-apps/api/core";
import type { Article } from "@/types/lore";
import { TEMPLATE_SCHEMAS } from "@/lib/loreTemplates";
import { buildWorldContext } from "@/lib/loreGeneration";
import { tiptapToPlainText, plainTextToTiptap } from "@/lib/loreRelations";
import { REWRITE_SYSTEM_PROMPT } from "@/lib/lorePrompts";

export interface RewriteResult {
  content: string; // TipTap JSON string
  fields: Record<string, unknown>; // Only changed fields
}

export async function rewriteArticle(
  article: Article,
  instructions: string,
): Promise<RewriteResult> {
  const schema = TEMPLATE_SCHEMAS[article.template];
  const worldContext = buildWorldContext();
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
    `\nWorld context:\n${worldContext.slice(0, 1500)}`,
    `\n---\nInstructions: ${instructions}`,
  ].join("");

  const raw = await invoke<string>("llm_complete", {
    systemPrompt: REWRITE_SYSTEM_PROMPT,
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
