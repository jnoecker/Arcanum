import type { EncounterInputs, EncounterOutcome, EconomyInputs } from "./simulations";

export interface NumericBand {
  min?: number;
  max?: number;
}

export interface EncounterContract {
  id: string;
  label: string;
  inputs: EncounterInputs;
  allowedVerdicts: EncounterOutcome["verdict"][];
  hpRemainingPercent: NumericBand;
}

export interface EconomyContract {
  id: string;
  label: string;
  inputs: EconomyInputs;
  goldPerHour: NumericBand;
}

export interface RegenContract {
  id: string;
  label: string;
  statValue: number;
  intervalMs: NumericBand;
}

export interface ArchetypeContract {
  id: string;
  label: string;
  summary: string;
  pillars: string[];
  combat: EncounterContract[];
  economy: EconomyContract;
  regen: RegenContract;
}

const CANONICAL_TIER_MIX = {
  weak: 0.7,
  standard: 0.25,
  elite: 0.05,
  boss: 0,
} as const;

export const ARCHETYPE_CONTRACTS: Record<string, ArchetypeContract> = {
  casual: {
    id: "casual",
    label: "Casual Adventure",
    summary:
      "Forgiving moment-to-moment play, generous rewards, and low downtime. Players should move quickly without trivializing the world.",
    pillars: [
      "Forgiving same-level fights",
      "Generous gold income",
      "Low downtime",
    ],
    combat: [
      {
        id: "standard-l10",
        label: "Level 10 standard mob",
        inputs: { playerLevel: 10, mobTier: "standard", mobLevel: 10 },
        allowedVerdicts: ["easy"],
        hpRemainingPercent: { min: 85, max: 100 },
      },
      {
        id: "elite-l10",
        label: "Level 10 elite mob",
        inputs: { playerLevel: 10, mobTier: "elite", mobLevel: 10 },
        allowedVerdicts: ["easy", "fair"],
        hpRemainingPercent: { min: 70, max: 100 },
      },
    ],
    economy: {
      id: "economy-l10",
      label: "Level 10 trash run",
      inputs: {
        level: 10,
        killsPerHour: 120,
        tierMix: CANONICAL_TIER_MIX,
        sellRate: 0.5,
        consumableSpendPerHour: 500,
      },
      goldPerHour: { min: 2500, max: 4500 },
    },
    regen: {
      id: "regen-stat30",
      label: "Regen at stat 30",
      statValue: 30,
      intervalMs: { min: 700, max: 1000 },
    },
  },
  balanced: {
    id: "balanced",
    label: "Balanced Realm",
    summary:
      "Steady progression with accessible same-level combat and a healthy economy. This is the general-purpose Arcanum midpoint.",
    pillars: [
      "Measured combat",
      "Steady progression",
      "Healthy economy",
    ],
    combat: [
      {
        id: "standard-l10",
        label: "Level 10 standard mob",
        inputs: { playerLevel: 10, mobTier: "standard", mobLevel: 10 },
        allowedVerdicts: ["easy", "fair"],
        hpRemainingPercent: { min: 65, max: 100 },
      },
      {
        id: "elite-l10",
        label: "Level 10 elite mob",
        inputs: { playerLevel: 10, mobTier: "elite", mobLevel: 10 },
        allowedVerdicts: ["easy", "fair"],
        hpRemainingPercent: { min: 55, max: 85 },
      },
    ],
    economy: {
      id: "economy-l10",
      label: "Level 10 trash run",
      inputs: {
        level: 10,
        killsPerHour: 120,
        tierMix: CANONICAL_TIER_MIX,
        sellRate: 0.5,
        consumableSpendPerHour: 500,
      },
      goldPerHour: { min: 1400, max: 2300 },
    },
    regen: {
      id: "regen-stat30",
      label: "Regen at stat 30",
      statValue: 30,
      intervalMs: { min: 900, max: 1200 },
    },
  },
  hardcore: {
    id: "hardcore",
    label: "Hardcore Trials",
    summary:
      "Punishing same-level encounters, slower progression, and constrained resources. Success should require planning and efficiency.",
    pillars: [
      "Dangerous same-level fights",
      "Slow progression",
      "Meaningful scarcity",
    ],
    combat: [
      {
        id: "standard-l10",
        label: "Level 10 standard mob",
        inputs: { playerLevel: 10, mobTier: "standard", mobLevel: 10 },
        allowedVerdicts: ["fair", "risky"],
        hpRemainingPercent: { min: 0, max: 75 },
      },
      {
        id: "elite-l10",
        label: "Level 10 elite mob",
        inputs: { playerLevel: 10, mobTier: "elite", mobLevel: 10 },
        allowedVerdicts: ["risky", "lethal"],
        hpRemainingPercent: { min: 0, max: 25 },
      },
    ],
    economy: {
      id: "economy-l10",
      label: "Level 10 trash run",
      inputs: {
        level: 10,
        killsPerHour: 120,
        tierMix: CANONICAL_TIER_MIX,
        sellRate: 0.5,
        consumableSpendPerHour: 500,
      },
      goldPerHour: { min: 900, max: 1400 },
    },
    regen: {
      id: "regen-stat30",
      label: "Regen at stat 30",
      statValue: 30,
      intervalMs: { min: 2500, max: 3200 },
    },
  },
  soloStory: {
    id: "soloStory",
    label: "Solo Story",
    summary:
      "Narrative-first solo play with very forgiving combat, strong rewards, and almost no downtime. It should still respect an actual progression arc.",
    pillars: [
      "Very forgiving solo combat",
      "Strong reward flow",
      "Minimal downtime",
    ],
    combat: [
      {
        id: "standard-l10",
        label: "Level 10 standard mob",
        inputs: { playerLevel: 10, mobTier: "standard", mobLevel: 10 },
        allowedVerdicts: ["easy"],
        hpRemainingPercent: { min: 95, max: 100 },
      },
      {
        id: "elite-l10",
        label: "Level 10 elite mob",
        inputs: { playerLevel: 10, mobTier: "elite", mobLevel: 10 },
        allowedVerdicts: ["easy"],
        hpRemainingPercent: { min: 85, max: 100 },
      },
    ],
    economy: {
      id: "economy-l10",
      label: "Level 10 trash run",
      inputs: {
        level: 10,
        killsPerHour: 120,
        tierMix: CANONICAL_TIER_MIX,
        sellRate: 0.5,
        consumableSpendPerHour: 500,
      },
      goldPerHour: { min: 4000, max: 6500 },
    },
    regen: {
      id: "regen-stat30",
      label: "Regen at stat 30",
      statValue: 30,
      intervalMs: { min: 400, max: 650 },
    },
  },
  pvpArena: {
    id: "pvpArena",
    label: "PvP Arena",
    summary:
      "Competitive tuning with fast fights, deliberate recovery, and tighter resources. PvE should prepare players for sharper matchups.",
    pillars: [
      "Fast, readable fights",
      "Moderate scarcity",
      "Intentional recovery pacing",
    ],
    combat: [
      {
        id: "standard-l10",
        label: "Level 10 standard mob",
        inputs: { playerLevel: 10, mobTier: "standard", mobLevel: 10 },
        allowedVerdicts: ["easy", "fair"],
        hpRemainingPercent: { min: 65, max: 95 },
      },
      {
        id: "elite-l10",
        label: "Level 10 elite mob",
        inputs: { playerLevel: 10, mobTier: "elite", mobLevel: 10 },
        allowedVerdicts: ["fair", "risky"],
        hpRemainingPercent: { min: 0, max: 65 },
      },
    ],
    economy: {
      id: "economy-l10",
      label: "Level 10 trash run",
      inputs: {
        level: 10,
        killsPerHour: 120,
        tierMix: CANONICAL_TIER_MIX,
        sellRate: 0.5,
        consumableSpendPerHour: 500,
      },
      goldPerHour: { min: 1300, max: 1900 },
    },
    regen: {
      id: "regen-stat30",
      label: "Regen at stat 30",
      statValue: 30,
      intervalMs: { min: 1200, max: 1600 },
    },
  },
  loreExplorer: {
    id: "loreExplorer",
    label: "Lore Explorer",
    summary:
      "An overpowered sightseeing archetype where combat and downtime barely slow the player. It should still avoid collapsing progression into parody.",
    pillars: [
      "Power fantasy combat",
      "Extreme generosity",
      "Near-zero downtime",
    ],
    combat: [
      {
        id: "standard-l10",
        label: "Level 10 standard mob",
        inputs: { playerLevel: 10, mobTier: "standard", mobLevel: 10 },
        allowedVerdicts: ["easy"],
        hpRemainingPercent: { min: 98, max: 100 },
      },
      {
        id: "elite-l10",
        label: "Level 10 elite mob",
        inputs: { playerLevel: 10, mobTier: "elite", mobLevel: 10 },
        allowedVerdicts: ["easy"],
        hpRemainingPercent: { min: 98, max: 100 },
      },
    ],
    economy: {
      id: "economy-l10",
      label: "Level 10 trash run",
      inputs: {
        level: 10,
        killsPerHour: 120,
        tierMix: CANONICAL_TIER_MIX,
        sellRate: 0.5,
        consumableSpendPerHour: 500,
      },
      goldPerHour: { min: 8000, max: 12000 },
    },
    regen: {
      id: "regen-stat30",
      label: "Regen at stat 30",
      statValue: 30,
      intervalMs: { min: 250, max: 400 },
    },
  },
};

export function getArchetypeContract(id: string | null | undefined): ArchetypeContract | null {
  if (!id) return null;
  return ARCHETYPE_CONTRACTS[id] ?? null;
}
