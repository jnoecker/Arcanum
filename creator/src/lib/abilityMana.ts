import type {
  AbilityDefinitionConfig,
  AppConfig,
  ClassDefinitionConfig,
  LevelRewardsConfig,
} from "@/types/config";

export function playerBaseManaAtLevel(
  level: number,
  rewards: Pick<LevelRewardsConfig, "baseMana" | "manaScalingRate">,
  classManaScalingRate?: number,
): number {
  const resolvedLevel = Math.max(1, level || 1);
  const rate = classManaScalingRate ?? rewards.manaScalingRate;
  return Math.max(
    rewards.baseMana,
    Math.floor(rewards.baseMana * Math.pow(rate, resolvedLevel - 1)),
  );
}

function roundPct(value: number): number {
  return Math.round(value * 100) / 100;
}

export function manaCostPctFromFlatCost(
  manaCost: number,
  ability: Pick<AbilityDefinitionConfig, "levelRequired" | "requiredClass" | "classRestriction">,
  classes: Record<string, ClassDefinitionConfig>,
  progression: Pick<AppConfig["progression"], "rewards">,
): number {
  if (manaCost <= 0) return 0;
  const requiredClass = ability.requiredClass?.trim() || ability.classRestriction?.trim() || "";
  const classManaScalingRate = requiredClass ? classes[requiredClass]?.manaScalingRate : undefined;
  const baseMana = playerBaseManaAtLevel(ability.levelRequired, progression.rewards, classManaScalingRate);
  return roundPct((manaCost / Math.max(baseMana, 1)) * 100);
}

export function manaCostFromPct(manaCostPct: number, baseMana: number): number {
  if (manaCostPct <= 0) return 0;
  return Math.max(1, Math.round(baseMana * (manaCostPct / 100)));
}

export function normalizeAbilityManaCost(
  ability: AbilityDefinitionConfig,
  classes: Record<string, ClassDefinitionConfig>,
  progression: Pick<AppConfig["progression"], "rewards">,
): AbilityDefinitionConfig {
  const legacy = ability as AbilityDefinitionConfig & { manaCost?: number };
  const manaCostPct =
    typeof ability.manaCostPct === "number"
      ? ability.manaCostPct
      : manaCostPctFromFlatCost(legacy.manaCost ?? 10, ability, classes, progression);
  const next = { ...ability, manaCostPct };
  delete (next as AbilityDefinitionConfig & { manaCost?: number }).manaCost;
  return next;
}
