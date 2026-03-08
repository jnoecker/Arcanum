import type { ConfigPanelProps, AppConfig } from "./types";
import type { CraftingSkillDefinition, CraftingStationTypeDefinition } from "@/types/config";
import { Section, FieldRow, NumberInput, TextInput, SelectInput } from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";

export function CraftingPanel({ config, onChange }: ConfigPanelProps) {
  const c = config.crafting;
  const patch = (p: Partial<AppConfig["crafting"]>) =>
    onChange({ crafting: { ...c, ...p } });

  return (
    <>
      <Section title="Skill Progression">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Max Skill Level">
            <NumberInput
              value={c.maxSkillLevel}
              onCommit={(v) => patch({ maxSkillLevel: v ?? 100 })}
              min={1}
            />
          </FieldRow>
          <FieldRow label="Base XP / Level">
            <NumberInput
              value={c.baseXpPerLevel}
              onCommit={(v) => patch({ baseXpPerLevel: v ?? 50 })}
              min={1}
            />
          </FieldRow>
          <FieldRow label="XP Exponent">
            <NumberInput
              value={c.xpExponent}
              onCommit={(v) => patch({ xpExponent: v ?? 1.5 })}
              min={1}
              step={0.1}
            />
          </FieldRow>
        </div>
      </Section>

      <Section title="Gathering">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Cooldown (ms)">
            <NumberInput
              value={c.gatherCooldownMs}
              onCommit={(v) => patch({ gatherCooldownMs: v ?? 3000 })}
              min={0}
            />
          </FieldRow>
          <FieldRow label="Station Bonus">
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
        defaultItem={(raw) => ({ displayName: raw, type: "crafting" })}
        renderSummary={(_id, s) => s.type}
        renderDetail={(_id, s, patch) => (
          <>
            <FieldRow label="Display Name">
              <TextInput
                value={s.displayName}
                onCommit={(v) => patch({ displayName: v })}
              />
            </FieldRow>
            <FieldRow label="Type">
              <SelectInput
                value={s.type}
                onCommit={(v) => patch({ type: v })}
                options={[
                  { value: "gathering", label: "Gathering" },
                  { value: "crafting", label: "Crafting" },
                ]}
              />
            </FieldRow>
          </>
        )}
      />

      <RegistryPanel<CraftingStationTypeDefinition>
        title="Station Types"
        items={config.craftingStationTypes}
        onItemsChange={(craftingStationTypes) => onChange({ craftingStationTypes })}
        placeholder="New station type"
        idTransform={(raw) => raw.trim().toLowerCase().replace(/\s+/g, "_")}
        getDisplayName={(s) => s.displayName}
        defaultItem={(raw) => ({ displayName: raw })}
        renderSummary={() => ""}
        renderDetail={(_id, s, patch) => (
          <FieldRow label="Display Name">
            <TextInput
              value={s.displayName}
              onCommit={(v) => patch({ displayName: v })}
            />
          </FieldRow>
        )}
      />
    </>
  );
}
