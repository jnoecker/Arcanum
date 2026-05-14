import type { ItemFile } from "@/types/world";
import type { ItemBudgetConfig } from "@/types/config";

export interface ItemBudgetEvaluation {
  itemId: string;
  slot: string;
  level: number;
  rarity: string;
  spent: number;
  budget: number;
  tolerance: number;
  overBudget: boolean;
  breakdown: string[];
}

/**
 * Port of `dev.ambon.domain.world.ItemBudgetEvaluation.evaluate` from AmbonMUD.
 * Returns null when the item opts out (no level/rarity, no slot, or config disabled).
 * Throws when the item declares an unknown slot or rarity — callers should catch
 * and surface as a validation error rather than crashing.
 */
export function evaluateItemBudget(
  itemId: string,
  item: ItemFile,
  config: ItemBudgetConfig,
): ItemBudgetEvaluation | null {
  if (!config.enabled) return null;
  if (item.level == null && item.rarity == null) return null;
  if (!item.slot) return null;

  const slotKey = item.slot.toLowerCase();
  const slotBase = config.slotBaseBudget[slotKey];
  if (slotBase == null) {
    throw new Error(`Unknown slot "${item.slot}" — not in itemBudget.slotBaseBudget`);
  }

  const rarityKey = (item.rarity ?? config.defaultRarity).toLowerCase();
  const rarityMult = config.rarityMultiplier[rarityKey];
  if (rarityMult == null) {
    throw new Error(`Unknown rarity "${rarityKey}" — not in itemBudget.rarityMultiplier`);
  }

  const level = Math.max(1, item.level ?? 1);
  const budget = (slotBase + level * config.pointsPerLevel) * rarityMult;

  const damage = item.damage ?? 0;
  const armor = item.armor ?? 0;
  const statSum = Object.values(item.stats ?? {}).reduce((a, b) => a + b, 0);

  const damagePoints = damage * config.damagePointCost;
  const armorPoints = armor * config.armorPointCost;
  const statPoints = statSum * config.statPointCost;
  const spent = damagePoints + armorPoints + statPoints;

  const breakdown: string[] = [];
  if (damagePoints > 0) breakdown.push(`damage ${damage}=${damagePoints.toFixed(1)}pt`);
  if (armorPoints > 0) breakdown.push(`armor ${armor}=${armorPoints.toFixed(1)}pt`);
  if (statPoints > 0) breakdown.push(`stats ${statSum}=${statPoints.toFixed(1)}pt`);

  const overBudget = spent > budget * (1 + config.tolerance);

  return {
    itemId,
    slot: slotKey,
    level,
    rarity: rarityKey,
    spent,
    budget,
    tolerance: config.tolerance,
    overBudget,
    breakdown,
  };
}

/** One-line summary suitable for a validation issue message. */
export function summarizeItemBudget(evaluation: ItemBudgetEvaluation): string {
  const pct = evaluation.budget > 0 ? Math.round((evaluation.spent / evaluation.budget) * 100) : 0;
  const breakdown = evaluation.breakdown.length > 0 ? evaluation.breakdown.join(", ") : "no contributions";
  return `Item over power budget: spent ${evaluation.spent.toFixed(1)} / ${evaluation.budget.toFixed(1)} points (${pct}%), breakdown: ${breakdown}`;
}
