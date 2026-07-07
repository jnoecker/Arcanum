import type { ItemFile, MobFile, RoomFile, WorldFile } from "@/types/world";
import type { ReferenceSubject } from "@/types/reference";

/**
 * `@token` and `@[Multi Word Name]` reference markers.
 *  - `@aineroia`         → bare slug form (letters, digits, `_`, `-`)
 *  - `@[Crimson Court]`  → bracket form, for names with spaces/punctuation
 */
const TOKEN_RE = /@\[([^\]]+)\]|@([\p{L}\p{N}_-]+)/gu;

export interface TokenMatch {
  /** The full matched text including the `@` (e.g. `@aineroia`). */
  raw: string;
  /** Inner text without the sigil/brackets (e.g. `aineroia`, `Crimson Court`). */
  inner: string;
  /** Normalized lookup key. */
  key: string;
}

/** Normalize a token or name into a stable lookup key. */
export function refKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Turn an arbitrary display name into a bare-token slug. */
export function slugifyToken(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/** Find every `@token` reference in a string. */
export function extractTokens(text: string | undefined | null): TokenMatch[] {
  if (!text) return [];
  const out: TokenMatch[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const inner = (m[1] ?? m[2] ?? "").trim();
    if (!inner) continue;
    out.push({ raw: m[0], inner, key: refKey(inner) });
  }
  return out;
}

export interface MentionQuery {
  /** Index of the leading `@` in the text. */
  start: number;
  /** The partial text typed after the `@` (sigil/bracket removed). */
  query: string;
}

/**
 * Locate an in-progress `@mention` ending exactly at `caret`, for autocomplete.
 * Returns null when the caret isn't inside a fresh `@token` / `@[name` run.
 */
export function detectMention(text: string, caret: number): MentionQuery | null {
  const before = text.slice(0, caret);
  const bracket = before.match(/@\[([^\]\n]*)$/u);
  const bare = bracket ? null : before.match(/@([\p{L}\p{N}_-]*)$/u);
  const m = bracket ?? bare;
  if (!m) return null;
  const start = caret - m[0].length;
  // The `@` must begin a word — never mid-token or right after another `@`.
  const prev = start > 0 ? text[start - 1]! : "";
  if (prev && /[\p{L}\p{N}@]/u.test(prev)) return null;
  return { start, query: (m[1] ?? "").trim() };
}

/** Does the text contain at least one `@token`? */
export function hasTokens(text: string | undefined | null): boolean {
  if (!text) return false;
  TOKEN_RE.lastIndex = 0;
  return TOKEN_RE.test(text);
}

/** Build a key → subject resolver (indexed by both token slug and display name). */
export function buildResolver(subjects: ReferenceSubject[]): Map<string, ReferenceSubject> {
  const m = new Map<string, ReferenceSubject>();
  for (const s of subjects) {
    if (s.token) m.set(refKey(s.token), s);
    if (s.name) m.set(refKey(s.name), s);
  }
  return m;
}

/**
 * Remove the `@` sigil from reference markers, leaving clean human text.
 * This is what gets written to the game YAML.
 *
 * When `known` is supplied, only markers that resolve to a registered subject
 * are stripped — stray `@handles` in prose are left untouched so the
 * transformation never mangles unrelated text.
 */
export function stripSigils(
  text: string,
  known?: Set<string> | Map<string, ReferenceSubject>,
): string {
  if (!text) return text;
  return text.replace(TOKEN_RE, (raw, bracket?: string, bare?: string) => {
    const inner = (bracket ?? bare ?? "").trim();
    if (!inner) return raw;
    if (known && !known.has(refKey(inner))) return raw;
    return inner;
  });
}

export interface ExpandResult {
  /** Prompt text with sigils removed (resolved markers → display name). */
  text: string;
  /** Subjects referenced in the text, in first-seen order, deduped. */
  used: ReferenceSubject[];
  /** Tokens that matched no registered subject. */
  unknown: string[];
}

/**
 * Resolve `@tokens` for image generation: strip the sigils for readability and
 * collect the canonical subjects so the caller can append their appearance to
 * the prompt. Unknown tokens are stripped too (so no stray `@` reaches the
 * model) but reported back for surfacing as a hint.
 */
export function expandReferences(
  text: string | undefined | null,
  resolver: Map<string, ReferenceSubject>,
): ExpandResult {
  if (!text) return { text: text ?? "", used: [], unknown: [] };
  const used: ReferenceSubject[] = [];
  const seen = new Set<string>();
  const unknown: string[] = [];

  const clean = text.replace(TOKEN_RE, (_raw, bracket?: string, bare?: string) => {
    const inner = (bracket ?? bare ?? "").trim();
    if (!inner) return _raw;
    const subject = resolver.get(refKey(inner));
    if (subject) {
      if (!seen.has(subject.id)) {
        seen.add(subject.id);
        used.push(subject);
      }
      return subject.name;
    }
    unknown.push(inner);
    return inner;
  });

  return { text: clean, used, unknown };
}

/** Format the canonical appearance of referenced subjects as a prompt block. */
export function buildReferenceBlock(subjects: ReferenceSubject[]): string {
  if (subjects.length === 0) return "";
  const lines = subjects
    .filter((s) => s.appearance.trim())
    .map((s) => `- ${s.name}: ${s.appearance.trim()}`);
  if (lines.length === 0) return "";
  return `Canonical appearance references — render these subjects exactly as described for visual consistency:\n${lines.join("\n")}`;
}

/**
 * One-shot helper: expand a prompt string and append the reference block.
 * Returns the original text unchanged when there are no resolvable tokens.
 */
export function applyReferences(
  text: string,
  resolver: Map<string, ReferenceSubject>,
): { prompt: string; used: ReferenceSubject[]; unknown: string[] } {
  const { text: clean, used, unknown } = expandReferences(text, resolver);
  const block = buildReferenceBlock(used);
  const prompt = block ? `${clean}\n\n${block}` : clean;
  return { prompt, used, unknown };
}

// ─── WorldFile token-slot traversal ──────────────────────────────────
// Token persistence is scoped to the entity fields that drive art
// generation: the descriptions and names/titles of rooms, mobs, and items.
// Description slots keep the bare `<kind>/<entityId>` key so annotation
// files written before name support round-trip unchanged.

export interface TokenSlot {
  /** Stable key: `<kind>/<entityId>` (description) or `<kind>/<entityId>/name`. */
  key: string;
  text: string;
}

/** Collect every token-bearing field of every art-bearing entity in a world. */
export function collectTokenSlots(world: WorldFile): TokenSlot[] {
  const slots: TokenSlot[] = [];
  for (const [id, room] of Object.entries(world.rooms ?? {})) {
    if (typeof room.description === "string") slots.push({ key: `room/${id}`, text: room.description });
    if (typeof room.title === "string") slots.push({ key: `room/${id}/name`, text: room.title });
  }
  for (const [id, mob] of Object.entries(world.mobs ?? {})) {
    if (typeof mob.description === "string") slots.push({ key: `mob/${id}`, text: mob.description });
    if (typeof mob.name === "string") slots.push({ key: `mob/${id}/name`, text: mob.name });
  }
  for (const [id, item] of Object.entries(world.items ?? {})) {
    if (typeof item.description === "string") slots.push({ key: `item/${id}`, text: item.description });
    if (typeof item.displayName === "string") slots.push({ key: `item/${id}/name`, text: item.displayName });
  }
  return slots;
}

function mapEntitySlots<T>(
  kind: string,
  id: string,
  entity: T,
  descField: keyof T & string,
  nameField: keyof T & string,
  fn: (key: string, text: string) => string,
  descFallback: string | undefined,
): T {
  let next = entity;
  const desc = entity[descField] as unknown;
  const descText = typeof desc === "string" ? desc : descFallback;
  if (typeof descText === "string") {
    const updated = fn(`${kind}/${id}`, descText);
    if (updated !== desc) next = { ...next, [descField]: updated } as T;
  }
  const name = entity[nameField] as unknown;
  if (typeof name === "string") {
    const updated = fn(`${kind}/${id}/name`, name);
    if (updated !== name) next = { ...next, [nameField]: updated } as T;
  }
  return next;
}

/**
 * Return a shallow-cloned world with every art-bearing description and
 * name/title rewritten by `fn`. Only the entities that change are reallocated.
 */
export function mapTokenSlots(
  world: WorldFile,
  fn: (key: string, text: string) => string,
): WorldFile {
  const next: WorldFile = { ...world };

  const rooms = world.rooms ?? {};
  let roomsChanged = false;
  const nextRooms: Record<string, RoomFile> = {};
  for (const [id, room] of Object.entries(rooms)) {
    const updated = mapEntitySlots("room", id, room, "description", "title", fn, "");
    nextRooms[id] = updated;
    if (updated !== room) roomsChanged = true;
  }
  if (roomsChanged) next.rooms = nextRooms;

  if (world.mobs) {
    let changed = false;
    const nextMobs: Record<string, MobFile> = {};
    for (const [id, mob] of Object.entries(world.mobs)) {
      const updated = mapEntitySlots("mob", id, mob, "description", "name", fn, undefined);
      nextMobs[id] = updated;
      if (updated !== mob) changed = true;
    }
    if (changed) next.mobs = nextMobs;
  }

  if (world.items) {
    let changed = false;
    const nextItems: Record<string, ItemFile> = {};
    for (const [id, item] of Object.entries(world.items)) {
      const updated = mapEntitySlots("item", id, item, "description", "displayName", fn, undefined);
      nextItems[id] = updated;
      if (updated !== item) changed = true;
    }
    if (changed) next.items = nextItems;
  }

  return next;
}
