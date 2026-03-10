import type { AppConfig } from "@/types/config";

/** All tier values: the configured level tiers plus the special "staff" tier. */
export function getAllTiers(config: AppConfig): Array<number | "staff"> {
  const tiers: Array<number | "staff"> = [...config.images.spriteLevelTiers].sort((a, b) => a - b);
  tiers.push("staff");
  return tiers;
}

/** Human-readable tier label. */
export function tierLabel(tier: number | "staff"): string {
  return tier === "staff" ? "tstaff (Staff)" : `t${tier}`;
}

/** Level range for a tier. */
export function tierRange(tier: number | "staff", allTiers: Array<number | "staff">): string {
  if (tier === "staff") return "Staff";
  const numeric = allTiers.filter((t): t is number => t !== "staff").sort((a, b) => a - b);
  const idx = numeric.indexOf(tier);
  if (idx === -1) return `${tier}+`;
  const nextTier = numeric[idx + 1];
  if (nextTier === undefined) return `${tier}+`;
  return `${tier}–${nextTier - 1}`;
}

/** Extract race/class/tier values from config for the sprite matrix. */
export function getSpriteAxes(config: AppConfig) {
  const races = Object.keys(config.races).map((r) => r.toLowerCase());
  const classes = Object.keys(config.classes).map((c) => c.toLowerCase());
  const tiers = getAllTiers(config);

  return { races, classes, tiers };
}

/** Build the sprite key (matches the filename convention without extension). */
export function spriteKey(race: string, cls: string, tier: number | "staff"): string {
  return `${race}_${cls}_t${tier}`;
}

/** Build the full filename path as the server expects it. */
export function spriteFilename(race: string, cls: string, tier: number | "staff"): string {
  return `player_sprites/${spriteKey(race, cls, tier)}.png`;
}

/** Total number of sprites in the matrix. */
export function totalSprites(config: AppConfig): number {
  const { races, classes, tiers } = getSpriteAxes(config);
  return races.length * classes.length * tiers.length;
}
