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

// ─── WorldFile description traversal ─────────────────────────────────
// Token persistence is scoped to the entity descriptions that drive art
// generation: rooms, mobs, and items.

export interface DescriptionSlot {
  /** Stable per-entity key: `<kind>/<entityId>`. */
  key: string;
  text: string;
}

/** Collect the description of every art-bearing entity in a world. */
export function collectDescriptions(world: WorldFile): DescriptionSlot[] {
  const slots: DescriptionSlot[] = [];
  for (const [id, room] of Object.entries(world.rooms ?? {})) {
    if (typeof room.description === "string") slots.push({ key: `room/${id}`, text: room.description });
  }
  for (const [id, mob] of Object.entries(world.mobs ?? {})) {
    if (typeof mob.description === "string") slots.push({ key: `mob/${id}`, text: mob.description });
  }
  for (const [id, item] of Object.entries(world.items ?? {})) {
    if (typeof item.description === "string") slots.push({ key: `item/${id}`, text: item.description });
  }
  return slots;
}

/**
 * Return a shallow-cloned world with every art-bearing description rewritten
 * by `fn`. Only the entities whose description changes are reallocated.
 */
export function mapDescriptions(
  world: WorldFile,
  fn: (key: string, text: string) => string,
): WorldFile {
  const next: WorldFile = { ...world };

  const rooms = world.rooms ?? {};
  let roomsChanged = false;
  const nextRooms: Record<string, RoomFile> = {};
  for (const [id, room] of Object.entries(rooms)) {
    const updated = fn(`room/${id}`, room.description ?? "");
    if (updated !== room.description) {
      nextRooms[id] = { ...room, description: updated };
      roomsChanged = true;
    } else {
      nextRooms[id] = room;
    }
  }
  if (roomsChanged) next.rooms = nextRooms;

  if (world.mobs) {
    let changed = false;
    const nextMobs: Record<string, MobFile> = {};
    for (const [id, mob] of Object.entries(world.mobs)) {
      if (typeof mob.description !== "string") {
        nextMobs[id] = mob;
        continue;
      }
      const updated = fn(`mob/${id}`, mob.description);
      if (updated !== mob.description) {
        nextMobs[id] = { ...mob, description: updated };
        changed = true;
      } else {
        nextMobs[id] = mob;
      }
    }
    if (changed) next.mobs = nextMobs;
  }

  if (world.items) {
    let changed = false;
    const nextItems: Record<string, ItemFile> = {};
    for (const [id, item] of Object.entries(world.items)) {
      if (typeof item.description !== "string") {
        nextItems[id] = item;
        continue;
      }
      const updated = fn(`item/${id}`, item.description);
      if (updated !== item.description) {
        nextItems[id] = { ...item, description: updated };
        changed = true;
      } else {
        nextItems[id] = item;
      }
    }
    if (changed) next.items = nextItems;
  }

  return next;
}
