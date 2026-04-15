import type {
  WorldFile,
  RoomFile,
  ExitValue,
  MobFile,
  ItemFile,
  ShopFile,
  TrainerFile,
  QuestFile,
  GatheringNodeFile,
  RecipeFile,
  BtNodeFile,
  StatMap,
  FeatureFile,
  DoorFile,
  DungeonLootTable,
} from "@/types/world";
import { resolveDoorKeyId } from "./doorHelpers";
import { getTrainerClasses, setTrainerClasses } from "./trainers";

/** Derive keyword from entity ID: extract part after last colon, or full ID. Matches Kotlin `keywordFromId`. */
export function keywordFromId(id: string): string {
  const idx = id.lastIndexOf(":");
  return idx >= 0 ? id.slice(idx + 1) : id;
}

// ─── ID sanitization ──────────────────────────────────────────────

const NUMERIC_ONLY_RE = /^\d+$/;
const INVALID_ID_CHARS_RE = /[^a-z0-9_]/g;

/**
 * Sanitize an entity ID for the AmbonMUD server.
 * - Purely numeric IDs get prefixed (e.g. "3001" → "room_3001")
 * - Special chars are stripped, spaces/hyphens become underscores
 * - Result is lowercased
 * - Returns null if blank after sanitization
 */
export function sanitizeId(rawId: string, prefix: string): string | null {
  let id = rawId.trim().toLowerCase();
  if (!id) return null;
  id = id.replace(/[\s\-.]+/g, "_");
  id = id.replace(INVALID_ID_CHARS_RE, "");
  id = id.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  if (!id) return null;
  if (NUMERIC_ONLY_RE.test(id)) id = `${prefix}_${id}`;
  return id;
}

/**
 * Build a remap table (oldId → newId) for IDs that need sanitizing.
 * Only contains entries that actually change. Handles collisions.
 */
export function buildIdRemap(ids: string[], prefix: string): Map<string, string> {
  const remap = new Map<string, string>();
  const usedIds = new Set<string>();

  // First pass: claim IDs that don't need changes
  for (const oldId of ids) {
    const sanitized = sanitizeId(oldId, prefix);
    if (sanitized === oldId) usedIds.add(oldId);
  }

  // Second pass: remap IDs that need changes
  for (const oldId of ids) {
    const sanitized = sanitizeId(oldId, prefix);
    if (sanitized === oldId) continue;
    if (!sanitized) {
      remap.set(oldId, "");
      continue;
    }
    let finalId = sanitized;
    let counter = 2;
    while (usedIds.has(finalId)) {
      finalId = `${sanitized}_${counter}`;
      counter++;
    }
    usedIds.add(finalId);
    remap.set(oldId, finalId);
  }

  return remap;
}

// ─── Remap helpers ────────────────────────────────────────────────

function rId(id: string, table: Map<string, string>): string {
  return table.get(id) ?? id;
}

function rArray(ids: string[], table: Map<string, string>): string[] {
  return ids.map((id) => table.get(id) ?? id);
}

function remapBtRoutes(node: BtNodeFile, roomRemap: Map<string, string>): BtNodeFile {
  let result = node;
  if (node.route) result = { ...result, route: rArray(node.route, roomRemap) };
  if (node.children) result = { ...result, children: node.children.map((c) => remapBtRoutes(c, roomRemap)) };
  return result;
}

function normalizeDoorFile(door?: DoorFile): DoorFile | undefined {
  if (!door) return undefined;

  const normalized: DoorFile = {};
  const initialState = door.initialState ?? (door.locked ? "locked" : door.closed ? "closed" : undefined);
  const keyItemId = resolveDoorKeyId(door);

  if (initialState) normalized.initialState = initialState;
  if (keyItemId) normalized.keyItemId = keyItemId;
  if (door.keyConsumed != null) normalized.keyConsumed = door.keyConsumed;
  if (door.resetWithZone != null) normalized.resetWithZone = door.resetWithZone;

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeFeatureFile(feature: FeatureFile): FeatureFile {
  const type = feature.type.trim().toUpperCase();
  const out: FeatureFile = {
    type,
    displayName: feature.displayName ?? "",
    keyword: feature.keyword ?? "",
  };
  if (type === "CONTAINER") {
    if (feature.initialState) out.initialState = feature.initialState;
    if (feature.keyItemId) out.keyItemId = feature.keyItemId;
    if (feature.keyConsumed != null) out.keyConsumed = feature.keyConsumed;
    if (feature.resetWithZone != null) out.resetWithZone = feature.resetWithZone;
    if (feature.items && feature.items.length > 0) out.items = [...feature.items];
  } else if (type === "LEVER") {
    if (feature.initialState) out.initialState = feature.initialState;
    if (feature.resetWithZone != null) out.resetWithZone = feature.resetWithZone;
  } else if (type === "SIGN") {
    if (feature.text != null) out.text = feature.text;
  }
  return out;
}

function normalizeRoomOutput(room: RoomFile): RoomFile {
  let next: RoomFile = { ...room, audio: undefined };
  if (room.exits) {
    const exits: Record<string, string | ExitValue> = {};
    for (const [dir, exit] of Object.entries(room.exits)) {
      if (typeof exit === "string") {
        exits[dir] = exit;
      } else {
        const door = normalizeDoorFile(exit.door);
        exits[dir] = door ? { to: exit.to, door } : exit.to;
      }
    }
    next = { ...next, exits };
  }
  if (room.features) {
    const features: Record<string, FeatureFile> = {};
    for (const [id, feature] of Object.entries(room.features)) {
      features[id] = normalizeFeatureFile(feature);
    }
    if (Object.keys(features).length > 0) {
      next = { ...next, features };
    } else {
      const { features: _unused, ...withoutFeatures } = next;
      next = withoutFeatures;
    }
  }
  return next;
}

function normalizeTrainerOutput(trainer: TrainerFile): TrainerFile {
  return {
    ...trainer,
    ...setTrainerClasses(getTrainerClasses(trainer)),
  };
}

function normalizePuzzleReward(
  reward: NonNullable<WorldFile["puzzles"]>[string]["reward"],
): NonNullable<WorldFile["puzzles"]>[string]["reward"] {
  if (reward.type === "give_gold") {
    return { ...reward, gold: reward.gold ?? reward.amount, amount: undefined };
  }
  if (reward.type === "give_xp") {
    return { ...reward, xp: reward.xp ?? reward.amount, amount: undefined };
  }
  return reward;
}

// ─── Phase 1: Remap all entity IDs and references ─────────────────

interface RemapTables {
  room: Map<string, string>;
  mob: Map<string, string>;
  item: Map<string, string>;
  shop: Map<string, string>;
  trainer: Map<string, string>;
  quest: Map<string, string>;
  node: Map<string, string>;
  recipe: Map<string, string>;
}

function applyIdRemaps(world: WorldFile, t: RemapTables): WorldFile {
  const hasRemaps = [t.room, t.mob, t.item, t.shop, t.trainer, t.quest, t.node, t.recipe].some(
    (m) => m.size > 0,
  );
  if (!hasRemaps) return world;

  // Rooms: remap keys, exit targets, door keys, feature item refs
  const rooms: Record<string, RoomFile> = {};
  for (const [oldId, room] of Object.entries(world.rooms)) {
    const key = t.room.get(oldId);
    if (key === "") continue;
    let r2 = room;

    if (room.exits && t.room.size + t.item.size > 0) {
      const exits: Record<string, string | ExitValue> = {};
      for (const [dir, exit] of Object.entries(room.exits)) {
        if (typeof exit === "string") {
          exits[dir] = exit.includes(":") ? exit : rId(exit, t.room);
        } else {
          const to = exit.to.includes(":") ? exit.to : rId(exit.to, t.room);
          const doorKey = resolveDoorKeyId(exit.door);
          const door = doorKey
            ? {
                ...exit.door,
                key: exit.door?.key ? rId(exit.door.key, t.item) : undefined,
                keyItemId: exit.door?.keyItemId ? rId(exit.door.keyItemId, t.item) : undefined,
              }
            : exit.door;
          exits[dir] = { ...exit, to, door };
        }
      }
      r2 = { ...r2, exits };
    }

    if (room.features && t.item.size > 0) {
      const features: Record<string, FeatureFile> = {};
      for (const [fId, feat] of Object.entries(room.features)) {
        let f = feat;
        if (feat.keyItemId) f = { ...f, keyItemId: rId(feat.keyItemId, t.item) };
        if (feat.items) f = { ...f, items: rArray(feat.items, t.item) };
        features[fId] = f;
      }
      r2 = { ...r2, features };
    }

    rooms[key ?? oldId] = r2;
  }

  // Mobs: remap keys, room, drops, quests, patrol routes, BT routes
  let mobs: Record<string, MobFile> | undefined;
  if (world.mobs) {
    mobs = {};
    for (const [oldId, mob] of Object.entries(world.mobs)) {
      const key = t.mob.get(oldId);
      if (key === "") continue;
      let m: MobFile = { ...mob, room: rId(mob.room, t.room) };
      if (mob.drops) m.drops = mob.drops.map((d) => ({
        ...d,
        itemId: rId(d.itemId, t.item),
        chance: d.chance > 1 ? d.chance / 100 : d.chance,
      }));
      if (mob.quests) m.quests = rArray(mob.quests, t.quest);
      if (mob.behavior?.params?.patrolRoute) {
        m = {
          ...m,
          behavior: {
            ...mob.behavior,
            params: { ...mob.behavior.params, patrolRoute: rArray(mob.behavior.params.patrolRoute, t.room) },
          },
        };
      }
      if (mob.behavior?.tree) {
        m = { ...m, behavior: { ...m.behavior!, tree: remapBtRoutes(mob.behavior.tree, t.room) } };
      }
      mobs[key ?? oldId] = m;
    }
  }

  // Items: remap keys, optional room ref
  let items: Record<string, ItemFile> | undefined;
  if (world.items) {
    items = {};
    for (const [oldId, item] of Object.entries(world.items)) {
      const key = t.item.get(oldId);
      if (key === "") continue;
      items[key ?? oldId] = { ...item, room: item.room ? rId(item.room, t.room) : undefined };
    }
  }

  // Shops: remap keys, room, item refs
  let shops: Record<string, ShopFile> | undefined;
  if (world.shops) {
    shops = {};
    for (const [oldId, shop] of Object.entries(world.shops)) {
      const key = t.shop.get(oldId);
      if (key === "") continue;
      shops[key ?? oldId] = {
        ...shop,
        room: rId(shop.room, t.room),
        items: shop.items ? rArray(shop.items, t.item) : undefined,
      };
    }
  }

  // Trainers: remap keys, room
  const trainers = world.trainers
    ? Object.fromEntries(
        Object.entries(world.trainers)
          .filter(([id]) => t.trainer.get(id) !== "")
          .map(([id, tr]) => [t.trainer.get(id) ?? id, { ...tr, room: rId(tr.room, t.room) }]),
      )
    : undefined;

  // Quests: remap keys, giver ref
  const quests = world.quests
    ? Object.fromEntries(
        Object.entries(world.quests)
          .filter(([id]) => t.quest.get(id) !== "")
          .map(([id, q]) => [t.quest.get(id) ?? id, { ...q, giver: rId(q.giver, t.mob) }]),
      )
    : undefined;

  // Gathering nodes: remap keys, room, yield items
  let gatheringNodes: Record<string, GatheringNodeFile> | undefined;
  if (world.gatheringNodes) {
    gatheringNodes = {};
    for (const [oldId, node] of Object.entries(world.gatheringNodes)) {
      const key = t.node.get(oldId);
      if (key === "") continue;
      gatheringNodes[key ?? oldId] = {
        ...node,
        room: rId(node.room, t.room),
        yields: node.yields.map((y) => ({ ...y, itemId: rId(y.itemId, t.item) })),
        rareYields: node.rareYields?.map((y) => ({ ...y, itemId: rId(y.itemId, t.item) })),
      };
    }
  }

  // Recipes: remap keys, output item, material items
  let recipes: Record<string, RecipeFile> | undefined;
  if (world.recipes) {
    recipes = {};
    for (const [oldId, recipe] of Object.entries(world.recipes)) {
      const key = t.recipe.get(oldId);
      if (key === "") continue;
      recipes[key ?? oldId] = {
        ...recipe,
        outputItemId: rId(recipe.outputItemId, t.item),
        materials: recipe.materials.map((m) => ({ ...m, itemId: rId(m.itemId, t.item) })),
      };
    }
  }

  // Puzzles: remap room, mob, item refs
  let puzzles = world.puzzles;
  if (puzzles && (t.room.size > 0 || t.mob.size > 0 || t.item.size > 0)) {
    const newPuzzles: typeof puzzles = {};
    for (const [pId, p] of Object.entries(puzzles)) {
      const reward = p.reward
        ? {
            ...p.reward,
            targetRoom: p.reward.targetRoom ? rId(p.reward.targetRoom, t.room) : undefined,
            itemId: p.reward.itemId ? rId(p.reward.itemId, t.item) : undefined,
          }
        : p.reward;
      newPuzzles[pId] = {
        ...p,
        roomId: rId(p.roomId, t.room),
        mobId: p.mobId ? rId(p.mobId, t.mob) : undefined,
        reward,
      };
    }
    puzzles = newPuzzles;
  }

  // Dungeon: remap portal room, mob pool IDs, loot table item IDs
  let dungeon = world.dungeon;
  if (dungeon) {
    if (dungeon.portalRoom && t.room.size > 0) {
      dungeon = { ...dungeon, portalRoom: rId(dungeon.portalRoom, t.room) };
    }
    if (dungeon.mobPools && t.mob.size > 0) {
      const mp = dungeon.mobPools;
      dungeon = {
        ...dungeon,
        mobPools: {
          common: mp.common ? rArray(mp.common, t.mob) : undefined,
          elite: mp.elite ? rArray(mp.elite, t.mob) : undefined,
          boss: mp.boss ? rArray(mp.boss, t.mob) : undefined,
        },
      };
    }
    if (dungeon.lootTables && t.item.size > 0) {
      const remapped: Record<string, DungeonLootTable> = {};
      for (const [tier, lt] of Object.entries(dungeon.lootTables)) {
        remapped[tier] = {
          mobDrops: lt.mobDrops ? rArray(lt.mobDrops, t.item) : undefined,
          completionRewards: lt.completionRewards ? rArray(lt.completionRewards, t.item) : undefined,
        };
      }
      dungeon = { ...dungeon, lootTables: remapped };
    }
  }

  return {
    ...world,
    startRoom: rId(world.startRoom, t.room),
    rooms,
    mobs,
    items,
    shops,
    trainers: trainers && Object.keys(trainers).length > 0 ? trainers : undefined,
    quests: quests && Object.keys(quests).length > 0 ? quests : undefined,
    gatheringNodes,
    recipes,
    puzzles,
    dungeon,
  };
}

// ─── Phase 2: Strip entities with broken hard requirements ────────

function stripInvalidEntities(world: WorldFile): WorldFile {
  const roomIds = new Set(Object.keys(world.rooms ?? {}));

  // Rooms: default missing required fields (don't remove rooms)
  const rooms: Record<string, RoomFile> = {};
  for (const [id, room] of Object.entries(world.rooms ?? {})) {
    rooms[id] = {
      ...room,
      title: room.title?.trim() || id,
      description: room.description?.trim() || "No description.",
    };
  }

  // Mobs: remove if room doesn't exist, default name. Also strip the
  // legacy `housingBroker` flag — the MUD's MobFile has no such field and
  // the HousingSystem never checks the player's location for `house buy`,
  // so the flag was dead weight in the YAML. Drop it on next save so old
  // projects get cleaned up automatically.
  let mobs: Record<string, MobFile> | undefined;
  if (world.mobs) {
    mobs = {};
    for (const [id, mob] of Object.entries(world.mobs)) {
      if (!roomIds.has(mob.room)) continue;
      const { housingBroker: _legacyBroker, ...cleanMob } = mob as MobFile & {
        housingBroker?: unknown;
      };
      mobs[id] = { ...cleanMob, name: mob.name?.trim() || id };
    }
  }

  // Items: clear invalid optional room ref, default displayName
  let items: Record<string, ItemFile> | undefined;
  if (world.items) {
    items = {};
    for (const [id, item] of Object.entries(world.items)) {
      const room = item.room && roomIds.has(item.room) ? item.room : undefined;
      const keyword = item.keyword?.trim() || undefined;
      items[id] = { ...item, displayName: item.displayName?.trim() || id, room, keyword: keyword || keywordFromId(id) };
    }
  }

  // Shops: remove if room doesn't exist, default name
  let shops: Record<string, ShopFile> | undefined;
  if (world.shops) {
    shops = {};
    for (const [id, shop] of Object.entries(world.shops)) {
      if (!roomIds.has(shop.room)) continue;
      shops[id] = { ...shop, name: shop.name?.trim() || id };
    }
  }

  // Trainers: remove if room doesn't exist, default name
  let trainers: Record<string, TrainerFile> | undefined;
  if (world.trainers) {
    trainers = {};
    for (const [id, trainer] of Object.entries(world.trainers)) {
      if (!roomIds.has(trainer.room)) continue;
      trainers[id] = { ...trainer, name: trainer.name?.trim() || id };
    }
  }

  // Gathering nodes: remove if room doesn't exist, default displayName
  let gatheringNodes: Record<string, GatheringNodeFile> | undefined;
  if (world.gatheringNodes) {
    gatheringNodes = {};
    for (const [id, node] of Object.entries(world.gatheringNodes)) {
      if (!roomIds.has(node.room)) continue;
      const keyword = node.keyword?.trim() || undefined;
      gatheringNodes[id] = { ...node, displayName: node.displayName?.trim() || id, keyword: keyword || keywordFromId(id) };
    }
  }

  return { ...world, rooms, mobs, items, shops, trainers, gatheringNodes };
}

// ─── Phase 3: Strip dangling references in surviving entities ─────

function stripDanglingReferences(world: WorldFile): WorldFile {
  const roomIds = new Set(Object.keys(world.rooms));
  const mobIds = new Set(Object.keys(world.mobs ?? {}));
  const itemIds = new Set(Object.keys(world.items ?? {}));
  const questIds = new Set(Object.keys(world.quests ?? {}));

  // Room exits: drop exits to non-existent local rooms, clear broken door keys
  const rooms: Record<string, RoomFile> = {};
  for (const [id, room] of Object.entries(world.rooms)) {
    if (!room.exits) {
      rooms[id] = room;
      continue;
    }
    const exits: Record<string, string | ExitValue> = {};
    for (const [dir, exit] of Object.entries(room.exits)) {
      const target = typeof exit === "string" ? exit : exit.to;
      if (!target.includes(":") && !roomIds.has(target)) continue;
      const doorKey = typeof exit === "string" ? undefined : resolveDoorKeyId(exit.door);
      if (typeof exit !== "string" && doorKey && !itemIds.has(doorKey)) {
        exits[dir] = {
          ...exit,
          door: {
            ...exit.door,
            key: undefined,
            keyItemId: undefined,
          },
        };
      } else {
        exits[dir] = exit;
      }
    }
    rooms[id] = { ...room, exits: Object.keys(exits).length > 0 ? exits : undefined };
  }

  // Mob drops, quests, patrol routes
  let mobs: Record<string, MobFile> | undefined;
  if (world.mobs) {
    mobs = {};
    for (const [id, mob] of Object.entries(world.mobs)) {
      let m = mob;
      if (mob.drops) {
        const valid = mob.drops
          .filter((d) => d.itemId && itemIds.has(d.itemId))
          .map((d) => ({
            ...d,
            chance: d.chance > 1 ? d.chance / 100 : Math.max(0, Math.min(1, d.chance)),
          }));
        m = { ...m, drops: valid.length > 0 ? valid : undefined };
      }
      if (mob.quests) {
        const valid = mob.quests.filter((q) => questIds.has(q));
        m = { ...m, quests: valid.length > 0 ? valid : undefined };
      }
      if (mob.behavior?.params?.patrolRoute) {
        const valid = mob.behavior.params.patrolRoute.filter((r) => roomIds.has(r));
        m = {
          ...m,
          behavior: {
            ...mob.behavior,
            params: { ...mob.behavior.params, patrolRoute: valid.length > 0 ? valid : undefined },
          },
        };
      }
      mobs[id] = m;
    }
  }

  // Shop items
  let shops: Record<string, ShopFile> | undefined;
  if (world.shops) {
    shops = {};
    for (const [id, shop] of Object.entries(world.shops)) {
      const valid = (shop.items ?? []).filter((i) => itemIds.has(i));
      shops[id] = { ...shop, items: valid.length > 0 ? valid : undefined };
    }
  }

  // Quest giver
  let quests: Record<string, QuestFile> | undefined;
  if (world.quests) {
    quests = {};
    for (const [id, quest] of Object.entries(world.quests)) {
      quests[id] = { ...quest, giver: mobIds.has(quest.giver) ? quest.giver : "" };
    }
  }

  // Recipe materials and output
  let recipes: Record<string, RecipeFile> | undefined;
  if (world.recipes) {
    recipes = {};
    for (const [id, recipe] of Object.entries(world.recipes)) {
      if (!itemIds.has(recipe.outputItemId)) continue;
      const validMats = recipe.materials.filter((m) => m.itemId && itemIds.has(m.itemId));
      if (validMats.length === 0) continue;
      recipes[id] = { ...recipe, materials: validMats };
    }
  }

  // Gathering node yields
  let gatheringNodes: Record<string, GatheringNodeFile> | undefined;
  if (world.gatheringNodes) {
    gatheringNodes = {};
    for (const [id, node] of Object.entries(world.gatheringNodes)) {
      const validYields = node.yields.filter((y) => y.itemId && itemIds.has(y.itemId));
      const validRare = node.rareYields?.filter((y) => y.itemId && itemIds.has(y.itemId));
      gatheringNodes[id] = {
        ...node,
        yields: validYields,
        rareYields: validRare && validRare.length > 0 ? validRare : undefined,
      };
    }
  }

  return { ...world, rooms, mobs, shops, quests, recipes, gatheringNodes };
}

// ─── Phase 4: Clean output ────────────────────────────────────────

function stripZeroStats(stats?: StatMap): StatMap | undefined {
  if (!stats) return undefined;
  const clean: StatMap = {};
  for (const [key, val] of Object.entries(stats)) {
    if (val !== 0) clean[key] = val;
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
}

function hasEntries(obj?: Record<string, unknown> | unknown[]): boolean {
  if (!obj) return false;
  if (Array.isArray(obj)) return obj.length > 0;
  return Object.keys(obj).length > 0;
}

function cleanOutput(world: WorldFile): WorldFile {
  const roomIds = new Set(Object.keys(world.rooms));

  // Ensure zone name is valid
  const zone = sanitizeId(world.zone?.trim() || "unnamed", "zone") ?? "unnamed";

  // Ensure startRoom references a valid room
  let startRoom = world.startRoom;
  if (!roomIds.has(startRoom)) {
    startRoom = Object.keys(world.rooms)[0] ?? startRoom;
  }

  // Clean items: strip zero stats, normalize onUse/charges
  let items: Record<string, ItemFile> | undefined;
  if (world.items && hasEntries(world.items)) {
    items = {};
    for (const [id, item] of Object.entries(world.items)) {
      let cleaned: ItemFile = { ...item, stats: stripZeroStats(item.stats) };
      // Strip onUse if no positive effect
      if (cleaned.onUse) {
        const hasEffect = (cleaned.onUse.healHp ?? 0) > 0 || (cleaned.onUse.grantXp ?? 0) > 0;
        if (!hasEffect) cleaned = { ...cleaned, onUse: undefined };
      }
      // Strip charges if invalid (must be > 0 when present)
      if (cleaned.charges != null && cleaned.charges <= 0) {
        cleaned = { ...cleaned, charges: undefined };
      }
      items[id] = cleaned;
    }
  }

  const rooms = Object.fromEntries(
    Object.entries(world.rooms).map(([id, room]) => [id, normalizeRoomOutput(room)]),
  );

  const trainers = world.trainers && hasEntries(world.trainers)
    ? Object.fromEntries(
        Object.entries(world.trainers).map(([id, trainer]) => [id, normalizeTrainerOutput(trainer)]),
      )
    : undefined;

  const puzzles = world.puzzles && hasEntries(world.puzzles)
    ? Object.fromEntries(
        Object.entries(world.puzzles).map(([id, puzzle]) => [id, { ...puzzle, reward: normalizePuzzleReward(puzzle.reward) }]),
      )
    : undefined;

  // Build result with only non-empty optional collections
  const result: WorldFile = { zone, startRoom, rooms };

  if (world.lifespan != null && world.lifespan > 0) result.lifespan = world.lifespan;
  if (world.terrain) result.terrain = world.terrain;
  if (world.graphical) result.graphical = true;
  if (world.pvpEnabled) result.pvpEnabled = true;
  if (world.faction?.trim()) result.faction = world.faction.trim();
  if (world.image) {
    // Strip zoneMap — it's Arcanum-only; the MUD server's ZoneImageDefaults
    // doesn't recognize it and will crash on the unknown field.
    const { zoneMap: _, ...mudImage } = world.image;
    if (Object.keys(mudImage).some((k) => (mudImage as Record<string, unknown>)[k] != null)) {
      result.image = mudImage;
    }
  }
  if (world.audio) result.audio = world.audio;
  if (hasEntries(world.mobs)) result.mobs = world.mobs;
  if (hasEntries(items)) result.items = items;
  if (hasEntries(world.shops)) result.shops = world.shops;
  if (hasEntries(trainers)) result.trainers = trainers;
  if (hasEntries(world.quests)) result.quests = world.quests;
  if (hasEntries(world.gatheringNodes)) result.gatheringNodes = world.gatheringNodes;
  if (hasEntries(world.recipes)) result.recipes = world.recipes;
  if (hasEntries(puzzles)) result.puzzles = puzzles;
  if (world.dungeon) result.dungeon = world.dungeon;

  return result;
}

// ─── Main entry point ─────────────────────────────────────────────

/**
 * Sanitize a WorldFile for safe serialization to YAML.
 * Arcanum is forgiving when reading, but never writes invalid data.
 *
 * Phase 1: Fix invalid entity IDs (numeric-only, special chars) + cascade
 * Phase 2: Strip entities with broken hard requirements (invalid room refs)
 * Phase 3: Clean up dangling references in surviving entities
 * Phase 4: Omit empty collections, zero stats, ensure required defaults
 */
export function sanitizeZone(world: WorldFile): WorldFile {
  // Phase 1
  const t: RemapTables = {
    room: buildIdRemap(Object.keys(world.rooms ?? {}), "room"),
    mob: buildIdRemap(Object.keys(world.mobs ?? {}), "mob"),
    item: buildIdRemap(Object.keys(world.items ?? {}), "item"),
    shop: buildIdRemap(Object.keys(world.shops ?? {}), "shop"),
    trainer: buildIdRemap(Object.keys(world.trainers ?? {}), "trainer"),
    quest: buildIdRemap(Object.keys(world.quests ?? {}), "quest"),
    node: buildIdRemap(Object.keys(world.gatheringNodes ?? {}), "node"),
    recipe: buildIdRemap(Object.keys(world.recipes ?? {}), "recipe"),
  };

  let w = applyIdRemaps(world, t);

  // Phase 2
  w = stripInvalidEntities(w);

  // Phase 3
  w = stripDanglingReferences(w);

  // Phase 4
  w = cleanOutput(w);

  return w;
}
