import type { Article, WorldLore } from "@/types/lore";
import { extractMentions, tiptapToPlainText } from "./loreRelations";
import { retrieveLoreContext } from "@/lib/rag";
import type { RetrievedChunk } from "@/lib/rag/types";

export interface LoreChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface LoreChatPrompt {
  systemPrompt: string;
  userPrompt: string;
  /** IDs of articles included in the context — useful for debugging / citations. */
  articlesUsed: string[];
}

export interface BuildLoreChatPromptOptions {
  worldName?: string;
}

const SMALL_WORLD_THRESHOLD = 40;
const MAX_SELECTED_ARTICLES = 60;
const PRIMARY_MATCH_CAP = 30;
const CONTENT_SNIPPET_CHARS = 500;
const HISTORY_TURNS_USED_FOR_RETRIEVAL = 2;
const MAX_HISTORY_TURNS_IN_PROMPT = 10;
const RAG_K = 30;
const MAX_FRAGMENTS = 20;

function tokenize(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
}

function stringifyFieldValue(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map((x) => stringifyFieldValue(x)).filter(Boolean).join(", ");
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return "";
    }
  }
  return String(v);
}

function fieldsToString(fields: Record<string, unknown> | undefined): string {
  if (!fields) return "";
  const entries: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    const rendered = stringifyFieldValue(v).trim();
    if (rendered && rendered !== "[]" && rendered !== "{}") {
      entries.push(`${k}: ${rendered}`);
    }
  }
  return entries.join(" | ");
}

function articleBlock(
  article: Article,
  allArticles: Record<string, Article>,
): string {
  const lines: string[] = [];
  lines.push(`[${article.title}]`);
  lines.push(`kind: ${article.template}${article.draft ? " (draft)" : ""}`);
  if (article.tags?.length) lines.push(`tags: ${article.tags.join(", ")}`);
  if (article.parentId && allArticles[article.parentId]) {
    lines.push(`parent: ${allArticles[article.parentId]!.title}`);
  }
  if (article.relations?.length) {
    const relStrs: string[] = [];
    for (const r of article.relations) {
      const target = allArticles[r.targetId];
      if (target) {
        const label = r.label ? ` (${r.label})` : "";
        relStrs.push(`${r.type} → ${target.title}${label}`);
      }
    }
    if (relStrs.length) lines.push(`relations: ${relStrs.join("; ")}`);
  }
  const fieldStr = fieldsToString(article.fields);
  if (fieldStr) lines.push(`fields: ${fieldStr}`);

  const plain = tiptapToPlainText(article.content ?? "").trim();
  if (plain) {
    const snippet = plain.length > CONTENT_SNIPPET_CHARS
      ? `${plain.slice(0, CONTENT_SNIPPET_CHARS).trimEnd()}…`
      : plain;
    lines.push(snippet);
  }
  return lines.join("\n");
}

function selectArticlesSmallWorld(
  articles: Record<string, Article>,
): Article[] {
  return Object.values(articles);
}

/**
 * Build a map from articleId → set of article IDs that mention it via @mentions
 * in their TipTap content. Used to expand retrieval so that facts living on
 * a *different* article (e.g. "Astriel created the Sylflorae" on Astriel's
 * page) still surface when the question names the mentioned subject.
 */
function buildMentionIndex(
  articles: Record<string, Article>,
): { forward: Map<string, Set<string>>; backward: Map<string, Set<string>> } {
  const forward = new Map<string, Set<string>>();
  const backward = new Map<string, Set<string>>();
  for (const a of Object.values(articles)) {
    const mentions = extractMentions(a.content ?? "");
    if (mentions.length === 0) continue;
    const outgoing = new Set<string>();
    for (const m of mentions) {
      if (!articles[m.targetId]) continue;
      if (m.targetId === a.id) continue;
      outgoing.add(m.targetId);
      let back = backward.get(m.targetId);
      if (!back) {
        back = new Set<string>();
        backward.set(m.targetId, back);
      }
      back.add(a.id);
    }
    if (outgoing.size > 0) forward.set(a.id, outgoing);
  }
  return { forward, backward };
}

function selectArticlesLargeWorld(
  articles: Record<string, Article>,
  question: string,
  history: LoreChatTurn[],
): Article[] {
  const queryTokens = new Set<string>();
  for (const t of tokenize(question)) queryTokens.add(t);
  const recent = history.slice(-HISTORY_TURNS_USED_FOR_RETRIEVAL);
  for (const turn of recent) {
    for (const t of tokenize(turn.content)) queryTokens.add(t);
  }

  if (queryTokens.size === 0) {
    return Object.values(articles).slice(0, MAX_SELECTED_ARTICLES);
  }

  const scored: Array<{ article: Article; score: number }> = [];
  for (const a of Object.values(articles)) {
    const titleLower = a.title.toLowerCase();
    const haystack = [
      a.title,
      a.template,
      (a.tags ?? []).join(" "),
      fieldsToString(a.fields),
      tiptapToPlainText(a.content ?? ""),
    ].join(" ").toLowerCase();

    let score = 0;
    for (const tok of queryTokens) {
      if (titleLower.includes(tok)) score += 3;
      else if (haystack.includes(tok)) score += 1;
    }
    if (score > 0) scored.push({ article: a, score });
  }
  scored.sort((a, b) => b.score - a.score);

  const { forward, backward } = buildMentionIndex(articles);
  const primary = scored.slice(0, PRIMARY_MATCH_CAP).map((s) => s.article);
  const expanded = new Map<string, Article>();
  for (const a of primary) {
    expanded.set(a.id, a);
    if (a.parentId && articles[a.parentId]) {
      expanded.set(a.parentId, articles[a.parentId]!);
    }
    for (const r of a.relations ?? []) {
      const target = articles[r.targetId];
      if (target) expanded.set(target.id, target);
    }
    const outgoing = forward.get(a.id);
    if (outgoing) {
      for (const id of outgoing) {
        const target = articles[id];
        if (target) expanded.set(id, target);
      }
    }
    const incoming = backward.get(a.id);
    if (incoming) {
      for (const id of incoming) {
        const source = articles[id];
        if (source) expanded.set(id, source);
      }
    }
  }
  return Array.from(expanded.values()).slice(0, MAX_SELECTED_ARTICLES);
}

/**
 * Build a prompt pair for the lore chat assistant. The system prompt carries
 * the retrieved lore context + citation instructions; the user prompt carries
 * the conversation history and the new question.
 *
 * Retrieval strategy:
 * - Small worlds (≤40 articles) get every article — no retrieval needed.
 * - Larger worlds try RAG first (semantic embedding search over articles,
 *   events, pins, relationships, entity descriptions), then fall back to
 *   the legacy token-match + relation/mention expansion if RAG is empty
 *   (no index built yet) or unavailable.
 */
export async function buildLoreChatPrompt(
  lore: WorldLore,
  question: string,
  history: LoreChatTurn[] = [],
  options: BuildLoreChatPromptOptions = {},
): Promise<LoreChatPrompt> {
  const articles = lore.articles ?? {};
  const articleList = Object.values(articles);

  if (articleList.length <= SMALL_WORLD_THRESHOLD) {
    return assemblePrompt(
      selectArticlesSmallWorld(articles),
      [],
      articles,
      question,
      history,
      options,
    );
  }

  try {
    const queryParts = [
      question,
      ...history
        .slice(-HISTORY_TURNS_USED_FOR_RETRIEVAL)
        .map((t) => t.content),
    ];
    const chunks = await retrieveLoreContext({
      query: queryParts.join("\n"),
      k: RAG_K,
    });
    if (chunks.length > 0) {
      const { articleHits, fragments } = splitChunks(chunks, articles);
      return assemblePrompt(articleHits, fragments, articles, question, history, options);
    }
  } catch (e) {
    console.warn("[loreChat] RAG retrieval failed; using token-match fallback", e);
  }

  return assemblePrompt(
    selectArticlesLargeWorld(articles, question, history),
    [],
    articles,
    question,
    history,
    options,
  );
}

interface ChunkFragment {
  kind: string;
  title: string;
  body: string;
}

function splitChunks(
  chunks: RetrievedChunk[],
  articles: Record<string, Article>,
): { articleHits: Article[]; fragments: ChunkFragment[] } {
  const seenArticles = new Set<string>();
  const articleHits: Article[] = [];
  const fragments: ChunkFragment[] = [];
  for (const c of chunks) {
    if (c.kind === "article") {
      if (seenArticles.has(c.source_id)) continue;
      const a = articles[c.source_id];
      if (a) {
        seenArticles.add(c.source_id);
        articleHits.push(a);
      }
    } else {
      fragments.push({ kind: c.kind, title: c.title, body: c.body });
    }
  }
  return {
    articleHits: articleHits.slice(0, MAX_SELECTED_ARTICLES),
    fragments: fragments.slice(0, MAX_FRAGMENTS),
  };
}

function fragmentBlock(f: ChunkFragment): string {
  const label = f.kind.charAt(0).toUpperCase() + f.kind.slice(1);
  return `[${label}: ${f.title}]\n${f.body.trim()}`;
}

function assemblePrompt(
  selected: Article[],
  fragments: ChunkFragment[],
  articles: Record<string, Article>,
  question: string,
  history: LoreChatTurn[],
  options: BuildLoreChatPromptOptions,
): LoreChatPrompt {
  const lorePart = selected.length > 0
    ? selected.map((a) => articleBlock(a, articles)).join("\n\n---\n\n")
    : "(No articles yet — the world is unwritten.)";

  const fragmentsPart = fragments.length > 0
    ? fragments.map(fragmentBlock).join("\n\n---\n\n")
    : "";

  const worldLabel = options.worldName?.trim() || "this world";

  const sections = [
    `You are the lore archivist for ${worldLabel}. The user is the world's creator, asking you questions about the world they've written.`,
    ``,
    `Ground every answer in the articles below. When the lore doesn't cover something, say so plainly — do not invent facts, names, or relationships. If a thoughtful next step would help the creator, offer it.`,
    ``,
    `Cite articles inline using square brackets containing the exact title, e.g. [Veilspire Pact]. Cite only titles that appear in the list below; never invent titles. Keep citations natural — don't list them all at the end.`,
    ``,
    `Answer concisely. Two or three short paragraphs at most. Prefer specificity over generality.`,
    ``,
    `=== LORE ARTICLES ===`,
    lorePart,
    `=== END LORE ===`,
  ];
  if (fragmentsPart) {
    sections.push(
      ``,
      `=== ADDITIONAL LORE FRAGMENTS (events, map pins, relationships, entity descriptions) ===`,
      fragmentsPart,
      `=== END FRAGMENTS ===`,
    );
  }
  const systemPrompt = sections.join("\n");

  const trimmedHistory = history.slice(-MAX_HISTORY_TURNS_IN_PROMPT);
  const lines: string[] = [];
  for (const turn of trimmedHistory) {
    lines.push(`${turn.role === "user" ? "User" : "Archivist"}: ${turn.content}`);
  }
  lines.push(`User: ${question}`);
  lines.push(`Archivist:`);
  const userPrompt = lines.join("\n\n");

  return {
    systemPrompt,
    userPrompt,
    articlesUsed: selected.map((a) => a.id),
  };
}

/**
 * Parse an assistant response into segments, splitting out `[Article Title]`
 * citations so the UI can render them as clickable links. Titles are matched
 * case-insensitively against the article registry so minor casing differences
 * in the model's output don't break linking.
 */
export type ChatSegment =
  | { kind: "text"; text: string }
  | { kind: "citation"; text: string; articleId: string | null };

export function parseChatSegments(
  text: string,
  articles: Record<string, Article>,
): ChatSegment[] {
  const titleIndex = new Map<string, string>();
  for (const a of Object.values(articles)) {
    titleIndex.set(a.title.toLowerCase(), a.id);
  }

  const segments: ChatSegment[] = [];
  const regex = /\[([^\]\n]{1,120})\]/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > cursor) {
      segments.push({ kind: "text", text: text.slice(cursor, m.index) });
    }
    const inner = m[1]!.trim();
    const articleId = titleIndex.get(inner.toLowerCase()) ?? null;
    if (articleId) {
      segments.push({ kind: "citation", text: inner, articleId });
    } else {
      segments.push({ kind: "text", text: m[0] });
    }
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) {
    segments.push({ kind: "text", text: text.slice(cursor) });
  }
  return segments;
}
