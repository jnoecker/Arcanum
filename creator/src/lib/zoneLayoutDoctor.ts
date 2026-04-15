import type { WorldFile } from "@/types/world";
import { exitTarget, OPPOSITE } from "@/lib/zoneEdits";

// ─── Types ──────────────────────────────────────────────────────

export type IssueKind =
  | "one-way-exit"
  | "contradictory-pair"
  | "disconnected-room"
  | "text-direction-mismatch"
  | "text-room-mismatch";

export type IssueSeverity = "warning" | "error";

export interface LayoutIssueFix {
  /** Human-readable description of the suggested fix. */
  label: string;
  /** Apply this fix to a WorldFile, returning the updated version. */
  apply: (world: WorldFile) => WorldFile;
}

export interface LayoutIssue {
  kind: IssueKind;
  severity: IssueSeverity;
  /** Primary room involved. */
  roomId: string;
  /** Optional second room (for exit-pair issues). */
  otherRoomId?: string;
  /** Human-readable summary. */
  message: string;
  /** Deterministic key for dedup / dismiss tracking. */
  key: string;
  /** Suggested structural fix (exit re-wiring). Absent for text-only issues. */
  fix?: LayoutIssueFix;
}

// ─── Direction helpers ─────────────────────────────────────────

const VALID_DIRS = new Set(["n", "s", "e", "w", "u", "d"]);

const DIR_LABELS: Record<string, string> = {
  n: "north",
  s: "south",
  e: "east",
  w: "west",
  u: "up",
  d: "down",
};

/** Regex fragments for detecting directional references in room text. */
const DIR_PATTERNS: Record<string, RegExp> = {
  n: /\b(north(?:ward)?|to the north)\b/i,
  s: /\b(south(?:ward)?|to the south)\b/i,
  e: /\b(east(?:ward)?|to the east)\b/i,
  w: /\b(west(?:ward)?|to the west)\b/i,
  u: /\b(up(?:ward)?|above|upstairs|ascend|climb(?:s)? up|stair(?:s|way|case)?\b.*\bup)\b/i,
  d: /\b(down(?:ward)?|below|downstairs|descend|climb(?:s)? down|stair(?:s|way|case)?\b.*\bdown)\b/i,
};

/**
 * Tighter patterns for the text-room mismatch detector. These only match
 * words used as spatial markers — excluding verb forms like "descend" or
 * "ascend" which are actions rather than claims about layout.
 */
const SPATIAL_DIR_PATTERNS: Record<string, RegExp> = {
  n: /\b(north(?:ward|ern)?)\b/i,
  s: /\b(south(?:ward|ern)?)\b/i,
  e: /\b(east(?:ward|ern)?)\b/i,
  w: /\b(west(?:ward|ern)?)\b/i,
  u: /\b(upstairs|above|overhead|upward|upper)\b/i,
  d: /\b(downstairs|below|beneath|underfoot|downward|lower)\b/i,
};

// ─── Detectors ─────────────────────────────────────────────────

function detectOneWayExits(world: WorldFile): LayoutIssue[] {
  const issues: LayoutIssue[] = [];

  for (const [roomId, room] of Object.entries(world.rooms)) {
    for (const [dir, exitVal] of Object.entries(room.exits ?? {})) {
      if (!VALID_DIRS.has(dir)) continue;
      const target = exitTarget(exitVal);
      if (target.includes(":")) continue; // cross-zone exits are expected to be one-way
      if (!world.rooms[target]) continue;

      const rev = OPPOSITE[dir]!;
      const targetRoom = world.rooms[target]!;
      const targetExits = targetRoom.exits ?? {};

      // Check if there's ANY exit from target back to this room
      const hasReturn = Object.entries(targetExits).some(
        ([, v]) => exitTarget(v) === roomId,
      );

      if (!hasReturn) {
        // Only report once per pair (from the room that has the exit)
        const key = `one-way:${roomId}:${dir}:${target}`;
        issues.push({
          kind: "one-way-exit",
          severity: "warning",
          roomId,
          otherRoomId: target,
          message: `${roomId} exits ${DIR_LABELS[dir]} to ${target}, but ${target} has no exit back.`,
          key,
          fix: {
            label: `Add ${rev} exit from ${target} to ${roomId}`,
            apply: (w) => {
              const next = structuredClone(w);
              const tgt = next.rooms[target]!;
              if (!tgt.exits) tgt.exits = {};
              tgt.exits[rev] = roomId;
              return next;
            },
          },
        });
      }
    }
  }

  return issues;
}

function detectContradictoryPairs(world: WorldFile): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  const seen = new Set<string>();

  for (const [roomId, room] of Object.entries(world.rooms)) {
    for (const [dir, exitVal] of Object.entries(room.exits ?? {})) {
      if (!VALID_DIRS.has(dir)) continue;
      const target = exitTarget(exitVal);
      if (target.includes(":")) continue;
      if (!world.rooms[target]) continue;

      const expectedReverse = OPPOSITE[dir]!;
      const targetRoom = world.rooms[target]!;

      // Find exits from target back to this room
      for (const [tDir, tExitVal] of Object.entries(targetRoom.exits ?? {})) {
        if (exitTarget(tExitVal) !== roomId) continue;
        if (tDir === expectedReverse) continue; // correct pair
        if (!VALID_DIRS.has(tDir)) continue;

        const pairKey = [roomId, target].sort().join("|");
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        const key = `contradictory:${pairKey}:${dir}:${tDir}`;
        issues.push({
          kind: "contradictory-pair",
          severity: "error",
          roomId,
          otherRoomId: target,
          message: `${roomId} exits ${DIR_LABELS[dir]} to ${target}, but ${target} exits ${DIR_LABELS[tDir]} back (expected ${DIR_LABELS[expectedReverse]}).`,
          key,
          fix: {
            label: `Change ${target}'s exit from ${DIR_LABELS[tDir]} to ${DIR_LABELS[expectedReverse]}`,
            apply: (w) => {
              const next = structuredClone(w);
              const tgt = next.rooms[target]!;
              if (!tgt.exits) tgt.exits = {};
              const existingExit = tgt.exits[tDir];
              delete tgt.exits[tDir];
              tgt.exits[expectedReverse] = existingExit!;
              return next;
            },
          },
        });
      }
    }
  }

  return issues;
}

function detectDisconnectedRooms(world: WorldFile): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  const roomIds = Object.keys(world.rooms);
  if (roomIds.length <= 1) return issues;

  // BFS from startRoom
  const visited = new Set<string>();
  const queue = [world.startRoom];
  visited.add(world.startRoom);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const room = world.rooms[current];
    if (!room?.exits) continue;
    for (const [, exitVal] of Object.entries(room.exits)) {
      const target = exitTarget(exitVal);
      if (target.includes(":")) continue;
      if (!visited.has(target) && world.rooms[target]) {
        visited.add(target);
        queue.push(target);
      }
    }
    // Also check incoming exits (rooms that exit TO this room)
    for (const [otherId, otherRoom] of Object.entries(world.rooms)) {
      if (visited.has(otherId)) continue;
      for (const [, exitVal] of Object.entries(otherRoom.exits ?? {})) {
        if (exitTarget(exitVal) === current) {
          visited.add(otherId);
          queue.push(otherId);
        }
      }
    }
  }

  for (const roomId of roomIds) {
    if (visited.has(roomId)) continue;
    const key = `disconnected:${roomId}`;
    issues.push({
      kind: "disconnected-room",
      severity: "error",
      roomId,
      message: `${roomId} is not reachable from the start room (${world.startRoom}).`,
      key,
    });
  }

  return issues;
}

export interface TextDirectionMismatch {
  roomId: string;
  /** Direction mentioned in text but not present as an exit. */
  mentionedDir?: string;
  /** Exit direction present but described as a different direction. */
  exitDir?: string;
  /** The text snippet containing the reference. */
  snippet: string;
  /**
   * Optional overriding problem description. When present the LLM rewriter
   * should use this verbatim instead of synthesizing one from the fields above.
   */
  problem?: string;
}

function detectTextDirectionMismatches(world: WorldFile): {
  issues: LayoutIssue[];
  mismatches: TextDirectionMismatch[];
} {
  const issues: LayoutIssue[] = [];
  const mismatches: TextDirectionMismatch[] = [];

  for (const [roomId, room] of Object.entries(world.rooms)) {
    const desc = room.description;
    if (!desc) continue;

    const exitDirs = new Set(
      Object.keys(room.exits ?? {}).filter((d) => VALID_DIRS.has(d)),
    );

    // Find directions mentioned in text
    for (const [dir, pattern] of Object.entries(DIR_PATTERNS)) {
      const match = desc.match(pattern);
      if (!match) continue;

      if (!exitDirs.has(dir)) {
        // Text mentions a direction that has no exit
        const key = `text-mismatch:${roomId}:mentions-${dir}`;
        const mismatch: TextDirectionMismatch = {
          roomId,
          mentionedDir: dir,
          snippet: match[0],
        };
        mismatches.push(mismatch);
        issues.push({
          kind: "text-direction-mismatch",
          severity: "warning",
          roomId,
          message: `Description mentions "${match[0]}" but there is no ${DIR_LABELS[dir]} exit.`,
          key,
        });
      }
    }

    // Find exits whose direction isn't mentioned, but a DIFFERENT direction
    // to the same general destination IS mentioned — suggesting the text
    // describes the wrong direction. Only flag if the text mentions a direction
    // that doesn't have an exit (already caught above).
  }

  return { issues, mismatches };
}

// ─── Text ↔ room-name mismatch ─────────────────────────────────

const STOPWORDS = new Set([
  "the", "a", "an", "of", "and", "or", "in", "on", "to", "at",
  "for", "with", "by", "from", "into", "onto", "upon",
]);

/** Proximity window (characters) between a direction mention and a room name. */
const PROXIMITY_WINDOW = 60;

function titleKeywords(title: string): string[] {
  const cleaned = title
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];
  const tokens = cleaned.split(" ").filter((w) => !STOPWORDS.has(w));
  if (tokens.length === 0) return [];
  const phrase = tokens.join(" ");
  const keywords = new Set<string>();
  if (phrase.length >= 4) keywords.add(phrase);
  for (const t of tokens) {
    if (t.length >= 5) keywords.add(t);
  }
  return [...keywords];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectTextRoomMismatches(world: WorldFile): {
  issues: LayoutIssue[];
  mismatches: TextDirectionMismatch[];
} {
  const issues: LayoutIssue[] = [];
  const mismatches: TextDirectionMismatch[] = [];

  // keyword -> roomId. Prefer the first (most specific) match; skip ambiguous
  // keywords that apply to multiple rooms so we don't false-positive on shared
  // vocabulary ("gate", "hall").
  const keywordToRooms = new Map<string, Set<string>>();
  for (const [roomId, room] of Object.entries(world.rooms)) {
    const kws = titleKeywords(room.title ?? "");
    for (const kw of kws) {
      let set = keywordToRooms.get(kw);
      if (!set) {
        set = new Set();
        keywordToRooms.set(kw, set);
      }
      set.add(roomId);
    }
  }
  const index = new Map<string, string>();
  for (const [kw, roomIds] of keywordToRooms) {
    if (roomIds.size === 1) {
      index.set(kw, [...roomIds][0]!);
    }
  }

  for (const [roomId, room] of Object.entries(world.rooms)) {
    const desc = room.description;
    if (!desc) continue;

    // Collect direction mentions with their character offsets.
    const dirMentions: Array<{ dir: string; pos: number; text: string }> = [];
    for (const [dir, pattern] of Object.entries(SPATIAL_DIR_PATTERNS)) {
      const re = new RegExp(pattern.source, "gi");
      let m: RegExpExecArray | null;
      while ((m = re.exec(desc))) {
        dirMentions.push({ dir, pos: m.index, text: m[0] });
      }
    }
    if (dirMentions.length === 0) continue;

    // Collect keyword mentions with their offsets.
    interface KwHit { keyword: string; targetId: string; pos: number; length: number }
    const kwMentions: KwHit[] = [];
    for (const [keyword, targetId] of index) {
      if (targetId === roomId) continue;
      const re = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "gi");
      let m: RegExpExecArray | null;
      while ((m = re.exec(desc))) {
        kwMentions.push({ keyword, targetId, pos: m.index, length: m[0].length });
      }
    }
    if (kwMentions.length === 0) continue;

    // Pair each direction mention with the nearest keyword within the window.
    const reportedPairs = new Set<string>();
    for (const dirHit of dirMentions) {
      let bestKw: KwHit | null = null;
      let bestDist = Infinity;
      for (const kw of kwMentions) {
        const dist = Math.min(
          Math.abs(kw.pos - dirHit.pos),
          Math.abs(kw.pos + kw.length - dirHit.pos),
          Math.abs(kw.pos - (dirHit.pos + dirHit.text.length)),
        );
        if (dist < bestDist) {
          bestDist = dist;
          bestKw = kw;
        }
      }
      if (!bestKw || bestDist > PROXIMITY_WINDOW) continue;

      const claimedTarget = bestKw.targetId;
      const pairKey = `${dirHit.dir}:${claimedTarget}`;
      if (reportedPairs.has(pairKey)) continue;

      const exitVal = room.exits?.[dirHit.dir];
      const actualTargetId = exitVal ? exitTarget(exitVal) : undefined;
      const actualResolved =
        actualTargetId && !actualTargetId.includes(":")
          ? actualTargetId
          : undefined;
      if (actualResolved === claimedTarget) continue; // consistent

      reportedPairs.add(pairKey);

      const claimedTitle = world.rooms[claimedTarget]?.title ?? claimedTarget;
      const dirLabel = DIR_LABELS[dirHit.dir]!;

      let message: string;
      if (!actualTargetId) {
        message = `Description places "${claimedTitle}" ${dirLabel}, but there is no ${dirLabel} exit.`;
      } else if (actualResolved && world.rooms[actualResolved]) {
        const actualTitle = world.rooms[actualResolved].title || actualResolved;
        message = `Description places "${claimedTitle}" ${dirLabel}, but ${dirLabel} leads to "${actualTitle}".`;
      } else {
        message = `Description places "${claimedTitle}" ${dirLabel}, but ${dirLabel} leads to ${actualTargetId}.`;
      }

      issues.push({
        kind: "text-room-mismatch",
        severity: "warning",
        roomId,
        otherRoomId: claimedTarget,
        message,
        key: `text-room-mismatch:${roomId}:${dirHit.dir}:${claimedTarget}`,
      });
      mismatches.push({
        roomId,
        mentionedDir: dirHit.dir,
        snippet: dirHit.text,
        problem: message,
      });
    }
  }

  return { issues, mismatches };
}

// ─── Public API ────────────────────────────────────────────────

export interface DoctorReport {
  issues: LayoutIssue[];
  /** Text/direction mismatches that can be sent to the LLM for rewriting. */
  textMismatches: TextDirectionMismatch[];
}

export function analyzeZoneLayout(world: WorldFile): DoctorReport {
  const oneWay = detectOneWayExits(world);
  const contradictory = detectContradictoryPairs(world);
  const disconnected = detectDisconnectedRooms(world);
  const { issues: textIssues, mismatches } = detectTextDirectionMismatches(world);
  const { issues: roomMismatchIssues, mismatches: roomMismatches } =
    detectTextRoomMismatches(world);

  return {
    issues: [
      ...contradictory,
      ...disconnected,
      ...oneWay,
      ...textIssues,
      ...roomMismatchIssues,
    ],
    textMismatches: [...mismatches, ...roomMismatches],
  };
}
