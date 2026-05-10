import type { EnchantmentDefinitionConfig, AppConfig } from "@/types/config";

interface EnchantmentPreviewProps {
  id: string;
  def: EnchantmentDefinitionConfig;
  craftingSkills: AppConfig["craftingSkills"];
  craftingStationTypes: AppConfig["craftingStationTypes"];
  equipmentSlots: AppConfig["equipmentSlots"];
  stats: AppConfig["stats"];
}

export function EnchantmentPreview({
  id,
  def,
  craftingSkills,
  craftingStationTypes,
  equipmentSlots,
  stats,
}: EnchantmentPreviewProps) {
  const skillDef = craftingSkills[def.skill];
  const skillLabel = skillDef?.displayName ?? def.skill ?? "—";
  const stationKey = skillDef?.type?.trim() ?? "";
  const stationLabel =
    (stationKey && craftingStationTypes[stationKey]?.displayName) ||
    stationKey ||
    "an unspecified station";

  const targetSlots = def.targetSlots ?? [];
  const slotChips =
    targetSlots.length === 0
      ? [{ key: "__any__", label: "Any slot" }]
      : targetSlots.map((sid) => ({
          key: sid,
          label: equipmentSlots[sid]?.displayName ?? sid,
        }));

  const flatBonuses: Array<{ label: string; value: string }> = [];
  if (def.damageBonus && def.damageBonus > 0) {
    flatBonuses.push({ label: "Damage", value: `+${def.damageBonus}` });
  }
  if (def.armorBonus && def.armorBonus > 0) {
    flatBonuses.push({ label: "Armor", value: `+${def.armorBonus}` });
  }

  const statBonusEntries = Object.entries(def.statBonuses ?? {});
  const statBonuses = statBonusEntries.map(([sid, val]) => ({
    label: stats.definitions[sid]?.displayName ?? sid,
    value: `+${val}`,
  }));

  const hasAnyBonus = flatBonuses.length > 0 || statBonuses.length > 0;
  const displayName = def.displayName || id;

  return (
    <section
      aria-label="Player tooltip preview"
      className="relative mx-auto w-full max-w-[360px]"
    >
      <p className="mb-2 text-center font-display text-[0.55rem] font-semibold uppercase tracking-[0.28em] text-text-muted/70">
        Player Tooltip Preview
      </p>

      <div className="panel-surface bg-gradient-glow-top shadow-section shadow-glow-warm relative overflow-hidden rounded-2xl border border-accent/30 px-5 py-4">
        <span
          aria-hidden="true"
          className="flourish-top-thread pointer-events-none absolute inset-x-6 top-0 h-px"
        />

        {/* Header — sigil + name */}
        <div className="flex items-baseline gap-2">
          <span
            aria-hidden="true"
            className="font-display text-base leading-none text-accent/80"
          >
            ❖
          </span>
          <h4 className="font-display text-lg font-semibold uppercase tracking-[0.08em] text-accent">
            {displayName}
          </h4>
        </div>

        {/* Subhead */}
        <p className="mt-0.5 font-display text-[0.6rem] uppercase tracking-[0.2em] text-text-muted">
          Enchantment
          <span className="px-1 text-text-muted/50">·</span>
          <span className="text-text-secondary">{skillLabel}</span>
          <span className="px-1 text-text-muted/50">·</span>
          <span className="font-mono text-text-secondary">
            Lv {def.skillRequired}
          </span>
        </p>

        <div className="my-3 ornate-divider" aria-hidden="true" />

        {/* Bonuses */}
        {hasAnyBonus ? (
          <ul className="flex flex-col gap-1">
            {flatBonuses.map((b) => (
              <BonusRow key={`flat-${b.label}`} label={b.label} value={b.value} />
            ))}
            {statBonuses.map((b) => (
              <BonusRow key={`stat-${b.label}`} label={b.label} value={b.value} />
            ))}
          </ul>
        ) : (
          <p className="text-center font-body text-xs italic text-text-muted/70">
            No bonuses defined yet.
          </p>
        )}

        <div className="my-3 ornate-divider" aria-hidden="true" />

        {/* Slots */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-display text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Fits:
          </span>
          {slotChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center rounded-md border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-1.5 py-0.5 font-display text-[0.6rem] uppercase tracking-[0.14em] text-text-secondary"
            >
              {chip.label}
            </span>
          ))}
        </div>

        {/* Footer meta */}
        <p className="mt-3 border-t border-[var(--chrome-stroke)] pt-2 font-body text-[0.7rem] italic leading-snug text-text-muted/80">
          Inscribed at {stationLabel}.
          {" "}
          <span className="text-text-muted">
            {def.xpReward} XP awarded on completion.
          </span>
        </p>
      </div>
    </section>
  );
}

function BonusRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="font-display text-xs uppercase tracking-[0.12em] text-text-secondary">
        {label}
      </span>
      <span className="font-mono text-sm font-semibold tabular-nums text-accent">
        {value}
      </span>
    </li>
  );
}
