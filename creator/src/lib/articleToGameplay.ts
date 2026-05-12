import { invoke } from "@tauri-apps/api/core";
import { useLoreStore } from "@/stores/loreStore";
import type { Article } from "@/types/lore";
import type {
  AbilityDefinitionConfig,
  AbilityEffectConfig,
  ClassDefinitionConfig,
  RaceDefinitionConfig,
} from "@/types/config";
import { tiptapToPlainText } from "@/lib/loreRelations";
import { getEffectiveSections } from "@/lib/loreSections";
import { buildToneDirective } from "@/lib/loreGeneration";
import { buildRagContext, type RetrievalDiagnostic } from "@/lib/rag/loreContext";
import { AI_ENABLED } from "@/lib/featureFlags";

// ─── Shared plumbing ────────────────────────────────────────────────

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

function articleFieldSummary(article: Article): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(article.fields)) {
    if (v == null || v === "") continue;
    const rendered = Array.isArray(v) ? v.join(", ") : String(v);
    if (rendered.length === 0) continue;
    out.push(`${k}: ${rendered}`);
  }
  return out.join("\n");
}

function idFromTitle(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return base || "untitled";
}

function parseGameplayJson(raw: string): Record<string, unknown> {
  const trimmed = raw.trim().replace(/^```json?\s*/i, "").replace(/\s*```\s*$/, "");
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function asString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed ? trimmed : undefined;
}

function asNumber(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x.trim() : "")).filter((x) => x.length > 0);
}

function asStatMap(v: unknown): Record<string, number> {
  if (v == null || typeof v !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const n = typeof val === "number" ? val : typeof val === "string" ? Number(val) : NaN;
    if (Number.isFinite(n) && n !== 0) {
      out[k.trim()] = Math.round(n);
    }
  }
  return out;
}

// ─── Class scaffold ─────────────────────────────────────────────────

export interface ClassScaffoldResult {
  id: string;
  config: ClassDefinitionConfig;
  /** Class-related abilities the model suggested. The user can fold these
   *  in via #240 (Talent generator) later; we surface them here so the
   *  proposal screen can hint at what to build next. */
  suggestedAbilities: string[];
  diagnostic: RetrievalDiagnostic;
  /** True when the article's title already collides with an existing class
   *  id or displayName — the proposal screen warns and disables Accept
   *  unless the user picks a different id. */
  collidesWithExisting: boolean;
}

interface ScaffoldClassOptions {
  article: Article;
  existingClassIds: Set<string>;
  existingClassDisplayNames: Set<string>;
}

export async function generateClassFromArticle(
  opts: ScaffoldClassOptions,
): Promise<ClassScaffoldResult> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");

  const { article, existingClassIds, existingClassDisplayNames } = opts;
  const body = articleBodyPlainText(article);
  const fieldSummary = articleFieldSummary(article);
  const toneDirective = buildToneDirective();

  const { context: ragContext, diagnostic } = await buildRagContext({
    query: `${article.title} class — role, primary stat, resource, key abilities, magic system`,
    excludeSourceIds: [article.id],
    k: 12,
    maxChars: 6000,
    fallback: () => "",
  });

  const systemPrompt = `You are scaffolding a player CLASS for a fantasy MUD from a worldbuilding article. Output a JSON object the gameplay layer can consume directly. Do NOT invent claims absent from the article and lore context; instead, leave fields blank when the source doesn't support them.

JSON shape:
{
  "id": "snake_case_slug",
  "displayName": "Title Case",
  "description": "One short line shown in the class roster.",
  "backstory": "1-3 short paragraphs of in-world history grounded in the article.",
  "hpPerLevel": 8-20,
  "manaPerLevel": 0-20,
  "primaryStat": "strength | intelligence | wisdom | dexterity | constitution | charisma | <other>",
  "outfitDescription": "Iconic look — armor, garb, weapons, stance. For sprite generation.",
  "suggestedAbilities": ["ability name 1", "ability name 2", ...]
}

Rules:
- hp/mana per level pace classes against each other: a tank/martial archetype gets high hp (16-20) and low mana (0-4); a caster gets lower hp (8-12) and high mana (14-20); hybrids land in the middle.
- The id is the slug form of the title (lowercase, underscores, no punctuation).
- suggestedAbilities is a short list of 3-6 names — concrete enough that an ability designer can act on them, but not full definitions.
- Output ONLY valid JSON — no markdown fences, no preamble, no trailing commentary.${toneDirective ? `\n\nVoice directive for backstory and description:\n${toneDirective}` : ""}`;

  const userPromptParts: string[] = [
    `Article title: ${article.title}`,
    article.template === "class" ? "Article template: class (playable)" : `Article template: ${article.template}`,
  ];
  if (fieldSummary) userPromptParts.push("", "Article fields:", fieldSummary);
  if (body) userPromptParts.push("", "Article body:", body);
  if (ragContext) userPromptParts.push("", "Related lore context:", ragContext);
  userPromptParts.push("", "Output the JSON now.");

  const raw = await invoke<string>("llm_complete", {
    systemPrompt,
    userPrompt: userPromptParts.join("\n"),
    maxTokens: 1536,
  });
  const parsed = parseGameplayJson(raw);

  const fallbackId = idFromTitle(article.title);
  const id = asString(parsed.id) ?? fallbackId;
  const displayName = asString(parsed.displayName) ?? article.title;

  const config: ClassDefinitionConfig = {
    displayName,
    description: asString(parsed.description),
    backstory: asString(parsed.backstory),
    hpPerLevel: asNumber(parsed.hpPerLevel, 12, 1, 50),
    manaPerLevel: asNumber(parsed.manaPerLevel, 10, 0, 50),
    primaryStat: asString(parsed.primaryStat),
    selectable: true,
    outfitDescription: asString(parsed.outfitDescription),
  };

  const collidesWithExisting =
    existingClassIds.has(id.toLowerCase()) ||
    existingClassDisplayNames.has(displayName.toLowerCase());

  return {
    id,
    config,
    suggestedAbilities: asStringArray(parsed.suggestedAbilities),
    diagnostic,
    collidesWithExisting,
  };
}

// ─── Race scaffold ──────────────────────────────────────────────────

export interface RaceScaffoldResult {
  id: string;
  config: RaceDefinitionConfig;
  diagnostic: RetrievalDiagnostic;
  collidesWithExisting: boolean;
}

interface ScaffoldRaceOptions {
  article: Article;
  existingRaceIds: Set<string>;
  existingRaceDisplayNames: Set<string>;
}

export async function generateRaceFromArticle(
  opts: ScaffoldRaceOptions,
): Promise<RaceScaffoldResult> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");

  const { article, existingRaceIds, existingRaceDisplayNames } = opts;
  const body = articleBodyPlainText(article);
  const fieldSummary = articleFieldSummary(article);
  const toneDirective = buildToneDirective();

  const { context: ragContext, diagnostic } = await buildRagContext({
    query: `${article.title} ancestry — heritage, traits, stat tendencies, signature abilities, body description`,
    excludeSourceIds: [article.id],
    k: 12,
    maxChars: 6000,
    fallback: () => "",
  });

  const systemPrompt = `You are scaffolding a player RACE (ancestry) for a fantasy MUD from a worldbuilding article. Output a JSON object the gameplay layer can consume directly. Do NOT invent claims absent from the article and lore context; instead, leave fields blank when the source doesn't support them.

JSON shape:
{
  "id": "snake_case_slug",
  "displayName": "Title Case",
  "description": "One short line shown in the race roster.",
  "backstory": "1-3 short paragraphs of in-world heritage grounded in the article.",
  "traits": ["trait one", "trait two", ...],
  "abilities": ["signature ability name 1", ...],
  "statMods": { "strength": 1, "intelligence": -1, ... },
  "bodyDescription": "Concrete physical description suitable for sprite generation — body shape, proportions, distinguishing features. NO clothing or outfits."
}

Rules:
- statMods is small adjustments in the range -2..+2 against the standard stats (strength, intelligence, wisdom, dexterity, constitution, charisma). Use only the stats the article actually supports. Omit zero values.
- traits is short tag-style phrases (1-4 words each), not paragraphs.
- abilities is a short list of named signature abilities (3-6 entries) — concrete enough that an ability designer can act on them, but not full definitions.
- bodyDescription is physical only. No clothing, garb, or accessories — those belong on classes.
- The id is the slug form of the title (lowercase, underscores, no punctuation).
- Output ONLY valid JSON — no markdown fences, no preamble, no trailing commentary.${toneDirective ? `\n\nVoice directive for backstory and description:\n${toneDirective}` : ""}`;

  const userPromptParts: string[] = [
    `Article title: ${article.title}`,
    article.template === "ancestry" ? "Article template: ancestry (playable)" : `Article template: ${article.template}`,
  ];
  if (fieldSummary) userPromptParts.push("", "Article fields:", fieldSummary);
  if (body) userPromptParts.push("", "Article body:", body);
  if (ragContext) userPromptParts.push("", "Related lore context:", ragContext);
  userPromptParts.push("", "Output the JSON now.");

  const raw = await invoke<string>("llm_complete", {
    systemPrompt,
    userPrompt: userPromptParts.join("\n"),
    maxTokens: 1536,
  });
  const parsed = parseGameplayJson(raw);

  const fallbackId = idFromTitle(article.title);
  const id = asString(parsed.id) ?? fallbackId;
  const displayName = asString(parsed.displayName) ?? article.title;

  const config: RaceDefinitionConfig = {
    displayName,
    description: asString(parsed.description),
    backstory: asString(parsed.backstory),
    traits: asStringArray(parsed.traits),
    abilities: asStringArray(parsed.abilities),
    statMods: asStatMap(parsed.statMods),
    bodyDescription: asString(parsed.bodyDescription),
    selectable: true,
  };

  const collidesWithExisting =
    existingRaceIds.has(id.toLowerCase()) ||
    existingRaceDisplayNames.has(displayName.toLowerCase());

  return {
    id,
    config,
    diagnostic,
    collidesWithExisting,
  };
}

// ─── Ability scaffolds (talent + creature power) ────────────────────

const EFFECT_TYPES = new Set([
  "DIRECT_DAMAGE",
  "AREA_DAMAGE",
  "DIRECT_HEAL",
  "APPLY_STATUS",
  "TAUNT",
  "SUMMON_PET",
]);

const TARGET_TYPES = new Set(["self", "ally", "enemy", "area"]);

const TALENT_TIER_FROM_STRING: Record<string, number> = {
  novice: 0,
  adept: 1,
  master: 2,
  transcendent: 3,
};

export interface AbilityScaffoldResult {
  id: string;
  config: AbilityDefinitionConfig;
  diagnostic: RetrievalDiagnostic;
  collidesWithExisting: boolean;
}

interface ScaffoldAbilityOptions {
  article: Article;
  existingAbilityIds: Set<string>;
  existingAbilityDisplayNames: Set<string>;
}

function asEffect(v: unknown): AbilityEffectConfig {
  if (typeof v !== "object" || v === null) {
    return { type: "DIRECT_DAMAGE" };
  }
  const raw = v as Record<string, unknown>;
  const typeRaw = asString(raw.type)?.toUpperCase() ?? "";
  const type = EFFECT_TYPES.has(typeRaw) ? typeRaw : "DIRECT_DAMAGE";
  const out: AbilityEffectConfig = { type };
  for (const key of [
    "value",
    "minDamage",
    "maxDamage",
    "damagePerLevel",
    "minHeal",
    "maxHeal",
    "healPerLevel",
    "flatThreat",
    "margin",
    "durationMs",
  ] as const) {
    const n = typeof raw[key] === "number" ? raw[key] : Number(raw[key]);
    if (Number.isFinite(n)) (out as unknown as Record<string, unknown>)[key] = Math.round(n as number);
  }
  if (typeof raw.statusEffectId === "string" && raw.statusEffectId.trim()) {
    out.statusEffectId = raw.statusEffectId.trim();
  }
  if (typeof raw.petTemplateKey === "string" && raw.petTemplateKey.trim()) {
    out.petTemplateKey = raw.petTemplateKey.trim();
  }
  return out;
}

function asTargetType(v: unknown): string {
  const t = asString(v)?.toLowerCase() ?? "";
  return TARGET_TYPES.has(t) ? t : "enemy";
}

function tierToNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
  if (typeof v === "string") {
    const mapped = TALENT_TIER_FROM_STRING[v.toLowerCase().trim()];
    if (mapped !== undefined) return mapped;
    const n = Number(v);
    if (Number.isFinite(n)) return Math.max(0, Math.round(n));
  }
  return undefined;
}

/** Find the linked class article (via the new `owningClass` field, falling
 *  back to the legacy `profession` field). Returns the class displayName
 *  suitable for `requiredClass` on the config row, or undefined. */
function resolveOwningClass(article: Article): string | undefined {
  const lore = useLoreStore.getState().lore;
  const articles = lore?.articles ?? {};
  const ref = (article.fields.owningClass as string | undefined) ??
              (article.fields.profession as string | undefined);
  if (!ref) return undefined;
  const linked = articles[ref];
  if (!linked) return undefined;
  // Use the display name's slug form so it matches the gameplay class id.
  return idFromTitle(linked.title);
}

export async function generateTalentFromArticle(
  opts: ScaffoldAbilityOptions,
): Promise<AbilityScaffoldResult> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");

  const { article, existingAbilityIds, existingAbilityDisplayNames } = opts;
  const body = articleBodyPlainText(article);
  const fieldSummary = articleFieldSummary(article);
  const toneDirective = buildToneDirective();
  const owningClass = resolveOwningClass(article);

  const { context: ragContext, diagnostic } = await buildRagContext({
    query: `${article.title} talent — ${owningClass ?? "class ability"} cost cooldown range effect`,
    excludeSourceIds: [article.id],
    k: 10,
    maxChars: 5000,
    fallback: () => "",
  });

  const systemPrompt = `You are scaffolding a player TALENT (player-pickable ability) for a fantasy MUD from a worldbuilding article. Output an AbilityDefinitionConfig JSON the gameplay engine can consume directly. Do NOT invent claims absent from the article and lore context; leave fields blank when the source doesn't support them.

JSON shape:
{
  "id": "snake_case_slug",
  "displayName": "Title Case",
  "description": "One-line summary surfaced in the spellbook.",
  "manaCost": 0-100,
  "cooldownMs": 0-300000,
  "levelRequired": 1-60,
  "targetType": "self | ally | enemy | area",
  "requiredClass": "owning_class_id",
  "tier": 0|1|2|3,
  "effect": {
    "type": "DIRECT_DAMAGE | AREA_DAMAGE | DIRECT_HEAL | APPLY_STATUS | TAUNT | SUMMON_PET",
    "minDamage": int, "maxDamage": int, "damagePerLevel": number,
    "minHeal": int, "maxHeal": int, "healPerLevel": number,
    "statusEffectId": "string", "durationMs": int
  }
}

Rules:
- Effect type matches the action: damage attacks → DIRECT_DAMAGE / AREA_DAMAGE; heals → DIRECT_HEAL; buffs/debuffs → APPLY_STATUS; taunts → TAUNT; summons → SUMMON_PET.
- Set the numeric fields that suit the effect type and leave the rest unset (do not return 0 for fields that aren't relevant).
- tier 0 = entry, 3 = capstone. Match the article's "Tier" field when set.
- The id is the slug form of the title (lowercase, underscores, no punctuation).
- Output ONLY valid JSON — no markdown fences, no preamble, no trailing commentary.${toneDirective ? `\n\nVoice directive for description:\n${toneDirective}` : ""}`;

  const userPromptParts: string[] = [
    `Article title: ${article.title}`,
    article.template === "talent" ? "Article template: talent (player)" : `Article template: ${article.template}`,
  ];
  if (owningClass) userPromptParts.push(`Owning class (linked): ${owningClass}`);
  if (fieldSummary) userPromptParts.push("", "Article fields:", fieldSummary);
  if (body) userPromptParts.push("", "Article body:", body);
  if (ragContext) userPromptParts.push("", "Related lore context:", ragContext);
  userPromptParts.push("", "Output the JSON now.");

  const raw = await invoke<string>("llm_complete", {
    systemPrompt,
    userPrompt: userPromptParts.join("\n"),
    maxTokens: 1024,
  });
  const parsed = parseGameplayJson(raw);

  const id = asString(parsed.id) ?? idFromTitle(article.title);
  const displayName = asString(parsed.displayName) ?? article.title;
  const requiredClass = asString(parsed.requiredClass) ?? owningClass;
  const tier = tierToNumber(parsed.tier);

  const config: AbilityDefinitionConfig = {
    displayName,
    description: asString(parsed.description),
    manaCost: asNumber(parsed.manaCost, 10, 0, 500),
    cooldownMs: asNumber(parsed.cooldownMs, 5000, 0, 600000),
    levelRequired: asNumber(parsed.levelRequired, 1, 1, 100),
    targetType: asTargetType(parsed.targetType),
    effect: asEffect(parsed.effect),
    scope: "player",
  };
  if (requiredClass) config.requiredClass = requiredClass;
  if (tier !== undefined) config.tier = tier;

  const collidesWithExisting =
    existingAbilityIds.has(id.toLowerCase()) ||
    existingAbilityDisplayNames.has(displayName.toLowerCase());

  return { id, config, diagnostic, collidesWithExisting };
}

export async function generateCreaturePowerFromArticle(
  opts: ScaffoldAbilityOptions,
): Promise<AbilityScaffoldResult> {
  if (!AI_ENABLED) throw new Error("AI features are not available in Community Edition");

  const { article, existingAbilityIds, existingAbilityDisplayNames } = opts;
  const body = articleBodyPlainText(article);
  const fieldSummary = articleFieldSummary(article);
  const toneDirective = buildToneDirective();

  const { context: ragContext, diagnostic } = await buildRagContext({
    query: `${article.title} creature power — danger level frequency effect signature attack`,
    excludeSourceIds: [article.id],
    k: 10,
    maxChars: 5000,
    fallback: () => "",
  });

  const systemPrompt = `You are scaffolding a CREATURE POWER (a non-player ability — boss mechanic, mythic move, or signature creature attack) for a fantasy MUD from a worldbuilding article. Output an AbilityDefinitionConfig JSON the gameplay engine can consume directly. Do NOT invent claims absent from the article and lore context; leave fields blank when the source doesn't support them.

JSON shape:
{
  "id": "snake_case_slug",
  "displayName": "Title Case",
  "description": "One-line summary, written from a third-person observer's perspective.",
  "manaCost": 0,
  "cooldownMs": 0-600000,
  "levelRequired": 1-100,
  "targetType": "self | ally | enemy | area",
  "effect": {
    "type": "DIRECT_DAMAGE | AREA_DAMAGE | DIRECT_HEAL | APPLY_STATUS",
    "minDamage": int, "maxDamage": int, "damagePerLevel": number,
    "minHeal": int, "maxHeal": int, "healPerLevel": number,
    "statusEffectId": "string", "durationMs": int
  }
}

Rules:
- This is a creature power, NOT a player talent. Do not set requiredClass.
- manaCost should usually be 0 — creatures don't pay mana.
- levelRequired reflects the encounter tier where this power becomes threatening.
- cooldownMs controls frequency: signature once-per-encounter moves get high cooldowns (60000+), rapid-fire attacks get low ones.
- Effect type matches the action: most creature powers are DIRECT_DAMAGE / AREA_DAMAGE / APPLY_STATUS.
- The id is the slug form of the title (lowercase, underscores, no punctuation).
- Output ONLY valid JSON — no markdown fences, no preamble, no trailing commentary.${toneDirective ? `\n\nVoice directive for description:\n${toneDirective}` : ""}`;

  const userPromptParts: string[] = [
    `Article title: ${article.title}`,
    article.template === "creature_power"
      ? "Article template: creature_power (NPC / mythic)"
      : `Article template: ${article.template}`,
  ];
  if (fieldSummary) userPromptParts.push("", "Article fields:", fieldSummary);
  if (body) userPromptParts.push("", "Article body:", body);
  if (ragContext) userPromptParts.push("", "Related lore context:", ragContext);
  userPromptParts.push("", "Output the JSON now.");

  const raw = await invoke<string>("llm_complete", {
    systemPrompt,
    userPrompt: userPromptParts.join("\n"),
    maxTokens: 1024,
  });
  const parsed = parseGameplayJson(raw);

  const id = asString(parsed.id) ?? idFromTitle(article.title);
  const displayName = asString(parsed.displayName) ?? article.title;

  const config: AbilityDefinitionConfig = {
    displayName,
    description: asString(parsed.description),
    manaCost: asNumber(parsed.manaCost, 0, 0, 500),
    cooldownMs: asNumber(parsed.cooldownMs, 15000, 0, 600000),
    levelRequired: asNumber(parsed.levelRequired, 1, 1, 100),
    targetType: asTargetType(parsed.targetType),
    effect: asEffect(parsed.effect),
    scope: "creature",
  };

  const collidesWithExisting =
    existingAbilityIds.has(id.toLowerCase()) ||
    existingAbilityDisplayNames.has(displayName.toLowerCase());

  return { id, config, diagnostic, collidesWithExisting };
}
