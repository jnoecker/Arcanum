import type { AppConfig } from "@/types/config";
import { FieldRow, NumberInput } from "@/components/ui/FormWidgets";
import { DefinitionWorkbench } from "./DefinitionWorkbench";
import {
  CraftingSkillDetail,
  CraftingStationTypeDetail,
  defaultCraftingSkillDefinition,
  defaultCraftingStationTypeDefinition,
  summarizeCraftingSkill,
  summarizeCraftingStationType,
} from "@/components/config/panels/CraftingPanel";

export function CraftingStudio({
  config,
  onChange,
}: {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}) {
  const patchCrafting = (patch: Partial<AppConfig["crafting"]>) =>
    onChange({ crafting: { ...config.crafting, ...patch } });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/8 bg-black/12 p-5">
          <p className="text-2xs uppercase tracking-ui text-text-muted">Progression</p>
          <h4 className="mt-2 font-display text-2xl text-text-primary">Skill curve</h4>
          <p className="mt-2 text-sm leading-7 text-text-secondary">
            Crafting skills level independently from character level. Shape the time to mastery here before tuning the skill list itself.
          </p>
          <div className="mt-4 flex flex-col gap-1.5">
            <FieldRow label="Max Skill Level" hint="Cap for all crafting skills. 100 is the classic mastery target.">
              <NumberInput
                value={config.crafting.maxSkillLevel}
                onCommit={(v) => patchCrafting({ maxSkillLevel: v ?? 100 })}
                min={1}
              />
            </FieldRow>
            <FieldRow label="Base XP / Level" hint="Higher values make each level take longer.">
              <NumberInput
                value={config.crafting.baseXpPerLevel}
                onCommit={(v) => patchCrafting({ baseXpPerLevel: v ?? 50 })}
                min={1}
              />
            </FieldRow>
            <FieldRow label="XP Exponent" hint="1.0 = linear, 1.5 = moderate curve, 2.0+ = steep mastery grind.">
              <NumberInput
                value={config.crafting.xpExponent}
                onCommit={(v) => patchCrafting({ xpExponent: v ?? 1.5 })}
                min={1}
                step={0.1}
              />
            </FieldRow>
          </div>
        </div>

        <div className="rounded-3xl border border-white/8 bg-black/12 p-5">
          <p className="text-2xs uppercase tracking-ui text-text-muted">Gathering loop</p>
          <h4 className="mt-2 font-display text-2xl text-text-primary">Harvest pacing</h4>
          <p className="mt-2 text-sm leading-7 text-text-secondary">
            Control how quickly players harvest nodes and how much dedicated crafting stations outperform fieldwork.
          </p>
          <div className="mt-4 flex flex-col gap-1.5">
            <FieldRow label="Cooldown (ms)" hint="Delay between gathering attempts on the same node.">
              <NumberInput
                value={config.crafting.gatherCooldownMs}
                onCommit={(v) => patchCrafting({ gatherCooldownMs: v ?? 3000 })}
                min={0}
              />
            </FieldRow>
            <FieldRow label="Station Bonus" hint="Extra items yielded when gathering at a station instead of in the field.">
              <NumberInput
                value={config.crafting.stationBonusQuantity}
                onCommit={(v) => patchCrafting({ stationBonusQuantity: v ?? 1 })}
                min={0}
              />
            </FieldRow>
          </div>
        </div>
      </div>

      <DefinitionWorkbench
        title="Crafting skill designer"
        countLabel="Crafting skills"
        description="Gathering and crafting skill definitions."
        addPlaceholder="New skill id"
        searchPlaceholder="Search skills"
        emptyMessage="No crafting skills match the current search."
        emptyTitle="No recipes written yet"
        emptyDescription="Design the formulas and blueprints for crafting and creation."
        items={config.craftingSkills}
        defaultItem={defaultCraftingSkillDefinition}
        getDisplayName={(skill) => skill.displayName}
        renderSummary={summarizeCraftingSkill}
        renderBadges={(skill) => [skill.type]}
        renderDetail={(skill, patch) => (
          <CraftingSkillDetail skill={skill} patch={patch} />
        )}
        onItemsChange={(craftingSkills) => onChange({ craftingSkills })}
      />

      <DefinitionWorkbench
        title="Station type designer"
        countLabel="Station types"
        description="Station types used by recipes and rooms."
        addPlaceholder="New station type id"
        searchPlaceholder="Search station types"
        emptyMessage="No station types match the current search."
        emptyTitle="No recipes written yet"
        emptyDescription="Design the formulas and blueprints for crafting and creation."
        items={config.craftingStationTypes}
        defaultItem={defaultCraftingStationTypeDefinition}
        getDisplayName={(stationType) => stationType.displayName}
        renderSummary={summarizeCraftingStationType}
        renderDetail={(stationType, patch) => (
          <CraftingStationTypeDetail stationType={stationType} patch={patch} />
        )}
        onItemsChange={(craftingStationTypes) => onChange({ craftingStationTypes })}
      />
    </div>
  );
}
