import type { WorldFile } from "@/types/world";
import type { EquipmentSlotDefinition } from "@/types/config";
import { exitTarget } from "./zoneEdits";

export type Severity = "error" | "warning";

export interface ValidationIssue {
  severity: Severity;
  /** e.g. "room:tavern", "mob:rat", "quest:fetch_sword" */
  entity: string;
  message: string;
}

/**
 * Validate a single zone's WorldFile for referential integrity and
 * common mistakes. Returns an array of issues (empty = valid).
 */
export function validateZone(
  world: WorldFile,
  equipmentSlots?: Record<string, EquipmentSlotDefinition>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const roomIds = new Set(Object.keys(world.rooms));
  const mobIds = new Set(Object.keys(world.mobs ?? {}));
  const itemIds = new Set(Object.keys(world.items ?? {}));

  // ─── Zone-level checks ──────────────────────────────────────────
  if (!world.startRoom) {
    issues.push({
      severity: "error",
      entity: "zone",
      message: "No start room defined",
    });
  } else if (!roomIds.has(world.startRoom)) {
    issues.push({
      severity: "error",
      entity: "zone",
      message: `Start room "${world.startRoom}" does not exist`,
    });
  }

  if (roomIds.size === 0) {
    issues.push({
      severity: "error",
      entity: "zone",
      message: "Zone has no rooms",
    });
  }

  // ─── Room checks ────────────────────────────────────────────────
  for (const [roomId, room] of Object.entries(world.rooms)) {
    if (!room.title?.trim()) {
      issues.push({
        severity: "warning",
        entity: `room:${roomId}`,
        message: "Room has no title",
      });
    }
    if (!room.description?.trim()) {
      issues.push({
        severity: "warning",
        entity: `room:${roomId}`,
        message: "Room has no description",
      });
    }

    // Exit targets
    for (const [dir, exit] of Object.entries(room.exits ?? {})) {
      const target = exitTarget(exit);
      // Cross-zone exits (contain ":") are not validated here
      if (!target.includes(":") && !roomIds.has(target)) {
        issues.push({
          severity: "error",
          entity: `room:${roomId}`,
          message: `Exit "${dir}" points to non-existent room "${target}"`,
        });
      }

      // Door key validation
      if (typeof exit !== "string" && exit.door?.key) {
        if (!itemIds.has(exit.door.key)) {
          issues.push({
            severity: "warning",
            entity: `room:${roomId}`,
            message: `Exit "${dir}" door key "${exit.door.key}" is not a known item in this zone`,
          });
        }
      }
    }
  }

  // ─── Mob checks ─────────────────────────────────────────────────
  for (const [mobId, mob] of Object.entries(world.mobs ?? {})) {
    if (!mob.name?.trim()) {
      issues.push({
        severity: "warning",
        entity: `mob:${mobId}`,
        message: "Mob has no name",
      });
    }
    if (!roomIds.has(mob.room)) {
      issues.push({
        severity: "error",
        entity: `mob:${mobId}`,
        message: `Room "${mob.room}" does not exist`,
      });
    }

    // Drop references
    for (const drop of mob.drops ?? []) {
      if (!drop.itemId) {
        issues.push({
          severity: "warning",
          entity: `mob:${mobId}`,
          message: "Drop has empty item ID",
        });
      } else if (!itemIds.has(drop.itemId)) {
        issues.push({
          severity: "warning",
          entity: `mob:${mobId}`,
          message: `Drop item "${drop.itemId}" is not a known item in this zone`,
        });
      }
      if (drop.chance <= 0 || drop.chance > 100) {
        issues.push({
          severity: "warning",
          entity: `mob:${mobId}`,
          message: `Drop "${drop.itemId}" has invalid chance ${drop.chance}`,
        });
      }
    }

    // Behavior patrol route
    if (mob.behavior?.params?.patrolRoute) {
      for (const routeRoom of mob.behavior.params.patrolRoute) {
        if (!roomIds.has(routeRoom)) {
          issues.push({
            severity: "error",
            entity: `mob:${mobId}`,
            message: `Patrol route room "${routeRoom}" does not exist`,
          });
        }
      }
    }

    // Quest references
    for (const questId of mob.quests ?? []) {
      if (!world.quests?.[questId]) {
        issues.push({
          severity: "error",
          entity: `mob:${mobId}`,
          message: `Quest "${questId}" does not exist`,
        });
      }
    }

    // Dialogue node references
    if (mob.dialogue) {
      const dialogueIds = new Set(Object.keys(mob.dialogue));
      for (const [nodeId, node] of Object.entries(mob.dialogue)) {
        if (!node.text?.trim()) {
          issues.push({
            severity: "warning",
            entity: `mob:${mobId}`,
            message: `Dialogue node "${nodeId}" has empty text`,
          });
        }
        for (const choice of node.choices ?? []) {
          if (!choice.text?.trim()) {
            issues.push({
              severity: "warning",
              entity: `mob:${mobId}`,
              message: `Dialogue node "${nodeId}" has a choice with empty text`,
            });
          }
          if (choice.next && !dialogueIds.has(choice.next)) {
            issues.push({
              severity: "error",
              entity: `mob:${mobId}`,
              message: `Dialogue choice in "${nodeId}" points to non-existent node "${choice.next}"`,
            });
          }
        }
      }
    }
  }

  // ─── Item checks ────────────────────────────────────────────────
  for (const [itemId, item] of Object.entries(world.items ?? {})) {
    if (!item.displayName?.trim()) {
      issues.push({
        severity: "warning",
        entity: `item:${itemId}`,
        message: "Item has no display name",
      });
    }
    if (item.room && !roomIds.has(item.room)) {
      issues.push({
        severity: "error",
        entity: `item:${itemId}`,
        message: `Room "${item.room}" does not exist`,
      });
    }
    if (item.slot && equipmentSlots && Object.keys(equipmentSlots).length > 0) {
      if (!equipmentSlots[item.slot]) {
        issues.push({
          severity: "warning",
          entity: `item:${itemId}`,
          message: `Slot "${item.slot}" is not a defined equipment slot`,
        });
      }
    }
  }

  // ─── Shop checks ───────────────────────────────────────────────
  for (const [shopId, shop] of Object.entries(world.shops ?? {})) {
    if (!shop.name?.trim()) {
      issues.push({
        severity: "warning",
        entity: `shop:${shopId}`,
        message: "Shop has no name",
      });
    }
    if (!roomIds.has(shop.room)) {
      issues.push({
        severity: "error",
        entity: `shop:${shopId}`,
        message: `Room "${shop.room}" does not exist`,
      });
    }
    for (const itemId of shop.items ?? []) {
      if (!itemIds.has(itemId)) {
        issues.push({
          severity: "warning",
          entity: `shop:${shopId}`,
          message: `Inventory item "${itemId}" is not a known item in this zone`,
        });
      }
    }
  }

  // ─── Quest checks ──────────────────────────────────────────────
  for (const [questId, quest] of Object.entries(world.quests ?? {})) {
    if (!quest.name?.trim()) {
      issues.push({
        severity: "warning",
        entity: `quest:${questId}`,
        message: "Quest has no name",
      });
    }
    if (!quest.giver) {
      issues.push({
        severity: "warning",
        entity: `quest:${questId}`,
        message: "Quest has no giver",
      });
    } else if (!mobIds.has(quest.giver)) {
      issues.push({
        severity: "warning",
        entity: `quest:${questId}`,
        message: `Giver mob "${quest.giver}" is not a known mob in this zone`,
      });
    }
    if (!quest.objectives || quest.objectives.length === 0) {
      issues.push({
        severity: "warning",
        entity: `quest:${questId}`,
        message: "Quest has no objectives",
      });
    } else {
      for (const obj of quest.objectives) {
        if (!obj.type) {
          issues.push({
            severity: "warning",
            entity: `quest:${questId}`,
            message: "Objective has no type",
          });
        }
        if (!obj.targetKey) {
          issues.push({
            severity: "warning",
            entity: `quest:${questId}`,
            message: "Objective has no target key",
          });
        }
      }
    }
  }

  // ─── Gathering node checks ─────────────────────────────────────
  for (const [nodeId, node] of Object.entries(world.gatheringNodes ?? {})) {
    if (!node.displayName?.trim()) {
      issues.push({
        severity: "warning",
        entity: `gatheringNode:${nodeId}`,
        message: "Gathering node has no display name",
      });
    }
    if (!roomIds.has(node.room)) {
      issues.push({
        severity: "error",
        entity: `gatheringNode:${nodeId}`,
        message: `Room "${node.room}" does not exist`,
      });
    }
    if (!node.yields || node.yields.length === 0) {
      issues.push({
        severity: "warning",
        entity: `gatheringNode:${nodeId}`,
        message: "Gathering node has no yields",
      });
    } else {
      for (const y of node.yields) {
        if (!y.itemId) {
          issues.push({
            severity: "warning",
            entity: `gatheringNode:${nodeId}`,
            message: "Yield has empty item ID",
          });
        } else if (!itemIds.has(y.itemId)) {
          issues.push({
            severity: "warning",
            entity: `gatheringNode:${nodeId}`,
            message: `Yield item "${y.itemId}" is not a known item in this zone`,
          });
        }
      }
    }
  }

  // ─── Recipe checks ─────────────────────────────────────────────
  for (const [recipeId, recipe] of Object.entries(world.recipes ?? {})) {
    if (!recipe.displayName?.trim()) {
      issues.push({
        severity: "warning",
        entity: `recipe:${recipeId}`,
        message: "Recipe has no display name",
      });
    }
    if (!recipe.outputItemId) {
      issues.push({
        severity: "warning",
        entity: `recipe:${recipeId}`,
        message: "Recipe has no output item",
      });
    } else if (!itemIds.has(recipe.outputItemId)) {
      issues.push({
        severity: "warning",
        entity: `recipe:${recipeId}`,
        message: `Output item "${recipe.outputItemId}" is not a known item in this zone`,
      });
    }
    if (!recipe.materials || recipe.materials.length === 0) {
      issues.push({
        severity: "warning",
        entity: `recipe:${recipeId}`,
        message: "Recipe has no materials",
      });
    } else {
      for (const mat of recipe.materials) {
        if (!mat.itemId) {
          issues.push({
            severity: "warning",
            entity: `recipe:${recipeId}`,
            message: "Material has empty item ID",
          });
        } else if (!itemIds.has(mat.itemId)) {
          issues.push({
            severity: "warning",
            entity: `recipe:${recipeId}`,
            message: `Material item "${mat.itemId}" is not a known item in this zone`,
          });
        }
      }
    }
  }

  // ─── Dungeon template checks ────────────────────────────────────
  if (world.dungeon) {
    const d = world.dungeon;
    if (!d.name?.trim()) {
      issues.push({ severity: "warning", entity: "dungeon", message: "Dungeon has no name" });
    }
    if (d.roomCount) {
      if (d.roomCount.min < 1) {
        issues.push({ severity: "error", entity: "dungeon", message: "Room count min must be >= 1" });
      }
      if (d.roomCount.max < d.roomCount.min) {
        issues.push({ severity: "error", entity: "dungeon", message: "Room count max must be >= min" });
      }
    }
    const categories = Object.entries(d.roomTemplates ?? {});
    if (categories.length === 0) {
      issues.push({ severity: "warning", entity: "dungeon", message: "Dungeon has no room template categories" });
    }
    for (const [cat, templates] of categories) {
      if (templates.length === 0) {
        issues.push({ severity: "warning", entity: "dungeon", message: `Room category "${cat}" is empty` });
      }
      for (const tpl of templates) {
        if (!tpl.title?.trim()) {
          issues.push({ severity: "warning", entity: "dungeon", message: `Room template in "${cat}" has no title` });
        }
      }
    }
    const pools = Object.entries(d.mobPools ?? {});
    if (pools.length === 0) {
      issues.push({ severity: "warning", entity: "dungeon", message: "Dungeon has no mob pools" });
    }
    for (const [pool, mobIds] of pools) {
      if (mobIds.length === 0) {
        issues.push({ severity: "warning", entity: "dungeon", message: `Mob pool "${pool}" is empty` });
      }
    }
  }

  return issues;
}

/** Validate all zones and return a map of zoneId -> issues. */
export function validateAllZones(
  zones: Map<string, { data: WorldFile }>,
  equipmentSlots?: Record<string, EquipmentSlotDefinition>,
): Map<string, ValidationIssue[]> {
  const results = new Map<string, ValidationIssue[]>();
  for (const [zoneId, zone] of zones) {
    const issues = validateZone(zone.data, equipmentSlots);
    if (issues.length > 0) {
      results.set(zoneId, issues);
    }
  }
  return results;
}
