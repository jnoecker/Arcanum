import type { Article, ArticleTemplate, TimelineEvent } from "@/types/lore";
import { ARCANUM_PREAMBLE, GENTLE_MAGIC_PREAMBLE, type ArtStyle } from "@/lib/arcanumPrompts";
import { buildVisualStyleDirective } from "@/lib/loreGeneration";
import { useLoreStore } from "@/stores/loreStore";
import { extractMentionCounts, tiptapToPlainText } from "@/lib/loreRelations";

const SCENE_SUBJECT_DEFAULT_TEMPLATES: ReadonlySet<ArticleTemplate> = new Set([
  "event",
  "story",
]);

const SCENE_SUBJECT_MAX = 3;

// ─── Template → asset type mapping ──────────────────────────────────

export const TEMPLATE_ASSET_TYPE: Record<ArticleTemplate, string> = {
  world_setting: "lore_location",
  character: "lore_character",
  location: "lore_location",
  organization: "lore_organization",
  item: "lore_item",
  ancestry: "lore_species",
  bestiary: "lore_species",
  species: "lore_species",
  event: "lore_event",
  language: "lore_location",
  class: "lore_character",
  occupation: "lore_character",
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
  ancestry: "2:3 portrait of a representative member, dignified pose, signature garb and bearing",
  bestiary: "1:1 square creature portrait, full body centered",
  species: "1:1 square creature portrait, full body centered",
  item: "1:1 square item icon, floating on transparent background",
  event: "16:9 dramatic scene illustration, cinematic composition",
  world_setting: "16:9 panoramic landscape, epic scope",
  language: "16:9 illustration of a scroll or inscription",
  class: "2:3 portrait of a class archetype in action, dynamic pose, iconic gear and stance",
  occupation: "2:3 portrait of a tradesperson at work, tools in hand, signs of the trade",
  profession: "2:3 portrait of a class archetype in action, dynamic pose, iconic gear and stance",
  ability: "1:1 square spell or skill icon, magical energy effect, centered glow",
  freeform: "16:9 atmospheric illustration",
  story: "16:9 cinematic scene illustration, dramatic composition",
};

// ─── Prompt builders ────────────────────────────────────────────────

/**
 * Resolve the style directive for a fallback (non-LLM) lore prompt.
 * Defers to the world-defined visual style when present; otherwise uses
 * the canonical built-in preambles from arcanumPrompts.ts.
 */
function loreStyleDirective(style: ArtStyle): string {
  const worldStyle = buildVisualStyleDirective("lore");
  if (worldStyle) return worldStyle;
  return style === "arcanum" ? ARCANUM_PREAMBLE : GENTLE_MAGIC_PREAMBLE;
}

function worldContext(): string {
  const articles = useLoreStore.getState().lore?.articles ?? {};
  const ws = Object.values(articles).find((a) => a.template === "world_setting");
  if (!ws) return "";
  const name = typeof ws.fields.name === "string" ? ws.fields.name : "";
  const themes = Array.isArray(ws.fields.themes) ? ws.fields.themes.join(", ") : "";
  return [name && `World: ${name}`, themes && `Themes: ${themes}`].filter(Boolean).join(". ");
}

/** Pull a visual-description-shaped field if the article has one. */
function articleAppearance(article: Article): string {
  const candidates = ["appearance", "description", "physicalDescription", "looks"];
  for (const key of candidates) {
    const val = article.fields[key];
    if (typeof val === "string" && val.trim()) {
      return val.trim();
    }
  }
  return "";
}

function articleSummary(article: Article): string {
  const parts: string[] = [article.title];

  // Prefer the explicit appearance field — keeps the un-enhanced prompt
  // focused on visual cues without leaking plot/relationships into FLUX.
  // Fall back to article content so empty-fields articles still get *some*
  // context to work with.
  const appearance = articleAppearance(article);
  if (appearance) {
    parts.push(appearance.slice(0, 600));
  } else {
    const plainContent = tiptapToPlainText(article.content);
    if (plainContent) {
      parts.push(plainContent.slice(0, 600));
    }
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
  parts.push(loreStyleDirective(style));
  parts.push("No text, no runes, no words, no letters");
  return parts.join(". ");
}

/**
 * Build a fallback image prompt for a timeline event.
 */
export function getTimelineEventPrompt(event: TimelineEvent, style: ArtStyle): string {
  const ctx = worldContext();
  const parts: string[] = [
    "16:9 cinematic scene illustration, dramatic atmospheric composition, painterly historical chronicle",
  ];
  if (ctx) parts.push(ctx);
  parts.push(event.title);
  if (event.description) parts.push(event.description);
  parts.push(loreStyleDirective(style));
  parts.push("No text, no runes, no words, no letters");
  return parts.join(". ");
}

/**
 * Build rich entity context for LLM prompt enhancement of a timeline event.
 */
export function getTimelineEventContext(event: TimelineEvent): string {
  const parts: string[] = [
    "Article type: timeline_event",
    `Title: ${event.title}`,
    `Importance: ${event.importance}`,
  ];
  if (event.description) parts.push(`Description: ${event.description}`);

  // Pull in linked article context if present
  if (event.articleId) {
    const articles = useLoreStore.getState().lore?.articles ?? {};
    const linked = articles[event.articleId];
    if (linked) {
      parts.push(`Linked article: ${linked.title} (${linked.template})`);
    }
  }

  const ctx = worldContext();
  if (ctx) parts.push(`World: ${ctx}`);

  return parts.join("\n");
}

/**
 * Pick the auto-default scene subjects when the user hasn't curated them.
 * For event/story templates, surface the single most-frequently-mentioned
 * entity. Other templates default to none — the article's own subject is
 * implicit, and other @mentions tend to be backstory references the LLM
 * shouldn't try to depict.
 */
export function defaultSceneSubjects(article: Article): string[] {
  if (!SCENE_SUBJECT_DEFAULT_TEMPLATES.has(article.template)) return [];
  const counts = extractMentionCounts(article.content);
  if (counts.size === 0) return [];
  let bestId: string | null = null;
  let bestCount = 0;
  for (const [id, n] of counts) {
    if (n > bestCount) {
      bestCount = n;
      bestId = id;
    }
  }
  return bestId ? [bestId] : [];
}

/**
 * Resolve the effective scene subjects for an article. Returns the user's
 * explicit choice when set (including empty for "none"), otherwise the
 * template-driven default.
 */
export function resolveSceneSubjects(article: Article): string[] {
  return article.sceneSubjects ?? defaultSceneSubjects(article);
}

/** Short visual-leaning summary for a referenced subject article. */
function subjectSummary(article: Article): string {
  const appearance = articleAppearance(article);
  if (appearance) return appearance.slice(0, 400);
  const plain = tiptapToPlainText(article.content);
  return plain.slice(0, 400);
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
    parts.push(`Description: ${plainContent.slice(0, 4000)}`);
  }

  const subjectIds = resolveSceneSubjects(article).slice(0, SCENE_SUBJECT_MAX);
  if (subjectIds.length > 0) {
    const articles = useLoreStore.getState().lore?.articles ?? {};
    const lines: string[] = [];
    for (const id of subjectIds) {
      const subject = articles[id];
      if (!subject) continue;
      const summary = subjectSummary(subject);
      const label = `${subject.title} (${subject.template})`;
      lines.push(summary ? `- ${label}: ${summary}` : `- ${label}`);
    }
    if (lines.length > 0) {
      parts.push(
        `Scene subjects (visually depicted in this image — other @mentions in the description are backstory references, not subjects):\n${lines.join("\n")}`,
      );
    }
  }

  const ctx = worldContext();
  if (ctx) parts.push(`World: ${ctx}`);

  return parts.join("\n");
}

/**
 * Build a minimal framing hint for LLM enhancement — format/aspect only,
 * with no visual style or content. The system prompt already carries the
 * world's visualStyle, and the entity context carries the subject; passing
 * the full basePrompt would duplicate the style and let the surface
 * override's example framings ("garden alcoves", etc.) overwhelm the
 * actual entity description.
 */
export function getArticleFraming(article: Article): string {
  const format = FORMAT[article.template];
  return `${format}. No text, no runes, no words, no letters`;
}

/**
 * Minimal framing hint for timeline event LLM enhancement — same rationale
 * as getArticleFraming.
 */
export function getTimelineEventFraming(): string {
  return "16:9 cinematic scene illustration, dramatic atmospheric composition. No text, no runes, no words, no letters";
}
