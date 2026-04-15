import { DEFAULT_REPUTATION_TIERS, type ReputationTier, type FactionConfig } from "@/types/config";

/** Return tiers sorted low→high, falling back to defaults. */
export function getTiers(config?: FactionConfig | null): ReputationTier[] {
  const raw = config?.tiers;
  const tiers = raw && raw.length > 0 ? [...raw] : [...DEFAULT_REPUTATION_TIERS];
  tiers.sort((a, b) => a.minReputation - b.minReputation);
  return tiers;
}

/** Resolve the tier a given reputation value falls into. */
export function tierForRep(rep: number, config?: FactionConfig | null): ReputationTier {
  const tiers = getTiers(config);
  let match = tiers[0]!;
  for (const t of tiers) {
    if (rep >= t.minReputation) match = t;
  }
  return match;
}

/** Format a reputation value as "Honored (+1500)" for display. */
export function formatRep(rep: number, config?: FactionConfig | null): string {
  const tier = tierForRep(rep, config);
  const sign = rep >= 0 ? "+" : "";
  return `${tier.label} (${sign}${rep})`;
}
