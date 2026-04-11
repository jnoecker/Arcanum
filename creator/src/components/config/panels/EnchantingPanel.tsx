import { useCallback, useMemo, useState } from "react";
import type { ConfigPanelProps } from "./types";
import type {
  EnchantmentDefinitionConfig,
  EnchantmentMaterialConfig,
  EnchantingConfig,
} from "@/types/config";
import {
  TextInput,
  NumberInput,
  SelectInput,
  FieldGrid,
  CompactField,
  Badge,
} from "@/components/ui/FormWidgets";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function normalizeId(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

function defaultEnchantment(raw: string): EnchantmentDefinitionConfig {
  return {
    displayName: raw || "New Enchantment",
    skill: "enchanting",
    skillRequired: 1,
    materials: [],
    xpReward: 30,
  };
}

function totalBonusCount(e: EnchantmentDefinitionConfig): number {
  let n = 0;
  if (e.damageBonus) n += 1;
  if (e.armorBonus) n += 1;
  if (e.statBonuses) n += Object.keys(e.statBonuses).length;
  return n;
}

export function EnchantingPanel({ config, onChange }: ConfigPanelProps) {
  const enchanting = config.enchanting;
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const patchGlobal = useCallback(
    (patch: Partial<EnchantingConfig>) => {
      onChange({ enchanting: { ...enchanting, ...patch } });
    },
    [enchanting, onChange],
  );

  const patchEnchantment = useCallback(
    (id: string, p: Partial<EnchantmentDefinitionConfig>) => {
      const current = enchanting.definitions[id];
      if (!current) return;
      patchGlobal({
        definitions: { ...enchanting.definitions, [id]: { ...current, ...p } },
      });
    },
    [enchanting.definitions, patchGlobal],
  );

  const addEnchantment = useCallback(() => {
    const id = normalizeId(newName);
    if (!id || enchanting.definitions[id]) return;
    patchGlobal({
      definitions: {
        ...enchanting.definitions,
        [id]: defaultEnchantment(newName.trim()),
      },
    });
    setNewName("");
    setSelected(id);
  }, [newName, enchanting.definitions, patchGlobal]);

  const deleteEnchantment = useCallback(
    (id: string) => {
      const next = { ...enchanting.definitions };
      delete next[id];
      patchGlobal({ definitions: next });
      if (selected === id) setSelected(null);
    },
    [enchanting.definitions, selected, patchGlobal],
  );

  const renameEnchantment = useCallback(
    (oldId: string, rawNewId: string) => {
      const newId = normalizeId(rawNewId);
      if (!newId || oldId === newId || enchanting.definitions[newId]) return;
      const next: Record<string, EnchantmentDefinitionConfig> = {};
      for (const [k, v] of Object.entries(enchanting.definitions)) {
        next[k === oldId ? newId : k] = v;
      }
      patchGlobal({ definitions: next });
      if (selected === oldId) setSelected(newId);
      setRenaming(null);
    },
    [enchanting.definitions, selected, patchGlobal],
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

  const slotLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const opt of equipSlotOptions) m.set(opt.value, opt.label);
    return m;
  }, [equipSlotOptions]);

  const statLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const opt of statOptions) m.set(opt.value, opt.label);
    return m;
  }, [statOptions]);

  const enchantmentIds = Object.keys(enchanting.definitions);

  return (
    <div className="flex flex-col gap-6">
      <section className="panel-surface relative overflow-hidden rounded-3xl p-6 shadow-section">
        <div className="relative z-10 flex flex-col gap-5">
          <div className="max-w-2xl">
            <p className="border-l-2 border-accent/30 pl-2 text-2xs uppercase tracking-wide-ui text-text-muted">
              The enchanter's ledger
            </p>
            <h2 className="mt-2 font-display font-semibold text-xl text-text-primary">
              Inscriptions &amp; Wards
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Enchantments are permanent augments inscribed onto equipment —
              runes, wards, etchings. Each one trains a crafting skill, burns
              materials, and stacks onto an item up to the per-item cap below.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 border-t border-border-muted/50 pt-4">
            <div className="flex items-center gap-3 rounded-2xl border border-accent/25 bg-accent/[0.06] px-4 py-2">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                className="text-accent"
                aria-hidden="true"
              >
                <path
                  d="M12 3L6 7V12C6 15.5 8.5 19 12 21C15.5 19 18 15.5 18 12V7L12 3Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 12L11 14L15 10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div>
                <p className="font-display text-2xs uppercase tracking-wider text-text-muted">
                  Max per item
                </p>
                <div className="flex items-baseline gap-2">
                  <div className="w-16">
                    <NumberInput
                      value={enchanting.maxEnchantmentsPerItem}
                      onCommit={(v) =>
                        patchGlobal({ maxEnchantmentsPerItem: v ?? 1 })
                      }
                      min={1}
                    />
                  </div>
                  <span className="text-2xs text-text-muted/70">
                    {enchanting.maxEnchantmentsPerItem === 1
                      ? "single inscription per piece"
                      : `up to ${enchanting.maxEnchantmentsPerItem} stacked`}
                  </span>
                </div>
              </div>
            </div>

            <div className="ml-auto text-right">
              <p className="font-display text-2xl font-semibold leading-none text-text-primary">
                {enchantmentIds.length}
              </p>
              <p className="mt-1 text-2xs uppercase tracking-wider text-text-muted">
                {enchantmentIds.length === 1 ? "enchantment" : "enchantments"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <header className="flex items-end justify-between gap-3">
          <div>
            <h3 className="font-display font-semibold text-base text-text-primary">
              Known Enchantments
            </h3>
            <p className="mt-0.5 text-2xs leading-relaxed text-text-muted/70">
              Every enchantment a player can learn and inscribe.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              className="w-44 rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
              placeholder="new_enchantment_id"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addEnchantment();
              }}
            />
            <button
              type="button"
              onClick={addEnchantment}
              disabled={!newName.trim()}
              className="focus-ring rounded border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              + Add
            </button>
          </div>
        </header>

        {enchantmentIds.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-muted/60 bg-bg-primary/20 px-6 py-12 text-center">
            <p className="font-display text-sm text-text-muted">
              No enchantments known.
            </p>
            <p className="mt-1 text-2xs text-text-muted/70">
              Scribe the first ward to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {enchantmentIds.map((id) => (
              <EnchantmentCard
                key={id}
                id={id}
                enchantment={enchanting.definitions[id]!}
                slotLabelMap={slotLabelMap}
                statLabelMap={statLabelMap}
                selected={selected === id}
                onSelect={() => setSelected(selected === id ? null : id)}
                onDelete={() => deleteEnchantment(id)}
              />
            ))}
          </div>
        )}

        {selected && enchanting.definitions[selected] && (
          <EnchantmentEditor
            id={selected}
            enchantment={enchanting.definitions[selected]!}
            craftingSkillOptions={craftingSkillOptions}
            equipSlotOptions={equipSlotOptions}
            statOptions={statOptions}
            renaming={renaming === selected}
            renameValue={renameValue}
            onStartRename={() => {
              setRenaming(selected);
              setRenameValue(selected);
            }}
            onRenameChange={setRenameValue}
            onCommitRename={() =>
              renameEnchantment(selected, renameValue)
            }
            onCancelRename={() => setRenaming(null)}
            onPatch={(p) => patchEnchantment(selected, p)}
            onClose={() => setSelected(null)}
            onDelete={() => deleteEnchantment(selected)}
          />
        )}
      </section>
    </div>
  );
}

interface EnchantmentCardProps {
  id: string;
  enchantment: EnchantmentDefinitionConfig;
  slotLabelMap: Map<string, string>;
  statLabelMap: Map<string, string>;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function EnchantmentCard({
  id,
  enchantment,
  slotLabelMap,
  statLabelMap,
  selected,
  onSelect,
  onDelete,
}: EnchantmentCardProps) {
  const bonusCount = totalBonusCount(enchantment);
  const slotLabels = enchantment.targetSlots?.map(
    (s) => slotLabelMap.get(s) ?? s,
  );
  const statEntries = Object.entries(enchantment.statBonuses ?? {});

  return (
    <div
      className={cx(
        "group relative overflow-hidden rounded-2xl border transition",
        selected
          ? "border-accent/60 bg-accent/[0.07] shadow-[0_0_28px_-10px_rgb(var(--accent-rgb)/0.65)]"
          : "border-border-muted/50 bg-bg-primary/25 hover:border-border-default hover:bg-bg-primary/40",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-expanded={selected}
        className="focus-ring flex w-full flex-col gap-2 p-3 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="truncate font-display text-sm font-semibold text-text-primary">
              {enchantment.displayName || id}
            </h4>
            <p className="truncate text-2xs text-text-muted/70">{id}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span className="inline-flex items-baseline gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5">
              <span className="font-display text-[0.55rem] font-semibold uppercase tracking-wider text-accent/80">
                {enchantment.skill}
              </span>
              <span className="font-display text-xs font-semibold tabular-nums text-accent">
                {enchantment.skillRequired}
              </span>
            </span>
            <span className="text-[0.6rem] text-text-muted/60">
              {enchantment.xpReward} xp
            </span>
          </div>
        </div>

        {bonusCount === 0 ? (
          <p className="text-2xs italic text-text-muted/60">
            No bonuses configured.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {enchantment.damageBonus ? (
              <BonusChip tint="rose">
                +{enchantment.damageBonus} dmg
              </BonusChip>
            ) : null}
            {enchantment.armorBonus ? (
              <BonusChip tint="blue">
                +{enchantment.armorBonus} armor
              </BonusChip>
            ) : null}
            {statEntries.map(([stat, val]) => (
              <BonusChip key={stat} tint="violet">
                +{val} {statLabelMap.get(stat) ?? stat}
              </BonusChip>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {slotLabels && slotLabels.length > 0 ? (
            slotLabels
              .slice(0, 4)
              .map((label) => (
                <Badge key={label} variant="muted">
                  {label}
                </Badge>
              ))
          ) : (
            <Badge variant="muted">Any slot</Badge>
          )}
          {slotLabels && slotLabels.length > 4 && (
            <span className="text-2xs text-text-muted/60">
              +{slotLabels.length - 4} more
            </span>
          )}
          {enchantment.materials.length > 0 && (
            <Badge variant="warning">
              {enchantment.materials.length}{" "}
              {enchantment.materials.length === 1 ? "material" : "materials"}
            </Badge>
          )}
        </div>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label={`Delete ${id}`}
        className="focus-ring absolute right-2 top-2 rounded p-1 text-text-muted/40 opacity-0 transition hover:bg-status-error/15 hover:text-status-error group-hover:opacity-100"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M4 4L12 12M12 4L4 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

function BonusChip({
  tint,
  children,
}: {
  tint: "rose" | "blue" | "violet";
  children: React.ReactNode;
}) {
  const tintClass =
    tint === "rose"
      ? "border-status-error/35 bg-status-error/10 text-status-error"
      : tint === "blue"
        ? "border-stellar-blue/35 bg-stellar-blue/10 text-stellar-blue"
        : "border-violet/35 bg-violet/10 text-violet";
  return (
    <span
      className={cx(
        "rounded-full border px-2 py-0.5 font-display text-2xs font-semibold",
        tintClass,
      )}
    >
      {children}
    </span>
  );
}

interface EnchantmentEditorProps {
  id: string;
  enchantment: EnchantmentDefinitionConfig;
  craftingSkillOptions: { value: string; label: string }[];
  equipSlotOptions: { value: string; label: string }[];
  statOptions: { value: string; label: string }[];
  renaming: boolean;
  renameValue: string;
  onStartRename: () => void;
  onRenameChange: (v: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onPatch: (p: Partial<EnchantmentDefinitionConfig>) => void;
  onClose: () => void;
  onDelete: () => void;
}

function EnchantmentEditor({
  id,
  enchantment,
  craftingSkillOptions,
  equipSlotOptions,
  statOptions,
  renaming,
  renameValue,
  onStartRename,
  onRenameChange,
  onCommitRename,
  onCancelRename,
  onPatch,
  onClose,
  onDelete,
}: EnchantmentEditorProps) {
  const addMaterial = () =>
    onPatch({
      materials: [...enchantment.materials, { itemId: "", quantity: 1 }],
    });

  const updateMaterial = (
    idx: number,
    mp: Partial<EnchantmentMaterialConfig>,
  ) =>
    onPatch({
      materials: enchantment.materials.map((m, i) =>
        i === idx ? { ...m, ...mp } : m,
      ),
    });

  const removeMaterial = (idx: number) =>
    onPatch({
      materials: enchantment.materials.filter((_, i) => i !== idx),
    });

  const addStatBonus = () => {
    const existing = enchantment.statBonuses ?? {};
    const available = statOptions.find((s) => !(s.value in existing));
    if (!available) return;
    onPatch({ statBonuses: { ...existing, [available.value]: 1 } });
  };

  const updateStatBonus = (
    oldStat: string,
    newStat: string,
    value: number,
  ) => {
    const bonuses = { ...enchantment.statBonuses };
    if (oldStat !== newStat) delete bonuses[oldStat];
    bonuses[newStat] = value;
    onPatch({
      statBonuses: Object.keys(bonuses).length > 0 ? bonuses : undefined,
    });
  };

  const removeStatBonus = (stat: string) => {
    const { [stat]: _, ...rest } = enchantment.statBonuses ?? {};
    onPatch({ statBonuses: Object.keys(rest).length > 0 ? rest : undefined });
  };

  const statEntries = Object.entries(enchantment.statBonuses ?? {});
  const allStatsUsed =
    statOptions.length > 0 && statEntries.length >= statOptions.length;

  return (
    <div className="panel-surface relative overflow-hidden rounded-2xl p-5 shadow-section">
      <div className="relative z-10">
        <div className="mb-5 flex items-start justify-between gap-3 border-b border-border-muted/50 pb-3">
          <div className="min-w-0">
            <p className="text-2xs uppercase tracking-wider text-text-muted">
              Inscribing
            </p>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
              <h3 className="font-display font-semibold text-base text-text-primary">
                {enchantment.displayName || id}
              </h3>
              {renaming ? (
                <span className="inline-flex items-center gap-1">
                  <input
                    autoFocus
                    className="w-40 rounded border border-border-default bg-bg-primary px-1.5 py-0.5 font-sans text-xs text-text-primary outline-none focus:border-accent/50"
                    value={renameValue}
                    onChange={(e) => onRenameChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onCommitRename();
                      if (e.key === "Escape") onCancelRename();
                    }}
                  />
                  <button
                    type="button"
                    onClick={onCommitRename}
                    className="rounded bg-accent/20 px-1.5 py-0.5 text-2xs text-accent hover:bg-accent/30"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={onCancelRename}
                    className="rounded px-1.5 py-0.5 text-2xs text-text-muted hover:text-text-primary"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onStartRename}
                  title="Rename ID"
                  className="font-sans text-xs font-normal text-text-muted/70 underline-offset-2 hover:text-text-primary hover:underline"
                >
                  {id}
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring shrink-0 rounded-full border border-border-muted/60 px-3 py-1 text-2xs text-text-muted transition hover:border-border-default hover:text-text-primary"
          >
            Close
          </button>
        </div>

        <div className="flex flex-col gap-6">
          <EditorSection kicker="Identity" title="Name, skill, and cost">
            <FieldGrid>
              <CompactField label="Display name" span>
                <TextInput
                  value={enchantment.displayName}
                  onCommit={(v) => onPatch({ displayName: v })}
                  placeholder="Runes of Warding"
                />
              </CompactField>
              <CompactField
                label="Crafting skill"
                hint="Which discipline trains and gates this inscription."
              >
                <SelectInput
                  value={enchantment.skill}
                  onCommit={(v) => onPatch({ skill: v })}
                  options={craftingSkillOptions}
                  allowEmpty
                  placeholder="enchanting"
                />
              </CompactField>
              <CompactField
                label="Skill required"
                hint="Minimum skill level to attempt."
              >
                <NumberInput
                  value={enchantment.skillRequired}
                  onCommit={(v) => onPatch({ skillRequired: v ?? 1 })}
                  min={1}
                />
              </CompactField>
              <CompactField
                label="XP reward"
                hint="Crafting XP granted on success."
                span
              >
                <NumberInput
                  value={enchantment.xpReward}
                  onCommit={(v) => onPatch({ xpReward: v ?? 30 })}
                  min={0}
                />
              </CompactField>
            </FieldGrid>
          </EditorSection>

          <EditorSection
            kicker="Power"
            title="Bonuses granted to the enchanted item"
          >
            <FieldGrid>
              <CompactField
                label="Damage bonus"
                hint="Flat damage added to weapon hits."
              >
                <NumberInput
                  value={enchantment.damageBonus ?? 0}
                  onCommit={(v) =>
                    onPatch({ damageBonus: v && v > 0 ? v : undefined })
                  }
                  min={0}
                />
              </CompactField>
              <CompactField
                label="Armor bonus"
                hint="Flat armor added to the equipped piece."
              >
                <NumberInput
                  value={enchantment.armorBonus ?? 0}
                  onCommit={(v) =>
                    onPatch({ armorBonus: v && v > 0 ? v : undefined })
                  }
                  min={0}
                />
              </CompactField>
            </FieldGrid>

            <div className="mt-4 border-t border-border-muted/30 pt-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-2xs uppercase tracking-wider text-text-muted">
                    Stat bonuses
                  </p>
                  <p className="mt-0.5 text-2xs leading-snug text-text-muted/60">
                    Attribute buffs granted while equipped.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addStatBonus}
                  disabled={allStatsUsed}
                  className="focus-ring rounded border border-accent/40 bg-accent/10 px-2 py-0.5 text-2xs font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  + Stat
                </button>
              </div>
              {statEntries.length === 0 ? (
                <p className="text-2xs italic text-text-muted/60">
                  No stat bonuses.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {statEntries.map(([stat, val]) => (
                    <div
                      key={stat}
                      className="flex items-center gap-2 rounded-lg border border-violet/25 bg-violet/[0.06] px-2 py-1"
                    >
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
                          onCommit={(v) =>
                            updateStatBonus(stat, stat, v ?? 1)
                          }
                          min={1}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeStatBonus(stat)}
                        aria-label="Remove stat bonus"
                        className="focus-ring rounded p-1 text-text-muted/60 transition hover:bg-status-error/15 hover:text-status-error"
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                          <path
                            d="M4 4L12 12M12 4L4 12"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </EditorSection>

          <EditorSection
            kicker="Capability"
            title="Where the inscription can land"
          >
            <p className="mb-2 text-2xs text-text-muted/70">
              Leave all off to allow any slot — useful for generic wards.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {equipSlotOptions.map(({ value, label }) => {
                const on =
                  enchantment.targetSlots?.includes(value) ?? false;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      const current = enchantment.targetSlots ?? [];
                      const next = on
                        ? current.filter((s) => s !== value)
                        : [...current, value];
                      onPatch({
                        targetSlots: next.length > 0 ? next : undefined,
                      });
                    }}
                    aria-pressed={on}
                    className={cx(
                      "focus-ring rounded-full border px-3 py-1 text-2xs font-medium transition",
                      on
                        ? "border-accent/50 bg-accent/15 text-accent"
                        : "border-border-muted/60 bg-bg-primary/40 text-text-muted hover:border-border-default hover:text-text-secondary",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </EditorSection>

          <EditorSection kicker="Cost" title="Materials consumed per inscription">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-2xs text-text-muted/70">
                Items burned each time this enchantment is applied. Leave empty
                for free inscriptions.
              </p>
              <button
                type="button"
                onClick={addMaterial}
                className="focus-ring rounded border border-accent/40 bg-accent/10 px-2 py-0.5 text-2xs font-medium text-accent transition hover:bg-accent/20"
              >
                + Material
              </button>
            </div>
            {enchantment.materials.length === 0 ? (
              <p className="text-2xs italic text-text-muted/60">
                No materials required.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {enchantment.materials.map((mat, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-status-warning/25 bg-status-warning/[0.05] px-2 py-1"
                  >
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
                        onCommit={(v) =>
                          updateMaterial(i, { quantity: v ?? 1 })
                        }
                        min={1}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMaterial(i)}
                      aria-label="Remove material"
                      className="focus-ring rounded p-1 text-text-muted/60 transition hover:bg-status-error/15 hover:text-status-error"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M4 4L12 12M12 4L4 12"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </EditorSection>

          <div className="flex justify-end border-t border-border-muted/50 pt-4">
            <button
              type="button"
              onClick={onDelete}
              className="focus-ring rounded border border-status-error/30 bg-status-error/10 px-2.5 py-1 text-2xs font-medium text-status-error transition hover:bg-status-error/20"
            >
              Delete enchantment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditorSection({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2.5">
        <p className="text-[0.6rem] uppercase tracking-wide-ui text-accent/70">
          {kicker}
        </p>
        <h4 className="font-display text-sm font-semibold text-text-primary">
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}
