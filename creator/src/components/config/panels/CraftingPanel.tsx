import type { ConfigPanelProps, AppConfig } from "./types";
import type { CraftingSkillDefinition, CraftingStationTypeDefinition } from "@/types/config";
import { Section, FieldRow, NumberInput, TextInput, SelectInput } from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";

export function defaultCraftingSkillDefinition(raw: string): CraftingSkillDefinition {
  return { displayName: raw, type: "crafting" };
}

export function summarizeCraftingSkill(skill: CraftingSkillDefinition): string {
  return skill.type;
}

export function CraftingSkillDetail({
  skill,
  patch,
}: {
  skill: CraftingSkillDefinition;
  patch: (p: Partial<CraftingSkillDefinition>) => void;
}) {
  return (
    <>
      <FieldRow label="Display Name">
        <TextInput
          value={skill.displayName}
          onCommit={(v) => patch({ displayName: v })}
        />
      </FieldRow>
      <FieldRow label="Type" hint="Gathering skills harvest raw materials; Crafting skills transform materials into items.">
        <SelectInput
          value={skill.type}
          onCommit={(v) => patch({ type: v })}
          options={[
            { value: "gathering", label: "Gathering" },
            { value: "crafting", label: "Crafting" },
          ]}
        />
      </FieldRow>
    </>
  );
}

export function defaultCraftingStationTypeDefinition(raw: string): CraftingStationTypeDefinition {
  return { displayName: raw };
}

export function summarizeCraftingStationType(): string {
  return "";
}

export function CraftingStationTypeDetail({
  stationType,
  patch,
}: {
  stationType: CraftingStationTypeDefinition;
  patch: (p: Partial<CraftingStationTypeDefinition>) => void;
}) {
  return (
    <FieldRow label="Display Name" hint="Name shown to players (e.g. Forge, Alchemy Table, Loom).">
      <TextInput
        value={stationType.displayName}
        onCommit={(v) => patch({ displayName: v })}
      />
    </FieldRow>
  );
}

export function CraftingPanel({ config, onChange }: ConfigPanelProps) {
  const c = config.crafting;
  const patch = (p: Partial<AppConfig["crafting"]>) =>
    onChange({ crafting: { ...c, ...p } });

  return (
    <>
      <Section
        title="Skill Progression"
        description="Crafting skills level independently from character level. The XP formula is: XP(level) = baseXp * level^exponent. Higher exponents make mastery take significantly longer, rewarding dedicated crafters."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Max Skill Level" hint="Cap for all crafting skills. 100 is the classic 'mastery' target. Lower values (e.g. 50) make crafting easier to max out.">
            <NumberInput
              value={c.maxSkillLevel}
              onCommit={(v) => patch({ maxSkillLevel: v ?? 100 })}
              min={1}
            />
          </FieldRow>
          <FieldRow label="Base XP / Level" hint="XP constant in the skill-up formula. Higher values make each level take longer. 50 is a moderate pace.">
            <NumberInput
              value={c.baseXpPerLevel}
              onCommit={(v) => patch({ baseXpPerLevel: v ?? 50 })}
              min={1}
            />
          </FieldRow>
          <FieldRow label="XP Exponent" hint="Growth rate of XP requirements. 1.0 = linear (every level takes the same effort). 1.5 = moderate curve. 2.0+ = steep late-game grind.">
            <NumberInput
              value={c.xpExponent}
              onCommit={(v) => patch({ xpExponent: v ?? 1.5 })}
              min={1}
              step={0.1}
            />
          </FieldRow>
        </div>
      </Section>

      <Section
        title="Gathering"
        description="Controls the resource-gathering loop. Gathering cooldown determines how often players can harvest nodes, while the station bonus rewards players who craft at dedicated stations rather than in the field."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Cooldown (ms)" hint="Delay between gathering attempts on the same node. 3000ms (3s) feels responsive. Higher values (10000+) make gathering a slower, more deliberate activity.">
            <NumberInput
              value={c.gatherCooldownMs}
              onCommit={(v) => patch({ gatherCooldownMs: v ?? 3000 })}
              min={0}
            />
          </FieldRow>
          <FieldRow label="Station Bonus" hint="Extra items yielded when gathering at a crafting station vs. in the field. 1 = one bonus item. Set to 0 to remove the station advantage.">
            <NumberInput
              value={c.stationBonusQuantity}
              onCommit={(v) => patch({ stationBonusQuantity: v ?? 1 })}
              min={0}
            />
          </FieldRow>
        </div>
      </Section>

      <RegistryPanel<CraftingSkillDefinition>
        title="Crafting Skills"
        items={config.craftingSkills}
        onItemsChange={(craftingSkills) => onChange({ craftingSkills })}
        placeholder="New skill"
        idTransform={(raw) => raw.trim().toLowerCase().replace(/\s+/g, "_")}
        getDisplayName={(s) => s.displayName}
        defaultItem={defaultCraftingSkillDefinition}
        renderSummary={(_id, s) => summarizeCraftingSkill(s)}
        renderDetail={(_id, s, patch) => (
          <CraftingSkillDetail skill={s} patch={patch} />
        )}
      />

      <RegistryPanel<CraftingStationTypeDefinition>
        title="Station Types"
        items={config.craftingStationTypes}
        onItemsChange={(craftingStationTypes) => onChange({ craftingStationTypes })}
        placeholder="New station type"
        idTransform={(raw) => raw.trim().toLowerCase().replace(/\s+/g, "_")}
        getDisplayName={(s) => s.displayName}
        defaultItem={defaultCraftingStationTypeDefinition}
        renderSummary={summarizeCraftingStationType}
        renderDetail={(_id, s, patch) => (
          <CraftingStationTypeDetail stationType={s} patch={patch} />
        )}
      />
    </>
  );
}
