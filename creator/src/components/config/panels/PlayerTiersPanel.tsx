import { useMemo } from "react";
import type { ConfigPanelProps } from "./types";
import type { TierDefinitionConfig } from "@/types/config";
import { Section, FieldRow, TextInput, CommitTextarea } from "@/components/ui/FormWidgets";
import { DEFAULT_TIER_DEFINITIONS } from "@/lib/defaultSpriteData";

/** Derive tier keys from the numeric spriteLevelTiers breakpoints + always tstaff. */
function deriveTierKeys(spriteLevelTiers: number[]): string[] {
  const sorted = [...spriteLevelTiers].sort((a, b) => a - b);
  const keys = sorted.map((n) => `t${n}`);
  keys.push("tstaff");
  return keys;
}

/** Get a sensible default for a tier that has no definition yet. */
function defaultTierDef(tierId: string, breakpoints: number[]): TierDefinitionConfig {
  // If there's a hardcoded default, use it
  if (DEFAULT_TIER_DEFINITIONS[tierId]) return DEFAULT_TIER_DEFINITIONS[tierId]!;

  // Auto-scaffold from the numeric level
  const level = parseInt(tierId.replace("t", ""), 10);
  const sorted = [...breakpoints].sort((a, b) => a - b);
  const idx = sorted.indexOf(level);
  const nextLevel = sorted[idx + 1];
  const levelRange = nextLevel ? `${level}–${nextLevel - 1}` : `${level}`;

  return {
    displayName: `Tier ${level}`,
    levels: levelRange,
    visualDescription: "",
  };
}

export function PlayerTiersPanel({ config, onChange }: ConfigPanelProps) {
  const tiers = config.playerTiers ?? DEFAULT_TIER_DEFINITIONS;
  const breakpoints = config.images.spriteLevelTiers;

  // Derive tier order strictly from breakpoints — stale entries are ignored
  const orderedIds = useMemo(() => deriveTierKeys(breakpoints), [breakpoints]);

  const patchTier = (tierId: string, p: Partial<TierDefinitionConfig>) => {
    const existing = tiers[tierId] ?? defaultTierDef(tierId, breakpoints);
    const updated: TierDefinitionConfig = {
      displayName: p.displayName ?? existing.displayName,
      levels: p.levels ?? existing.levels,
      visualDescription: p.visualDescription ?? existing.visualDescription,
    };
    // Build full tier map from derived keys so we persist all of them
    const fullTiers: Record<string, TierDefinitionConfig> = {};
    for (const key of orderedIds) {
      fullTiers[key] = key === tierId ? updated : (tiers[key] ?? defaultTierDef(key, breakpoints));
    }
    onChange({ playerTiers: fullTiers });
  };

  return (
    <>
      <p className="mb-3 text-xs leading-relaxed text-text-muted">
        Player tiers control the visual progression of character sprites. Each tier defines how
        equipment, magical effects, and overall power level appear in generated sprite art.
        Tiers are derived from the level breakpoints configured above.
      </p>
      {orderedIds.map((tierId) => {
        const tier = tiers[tierId] ?? defaultTierDef(tierId, breakpoints);
        return (
          <Section key={tierId} title={tier.displayName} description={`Tier ${tierId} — ${tier.levels}`}>
            <div className="flex flex-col gap-1.5">
              <FieldRow label="Display Name">
                <TextInput
                  value={tier.displayName}
                  onCommit={(v) => patchTier(tierId, { displayName: v })}
                />
              </FieldRow>
              <FieldRow label="Levels" hint="Level range this tier covers (e.g. '1-9')">
                <TextInput
                  value={tier.levels}
                  onCommit={(v) => patchTier(tierId, { levels: v })}
                />
              </FieldRow>
              <CommitTextarea
                label="Visual Description"
                value={tier.visualDescription}
                onCommit={(v) => patchTier(tierId, { visualDescription: v })}
                placeholder="Describe how this tier's power level appears visually in sprite art..."
                rows={4}
              />
            </div>
          </Section>
        );
      })}
    </>
  );
}
