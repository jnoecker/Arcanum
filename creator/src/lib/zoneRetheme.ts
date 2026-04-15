import { invoke } from "@tauri-apps/api/core";
import type { WorldFile, RoomFile, MobFile, ItemFile } from "@/types/world";
import { buildToneDirective } from "@/lib/loreGeneration";

/**
 * Rewrite a zone's surface text to match a new theme. Layout (exits, IDs),
 * stats, drops, quests, and every numeric field are preserved. Only the
 * following fields are touched:
 *   - rooms[*].title, rooms[*].description
 *   - mobs[*].name, mobs[*].description
 *   - items[*].displayName, items[*].description
 *
 * One LLM call per invocation — all text is batched into a single prompt and
 * a single JSON response, mirroring the pattern in `zoneLayoutDoctorLlm.ts`.
 */

export interface RethemeParams {
  /** The zone to retheme (unchanged; returned clone holds the rewrites). */
  world: WorldFile;
  /** Natural-language description of the new theme. */
  newTheme: string;
  /** Optional hint about what the zone was before — inferred if absent. */
  currentTheme?: string;
  /** The containing world's theme, for tonal grounding. */
  worldTheme?: string;
}

export interface RethemeResult {
  world: WorldFile;
  /** Count of text fields the LLM actually rewrote. */
  changedFieldCount: number;
  /** Count of elements (rooms/mobs/items) whose text was requested. */
  requestedElementCount: number;
  /** Count of refs the LLM returned that couldn't be matched (warnings). */
  unmatchedRefCount: number;
}

interface TextRef {
  ref: string;          // e.g. "R0.title", "M2.description"
  current: string;
  kind: "room" | "mob" | "item";
  id: string;           // original entity id
  field: "title" | "description" | "name" | "displayName";
}

function collectRefs(world: WorldFile): TextRef[] {
  const refs: TextRef[] = [];
  let r = 0;
  for (const [id, room] of Object.entries(world.rooms)) {
    refs.push({ ref: `R${r}.title`, current: room.title ?? "", kind: "room", id, field: "title" });
    refs.push({ ref: `R${r}.description`, current: room.description ?? "", kind: "room", id, field: "description" });
    r++;
  }
  let m = 0;
  for (const [id, mob] of Object.entries(world.mobs ?? {})) {
    refs.push({ ref: `M${m}.name`, current: mob.name ?? "", kind: "mob", id, field: "name" });
    if (mob.description !== undefined) {
      refs.push({ ref: `M${m}.description`, current: mob.description ?? "", kind: "mob", id, field: "description" });
    }
    m++;
  }
  let i = 0;
  for (const [id, item] of Object.entries(world.items ?? {})) {
    refs.push({ ref: `I${i}.displayName`, current: item.displayName ?? "", kind: "item", id, field: "displayName" });
    if (item.description !== undefined) {
      refs.push({ ref: `I${i}.description`, current: item.description ?? "", kind: "item", id, field: "description" });
    }
    i++;
  }
  return refs;
}

function buildSystemPrompt(tone: string): string {
  return `You rewrite zone content for a MUD (text-based game) to match a new theme while keeping the underlying structure intact.

STRICT RULES:
- Preserve every room/mob/item's ROLE — a boss stays a boss, a merchant stays a merchant, a dead-end closet stays small.
- Do not invent new rooms, mobs, or items. Do not remove any.
- Do not change stats, levels, drops, or any numbers.
- Do not change IDs, directions, or exit targets.
- Keep descriptions roughly the same LENGTH as the originals (short rooms stay short).
- Titles/names should be evocative but brief (2-5 words is usually right).
- Do NOT mention compass directions that weren't in the original description — that can break directional-layout consistency.
- Maintain atmosphere and tone; don't make a horror zone feel cozy or vice versa (unless the new theme requests it).${tone ? `\n\nWorld context: ${tone}` : ""}

OUTPUT FORMAT:
Return ONLY a JSON array of objects: [{ "ref": string, "value": string }]
One entry per input ref. No markdown fences. No commentary. No trailing commas.`;
}

function buildUserPrompt(params: RethemeParams, refs: TextRef[]): string {
  const parts: string[] = [];
  parts.push(`Rewrite the following zone content.`);
  parts.push(``);
  if (params.worldTheme) parts.push(`World theme: ${params.worldTheme}`);
  if (params.currentTheme) parts.push(`Current zone theme: ${params.currentTheme}`);
  parts.push(`NEW zone theme: ${params.newTheme}`);
  parts.push(``);
  parts.push(`Input refs (rewrite each one, keeping structure/role/length):`);

  // Group by entity for readability — helps the LLM keep title+description consistent.
  const grouped = new Map<string, TextRef[]>();
  for (const ref of refs) {
    const key = `${ref.kind}:${ref.id}`;
    let arr = grouped.get(key);
    if (!arr) { arr = []; grouped.set(key, arr); }
    arr.push(ref);
  }

  for (const [key, entityRefs] of grouped) {
    const [kind, id] = key.split(":", 2);
    parts.push(``);
    parts.push(`[${kind} ${id}]`);
    for (const r of entityRefs) {
      parts.push(`${r.ref}: ${JSON.stringify(r.current)}`);
    }
  }

  return parts.join("\n");
}

function extractJsonArray(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?\s*```\s*$/, "");
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error("Retheme response did not contain a JSON array");
  }
  return text.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1");
}

function scaleMaxTokens(refCount: number): number {
  // Each entry is "ref":"...value..." — average ~80 tokens out per ref with headroom.
  return Math.max(4096, Math.min(refCount * 120 + 1024, 32000));
}

/**
 * Run the retheme. Returns a new WorldFile plus some counters so callers can
 * report "n of m fields rewritten" and flag partial outputs.
 */
export async function rethemeZone(params: RethemeParams): Promise<RethemeResult> {
  const refs = collectRefs(params.world);
  if (refs.length === 0) {
    return {
      world: structuredClone(params.world),
      changedFieldCount: 0,
      requestedElementCount: 0,
      unmatchedRefCount: 0,
    };
  }

  const tone = buildToneDirective();
  const systemPrompt = buildSystemPrompt(tone);
  const userPrompt = buildUserPrompt(params, refs);

  const response = await invoke<string>("llm_complete", {
    systemPrompt,
    userPrompt,
    maxTokens: scaleMaxTokens(refs.length),
  });

  const json = extractJsonArray(response);
  const parsed: Array<{ ref?: string; value?: string }> = JSON.parse(json);

  const byRef = new Map<string, string>();
  const seenRefs = new Set<string>(refs.map((r) => r.ref));
  let unmatched = 0;
  for (const entry of parsed) {
    if (!entry || typeof entry.ref !== "string" || typeof entry.value !== "string") continue;
    if (!seenRefs.has(entry.ref)) { unmatched++; continue; }
    byRef.set(entry.ref, entry.value);
  }

  return applyRethemeValues(params.world, refs, byRef, unmatched);
}

function applyRethemeValues(
  world: WorldFile,
  refs: TextRef[],
  byRef: Map<string, string>,
  unmatched: number,
): RethemeResult {
  const out = structuredClone(world);
  let changed = 0;
  const elements = new Set<string>();

  for (const ref of refs) {
    elements.add(`${ref.kind}:${ref.id}`);
    const newValue = byRef.get(ref.ref);
    if (newValue === undefined) continue;
    if (newValue === ref.current) continue;

    if (ref.kind === "room") {
      const room = out.rooms[ref.id] as RoomFile | undefined;
      if (!room) continue;
      if (ref.field === "title") room.title = newValue;
      else if (ref.field === "description") room.description = newValue;
      changed++;
    } else if (ref.kind === "mob") {
      const mob = out.mobs?.[ref.id] as MobFile | undefined;
      if (!mob) continue;
      if (ref.field === "name") mob.name = newValue;
      else if (ref.field === "description") mob.description = newValue;
      changed++;
    } else {
      const item = out.items?.[ref.id] as ItemFile | undefined;
      if (!item) continue;
      if (ref.field === "displayName") item.displayName = newValue;
      else if (ref.field === "description") item.description = newValue;
      changed++;
    }
  }

  return {
    world: out,
    changedFieldCount: changed,
    requestedElementCount: elements.size,
    unmatchedRefCount: unmatched,
  };
}

export const __test__ = {
  collectRefs,
  applyRethemeValues,
  extractJsonArray,
  buildSystemPrompt,
  buildUserPrompt,
};
