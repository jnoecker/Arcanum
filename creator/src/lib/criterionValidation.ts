import type { ZoneState } from "@/stores/zoneStore";
import type {
  AppConfig,
  AchievementCriterionFile,
  AchievementCriterionTypeDefinition,
} from "@/types/config";

export type CriterionTargetKind = "mob" | "item" | "room" | "ability";

export interface CriterionTargetIndex {
  mobs: Map<string, string>;
  items: Map<string, string>;
  rooms: Map<string, string>;
  abilities: Map<string, string>;
}

/**
 * Walk every loaded zone + the application config and build a flat lookup
 * from "id" → "human readable name" for each registry an achievement
 * criterion might point at. Mob/item/room ids may appear as bare ids or as
 * "zoneId:entityId" — both forms are recorded so authors using either
 * convention get a clean resolution.
 */
export function buildCriterionTargetIndex(
  zones: Map<string, ZoneState>,
  config: AppConfig | null | undefined,
): CriterionTargetIndex {
  const mobs = new Map<string, string>();
  const items = new Map<string, string>();
  const rooms = new Map<string, string>();
  const abilities = new Map<string, string>();

  for (const [zoneId, state] of zones) {
    const data = state.data;
    if (data.mobs) {
      for (const [mobId, mob] of Object.entries(data.mobs)) {
        const name = mob?.name || mobId;
        if (!mobs.has(mobId)) mobs.set(mobId, name);
        mobs.set(`${zoneId}:${mobId}`, `${zoneId} · ${name}`);
      }
    }
    if (data.items) {
      for (const [itemId, item] of Object.entries(data.items)) {
        const name = item?.displayName || itemId;
        if (!items.has(itemId)) items.set(itemId, name);
        items.set(`${zoneId}:${itemId}`, `${zoneId} · ${name}`);
      }
    }
    if (data.rooms) {
      for (const [roomId, room] of Object.entries(data.rooms)) {
        const name = room?.title || roomId;
        if (!rooms.has(roomId)) rooms.set(roomId, name);
        rooms.set(`${zoneId}:${roomId}`, `${zoneId} · ${name}`);
      }
    }
  }

  if (config?.abilities) {
    for (const [abilityId, ability] of Object.entries(config.abilities)) {
      abilities.set(abilityId, ability?.displayName || abilityId);
    }
  }

  return { mobs, items, rooms, abilities };
}

/**
 * Heuristic guess at which registry a criterion's targetId is supposed to
 * resolve against, based on tokens in the criterion type id (e.g. `kill_mob`
 * → mob). When nothing matches we return null and the validator will accept a
 * hit in any registry.
 */
function guessKind(criterionTypeId: string): CriterionTargetKind | null {
  const t = criterionTypeId.toLowerCase();
  if (/(mob|kill|slay|defeat|hunt|boss)/.test(t)) return "mob";
  if (/(item|obtain|collect|loot|gather|craft|equip)/.test(t)) return "item";
  if (/(room|visit|explore|discover|enter|reach_room)/.test(t)) return "room";
  if (/(ability|spell|skill|learn|master|cast)/.test(t)) return "ability";
  return null;
}

/**
 * Counter-style criterion types take no targetId — there's nothing to
 * cross-reference. We detect them by name pattern so the editor can suppress
 * the validation chip entirely.
 */
function isCounterStyle(criterionTypeId: string): boolean {
  const t = criterionTypeId.toLowerCase();
  return /(level|gold|xp|exp|score|count|streak|gain|earn|reach_level|playtime|login)/.test(
    t,
  );
}

const KIND_LABEL: Record<CriterionTargetKind, string> = {
  mob: "mob",
  item: "item",
  room: "room",
  ability: "ability",
};

export interface CriterionValidationResult {
  /** True when the criterion needs no target validation OR the target resolves cleanly. */
  ok: boolean;
  /** Human label for the resolved target (only set when ok && resolution succeeded). */
  resolvedName?: string;
  /** Set when ok=false — short message for the warning chip. */
  warning?: string;
  /** Whether to render a chip at all. False for counter-style criteria with no targetId. */
  showChip: boolean;
  /** Best-guess kind label for unknown-target warning copy. */
  kindLabel?: string;
}

export function validateCriterion(
  criterion: AchievementCriterionFile,
  criterionType: AchievementCriterionTypeDefinition | undefined,
  index: CriterionTargetIndex,
): CriterionValidationResult {
  const targetId = criterion.targetId?.trim() ?? "";
  const typeId = criterion.type ?? "";
  const counterStyle = isCounterStyle(typeId);

  if (!targetId) {
    // No target supplied: only show a chip if the type clearly needs one.
    if (counterStyle) return { ok: true, showChip: false };
    const kind = guessKind(typeId);
    if (!kind) return { ok: true, showChip: false };
    return {
      ok: false,
      showChip: true,
      warning: `Missing ${KIND_LABEL[kind]} target`,
      kindLabel: KIND_LABEL[kind],
    };
  }

  const kind = guessKind(typeId);

  if (kind) {
    const registry = index[kindToRegistry(kind)];
    const hit = registry.get(targetId);
    if (hit) {
      return { ok: true, showChip: true, resolvedName: hit, kindLabel: KIND_LABEL[kind] };
    }
    // Maybe author picked the wrong kind — fall through to a broader search.
    const fallback = lookupAny(targetId, index);
    if (fallback) {
      return {
        ok: true,
        showChip: true,
        resolvedName: fallback.name,
        kindLabel: KIND_LABEL[fallback.kind],
      };
    }
    void criterionType;
    return {
      ok: false,
      showChip: true,
      warning: `Unknown ${KIND_LABEL[kind]}: ${targetId}`,
      kindLabel: KIND_LABEL[kind],
    };
  }

  // No kind hint — accept any registry hit.
  const fallback = lookupAny(targetId, index);
  if (fallback) {
    return {
      ok: true,
      showChip: true,
      resolvedName: fallback.name,
      kindLabel: KIND_LABEL[fallback.kind],
    };
  }
  return {
    ok: false,
    showChip: true,
    warning: `Unknown target: ${targetId}`,
  };
}

function kindToRegistry(
  kind: CriterionTargetKind,
): keyof CriterionTargetIndex {
  switch (kind) {
    case "mob":
      return "mobs";
    case "item":
      return "items";
    case "room":
      return "rooms";
    case "ability":
      return "abilities";
  }
}

function lookupAny(
  id: string,
  index: CriterionTargetIndex,
): { kind: CriterionTargetKind; name: string } | null {
  const order: CriterionTargetKind[] = ["mob", "item", "room", "ability"];
  for (const kind of order) {
    const hit = index[kindToRegistry(kind)].get(id);
    if (hit) return { kind, name: hit };
  }
  return null;
}
