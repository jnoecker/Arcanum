import type { AppConfig } from "@/types/config";

export type SpriteTier = number | "staff";

export function isRaceOnlyTier(tier: SpriteTier): boolean {
  return tier === 1 || tier === "staff";
}

export function spriteClassForTier(cls: string, tier: SpriteTier): string {
  return isRaceOnlyTier(tier) ? "base" : cls;
}

/** All tier values: base, configured level tiers, plus the special staff tier. */
export function getAllTiers(config: AppConfig): SpriteTier[] {
  const numeric = Array.from(new Set([1, ...config.images.spriteLevelTiers])).sort((a, b) => a - b);
  return [...numeric, "staff"];
}

/** Human-readable tier label. */
export function tierLabel(tier: SpriteTier): string {
  if (tier === "staff") return "tstaff (Staff)";
  return tier === 1 ? "t1 (Base)" : `t${tier}`;
}

/** Level range for a tier. */
export function tierRange(tier: SpriteTier, allTiers: SpriteTier[]): string {
  if (tier === "staff") return "Staff";
  const numeric = allTiers.filter((t): t is number => t !== "staff").sort((a, b) => a - b);
  const idx = numeric.indexOf(tier);
  if (idx === -1) return `${tier}+`;
  const nextTier = numeric[idx + 1];
  if (nextTier === undefined) return `${tier}+`;
  return `${tier}-${nextTier - 1}`;
}

/** Extract race/class/tier values from config for the sprite matrix. */
export function getSpriteAxes(config: AppConfig) {
  const races = Object.keys(config.races).map((r) => r.toLowerCase());
  const classes = Object.keys(config.classes).map((c) => c.toLowerCase());
  const tiers = getAllTiers(config);

  return { races, classes, tiers };
}

/** Build the sprite key (matches the filename convention without extension). */
export function spriteKey(race: string, cls: string, tier: SpriteTier): string {
  return `${race}_${spriteClassForTier(cls, tier)}_t${tier}`;
}

/** Build the full filename path as the server expects it. */
export function spriteFilename(race: string, cls: string, tier: SpriteTier): string {
  return `player_sprites/${spriteKey(race, cls, tier)}.png`;
}

/** Total number of sprites in the matrix. */
export function totalSprites(config: AppConfig): number {
  const { races, classes, tiers } = getSpriteAxes(config);
  const sharedTierCount = tiers.filter(isRaceOnlyTier).length;
  const classTierCount = tiers.length - sharedTierCount;
  return races.length * sharedTierCount + races.length * classes.length * classTierCount;
}
