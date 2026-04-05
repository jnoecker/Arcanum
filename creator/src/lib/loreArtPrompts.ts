import type { Article, ArticleTemplate } from "@/types/lore";
import type { ArtStyle } from "@/lib/arcanumPrompts";
import { useLoreStore } from "@/stores/loreStore";
import { tiptapToPlainText } from "@/lib/loreRelations";

// ─── Template → asset type mapping ──────────────────────────────────

export const TEMPLATE_ASSET_TYPE: Record<ArticleTemplate, string> = {
  world_setting: "lore_location",
  character: "lore_character",
  location: "lore_location",
  organization: "lore_organization",
  item: "lore_item",
  species: "lore_species",
  event: "lore_event",
  language: "lore_location",
  profession: "lore_character",
  ability: "lore_item",
  freeform: "lore_location",
  story: "lore_event",
};

// ─── Format descriptions per template ───────────────────────────────

const FORMAT: Record<ArticleTemplate, string> = {
  character: "2:3 portrait orientation character illustration, close-up to mid-shot framing",
  location: "16:9 landscape illustration, wide establishing shot",
  organization: "1:1 square banner or crest illustration, centered heraldic composition",
  species: "1:1 square creature portrait, full body centered",
  item: "1:1 square item icon, floating on transparent background",
  event: "16:9 dramatic scene illustration, cinematic composition",
  world_setting: "16:9 panoramic landscape, epic scope",
  language: "16:9 illustration of a scroll or inscription",
  profession: "2:3 portrait of a class archetype in action, dynamic pose, iconic gear and stance",
  ability: "1:1 square spell or skill icon, magical energy effect, centered glow",
  freeform: "16:9 atmospheric illustration",
  story: "16:9 cinematic scene illustration, dramatic composition",
};

// ─── Prompt builders ────────────────────────────────────────────────

function worldContext(): string {
  const articles = useLoreStore.getState().lore?.articles ?? {};
  const ws = Object.values(articles).find((a) => a.template === "world_setting");
  if (!ws) return "";
  const name = typeof ws.fields.name === "string" ? ws.fields.name : "";
  const themes = Array.isArray(ws.fields.themes) ? ws.fields.themes.join(", ") : "";
  return [name && `World: ${name}`, themes && `Themes: ${themes}`].filter(Boolean).join(". ");
}

function articleSummary(article: Article): string {
  const parts: string[] = [`${article.title}`];

  // Include key fields
  for (const [key, val] of Object.entries(article.fields)) {
    if (typeof val === "string" && val.trim()) {
      parts.push(`${key}: ${val.slice(0, 100)}`);
    }
  }

  // Include beginning of content
  const plainContent = tiptapToPlainText(article.content);
  if (plainContent) {
    parts.push(plainContent.slice(0, 200));
  }

  return parts.join(". ");
}

/**
 * Build a fallback image prompt for an article (used when no LLM is available).
 */
export function getArticlePrompt(article: Article, style: ArtStyle): string {
  const format = FORMAT[article.template];
  const ctx = worldContext();
  const summary = articleSummary(article);

  const parts: string[] = [format];
  if (ctx) parts.push(ctx);
  parts.push(summary);

  if (style === "arcanum") {
    parts.push("Deep cosmic indigo and abyssal navy backgrounds, baroque rococo light scrollwork, golden accents");
  } else {
    parts.push("Soft lavender and pale blue undertones, ambient diffused lighting, dreamlike atmosphere");
  }

  parts.push("No text, no runes, no words, no letters");
  return parts.join(". ");
}

/**
 * Build rich entity context for LLM prompt enhancement.
 */
export function getArticleContext(article: Article): string {
  const parts: string[] = [
    `Article type: ${article.template}`,
    `Title: ${article.title}`,
  ];

  for (const [key, val] of Object.entries(article.fields)) {
    if (typeof val === "string" && val.trim()) {
      parts.push(`${key}: ${val}`);
    } else if (Array.isArray(val) && val.length > 0) {
      parts.push(`${key}: ${val.join(", ")}`);
    }
  }

  const plainContent = tiptapToPlainText(article.content);
  if (plainContent) {
    parts.push(`Description: ${plainContent.slice(0, 500)}`);
  }

  const ctx = worldContext();
  if (ctx) parts.push(`World: ${ctx}`);

  return parts.join("\n");
}
