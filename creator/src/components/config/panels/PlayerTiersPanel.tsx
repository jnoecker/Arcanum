import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ConfigPanelProps } from "./types";
import type { TierDefinitionConfig } from "@/types/config";
import { Section, FieldRow, TextInput, CommitTextarea, ActionButton } from "@/components/ui/FormWidgets";
import { DEFAULT_TIER_DEFINITIONS } from "@/lib/defaultSpriteData";
import { useAssetStore } from "@/stores/assetStore";
import { parseLlmJson } from "@/lib/arcanumPrompts";

/** Derive tier keys from the numeric spriteLevelTiers breakpoints + always tstaff. */
function deriveTierKeys(spriteLevelTiers: number[]): string[] {
  const sorted = [...spriteLevelTiers].sort((a, b) => a - b);
  const keys = sorted.map((n) => `t${n}`);
  keys.push("tstaff");
  return keys;
}

/** Get a sensible default for a tier that has no definition yet. */
function defaultTierDef(tierId: string, breakpoints: number[]): TierDefinitionConfig {
  if (DEFAULT_TIER_DEFINITIONS[tierId]) return DEFAULT_TIER_DEFINITIONS[tierId]!;

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
  const settings = useAssetStore((s) => s.settings);

  const [generating, setGenerating] = useState(false);

  const hasLlmKey = !!(
    settings?.deepinfra_api_key ||
    settings?.anthropic_api_key ||
    settings?.openrouter_api_key
  );

  const orderedIds = useMemo(() => deriveTierKeys(breakpoints), [breakpoints]);

  const patchTier = (tierId: string, p: Partial<TierDefinitionConfig>) => {
    const existing = tiers[tierId] ?? defaultTierDef(tierId, breakpoints);
    const updated: TierDefinitionConfig = {
      displayName: p.displayName ?? existing.displayName,
      levels: p.levels ?? existing.levels,
      visualDescription: p.visualDescription ?? existing.visualDescription,
    };
    const fullTiers: Record<string, TierDefinitionConfig> = {};
    for (const key of orderedIds) {
      fullTiers[key] = key === tierId ? updated : (tiers[key] ?? defaultTierDef(key, breakpoints));
    }
    onChange({ playerTiers: fullTiers });
  };

  const handleGenerateAll = async () => {
    setGenerating(true);
    try {
      const maxLevel = config.progression.maxLevel;
      const sorted = [...breakpoints].sort((a, b) => a - b);

      const tierList = orderedIds
        .map((id) => {
          const def = tiers[id] ?? defaultTierDef(id, breakpoints);
          return `- ${id} (${def.displayName}): levels ${def.levels}`;
        })
        .join("\n");

      const systemPrompt = `You are a game designer writing visual descriptions for player character sprite tiers in a fantasy MUD RPG.

Each tier represents a power level that determines how the character's gear, magical effects, and overall presence appear in generated sprite art. The descriptions are used as prompt fragments for AI image generation.

Write concise, vivid descriptions (1-2 sentences each) that create a clear visual progression from weakest to strongest. Focus on:
- Equipment quality and materials
- Magical effects and auras
- Overall visual impressiveness

The staff tier should be distinctly different — cosmic/divine authority, not just "more powerful."

Output ONLY valid JSON — an object mapping tier ID to an object with "displayName" and "visualDescription" fields. No markdown fences, no commentary.`;

      const userPrompt = `Max level: ${maxLevel}
Number of tiers: ${sorted.length} (plus staff)

Tiers:
${tierList}

Generate a displayName and visualDescription for each tier that creates a satisfying visual progression from level 1 to ${maxLevel}. The lowest tier should feel like a humble beginner; the highest regular tier should feel like a legendary champion at the peak of mortal power.`;

      const response = await invoke<string>("llm_complete", { systemPrompt, userPrompt });
      const parsed = parseLlmJson<Record<string, { displayName?: string; visualDescription?: string }>>(
        response,
        "tier-descriptions",
      );

      const fullTiers: Record<string, TierDefinitionConfig> = {};
      for (const key of orderedIds) {
        const existing = tiers[key] ?? defaultTierDef(key, breakpoints);
        const generated = parsed[key];
        fullTiers[key] = {
          displayName: generated?.displayName ?? existing.displayName,
          levels: existing.levels,
          visualDescription: generated?.visualDescription ?? existing.visualDescription,
        };
      }
      onChange({ playerTiers: fullTiers });
    } catch (err) {
      console.error("Failed to generate tier descriptions:", err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div className="mb-3 flex items-center gap-3">
        <p className="flex-1 text-xs leading-relaxed text-text-muted">
          Player tiers control the visual progression of character sprites. Each tier defines how
          equipment, magical effects, and overall power level appear in generated sprite art.
        </p>
        <ActionButton
          onClick={handleGenerateAll}
          disabled={!hasLlmKey || generating}
          variant="secondary"
          size="sm"
          title={!hasLlmKey ? "No LLM API key configured" : "Generate display names and visual descriptions for all tiers"}
        >
          {generating ? "Generating..." : "AI Fill All"}
        </ActionButton>
      </div>
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
