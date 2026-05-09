import { useState } from "react";
import type {
  EnchantmentDefinitionConfig,
  EnchantmentMaterialConfig,
} from "@/types/config";
import {
  TextInput,
  NumberInput,
  SelectInput,
} from "@/components/ui/FormWidgets";
import { Section } from "./Section";
import { PlusIcon, XIcon, TrashIcon } from "./icons";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

interface EnchantmentEditorProps {
  id: string;
  def: EnchantmentDefinitionConfig;
  craftingSkillOptions: { value: string; label: string }[];
  equipSlotOptions: { value: string; label: string }[];
  statOptions: { value: string; label: string }[];
  onPatch: (p: Partial<EnchantmentDefinitionConfig>) => void;
  onRename: (newId: string) => void;
}

export function EnchantmentEditor({
  id,
  def,
  craftingSkillOptions,
  equipSlotOptions,
  statOptions,
  onPatch,
  onRename,
}: EnchantmentEditorProps) {
  return (
    <div className="flex flex-col gap-4">
      <IdentityCard id={id} def={def} onPatch={onPatch} onRename={onRename} />

      <RequirementsCard
        def={def}
        craftingSkillOptions={craftingSkillOptions}
        onPatch={onPatch}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BonusesCard def={def} onPatch={onPatch} />
        <StatBonusesCard def={def} statOptions={statOptions} onPatch={onPatch} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SlotCompatibilityCard
          def={def}
          equipSlotOptions={equipSlotOptions}
          onPatch={onPatch}
        />
        <MaterialsCard def={def} onPatch={onPatch} />
      </div>
    </div>
  );
}

// ─── Identity ──────────────────────────────────────────────────────

function IdentityCard({
  id,
  def,
  onPatch,
  onRename,
}: {
  id: string;
  def: EnchantmentDefinitionConfig;
  onPatch: (p: Partial<EnchantmentDefinitionConfig>) => void;
  onRename: (v: string) => void;
}) {
  return (
    <Section title="Identity">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Display Name" hint="The name players will see.">
          <TextInput
            value={def.displayName}
            onCommit={(v) => onPatch({ displayName: v })}
            placeholder="Runes of Warding"
            dense
          />
        </Field>
        <Field label="Internal ID" hint="Unique identifier used by the system.">
          <SlugRenamer id={id} onRename={onRename} />
        </Field>
      </div>
    </Section>
  );
}

function SlugRenamer({ id, onRename }: { id: string; onRename: (v: string) => void }) {
  const [draft, setDraft] = useState(id);
  const [focused, setFocused] = useState(false);
  if (!focused && draft !== id) setDraft(id);

  const commit = () => {
    if (draft.trim() && draft !== id) onRename(draft);
    else setDraft(id);
  };

  return (
    <input
      className="ornate-input min-h-9 w-full px-2.5 py-1.5 font-mono text-xs text-text-primary"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(id);
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="runes_of_warding"
    />
  );
}

// ─── Requirements ──────────────────────────────────────────────────

function RequirementsCard({
  def,
  craftingSkillOptions,
  onPatch,
}: {
  def: EnchantmentDefinitionConfig;
  craftingSkillOptions: { value: string; label: string }[];
  onPatch: (p: Partial<EnchantmentDefinitionConfig>) => void;
}) {
  return (
    <Section
      title="Requirements"
      description="What's needed to learn and apply this inscription."
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field
          label="Crafting Skill"
          hint="Which discipline trains and gates this inscription."
        >
          <SelectInput
            value={def.skill}
            onCommit={(v) => onPatch({ skill: v })}
            options={craftingSkillOptions}
            allowEmpty
            placeholder="Enchanting"
            dense
          />
        </Field>
        <Field label="Skill Required" hint="Minimum skill level to attempt.">
          <NumberInput
            value={def.skillRequired}
            onCommit={(v) => onPatch({ skillRequired: v ?? 1 })}
            min={1}
            dense
          />
        </Field>
        <Field label="XP Reward" hint="XP granted on successful craft.">
          <NumberInput
            value={def.xpReward}
            onCommit={(v) => onPatch({ xpReward: v ?? 30 })}
            min={0}
            dense
          />
        </Field>
      </div>
    </Section>
  );
}

// ─── Bonuses ──────────────────────────────────────────────────────

function BonusesCard({
  def,
  onPatch,
}: {
  def: EnchantmentDefinitionConfig;
  onPatch: (p: Partial<EnchantmentDefinitionConfig>) => void;
}) {
  return (
    <Section
      title="Bonuses"
      description="Flat bonuses granted to the enchanted item."
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Damage Bonus" hint="Flat damage added to weapon hits.">
          <NumberInput
            value={def.damageBonus ?? 0}
            onCommit={(v) =>
              onPatch({ damageBonus: v && v > 0 ? v : undefined })
            }
            min={0}
            dense
          />
        </Field>
        <Field label="Armor Bonus" hint="Flat armor added to the equipped piece.">
          <NumberInput
            value={def.armorBonus ?? 0}
            onCommit={(v) =>
              onPatch({ armorBonus: v && v > 0 ? v : undefined })
            }
            min={0}
            dense
          />
        </Field>
      </div>
    </Section>
  );
}

// ─── Stat Bonuses ──────────────────────────────────────────────────

function StatBonusesCard({
  def,
  statOptions,
  onPatch,
}: {
  def: EnchantmentDefinitionConfig;
  statOptions: { value: string; label: string }[];
  onPatch: (p: Partial<EnchantmentDefinitionConfig>) => void;
}) {
  const entries = Object.entries(def.statBonuses ?? {});
  const allUsed = statOptions.length > 0 && entries.length >= statOptions.length;

  const updateStat = (oldStat: string, newStat: string, value: number) => {
    const next = { ...def.statBonuses };
    if (oldStat !== newStat) delete next[oldStat];
    next[newStat] = value;
    onPatch({ statBonuses: Object.keys(next).length > 0 ? next : undefined });
  };

  const removeStat = (stat: string) => {
    const { [stat]: _, ...rest } = def.statBonuses ?? {};
    onPatch({ statBonuses: Object.keys(rest).length > 0 ? rest : undefined });
  };

  const addStat = () => {
    const existing = def.statBonuses ?? {};
    const available = statOptions.find((s) => !(s.value in existing));
    if (!available) return;
    onPatch({ statBonuses: { ...existing, [available.value]: 1 } });
  };

  return (
    <Section
      title="Stat Bonuses"
      description="Attribute buffs granted while equipped."
    >
      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-5 text-center">
          <p className="mb-2 text-2xs text-text-muted/80">
            No stat bonuses added yet.
          </p>
          <button
            type="button"
            onClick={addStat}
            disabled={allUsed}
            className="focus-ring inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-2xs font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <PlusIcon />
            Add Stat Bonus
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {entries.map(([stat, val]) => (
            <div
              key={stat}
              className="flex items-center gap-2 rounded-lg border border-violet/25 bg-violet/[0.06] px-2 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <SelectInput
                  value={stat}
                  onCommit={(v) => updateStat(stat, v, val)}
                  options={statOptions}
                  dense
                />
              </div>
              <div className="w-16 shrink-0">
                <NumberInput
                  value={val}
                  onCommit={(v) => updateStat(stat, stat, v ?? 1)}
                  min={1}
                  dense
                />
              </div>
              <button
                type="button"
                onClick={() => removeStat(stat)}
                aria-label="Remove stat bonus"
                className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded text-text-muted/60 transition hover:bg-status-error/15 hover:text-status-error"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </div>
          ))}
          {!allUsed && (
            <button
              type="button"
              onClick={addStat}
              className="focus-ring mt-1 inline-flex items-center justify-center gap-1 rounded-lg border border-dashed border-accent/40 bg-transparent px-3 py-1.5 text-2xs font-medium text-accent transition hover:bg-accent/10"
            >
              <PlusIcon />
              Add Stat Bonus
            </button>
          )}
        </div>
      )}
    </Section>
  );
}

// ─── Slot Compatibility ────────────────────────────────────────────

function SlotCompatibilityCard({
  def,
  equipSlotOptions,
  onPatch,
}: {
  def: EnchantmentDefinitionConfig;
  equipSlotOptions: { value: string; label: string }[];
  onPatch: (p: Partial<EnchantmentDefinitionConfig>) => void;
}) {
  const targetSlots = def.targetSlots ?? [];
  const anySlot = targetSlots.length === 0;

  const setAnySlot = () => {
    onPatch({ targetSlots: undefined });
  };

  const toggleSlot = (slotId: string) => {
    const next = targetSlots.includes(slotId)
      ? targetSlots.filter((s) => s !== slotId)
      : [...targetSlots, slotId];
    onPatch({ targetSlots: next.length > 0 ? next : undefined });
  };

  return (
    <Section
      title="Slot Compatibility"
      description="Where the inscription can land."
    >
      <div className="flex flex-wrap gap-1.5">
        <SlotChip active={anySlot} onClick={setAnySlot}>
          Any slot
        </SlotChip>
        {equipSlotOptions.map(({ value, label }) => (
          <SlotChip
            key={value}
            active={targetSlots.includes(value)}
            onClick={() => toggleSlot(value)}
          >
            {label}
          </SlotChip>
        ))}
      </div>
      <p className="mt-2 text-2xs italic text-text-muted/70">
        Leave off to allow any slot.
      </p>
    </Section>
  );
}

function SlotChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "focus-ring inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-display text-2xs font-medium transition",
        active
          ? "border-accent/60 bg-accent/15 text-accent shadow-[0_0_18px_-10px_rgb(var(--accent-rgb)/0.6)]"
          : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-secondary hover:border-accent/30 hover:text-text-primary",
      )}
    >
      {children}
    </button>
  );
}

// ─── Materials ─────────────────────────────────────────────────────

function MaterialsCard({
  def,
  onPatch,
}: {
  def: EnchantmentDefinitionConfig;
  onPatch: (p: Partial<EnchantmentDefinitionConfig>) => void;
}) {
  const materials = def.materials;

  const addMaterial = () =>
    onPatch({
      materials: [...materials, { itemId: "", quantity: 1 }],
    });

  const updateMaterial = (i: number, p: Partial<EnchantmentMaterialConfig>) =>
    onPatch({
      materials: materials.map((m, idx) => (idx === i ? { ...m, ...p } : m)),
    });

  const removeMaterial = (i: number) =>
    onPatch({ materials: materials.filter((_, idx) => idx !== i) });

  return (
    <Section
      title="Materials Consumed"
      description="Items burned each time this enchantment is applied."
    >
      {materials.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] px-3 py-5 text-center">
          <p className="mb-2 text-2xs text-text-muted/80">
            No materials required.
          </p>
          <button
            type="button"
            onClick={addMaterial}
            className="focus-ring inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-2xs font-medium text-accent transition hover:bg-accent/20"
          >
            <PlusIcon />
            Add Material
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {materials.map((mat, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border border-status-warning/25 bg-status-warning/[0.05] px-2 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <TextInput
                  value={mat.itemId}
                  onCommit={(v) => updateMaterial(i, { itemId: v })}
                  placeholder="item_id"
                  dense
                />
              </div>
              <div className="w-16 shrink-0">
                <NumberInput
                  value={mat.quantity}
                  onCommit={(v) => updateMaterial(i, { quantity: v ?? 1 })}
                  min={1}
                  dense
                />
              </div>
              <button
                type="button"
                onClick={() => removeMaterial(i)}
                aria-label="Remove material"
                className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded text-text-muted/60 transition hover:bg-status-error/15 hover:text-status-error"
              >
                <TrashIcon />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addMaterial}
            className="focus-ring mt-1 inline-flex items-center justify-center gap-1 rounded-lg border border-dashed border-accent/40 bg-transparent px-3 py-1.5 text-2xs font-medium text-accent transition hover:bg-accent/10"
          >
            <PlusIcon />
            Add Material
          </button>
        </div>
      )}
    </Section>
  );
}

// ─── Shared ────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
        {label}
      </span>
      {children}
      {hint && (
        <p className="text-2xs leading-snug text-text-muted/70">{hint}</p>
      )}
    </div>
  );
}
