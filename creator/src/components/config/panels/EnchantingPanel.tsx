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
    <div className="flex flex-col gap-6">
      <Section title="Global Settings" defaultExpanded>
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Max Enchantments Per Item" hint="How many enchantments a single item can hold.">
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
    patch({ materials: [...enchantment.materials, { itemId: "", quantity: 1 }] });
  };
  const updateMaterial = (idx: number, mp: Partial<EnchantmentMaterialConfig>) => {
    const mats = enchantment.materials.map((m, i) => (i === idx ? { ...m, ...mp } : m));
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
    patch({ statBonuses: Object.keys(bonuses).length > 0 ? bonuses : undefined });
  };
  const removeStatBonus = (stat: string) => {
    const { [stat]: _, ...rest } = enchantment.statBonuses ?? {};
    patch({ statBonuses: Object.keys(rest).length > 0 ? rest : undefined });
  };

  return (
    <>
      <FieldRow label="Display Name">
        <TextInput
          value={enchantment.displayName}
          onCommit={(v) => patch({ displayName: v })}
        />
      </FieldRow>
      <FieldRow label="Skill" hint="Which crafting skill is used.">
        <SelectInput
          value={enchantment.skill}
          onCommit={(v) => patch({ skill: v })}
          options={craftingSkillOptions}
          allowEmpty
          placeholder="enchanting"
        />
      </FieldRow>
      <FieldRow label="Skill Required" hint="Minimum skill level to use this enchantment.">
        <NumberInput
          value={enchantment.skillRequired}
          onCommit={(v) => patch({ skillRequired: v ?? 1 })}
          min={1}
        />
      </FieldRow>
      <FieldRow label="XP Reward" hint="Enchanting XP awarded on use.">
        <NumberInput
          value={enchantment.xpReward}
          onCommit={(v) => patch({ xpReward: v ?? 30 })}
          min={0}
        />
      </FieldRow>

      {/* ── Bonuses ── */}
      <div className="mt-1 border-t border-border-muted pt-1.5">
        <h5 className="mb-1 text-2xs font-display uppercase tracking-widest text-text-muted">
          Bonuses
        </h5>
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Damage Bonus" hint="Extra damage added to the item.">
            <NumberInput
              value={enchantment.damageBonus ?? 0}
              onCommit={(v) => patch({ damageBonus: v || undefined })}
              min={0}
            />
          </FieldRow>
          <FieldRow label="Armor Bonus" hint="Extra armor added to the item.">
            <NumberInput
              value={enchantment.armorBonus ?? 0}
              onCommit={(v) => patch({ armorBonus: v || undefined })}
              min={0}
            />
          </FieldRow>
        </div>

        {/* ── Stat bonuses ── */}
        <div className="mt-2">
          <div className="flex items-center justify-between">
            <span className="text-2xs text-text-muted">Stat Bonuses</span>
            <IconButton onClick={addStatBonus} title="Add stat bonus">+</IconButton>
          </div>
          {Object.entries(enchantment.statBonuses ?? {}).map(([stat, val]) => (
            <div key={stat} className="mt-1 flex items-center gap-2">
              <SelectInput
                value={stat}
                onCommit={(v) => updateStatBonus(stat, v, val)}
                options={statOptions}
              />
              <NumberInput
                value={val}
                onCommit={(v) => updateStatBonus(stat, stat, v ?? 1)}
                min={1}
              />
              <IconButton onClick={() => removeStatBonus(stat)} title="Remove" danger>&times;</IconButton>
            </div>
          ))}
        </div>
      </div>

      {/* ── Target slots ── */}
      <div className="mt-1 border-t border-border-muted pt-1.5">
        <h5 className="mb-1 text-2xs font-display uppercase tracking-widest text-text-muted">
          Target Slots
        </h5>
        <p className="mb-2 text-2xs text-text-muted">
          Equipment slots this enchantment can be applied to. Leave empty for any slot.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {equipSlotOptions.map(({ value, label }) => {
            const selected = enchantment.targetSlots?.includes(value) ?? false;
            return (
              <button
                key={value}
                onClick={() => {
                  const current = enchantment.targetSlots ?? [];
                  const next = selected
                    ? current.filter((s) => s !== value)
                    : [...current, value];
                  patch({ targetSlots: next.length > 0 ? next : undefined });
                }}
                className={`rounded-full border px-3 py-1 text-2xs transition ${
                  selected
                    ? "border-accent/50 bg-accent/15 text-accent"
                    : "border-border-default bg-bg-primary text-text-muted hover:border-border-hover"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Materials ── */}
      <div className="mt-1 border-t border-border-muted pt-1.5">
        <div className="flex items-center justify-between">
          <h5 className="text-2xs font-display uppercase tracking-widest text-text-muted">
            Materials
          </h5>
          <IconButton onClick={addMaterial} title="Add material">+</IconButton>
        </div>
        {enchantment.materials.length === 0 ? (
          <p className="mt-1 text-2xs text-text-muted">No materials required. Add one above.</p>
        ) : (
          <div className="mt-1 flex flex-col gap-1.5">
            {enchantment.materials.map((mat, i) => (
              <div key={i} className="flex items-center gap-2">
                <TextInput
                  value={mat.itemId}
                  onCommit={(v) => updateMaterial(i, { itemId: v })}
                  placeholder="item_id"
                />
                <div className="w-20 shrink-0">
                  <NumberInput
                    value={mat.quantity}
                    onCommit={(v) => updateMaterial(i, { quantity: v ?? 1 })}
                    min={1}
                  />
                </div>
                <IconButton onClick={() => removeMaterial(i)} title="Remove" danger>&times;</IconButton>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
