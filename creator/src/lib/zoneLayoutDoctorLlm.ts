import { invoke } from "@tauri-apps/api/core";
import type { WorldFile } from "@/types/world";
import { exitTarget } from "@/lib/zoneEdits";
import { buildToneDirective } from "@/lib/loreGeneration";
import type { TextDirectionMismatch } from "@/lib/zoneLayoutDoctor";

const DIR_LABELS: Record<string, string> = {
  n: "north",
  s: "south",
  e: "east",
  w: "west",
  u: "up",
  d: "down",
};

const VALID_DIRS = new Set(["n", "s", "e", "w", "u", "d"]);

export interface TextRewriteResult {
  roomId: string;
  original: string;
  rewritten: string;
}

function buildExitSummary(world: WorldFile, roomId: string): string {
  const room = world.rooms[roomId];
  if (!room?.exits) return "No exits.";
  const parts: string[] = [];
  for (const [dir, exitVal] of Object.entries(room.exits)) {
    if (!VALID_DIRS.has(dir)) continue;
    const target = exitTarget(exitVal);
    const targetTitle = target.includes(":")
      ? target
      : world.rooms[target]?.title ?? target;
    parts.push(`${DIR_LABELS[dir] ?? dir}: ${targetTitle}`);
  }
  return parts.length > 0 ? parts.join(", ") : "No exits.";
}

export async function rewriteRoomDescriptions(
  world: WorldFile,
  mismatches: TextDirectionMismatch[],
): Promise<TextRewriteResult[]> {
  if (mismatches.length === 0) return [];

  // Group mismatches by room
  const byRoom = new Map<string, TextDirectionMismatch[]>();
  for (const m of mismatches) {
    let arr = byRoom.get(m.roomId);
    if (!arr) {
      arr = [];
      byRoom.set(m.roomId, arr);
    }
    arr.push(m);
  }

  const tone = buildToneDirective();

  const systemPrompt = `You are a text editor for a MUD (text-based game). You clean up directional references in room descriptions. The game engine now narrates each room's exits automatically (e.g. "To the north you see the Garden"), so explicit directional exit callouts baked into the prose are redundant and should be removed. You also fix references that contradict the room's actual exits. Preserve the atmosphere, voice, length, and style of the original text — only touch the directional references called out in each room's "Problems" list, and leave everything else untouched. Follow each room's Problems exactly: remove a redundant exit callout cleanly without leaving a dangling sentence, and for a genuine mismatch either drop the reference or rephrase it to match an actual exit. Never strip a description down to nothing — keep all the sensory/atmospheric content. Keep deliberate distant-landmark flavor (e.g. "far to the east, a tower pierces the clouds") that paints scenery rather than naming an adjacent exit.${tone ? `\n\nWorld context: ${tone}` : ""}

Return ONLY a JSON array of objects: [{ "roomId": string, "description": string }]
No markdown fences, no commentary.`;

  const roomEntries: string[] = [];
  for (const [roomId, roomMismatches] of byRoom) {
    const room = world.rooms[roomId];
    if (!room) continue;
    const exits = buildExitSummary(world, roomId);
    const problems = roomMismatches
      .map((m) => {
        if (m.problem) return m.problem;
        if (m.mentionedDir) {
          return `Text says "${m.snippet}" but there is no ${DIR_LABELS[m.mentionedDir]} exit`;
        }
        return `Direction reference mismatch: ${m.snippet}`;
      })
      .join("; ");

    roomEntries.push(
      `Room "${roomId}" (${room.title}):\n` +
      `  Actual exits: ${exits}\n` +
      `  Current description: ${room.description}\n` +
      `  Problems: ${problems}`,
    );
  }

  const userPrompt = `Clean up the directional references in these room descriptions, following the Problems noted for each.\n\n${roomEntries.join("\n\n")}`;

  const response = await invoke<string>("llm_complete", {
    systemPrompt,
    userPrompt,
    maxTokens: Math.max(2048, byRoom.size * 500),
  });

  // Parse response
  const jsonText = response.trim().replace(/^```(?:json)?\s*\n?/, "").replace(/\n?\s*```$/, "");
  const start = jsonText.indexOf("[");
  const end = jsonText.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error("LLM response did not contain a JSON array");
  }

  let cleaned = jsonText.slice(start, end + 1);
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  const parsed: Array<{ roomId: string; description: string }> = JSON.parse(cleaned);

  const results: TextRewriteResult[] = [];
  for (const entry of parsed) {
    const room = world.rooms[entry.roomId];
    if (!room) continue;
    if (entry.description && entry.description !== room.description) {
      results.push({
        roomId: entry.roomId,
        original: room.description,
        rewritten: entry.description,
      });
    }
  }

  return results;
}
