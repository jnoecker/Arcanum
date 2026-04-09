import { useCallback, useMemo } from "react";
import type { ConfigPanelProps } from "./types";
import type {
  EnchantmentDefinitionConfig,
  EnchantmentMaterialConfig,
  EnchantingConfig,
} from "@/types/config";
import {
  Section,
  FieldRow,
  NumberInput,
  TextInput,
  SelectInput,
  ActionButton,
  IconButton,
} from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";

function defaultEnchantmentDefinition(raw: string): EnchantmentDefinitionConfig {
  return {
    displayName: raw,
    skill: "enchanting",
    skillRequired: 1,
    materials: [],
    xpReward: 30,
  };
}

function summarizeEnchantment(e: EnchantmentDefinitionConfig): string {
  const parts: string[] = [];
  if (e.damageBonus) parts.push(`+${e.damageBonus} dmg`);
  if (e.armorBonus) parts.push(`+${e.armorBonus} armor`);
  if (e.statBonuses) {
    for (const [stat, val] of Object.entries(e.statBonuses)) {
      parts.push(`+${val} ${stat}`);
    }
  }
  if (parts.length === 0) parts.push("no bonuses");
  parts.push(`skill ${e.skillRequired}`);
  return parts.join(" | ");
}

export function EnchantingPanel({ config, onChange }: ConfigPanelProps) {
  const patchGlobal = useCallback(
    (patch: Partial<EnchantingConfig>) => {
      onChange({ enchanting: { ...config.enchanting, ...patch } });
    },
    [config.enchanting, onChange],
  );

  const handleRename = useCallback(
    (oldId: string, newId: string) => {
      const defs: Record<string, EnchantmentDefinitionConfig> = {};
      for (const [k, v] of Object.entries(config.enchanting.definitions)) {
        defs[k === oldId ? newId : k] = v;
      }
      patchGlobal({ definitions: defs });
    },
    [config.enchanting.definitions, patchGlobal],
  );

  const craftingSkillOptions = useMemo(
    () =>
      Object.keys(config.craftingSkills).map((id) => ({
        value: id,
        label: config.craftingSkills[id]!.displayName,
      })),
    [config.craftingSkills],
  );

  const equipSlotOptions = useMemo(
    () =>
      Object.entries(config.equipmentSlots)
        .sort(([, a], [, b]) => a.order - b.order)
        .map(([id, slot]) => ({
          value: id,
          label: slot.displayName,
        })),
    [config.equipmentSlots],
  );

  const statOptions = useMemo(
    () =>
      Object.keys(config.stats.definitions).map((id) => ({
        value: id,
        label: config.stats.definitions[id]!.displayName,
      })),
    [config.stats.definitions],
  );

  return (
    <>
      <Section
        title="Global Settings"
        description="Enchanting lets players permanently augment gear with stat and damage bonuses. Global settings control the overall scarcity and power ceiling of enchantments across the whole game."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow
            label="Max Per Item"
            hint="Upper limit on how many enchantments a single item can hold. 1 keeps builds simple and readable; 3+ encourages deep customization but can produce very powerful late-game gear."
          >
            <NumberInput
              value={config.enchanting.maxEnchantmentsPerItem}
              onCommit={(v) => patchGlobal({ maxEnchantmentsPerItem: v ?? 1 })}
              min={1}
            />
          </FieldRow>
        </div>
      </Section>

      <RegistryPanel<EnchantmentDefinitionConfig>
        title="Enchantment Definitions"
        items={config.enchanting.definitions}
        onItemsChange={(definitions) => patchGlobal({ definitions })}
        onRenameId={handleRename}
        placeholder="New enchantment key"
        idTransform={(raw) => raw.trim().toLowerCase().replace(/\s+/g, "_")}
        getDisplayName={(e) => e.displayName}
        defaultItem={defaultEnchantmentDefinition}
        renderSummary={(_id, e) => summarizeEnchantment(e)}
        renderDetail={(_id, ench, patch) => (
          <EnchantmentDetail
            enchantment={ench}
            patch={patch}
            craftingSkillOptions={craftingSkillOptions}
            equipSlotOptions={equipSlotOptions}
            statOptions={statOptions}
          />
        )}
      />
    </>
  );
}

function SubGroup({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2 border-t border-border-muted/40 pt-2 first:mt-0 first:border-0 first:pt-0">
      <div className="flex items-center justify-between">
        <h5 className="font-display text-2xs uppercase tracking-widest text-text-muted">
          {title}
        </h5>
        {actions}
      </div>
      {description && (
        <p className="mt-0.5 text-2xs leading-snug text-text-muted/60">
          {description}
        </p>
      )}
      <div className="mt-1.5 flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function EnchantmentDetail({
  enchantment,
  patch,
  craftingSkillOptions,
  equipSlotOptions,
  statOptions,
}: {
  enchantment: EnchantmentDefinitionConfig;
  patch: (p: Partial<EnchantmentDefinitionConfig>) => void;
  craftingSkillOptions: { value: string; label: string }[];
  equipSlotOptions: { value: string; label: string }[];
  statOptions: { value: string; label: string }[];
}) {
  const addMaterial = () => {
    patch({
      materials: [...enchantment.materials, { itemId: "", quantity: 1 }],
    });
  };
  const updateMaterial = (
    idx: number,
    mp: Partial<EnchantmentMaterialConfig>,
  ) => {
    const mats = enchantment.materials.map((m, i) =>
      i === idx ? { ...m, ...mp } : m,
    );
    patch({ materials: mats });
  };
  const removeMaterial = (idx: number) => {
    patch({ materials: enchantment.materials.filter((_, i) => i !== idx) });
  };

  const addStatBonus = () => {
    const existing = enchantment.statBonuses ?? {};
    const available = statOptions.find((s) => !(s.value in existing));
    if (!available) return;
    patch({ statBonuses: { ...existing, [available.value]: 1 } });
  };
  const updateStatBonus = (oldStat: string, newStat: string, value: number) => {
    const bonuses = { ...enchantment.statBonuses };
    if (oldStat !== newStat) delete bonuses[oldStat];
    bonuses[newStat] = value;
    patch({
      statBonuses: Object.keys(bonuses).length > 0 ? bonuses : undefined,
    });
  };
  const removeStatBonus = (stat: string) => {
    const { [stat]: _, ...rest } = enchantment.statBonuses ?? {};
    patch({ statBonuses: Object.keys(rest).length > 0 ? rest : undefined });
  };

  return (
    <>
      <SubGroup
        title="Identity & Cost"
        description="How this enchantment presents to players and what it takes to apply. Higher skill requirements gate powerful effects behind progression; XP rewards shape how quickly enchanters level up."
      >
        <FieldRow
          label="Display Name"
          hint="The name players see in item descriptions and crafting menus. Example: 'Runes of Warding' or 'Flame Etching'."
        >
          <TextInput
            value={enchantment.displayName}
            onCommit={(v) => patch({ displayName: v })}
          />
        </FieldRow>
        <FieldRow
          label="Skill"
          hint="Which crafting skill is trained and checked. Usually 'enchanting', but could be 'runesmithing' or another custom crafting discipline."
        >
          <SelectInput
            value={enchantment.skill}
            onCommit={(v) => patch({ skill: v })}
            options={craftingSkillOptions}
            allowEmpty
            placeholder="enchanting"
          />
        </FieldRow>
        <FieldRow
          label="Skill Required"
          hint="Minimum skill level to attempt this enchantment. Use this to gate stronger effects behind long practice — 1 for starter runes, 50+ for endgame augments."
        >
          <NumberInput
            value={enchantment.skillRequired}
            onCommit={(v) => patch({ skillRequired: v ?? 1 })}
            min={1}
          />
        </FieldRow>
        <FieldRow
          label="XP Reward"
          hint="Crafting XP granted each time this enchantment is successfully applied. Tune to match progression pace — weak enchantments give small amounts, rare ones give more."
        >
          <NumberInput
            value={enchantment.xpReward}
            onCommit={(v) => patch({ xpReward: v ?? 30 })}
            min={0}
          />
        </FieldRow>
      </SubGroup>

      <SubGroup
        title="Flat Bonuses"
        description="Simple additive bonuses applied to the enchanted item. Damage stacks onto weapon hits; armor stacks onto mitigation rolls."
      >
        <FieldRow
          label="Damage Bonus"
          hint="Flat damage added to each successful hit with the enchanted weapon. +1 to +3 is subtle; +5 and above noticeably shifts combat math."
        >
          <NumberInput
            value={enchantment.damageBonus ?? 0}
            onCommit={(v) => patch({ damageBonus: v || undefined })}
            min={0}
          />
        </FieldRow>
        <FieldRow
          label="Armor Bonus"
          hint="Flat armor added to the equipped piece. Stack multiple armor enchantments to build tank sets."
        >
          <NumberInput
            value={enchantment.armorBonus ?? 0}
            onCommit={(v) => patch({ armorBonus: v || undefined })}
            min={0}
          />
        </FieldRow>
      </SubGroup>

      <SubGroup
        title="Stat Bonuses"
        description="Grant bonus points to any stat defined in your Stats config. Useful for class-themed enchantments (e.g. +Intelligence for mage gear)."
        actions={
          <ActionButton variant="secondary" size="sm" onClick={addStatBonus}>
            + Add Stat
          </ActionButton>
        }
      >
        {Object.keys(enchantment.statBonuses ?? {}).length === 0 ? (
          <p className="text-2xs text-text-muted">
            No stat bonuses. Add one to boost a specific attribute.
          </p>
        ) : (
          Object.entries(enchantment.statBonuses ?? {}).map(([stat, val]) => (
            <div key={stat} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <SelectInput
                  value={stat}
                  onCommit={(v) => updateStatBonus(stat, v, val)}
                  options={statOptions}
                />
              </div>
              <div className="w-20 shrink-0">
                <NumberInput
                  value={val}
                  onCommit={(v) => updateStatBonus(stat, stat, v ?? 1)}
                  min={1}
                />
              </div>
              <IconButton
                onClick={() => removeStatBonus(stat)}
                title="Remove stat bonus"
                danger
              >
                &times;
              </IconButton>
            </div>
          ))
        )}
      </SubGroup>

      <SubGroup
        title="Target Slots"
        description="Restrict which equipment slots this enchantment can be applied to. Leave all unselected to allow any slot — useful for generic enchantments like 'Minor Ward'."
      >
        <div className="flex flex-wrap gap-1.5">
          {equipSlotOptions.map(({ value, label }) => {
            const selected = enchantment.targetSlots?.includes(value) ?? false;
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  const current = enchantment.targetSlots ?? [];
                  const next = selected
                    ? current.filter((s) => s !== value)
                    : [...current, value];
                  patch({
                    targetSlots: next.length > 0 ? next : undefined,
                  });
                }}
                className={
                  "focus-ring rounded-full border px-3 py-1 text-2xs transition " +
                  (selected
                    ? "border-accent/50 bg-accent/15 text-accent"
                    : "border-border-muted bg-bg-primary/40 text-text-muted hover:border-border-default hover:text-text-secondary")
                }
                aria-pressed={selected}
              >
                {label}
              </button>
            );
          })}
        </div>
      </SubGroup>

      <SubGroup
        title="Materials"
        description="Items consumed each time this enchantment is applied. Acts as a gold sink and creates demand for gathering and trading. Leave empty for free enchantments."
        actions={
          <ActionButton variant="secondary" size="sm" onClick={addMaterial}>
            + Add Material
          </ActionButton>
        }
      >
        {enchantment.materials.length === 0 ? (
          <p className="text-2xs text-text-muted">
            No materials required. Add one to create a resource cost.
          </p>
        ) : (
          enchantment.materials.map((mat, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <TextInput
                  value={mat.itemId}
                  onCommit={(v) => updateMaterial(i, { itemId: v })}
                  placeholder="item_id"
                />
              </div>
              <div className="w-20 shrink-0">
                <NumberInput
                  value={mat.quantity}
                  onCommit={(v) => updateMaterial(i, { quantity: v ?? 1 })}
                  min={1}
                />
              </div>
              <IconButton
                onClick={() => removeMaterial(i)}
                title="Remove material"
                danger
              >
                &times;
              </IconButton>
            </div>
          ))
        )}
      </SubGroup>
    </>
  );
}
