import type { AppConfig } from "@/types/config";

/** All tier levels including the staff tier. */
export function getAllTiers(config: AppConfig): number[] {
  const tiers = [...config.images.spriteLevelTiers].sort((a, b) => a - b);
  const staff = config.images.staffSpriteTier;
  if (!tiers.includes(staff)) {
    tiers.push(staff);
  }
  return tiers;
}

/** Human-readable tier label. */
export function tierLabel(tier: number, staffTier: number): string {
  return tier === staffTier ? `l${tier} (Staff)` : `l${tier}`;
}

/** Level range for a tier. */
export function tierRange(tier: number, allTiers: number[], staffTier: number): string {
  if (tier === staffTier) return "Staff";
  const sorted = allTiers.filter((t) => t !== staffTier).sort((a, b) => a - b);
  const idx = sorted.indexOf(tier);
  if (idx === -1) return `${tier}+`;
  const nextTier = sorted[idx + 1];
  if (nextTier === undefined) return `${tier}+`;
  return `${tier}–${nextTier - 1}`;
}

/** Extract race/gender/class/tier values from config. */
export function getSpriteAxes(config: AppConfig) {
  const races = Object.keys(config.races).map((r) => r.toLowerCase());
  const genders = Object.entries(config.genders).map(([key, g]) => ({
    id: (g.spriteCode || key).toLowerCase(),
    label: g.displayName,
  }));
  const classes = Object.keys(config.classes).map((c) => c.toLowerCase());
  const tiers = getAllTiers(config);

  return { races, genders, classes, tiers };
}

/** Build the sprite key (matches the filename convention without extension). */
export function spriteKey(race: string, gender: string, cls: string, tier: number): string {
  return `${race}_${gender}_${cls}_l${tier}`;
}

/** Build the full filename path as the server expects it. */
export function spriteFilename(race: string, gender: string, cls: string, tier: number): string {
  return `player_sprites/${spriteKey(race, gender, cls, tier)}.png`;
}

/** Total number of sprites in the matrix. */
export function totalSprites(config: AppConfig): number {
  const { races, genders, classes, tiers } = getSpriteAxes(config);
  return races.length * genders.length * classes.length * tiers.length;
}
