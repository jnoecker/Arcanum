import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ActionButton, DialogShell } from "@/components/ui/FormWidgets";
import { useConfigStore } from "@/stores/configStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useFocusTrap } from "@/lib/useFocusTrap";
import {
  applyZoneRebalance,
  computeZoneRebalance,
  inferLevelBand,
  type MobRebalanceDiff,
  type OverrideAction,
  type OverrideField,
  type ZoneRebalanceTarget,
} from "@/lib/zoneRebalance";

interface RebalanceZoneDialogProps {
  zoneId: string;
  onClose: () => void;
}

const TIER_LABELS: Record<string, string> = {
  weak: "Weak",
  standard: "Standard",
  elite: "Elite",
  boss: "Boss",
};

const DIFFICULTY_LABELS: Array<{ value: NonNullable<ZoneRebalanceTarget["difficultyHint"]>; label: string }> = [
  { value: "casual", label: "Casual" },
  { value: "standard", label: "Standard" },
  { value: "challenging", label: "Challenging" },
];

const DIFFICULTY_COPY: Record<NonNullable<ZoneRebalanceTarget["difficultyHint"]>, string> = {
  casual: "Bias standard and elite mobs toward the bottom of the band.",
  standard: "Keep weak, standard, elite, and boss mobs spread evenly across the band.",
  challenging: "Bias standard and elite mobs toward the top of the band.",
};

const DIFFICULTY_NONE_OPTION = {
  value: undefined,
  label: "None",
  description: "No spread bias",
  tooltip: "Use the band only, with no extra spread bias.",
} as const;

const DIFFICULTY_OPTIONS: Array<{
  value: ZoneRebalanceTarget["difficultyHint"] | undefined;
  label: string;
  description: string;
  tooltip: string;
}> = [
  DIFFICULTY_NONE_OPTION,
  ...DIFFICULTY_LABELS.map((option) => ({
    value: option.value,
    label: option.label,
    description:
      option.value === "casual"
        ? "Favor lower levels"
        : option.value === "challenging"
          ? "Favor upper levels"
          : "Even tier spread",
    tooltip: DIFFICULTY_COPY[option.value],
  })),
];

const FIELD_LABELS: Record<OverrideField, string> = {
  hp: "HP",
  minDamage: "min damage",
  maxDamage: "max damage",
  armor: "armor",
  xpReward: "XP reward",
  goldMin: "min gold",
  goldMax: "max gold",
};

const REVIEW_TOOLTIP =
  "Conservative heuristic: elite or boss mobs, or mobs with quests, dialogue, or drop tables. These are never auto-selected.";

const BATCH_SAFE_TOOLTIP =
  "Mobs that are not elite or boss and have no quests, dialogue, or drop tables attached.";

const MOB_SELECTION_TOOLTIP =
  "Selecting a mob rewrites that whole mob. Its level changes, and any stat cleanup shown on the row is applied automatically.";

const DIFFICULTY_TOOLTIP =
  "Controls where weak, standard, elite, and boss mobs land inside the selected level band.";

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function mobHasChanges(diff: MobRebalanceDiff): boolean {
  return diff.levelChanged || diff.overrideChanges.length > 0;
}

function getLevelSummary(diff: MobRebalanceDiff): string {
  if (!diff.levelChanged) {
    return diff.currentLevel != null ? `Already at L${diff.targetLevel}` : `Uses default L${diff.targetLevel}`;
  }
  if (diff.currentLevel != null) {
    return `Level L${diff.currentLevel} -> L${diff.targetLevel}`;
  }
  return `Set explicit level to L${diff.targetLevel}`;
}

function formatOverrideDetail(diff: MobRebalanceDiff, action: OverrideAction): string | null {
  const matches = diff.overrideChanges.filter((change) => change.action === action);
  if (matches.length === 0) return null;
  return matches
    .map((change) =>
      action === "drop"
        ? `${FIELD_LABELS[change.field]} ${change.currentOverride} -> ${change.tierBaseline}`
        : `${FIELD_LABELS[change.field]} ${change.currentOverride} (tier default ${change.tierBaseline})`,
    )
    .join(", ");
}

function countOverrideAction(diff: MobRebalanceDiff, action: OverrideAction): number {
  return diff.overrideChanges.filter((change) => change.action === action).length;
}

function HelpHint({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] text-[11px] text-text-muted"
    >
      ?
    </span>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "accent" | "warning" | "success";
}) {
  const toneClass =
    tone === "accent"
      ? "text-accent"
      : tone === "warning"
        ? "text-status-warning"
        : tone === "success"
          ? "text-status-success"
          : "text-text-primary";

  return (
    <div className="rounded-3xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-3">
      <div className="flex items-center gap-2">
        <p className="text-3xs uppercase tracking-wide-ui text-text-muted">{label}</p>
        {hint && <HelpHint text={hint} />}
      </div>
      <p className={`mt-2 font-display text-base ${toneClass}`}>{value}</p>
    </div>
  );
}

function DifficultyHintPicker({
  value,
  onChange,
}: {
  value: ZoneRebalanceTarget["difficultyHint"];
  onChange: (value: ZoneRebalanceTarget["difficultyHint"]) => void;
}) {
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {DIFFICULTY_OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value ?? "none"}
            type="button"
            aria-pressed={selected}
            title={option.tooltip}
            onClick={() => onChange(option.value)}
            className={`min-h-[5.25rem] rounded-[1.1rem] border px-3 py-3 text-left transition ${
              selected
                ? "border-accent/35 bg-gradient-active text-text-primary shadow-[var(--shadow-glow)]"
                : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] text-text-secondary hover:border-[var(--border-accent-ring)] hover:text-text-primary"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-sm">{option.label}</span>
              <span className={`text-xs ${selected ? "text-accent" : "text-text-muted"}`}>
                {selected ? "Active" : ""}
              </span>
            </div>
            <p className="mt-2 text-2xs leading-5 text-text-muted">{option.description}</p>
          </button>
        );
      })}
    </div>
  );
}

function MobDecisionCard({
  diff,
  included,
  onToggle,
}: {
  diff: MobRebalanceDiff;
  included: boolean;
  onToggle: () => void;
}) {
  const resetDetail = formatOverrideDetail(diff, "drop");
  const preservedDetail = formatOverrideDetail(diff, "flag");
  const resetCount = countOverrideAction(diff, "drop");
  const preservedCount = countOverrideAction(diff, "flag");
  const groupLabel = diff.classification === "named" ? "Review first" : "Batch-safe";
  const groupTooltip = diff.classification === "named" ? REVIEW_TOOLTIP : BATCH_SAFE_TOOLTIP;

  return (
    <article
      className={`rounded-3xl border p-4 transition ${
        included
          ? "border-accent/45 bg-gradient-active shadow-[var(--shadow-glow)]"
          : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] hover:border-[var(--border-accent-ring)]"
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-display text-sm text-text-primary">{diff.displayName}</h4>
            <span
              title={groupTooltip}
              className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] px-2.5 py-1 text-3xs uppercase tracking-label text-text-muted"
            >
              {groupLabel}
            </span>
            <span className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] px-2.5 py-1 text-3xs uppercase tracking-label text-text-muted">
              {TIER_LABELS[diff.tier] ?? diff.tier}
            </span>
            <span className="rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 font-mono text-3xs text-text-secondary">
              {getLevelSummary(diff)}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-2xs text-text-muted">
            {resetCount === 0 && preservedCount === 0 && (
              <span className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-2.5 py-1">
                Level only
              </span>
            )}
            {resetCount > 0 && (
              <span
                title={resetDetail ? `Reset to tier default: ${resetDetail}` : undefined}
                className="rounded-full border border-status-warning/25 bg-status-warning/10 px-2.5 py-1 text-status-warning"
              >
                {resetCount} {pluralize(resetCount, "stat")} reset
              </span>
            )}
            {preservedCount > 0 && (
              <span
                title={preservedDetail ? `Keep current custom values: ${preservedDetail}` : undefined}
                className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-2.5 py-1"
              >
                {preservedCount} {pluralize(preservedCount, "stat")} kept
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
          <span
            className={`rounded-full px-3 py-1 text-3xs uppercase tracking-wide-ui ${
              included
                ? "bg-accent/15 text-accent"
                : "bg-[var(--chrome-highlight-strong)] text-text-muted"
            }`}
          >
            {included ? "Rewriting now" : "Skipped"}
          </span>
          <ActionButton variant={included ? "primary" : "ghost"} size="sm" onClick={onToggle}>
            {included ? "Leave alone" : "Rewrite mob"}
          </ActionButton>
        </div>
      </div>
    </article>
  );
}

export function RebalanceZoneDialog({ zoneId, onClose }: RebalanceZoneDialogProps) {
  const config = useConfigStore((s) => s.config);
  const zoneState = useZoneStore((s) => s.zones.get(zoneId));
  const updateZone = useZoneStore((s) => s.updateZone);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  const initialBand = useMemo(
    () => (zoneState?.data ? inferLevelBand(zoneState.data) : { min: 1, max: 5 }),
    [zoneState?.data],
  );
  const [bandMin, setBandMin] = useState(initialBand.min);
  const [bandMax, setBandMax] = useState(initialBand.max);
  const [difficulty, setDifficulty] = useState<ZoneRebalanceTarget["difficultyHint"]>(
    zoneState?.data?.difficultyHint,
  );
  const [acceptedMobIds, setAcceptedMobIds] = useState<Set<string>>(() => new Set());

  const target: ZoneRebalanceTarget = {
    levelBand: { min: bandMin, max: Math.max(bandMin, bandMax) },
    difficultyHint: difficulty,
  };

  const diff = useMemo(() => {
    if (!zoneState?.data || !config) return null;
    return computeZoneRebalance(zoneState.data, config, target);
  }, [zoneState?.data, config, target]);

  const changedMobs = useMemo(
    () => diff?.mobs.filter(mobHasChanges) ?? [],
    [diff],
  );
  const changedMobIdSignature = useMemo(
    () => changedMobs.map((mob) => mob.mobId).join("|"),
    [changedMobs],
  );

  useEffect(() => {
    setAcceptedMobIds((prev) => {
      const validIds = new Set(changedMobs.map((mob) => mob.mobId));
      let mutated = false;
      const next = new Set<string>();
      for (const mobId of prev) {
        if (validIds.has(mobId)) {
          next.add(mobId);
        } else {
          mutated = true;
        }
      }
      return mutated ? next : prev;
    });
  }, [changedMobIdSignature, changedMobs]);

  const namedWithChanges = useMemo(
    () => changedMobs.filter((mob) => mob.classification === "named"),
    [changedMobs],
  );
  const trashWithChanges = useMemo(
    () => changedMobs.filter((mob) => mob.classification === "trash"),
    [changedMobs],
  );
  const reviewFirstMobs = namedWithChanges;
  const batchSafeMobs = trashWithChanges;

  const acceptedCount = acceptedMobIds.size;
  const unchangedCount = (diff?.mobs.length ?? 0) - changedMobs.length;
  const targetChanged =
    zoneState?.data?.levelBand?.min !== bandMin ||
    zoneState?.data?.levelBand?.max !== target.levelBand.max ||
    zoneState?.data?.difficultyHint !== difficulty;

  const toggleMob = (mobId: string) => {
    setAcceptedMobIds((prev) => {
      const next = new Set(prev);
      if (next.has(mobId)) next.delete(mobId);
      else next.add(mobId);
      return next;
    });
  };

  const setGroupSelection = (mobs: MobRebalanceDiff[], included: boolean) => {
    setAcceptedMobIds((prev) => {
      const next = new Set(prev);
      for (const mob of mobs) {
        if (included) next.add(mob.mobId);
        else next.delete(mob.mobId);
      }
      return next;
    });
  };

  const handleApply = () => {
    if (!zoneState?.data || !diff) return;
    const next = applyZoneRebalance(zoneState.data, diff, { acceptedMobIds });
    updateZone(zoneId, next);
    onClose();
  };

  const canApply = acceptedCount > 0 || targetChanged;

  let applyLabel = "Apply Rebalance";
  if (targetChanged && acceptedCount === 0) {
    applyLabel = "Save Target Only";
  } else if (targetChanged && acceptedCount > 0) {
    applyLabel = `Save Target + ${acceptedCount} ${pluralize(acceptedCount, "Mob")} `;
  } else if (acceptedCount > 0) {
    applyLabel = `Apply ${acceptedCount} ${pluralize(acceptedCount, "Mob")} Change${acceptedCount === 1 ? "" : "s"}`;
  }

  let footerSummary = "Pick a target or select mobs.";
  if (targetChanged && acceptedCount === 0) {
    footerSummary = "Saving target only.";
  } else if (targetChanged && acceptedCount > 0) {
    footerSummary = `Saving target and rewriting ${acceptedCount} ${pluralize(acceptedCount, "mob")}.`;
  } else if (acceptedCount > 0) {
    footerSummary = `Rewriting ${acceptedCount} ${pluralize(acceptedCount, "mob")}.`;
  }

  if (!zoneState || !config) {
    return null;
  }

  const content = (
    <DialogShell
      dialogRef={trapRef}
      overlayStyle={{ zIndex: 85 }}
      titleId="rebalance-zone-title"
      title={`Rebalance Zone - ${zoneState.data.zone}`}
      widthClassName="max-w-6xl"
      onClose={onClose}
      footer={(
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="max-w-3xl text-xs leading-6 text-text-secondary">{footerSummary}</p>
          <div className="flex shrink-0 gap-2">
            <ActionButton onClick={onClose} variant="ghost">
              Cancel
            </ActionButton>
            <ActionButton onClick={handleApply} disabled={!canApply} variant="primary">
              {applyLabel.trim()}
            </ActionButton>
          </div>
        </div>
      )}
    >
      <div className="flex min-h-[32rem] flex-col gap-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
            <div className="panel-surface-light rounded-3xl p-5">
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-3xs uppercase tracking-wide-ui text-text-muted">Zone target</p>
                  <h3 className="mt-2 font-display text-base text-text-primary">Mob band</h3>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-3xs uppercase tracking-wide-ui text-text-muted">Level min</span>
                  <input
                    id="rb-level-min"
                    type="number"
                    min={1}
                    value={bandMin}
                    onChange={(e) => setBandMin(Math.max(1, Number(e.target.value) || 1))}
                    className="mt-2 h-11 w-full rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 font-mono text-sm text-text-primary outline-none transition focus:border-[var(--border-accent-ring)] focus:shadow-[var(--glow-aurum)]"
                  />
                </label>
                <label className="block">
                  <span className="text-3xs uppercase tracking-wide-ui text-text-muted">Level max</span>
                  <input
                    id="rb-level-max"
                    type="number"
                    min={1}
                    value={bandMax}
                    onChange={(e) => setBandMax(Math.max(1, Number(e.target.value) || 1))}
                    className="mt-2 h-11 w-full rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 font-mono text-sm text-text-primary outline-none transition focus:border-[var(--border-accent-ring)] focus:shadow-[var(--glow-aurum)]"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="flex items-center gap-2 text-3xs uppercase tracking-wide-ui text-text-muted">
                    Difficulty spread
                    <HelpHint text={DIFFICULTY_TOOLTIP} />
                  </span>
                  <DifficultyHintPicker value={difficulty} onChange={setDifficulty} />
                </label>
              </div>
            </div>

            <div className="panel-surface-light rounded-3xl p-5">
              <div className="flex items-center gap-2">
                <p className="text-3xs uppercase tracking-wide-ui text-text-muted">Apply summary</p>
                <HelpHint text={MOB_SELECTION_TOOLTIP} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <SummaryTile
                  label="Zone target"
                  value={`L${bandMin}-${target.levelBand.max}`}
                  tone={targetChanged ? "accent" : "default"}
                />
                <SummaryTile
                  label="Mobs selected"
                  value={`${acceptedCount} ${pluralize(acceptedCount, "mob")}`}
                  hint={MOB_SELECTION_TOOLTIP}
                  tone={acceptedCount > 0 ? "accent" : "default"}
                />
                <SummaryTile
                  label="Review first"
                  value={`${reviewFirstMobs.length} ${pluralize(reviewFirstMobs.length, "mob")}`}
                  hint={REVIEW_TOOLTIP}
                  tone={reviewFirstMobs.length > 0 ? "warning" : "success"}
                />
                <SummaryTile
                  label="Batch-safe"
                  value={`${batchSafeMobs.length} ${pluralize(batchSafeMobs.length, "mob")}`}
                  hint={BATCH_SAFE_TOOLTIP}
                  tone={batchSafeMobs.length > 0 ? "success" : "default"}
                />
              </div>
            </div>
        </div>

        {reviewFirstMobs.length > 0 && (
            <section className="panel-surface-light rounded-3xl p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-base text-text-primary">Review-first mobs</h3>
                  <HelpHint text={REVIEW_TOOLTIP} />
                </div>
                <div className="flex gap-2">
                  <ActionButton variant="ghost" size="sm" onClick={() => setGroupSelection(reviewFirstMobs, false)}>
                    Clear
                  </ActionButton>
                  <ActionButton variant="secondary" size="sm" onClick={() => setGroupSelection(reviewFirstMobs, true)}>
                    Select All
                  </ActionButton>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {reviewFirstMobs.map((mob) => (
                  <MobDecisionCard
                    key={mob.mobId}
                    diff={mob}
                    included={acceptedMobIds.has(mob.mobId)}
                    onToggle={() => toggleMob(mob.mobId)}
                  />
                ))}
              </div>
            </section>
        )}

        {batchSafeMobs.length > 0 && (
            <section className="panel-surface-light rounded-3xl p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-base text-text-primary">Batch-safe mobs</h3>
                  <HelpHint text={BATCH_SAFE_TOOLTIP} />
                </div>
                <div className="flex gap-2">
                  <ActionButton variant="ghost" size="sm" onClick={() => setGroupSelection(batchSafeMobs, false)}>
                    Clear
                  </ActionButton>
                  <ActionButton variant="secondary" size="sm" onClick={() => setGroupSelection(batchSafeMobs, true)}>
                    Select All
                  </ActionButton>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {batchSafeMobs.map((mob) => (
                  <MobDecisionCard
                    key={mob.mobId}
                    diff={mob}
                    included={acceptedMobIds.has(mob.mobId)}
                    onToggle={() => toggleMob(mob.mobId)}
                  />
                ))}
              </div>
            </section>
        )}

        {diff && changedMobs.length === 0 && (
            <div className="panel-surface-light flex min-h-[12rem] items-center justify-center rounded-3xl px-6 py-8 text-center">
              <div>
                <h3 className="font-display text-base text-text-primary">Everything already matches the target</h3>
                <p className="mt-3 max-w-xl text-sm leading-7 text-text-secondary">
                  There are no mob rewrites to review. Save the target only if you want this zone's level band and difficulty hint persisted for future validation and rebalance work.
                </p>
              </div>
            </div>
        )}

        {diff && unchangedCount > 0 && changedMobs.length > 0 && (
            <div className="rounded-3xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-3 text-xs leading-6 text-text-muted">
              {unchangedCount} {pluralize(unchangedCount, "mob")} already match the target and are not shown below.
            </div>
        )}

        {diff && diff.skippedMobIds.length > 0 && (
            <div className="rounded-3xl border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
              These mobs were skipped because their tier is unknown: {diff.skippedMobIds.join(", ")}.
            </div>
        )}
      </div>
    </DialogShell>
  );

  if (typeof document === "undefined") {
    return content;
  }

  return createPortal(content, document.body);
}
