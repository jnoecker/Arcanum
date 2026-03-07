import type { WorldFile } from "@/types/world";
import type { AppConfig, StatBindings } from "@/types/config";

// ─── Zone-level renames ────────────────────────────────────────────

/** Rename a room ID and cascade to all references. */
export function renameRoom(world: WorldFile, oldId: string, newId: string): WorldFile {
  if (oldId === newId || !world.rooms[oldId]) return world;

  const rooms = { ...world.rooms };
  rooms[newId] = rooms[oldId]!;
  delete rooms[oldId];

  // Update exit targets in all rooms
  for (const [roomId, room] of Object.entries(rooms)) {
    if (!room.exits) continue;
    let changed = false;
    const exits = { ...room.exits };
    for (const [dir, exit] of Object.entries(exits)) {
      if (typeof exit === "string") {
        if (exit === oldId) {
          exits[dir] = newId;
          changed = true;
        }
      } else if (exit.to === oldId) {
        exits[dir] = { ...exit, to: newId };
        changed = true;
      }
    }
    if (changed) rooms[roomId] = { ...room, exits };
  }

  // Update mob.room
  const mobs = world.mobs ? { ...world.mobs } : undefined;
  if (mobs) {
    for (const [mobId, mob] of Object.entries(mobs)) {
      if (mob.room === oldId) mobs[mobId] = { ...mob, room: newId };
      if (mob.behavior?.params?.patrolRoute) {
        const route = mob.behavior.params.patrolRoute;
        if (route.includes(oldId)) {
          mobs[mobId] = {
            ...mobs[mobId]!,
            behavior: {
              ...mobs[mobId]!.behavior!,
              params: {
                ...mobs[mobId]!.behavior!.params,
                patrolRoute: route.map((r) => (r === oldId ? newId : r)),
              },
            },
          };
        }
      }
    }
  }

  // Update item.room
  const items = world.items ? { ...world.items } : undefined;
  if (items) {
    for (const [itemId, item] of Object.entries(items)) {
      if (item.room === oldId) items[itemId] = { ...item, room: newId };
    }
  }

  // Update shop.room
  const shops = world.shops ? { ...world.shops } : undefined;
  if (shops) {
    for (const [shopId, shop] of Object.entries(shops)) {
      if (shop.room === oldId) shops[shopId] = { ...shop, room: newId };
    }
  }

  // Update gatheringNode.room
  const gatheringNodes = world.gatheringNodes ? { ...world.gatheringNodes } : undefined;
  if (gatheringNodes) {
    for (const [nodeId, node] of Object.entries(gatheringNodes)) {
      if (node.room === oldId) gatheringNodes[nodeId] = { ...node, room: newId };
    }
  }

  return {
    ...world,
    rooms,
    startRoom: world.startRoom === oldId ? newId : world.startRoom,
    ...(mobs && { mobs }),
    ...(items && { items }),
    ...(shops && { shops }),
    ...(gatheringNodes && { gatheringNodes }),
  };
}

/** Rename a mob ID and cascade to quest.giver refs. */
export function renameMob(world: WorldFile, oldId: string, newId: string): WorldFile {
  if (oldId === newId || !world.mobs?.[oldId]) return world;

  const mobs = { ...world.mobs };
  mobs[newId] = mobs[oldId]!;
  delete mobs[oldId];

  // Update quest.giver
  const quests = world.quests ? { ...world.quests } : undefined;
  if (quests) {
    for (const [questId, quest] of Object.entries(quests)) {
      if (quest.giver === oldId) quests[questId] = { ...quest, giver: newId };
    }
  }

  return { ...world, mobs, ...(quests && { quests }) };
}

/** Rename an item ID and cascade to all references. */
export function renameItem(world: WorldFile, oldId: string, newId: string): WorldFile {
  if (oldId === newId || !world.items?.[oldId]) return world;

  const items = { ...world.items };
  items[newId] = items[oldId]!;
  delete items[oldId];

  // Update mob drops
  const mobs = world.mobs ? { ...world.mobs } : undefined;
  if (mobs) {
    for (const [mobId, mob] of Object.entries(mobs)) {
      if (mob.drops?.some((d) => d.itemId === oldId)) {
        mobs[mobId] = {
          ...mob,
          drops: mob.drops!.map((d) =>
            d.itemId === oldId ? { ...d, itemId: newId } : d,
          ),
        };
      }
    }
  }

  // Update shop inventory
  const shops = world.shops ? { ...world.shops } : undefined;
  if (shops) {
    for (const [shopId, shop] of Object.entries(shops)) {
      if (shop.items?.includes(oldId)) {
        shops[shopId] = {
          ...shop,
          items: shop.items.map((i) => (i === oldId ? newId : i)),
        };
      }
    }
  }

  // Update recipe materials and output
  const recipes = world.recipes ? { ...world.recipes } : undefined;
  if (recipes) {
    for (const [recipeId, recipe] of Object.entries(recipes)) {
      let changed = false;
      let outputItemId = recipe.outputItemId;
      if (outputItemId === oldId) {
        outputItemId = newId;
        changed = true;
      }
      const materials = recipe.materials.map((m) => {
        if (m.itemId === oldId) {
          changed = true;
          return { ...m, itemId: newId };
        }
        return m;
      });
      if (changed) {
        recipes[recipeId] = { ...recipe, outputItemId, materials };
      }
    }
  }

  // Update gathering node yields
  const gatheringNodes = world.gatheringNodes ? { ...world.gatheringNodes } : undefined;
  if (gatheringNodes) {
    for (const [nodeId, node] of Object.entries(gatheringNodes)) {
      if (node.yields.some((y) => y.itemId === oldId)) {
        gatheringNodes[nodeId] = {
          ...node,
          yields: node.yields.map((y) =>
            y.itemId === oldId ? { ...y, itemId: newId } : y,
          ),
        };
      }
    }
  }

  // Update door keys in room exits
  const rooms = { ...world.rooms };
  for (const [roomId, room] of Object.entries(rooms)) {
    if (!room.exits) continue;
    let changed = false;
    const exits = { ...room.exits };
    for (const [dir, exit] of Object.entries(exits)) {
      if (typeof exit !== "string" && exit.door?.key === oldId) {
        exits[dir] = { ...exit, door: { ...exit.door, key: newId } };
        changed = true;
      }
    }
    if (changed) rooms[roomId] = { ...room, exits };
  }

  return {
    ...world,
    rooms,
    items,
    ...(mobs && { mobs }),
    ...(shops && { shops }),
    ...(recipes && { recipes }),
    ...(gatheringNodes && { gatheringNodes }),
  };
}

/** Rename a quest ID and cascade to mob.quests arrays. */
export function renameQuest(world: WorldFile, oldId: string, newId: string): WorldFile {
  if (oldId === newId || !world.quests?.[oldId]) return world;

  const quests = { ...world.quests };
  quests[newId] = quests[oldId]!;
  delete quests[oldId];

  const mobs = world.mobs ? { ...world.mobs } : undefined;
  if (mobs) {
    for (const [mobId, mob] of Object.entries(mobs)) {
      if (mob.quests?.includes(oldId)) {
        mobs[mobId] = {
          ...mob,
          quests: mob.quests.map((q) => (q === oldId ? newId : q)),
        };
      }
    }
  }

  return { ...world, quests, ...(mobs && { mobs }) };
}

/** Rename a shop ID (no inbound references currently). */
export function renameShop(world: WorldFile, oldId: string, newId: string): WorldFile {
  if (oldId === newId || !world.shops?.[oldId]) return world;
  const shops = { ...world.shops };
  shops[newId] = shops[oldId]!;
  delete shops[oldId];
  return { ...world, shops };
}

/** Rename a gathering node ID (no inbound references currently). */
export function renameGatheringNode(world: WorldFile, oldId: string, newId: string): WorldFile {
  if (oldId === newId || !world.gatheringNodes?.[oldId]) return world;
  const gatheringNodes = { ...world.gatheringNodes };
  gatheringNodes[newId] = gatheringNodes[oldId]!;
  delete gatheringNodes[oldId];
  return { ...world, gatheringNodes };
}

/** Rename a recipe ID (no inbound references currently). */
export function renameRecipe(world: WorldFile, oldId: string, newId: string): WorldFile {
  if (oldId === newId || !world.recipes?.[oldId]) return world;
  const recipes = { ...world.recipes };
  recipes[newId] = recipes[oldId]!;
  delete recipes[oldId];
  return { ...world, recipes };
}

// ─── Count references (for confirmation dialog) ───────────────────

export type EntityCategory = "room" | "mob" | "item" | "quest" | "shop" | "gatheringNode" | "recipe";

export function countReferences(world: WorldFile, category: EntityCategory, entityId: string): number {
  let count = 0;

  if (category === "room") {
    if (world.startRoom === entityId) count++;
    for (const room of Object.values(world.rooms)) {
      for (const exit of Object.values(room.exits ?? {})) {
        const target = typeof exit === "string" ? exit : exit.to;
        if (target === entityId) count++;
      }
    }
    for (const mob of Object.values(world.mobs ?? {})) {
      if (mob.room === entityId) count++;
      if (mob.behavior?.params?.patrolRoute?.includes(entityId)) count++;
    }
    for (const item of Object.values(world.items ?? {})) {
      if (item.room === entityId) count++;
    }
    for (const shop of Object.values(world.shops ?? {})) {
      if (shop.room === entityId) count++;
    }
    for (const node of Object.values(world.gatheringNodes ?? {})) {
      if (node.room === entityId) count++;
    }
  } else if (category === "mob") {
    for (const quest of Object.values(world.quests ?? {})) {
      if (quest.giver === entityId) count++;
    }
  } else if (category === "item") {
    for (const mob of Object.values(world.mobs ?? {})) {
      count += (mob.drops ?? []).filter((d) => d.itemId === entityId).length;
    }
    for (const shop of Object.values(world.shops ?? {})) {
      count += (shop.items ?? []).filter((i) => i === entityId).length;
    }
    for (const recipe of Object.values(world.recipes ?? {})) {
      if (recipe.outputItemId === entityId) count++;
      count += recipe.materials.filter((m) => m.itemId === entityId).length;
    }
    for (const node of Object.values(world.gatheringNodes ?? {})) {
      count += node.yields.filter((y) => y.itemId === entityId).length;
    }
    for (const room of Object.values(world.rooms)) {
      for (const exit of Object.values(room.exits ?? {})) {
        if (typeof exit !== "string" && exit.door?.key === entityId) count++;
      }
    }
  } else if (category === "quest") {
    for (const mob of Object.values(world.mobs ?? {})) {
      count += (mob.quests ?? []).filter((q) => q === entityId).length;
    }
  }

  return count;
}

// ─── Config-level renames ─────────────────────────────────────────

/** Rename a key in a Record, preserving all other entries. */
function renameKey<T>(record: Record<string, T>, oldKey: string, newKey: string): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [k, v] of Object.entries(record)) {
    result[k === oldKey ? newKey : k] = v;
  }
  return result;
}

/** Rename a stat ID across the entire config. */
export function renameStatInConfig(config: AppConfig, oldId: string, newId: string): AppConfig {
  if (oldId === newId) return config;

  const oldBindings = config.stats.bindings;
  const bindings: StatBindings = { ...oldBindings };
  // Rename stat references in bindings (string fields that reference stat IDs)
  const statKeys = [
    "meleeDamageStat", "dodgeStat", "spellDamageStat",
    "hpScalingStat", "manaScalingStat", "hpRegenStat",
    "manaRegenStat", "xpBonusStat",
  ] as const;
  for (const key of statKeys) {
    if (bindings[key] === oldId) {
      (bindings as unknown as Record<string, unknown>)[key] = newId;
    }
  }

  const stats = {
    ...config.stats,
    definitions: renameKey(config.stats.definitions, oldId, newId),
    bindings,
  };

  // Race statMods
  const races: typeof config.races = {};
  for (const [raceId, race] of Object.entries(config.races)) {
    if (race.statMods && oldId in race.statMods) {
      races[raceId] = { ...race, statMods: renameKey(race.statMods, oldId, newId) };
    } else {
      races[raceId] = race;
    }
  }

  // Status effect statMods
  const statusEffects: typeof config.statusEffects = {};
  for (const [seId, se] of Object.entries(config.statusEffects)) {
    if (se.statMods && oldId in se.statMods) {
      statusEffects[seId] = { ...se, statMods: renameKey(se.statMods, oldId, newId) };
    } else {
      statusEffects[seId] = se;
    }
  }

  // Class primaryStat
  const classes: typeof config.classes = {};
  for (const [classId, cls] of Object.entries(config.classes)) {
    if (cls.primaryStat === oldId) {
      classes[classId] = { ...cls, primaryStat: newId };
    } else {
      classes[classId] = cls;
    }
  }

  return { ...config, stats, races, statusEffects, classes };
}

/** Rename a class ID across the config. */
export function renameClassInConfig(config: AppConfig, oldId: string, newId: string): AppConfig {
  if (oldId === newId) return config;

  const classes = renameKey(config.classes, oldId, newId);

  // Ability classRestriction
  const abilities: typeof config.abilities = {};
  for (const [abilityId, ability] of Object.entries(config.abilities)) {
    if (ability.classRestriction === oldId) {
      abilities[abilityId] = { ...ability, classRestriction: newId };
    } else {
      abilities[abilityId] = ability;
    }
  }

  return { ...config, classes, abilities };
}

/** Rename a status effect ID across the config. */
export function renameStatusEffectInConfig(config: AppConfig, oldId: string, newId: string): AppConfig {
  if (oldId === newId) return config;

  const statusEffects = renameKey(config.statusEffects, oldId, newId);

  // Ability statusEffectId
  const abilities: typeof config.abilities = {};
  for (const [abilityId, ability] of Object.entries(config.abilities)) {
    if (ability.effect.statusEffectId === oldId) {
      abilities[abilityId] = {
        ...ability,
        effect: { ...ability.effect, statusEffectId: newId },
      };
    } else {
      abilities[abilityId] = ability;
    }
  }

  return { ...config, statusEffects, abilities };
}
