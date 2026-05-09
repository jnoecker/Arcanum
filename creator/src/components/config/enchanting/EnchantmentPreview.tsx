import type { EnchantmentDefinitionConfig, AppConfig } from "@/types/config";
import { Section } from "./Section";

interface EnchantmentPreviewProps {
  id: string;
  def: EnchantmentDefinitionConfig;
  craftingSkills: AppConfig["craftingSkills"];
  equipmentSlots: AppConfig["equipmentSlots"];
  stats: AppConfig["stats"];
}

export function EnchantmentPreview({
  id,
  def,
  craftingSkills,
  equipmentSlots,
  stats,
}: EnchantmentPreviewProps) {
  const skillLabel = craftingSkills[def.skill]?.displayName ?? def.skill;

  const slotsText =
    !def.targetSlots || def.targetSlots.length === 0
      ? "Any slot"
      : def.targetSlots.length === 1
        ? equipmentSlots[def.targetSlots[0]!]?.displayName ?? def.targetSlots[0]
        : `${def.targetSlots.length} slots`;

  const statBonusEntries = Object.entries(def.statBonuses ?? {});
  const statBonusText =
    statBonusEntries.length === 0
      ? "—"
      : statBonusEntries
          .map(
            ([sid, val]) =>
              `+${val} ${stats.definitions[sid]?.displayName ?? sid}`,
          )
          .join(", ");

  const materialsText =
    def.materials.length === 0
      ? "—"
      : def.materials.length === 1
        ? `${def.materials[0]!.quantity}× ${def.materials[0]!.itemId || "?"}`
        : `${def.materials.length} kinds`;

  return (
    <Section title="Preview / Summary" className="relative">
      <div className="relative flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-display text-xl font-semibold text-text-primary">
              {def.displayName || id}
            </h4>
            <span className="inline-flex items-baseline gap-1 rounded-md border border-accent/40 bg-accent/10 px-1.5 py-0.5">
              <span className="font-display text-[0.55rem] font-semibold uppercase tracking-wider text-accent/85">
                {skillLabel}
              </span>
              <span className="font-display text-2xs font-bold tabular-nums text-accent">
                {def.skillRequired}
              </span>
            </span>
          </div>
          <p className="mt-0.5 font-mono text-2xs text-text-muted/70">{id}</p>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-7">
            <StatColumn label="XP Reward" value={`${def.xpReward} XP`} accent />
            <StatColumn
              label="Requires Skill"
              value={String(def.skillRequired)}
            />
            <StatColumn label="Slot" value={slotsText ?? "—"} />
            <StatColumn
              label="Damage Bonus"
              value={String(def.damageBonus ?? 0)}
            />
            <StatColumn
              label="Armor Bonus"
              value={String(def.armorBonus ?? 0)}
            />
            <StatColumn
              label="Stat Bonuses"
              value={statBonusEntries.length === 0 ? "—" : String(statBonusEntries.length)}
              title={statBonusText}
            />
            <StatColumn
              label="Materials"
              value={def.materials.length === 0 ? "—" : String(def.materials.length)}
              title={materialsText}
            />
          </dl>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-[var(--chrome-stroke)] pt-2.5">
        <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
          Crafting Skill:
        </span>
        <span className="font-display text-2xs font-semibold text-accent">
          {skillLabel}
        </span>
      </div>
    </Section>
  );
}

function StatColumn({
  label,
  value,
  accent,
  title,
}: {
  label: string;
  value: string;
  accent?: boolean;
  title?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="font-display text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
        {label}
      </dt>
      <dd
        className={`mt-0.5 truncate font-display text-base font-bold ${accent ? "text-accent" : "text-text-primary"}`}
        title={title}
      >
        {value}
      </dd>
    </div>
  );
}
