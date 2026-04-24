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
  type MobClassification,
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

type DifficultyValue = ZoneRebalanceTarget["difficultyHint"];

const DIFFICULTY_OPTIONS: Array<{ value: DifficultyValue; label: string; tooltip: string }> = [
  { value: undefined, label: "None", tooltip: "Use the band only, no spread bias." },
  { value: "casual", label: "Casual", tooltip: "Bias standard and elite toward the bottom of the band." },
  { value: "standard", label: "Standard", tooltip: "Spread tiers evenly across the band." },
  { value: "challenging", label: "Challenging", tooltip: "Bias standard and elite toward the top of the band." },
];

const FIELD_LABELS: Record<OverrideField, string> = {
  hp: "HP",
  minDamage: "min dmg",
  maxDamage: "max dmg",
  armor: "armor",
  xpReward: "XP",
  goldMin: "gold min",
  goldMax: "gold max",
};

const SECTION_META: Record<
  MobClassification,
  { title: string; helper: string; selectable: boolean }
> = {
  named: {
    title: "Review first",
    helper: "Elite or boss mobs, or combat mobs with quests, dialogue, or drops. Never auto-selected.",
    selectable: true,
  },
  trash: {
    title: "Batch-safe",
    helper: "Combat mobs with no quests, dialogue, or drop tables. Safe to rewrite as a group.",
    selectable: true,
  },
  "non-combat": {
    title: "Not combat (skipped)",
    helper: "Vendors, quest-givers, dialog NPCs, and props. Levels don't matter for these — the wizard leaves them alone.",
    selectable: false,
  },
};

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function mobHasChanges(diff: MobRebalanceDiff): boolean {
  return diff.levelChanged || diff.overrideChanges.length > 0;
}

function levelSummary(diff: MobRebalanceDiff): string {
  if (!diff.levelChanged) {
    return diff.currentLevel != null ? `L${diff.currentLevel}` : `L? → L${diff.targetLevel}`;
  }
  if (diff.currentLevel != null) {
    return `L${diff.currentLevel} → L${diff.targetLevel}`;
  }
  return `→ L${diff.targetLevel}`;
}

function formatOverrideDetail(diff: MobRebalanceDiff, action: OverrideAction): string | null {
  const matches = diff.overrideChanges.filter((c) => c.action === action);
  if (matches.length === 0) return null;
  return matches
    .map((c) =>
      action === "drop"
        ? `${FIELD_LABELS[c.field]} ${c.currentOverride} → ${c.tierBaseline}`
        : `${FIELD_LABELS[c.field]} ${c.currentOverride} (tier ${c.tierBaseline})`,
    )
    .join(", ");
}

function countOverrideAction(diff: MobRebalanceDiff, action: OverrideAction): number {
  return diff.overrideChanges.filter((c) => c.action === action).length;
}

// ─── Inline row for a single mob ────────────────────────────────────

function MobRow({
  diff,
  included,
  selectable,
  onToggle,
}: {
  diff: MobRebalanceDiff;
  included: boolean;
  selectable: boolean;
  onToggle: () => void;
}) {
  const resetCount = countOverrideAction(diff, "drop");
  const preservedCount = countOverrideAction(diff, "flag");
  const resetDetail = formatOverrideDetail(diff, "drop");
  const preservedDetail = formatOverrideDetail(diff, "flag");
  const tierLabel = TIER_LABELS[diff.tier] ?? diff.tier;

  return (
    <label
      className={`group flex cursor-pointer items-center gap-3 border-b border-border-muted px-2 py-2 text-sm transition last:border-b-0 ${
        selectable && included
          ? "bg-accent/[0.08]"
          : "hover:bg-[var(--chrome-highlight)]"
      } ${!selectable ? "cursor-default" : ""}`}
    >
      <input
        type="checkbox"
        checked={selectable ? included : false}
        disabled={!selectable}
        onChange={selectable ? onToggle : undefined}
        aria-label={`Rewrite ${diff.displayName}`}
        className="h-4 w-4 shrink-0 cursor-pointer accent-accent disabled:cursor-not-allowed disabled:opacity-40"
      />

      <span className="min-w-0 flex-1 truncate font-display text-text-primary">
        {diff.displayName}
      </span>

      <span className="shrink-0 rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] px-2 py-0.5 font-mono text-2xs uppercase tracking-label text-text-muted">
        {tierLabel}
      </span>

      {selectable && (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-2xs ${
            diff.levelChanged
              ? "border border-accent/30 bg-accent/10 text-accent"
              : "border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] text-text-muted"
          }`}
        >
          {levelSummary(diff)}
        </span>
      )}

      {resetCount > 0 && (
        <span
          title={resetDetail ? `Reset to tier default: ${resetDetail}` : undefined}
          className="shrink-0 rounded-full border border-status-warning/25 bg-status-warning/10 px-2 py-0.5 text-2xs text-status-warning"
        >
          {resetCount} reset
        </span>
      )}

      {preservedCount > 0 && (
        <span
          title={preservedDetail ? `Keep current custom values: ${preservedDetail}` : undefined}
          className="shrink-0 rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-2 py-0.5 text-2xs text-text-muted"
        >
          {preservedCount} kept
        </span>
      )}
    </label>
  );
}

// ─── Collapsible section ────────────────────────────────────────────

function SectionGroup({
  classification,
  mobs,
  acceptedMobIds,
  onToggleMob,
  onToggleAll,
  initiallyCollapsed,
}: {
  classification: MobClassification;
  mobs: MobRebalanceDiff[];
  acceptedMobIds: Set<string>;
  onToggleMob: (mobId: string) => void;
  onToggleAll: (included: boolean) => void;
  initiallyCollapsed?: boolean;
}) {
  const meta = SECTION_META[classification];
  const [collapsed, setCollapsed] = useState(initiallyCollapsed ?? false);

  if (mobs.length === 0) return null;

  const acceptedInGroup = mobs.filter((m) => acceptedMobIds.has(m.mobId)).length;
  const allAccepted = acceptedInGroup === mobs.length;
  const slug = classification.replace(/[^a-z0-9]+/gi, "-");
  const regionId = `rebalance-section-${slug}`;
  const titleId = `${regionId}-title`;

  return (
    <section className="border-t border-border-muted">
      <div className="flex items-center gap-3 py-3">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-controls={regionId}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
        >
          <span
            aria-hidden="true"
            className={`inline-block text-text-muted transition-transform duration-150 ${
              collapsed ? "rotate-0" : "rotate-90"
            }`}
          >
            &#9654;
          </span>
          <span
            id={titleId}
            className="font-display text-sm uppercase tracking-[0.5px] text-text-secondary"
          >
            {meta.title}
          </span>
          <span className="rounded-full bg-accent/[0.14] px-2 py-0.5 text-xs text-accent">
            {mobs.length}
          </span>
          {meta.selectable && acceptedInGroup > 0 && (
            <span className="rounded-full bg-status-success/[0.14] px-2 py-0.5 text-xs text-status-success">
              {acceptedInGroup} selected
            </span>
          )}
        </button>

        {meta.selectable && (
          <div className="flex shrink-0 gap-2">
            <ActionButton
              variant="ghost"
              size="sm"
              onClick={() => onToggleAll(false)}
              disabled={acceptedInGroup === 0}
            >
              Clear
            </ActionButton>
            <ActionButton
              variant="secondary"
              size="sm"
              onClick={() => onToggleAll(true)}
              disabled={allAccepted}
            >
              Select all
            </ActionButton>
          </div>
        )}
      </div>

      {!collapsed && (
        <div id={regionId} role="region" aria-labelledby={titleId} className="pb-3">
          <p className="mb-2 px-2 text-xs leading-5 text-text-muted">{meta.helper}</p>
          <div className="rounded-2xl border border-border-muted bg-[var(--chrome-fill)]">
            {mobs.map((mob) => (
              <MobRow
                key={mob.mobId}
                diff={mob}
                included={acceptedMobIds.has(mob.mobId)}
                selectable={meta.selectable}
                onToggle={() => onToggleMob(mob.mobId)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Dialog ─────────────────────────────────────────────────────────

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
  const [difficulty, setDifficulty] = useState<DifficultyValue>(zoneState?.data?.difficultyHint);
  const [acceptedMobIds, setAcceptedMobIds] = useState<Set<string>>(() => new Set());

  const scalingMode = zoneState?.data?.scaling?.mode;
  const scalingRange = zoneState?.data?.scaling?.levelRange;

  const target: ZoneRebalanceTarget = {
    levelBand: { min: bandMin, max: Math.max(bandMin, bandMax) },
    difficultyHint: difficulty,
  };

  const diff = useMemo(() => {
    if (!zoneState?.data || !config) return null;
    return computeZoneRebalance(zoneState.data, config, target);
  }, [zoneState?.data, config, target]);

  const mobsByClassification = useMemo(() => {
    const named: MobRebalanceDiff[] = [];
    const trash: MobRebalanceDiff[] = [];
    const nonCombat: MobRebalanceDiff[] = [];
    for (const m of diff?.mobs ?? []) {
      if (m.classification === "named" && mobHasChanges(m)) named.push(m);
      else if (m.classification === "trash" && mobHasChanges(m)) trash.push(m);
      else if (m.classification === "non-combat") nonCombat.push(m);
    }
    return { named, trash, nonCombat };
  }, [diff]);

  const changedIdSignature = useMemo(
    () => [...mobsByClassification.named, ...mobsByClassification.trash].map((m) => m.mobId).join("|"),
    [mobsByClassification],
  );

  useEffect(() => {
    setAcceptedMobIds((prev) => {
      const validIds = new Set<string>(
        [...mobsByClassification.named, ...mobsByClassification.trash].map((m) => m.mobId),
      );
      let mutated = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) next.add(id);
        else mutated = true;
      }
      return mutated ? next : prev;
    });
  }, [changedIdSignature, mobsByClassification]);

  const acceptedCount = acceptedMobIds.size;
  const unchangedCount =
    (diff?.mobs.filter((m) => m.classification !== "non-combat").length ?? 0) -
    mobsByClassification.named.length -
    mobsByClassification.trash.length;
  const targetChanged =
    zoneState?.data?.levelBand?.min !== target.levelBand.min ||
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

  const toggleSection = (mobs: MobRebalanceDiff[], included: boolean) => {
    setAcceptedMobIds((prev) => {
      const next = new Set(prev);
      for (const mob of mobs) {
        if (included) next.add(mob.mobId);
        else next.delete(mob.mobId);
      }
      return next;
    });
  };

  const playerScaled = diff?.availability === "player-scaled";

  const handleApply = () => {
    if (!zoneState?.data || !diff || playerScaled) return;
    const next = applyZoneRebalance(zoneState.data, diff, { acceptedMobIds });
    updateZone(zoneId, next);
    onClose();
  };

  const canApply = !playerScaled && (acceptedCount > 0 || targetChanged);

  let applyLabel = "Apply rebalance";
  if (targetChanged && acceptedCount === 0) applyLabel = "Save target only";
  else if (acceptedCount > 0 && !targetChanged)
    applyLabel = `Rewrite ${acceptedCount} ${pluralize(acceptedCount, "mob")}`;
  else if (acceptedCount > 0 && targetChanged)
    applyLabel = `Save target + ${acceptedCount} ${pluralize(acceptedCount, "mob")}`;

  let footerSummary: string;
  if (playerScaled) footerSummary = "Player-scaled zones can't be rebalanced — authored levels don't drive runtime.";
  else if (targetChanged && acceptedCount === 0) footerSummary = "Saving target only.";
  else if (targetChanged && acceptedCount > 0)
    footerSummary = `Saving target and rewriting ${acceptedCount} ${pluralize(acceptedCount, "mob")}.`;
  else if (acceptedCount > 0) footerSummary = `Rewriting ${acceptedCount} ${pluralize(acceptedCount, "mob")}.`;
  else footerSummary = "Pick a target or select mobs to rewrite.";

  if (!zoneState || !config) return null;

  const content = (
    <DialogShell
      dialogRef={trapRef}
      overlayStyle={{ zIndex: 85 }}
      titleId="rebalance-zone-title"
      title={`Rebalance Zone — ${zoneState.data.zone}`}
      subtitle={
        scalingMode === "bounded" && scalingRange
          ? `Bounded scaling: L${scalingRange[0]}–${scalingRange[1]}`
          : scalingMode === "player"
            ? "Player-scaled zone"
            : undefined
      }
      widthClassName="max-w-5xl"
      onClose={onClose}
      footer={
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="max-w-3xl text-xs leading-6 text-text-secondary">{footerSummary}</p>
          <div className="flex shrink-0 gap-2">
            <ActionButton onClick={onClose} variant="ghost">
              Cancel
            </ActionButton>
            <ActionButton onClick={handleApply} disabled={!canApply} variant="primary">
              {applyLabel}
            </ActionButton>
          </div>
        </div>
      }
    >
      <div className="flex min-h-[28rem] flex-col gap-4">
        {/* Target row — flat, no wrapping panel */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1">
            <span className="text-3xs uppercase tracking-wide-ui text-text-muted">Level min</span>
            <input
              type="number"
              min={1}
              value={bandMin}
              disabled={playerScaled}
              onChange={(e) => setBandMin(Math.max(1, Number(e.target.value) || 1))}
              className="h-10 w-24 rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-3 font-mono text-sm text-text-primary outline-none transition focus:border-[var(--border-accent-ring)] focus:shadow-[var(--glow-aurum)] disabled:opacity-50"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-3xs uppercase tracking-wide-ui text-text-muted">Level max</span>
            <input
              type="number"
              min={1}
              value={bandMax}
              disabled={playerScaled}
              onChange={(e) => setBandMax(Math.max(1, Number(e.target.value) || 1))}
              className="h-10 w-24 rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-3 font-mono text-sm text-text-primary outline-none transition focus:border-[var(--border-accent-ring)] focus:shadow-[var(--glow-aurum)] disabled:opacity-50"
            />
          </label>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-3xs uppercase tracking-wide-ui text-text-muted">Difficulty spread</span>
            <div className="flex flex-wrap gap-1.5">
              {DIFFICULTY_OPTIONS.map((opt) => {
                const selected = opt.value === difficulty;
                return (
                  <button
                    key={opt.value ?? "none"}
                    type="button"
                    aria-pressed={selected}
                    title={opt.tooltip}
                    disabled={playerScaled}
                    onClick={() => setDifficulty(opt.value)}
                    className={`h-10 rounded-xl border px-3 font-display text-xs transition disabled:opacity-50 ${
                      selected
                        ? "border-accent/35 bg-accent/15 text-accent"
                        : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] text-text-secondary hover:border-[var(--border-accent-ring)] hover:text-text-primary"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scaling hints */}
        {playerScaled && (
          <div className="rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-4 text-sm leading-6 text-text-secondary">
            <p className="font-display text-text-primary">Nothing to rebalance.</p>
            <p className="mt-1 text-text-muted">
              This zone uses <span className="font-mono text-accent">player</span> scaling — mob levels are derived from
              the reference player at runtime, so rewriting authored levels wouldn't change what players experience. To
              use the rebalance wizard, switch the zone's scaling to <span className="font-mono">static</span> or{" "}
              <span className="font-mono">bounded</span>.
            </p>
          </div>
        )}

        {!playerScaled && diff?.bandClampedToScaling && (
          <div className="rounded-2xl border border-accent/25 bg-accent/[0.08] px-4 py-3 text-xs leading-5 text-text-secondary">
            Target band clamped to this zone's bounded scaling range (L{diff.target.levelBand.min}–
            {diff.target.levelBand.max}). Adjust the scaling range in the zone editor to use a wider band.
          </div>
        )}

        {/* Sections */}
        {!playerScaled && (
          <>
            <SectionGroup
              classification="named"
              mobs={mobsByClassification.named}
              acceptedMobIds={acceptedMobIds}
              onToggleMob={toggleMob}
              onToggleAll={(included) => toggleSection(mobsByClassification.named, included)}
            />
            <SectionGroup
              classification="trash"
              mobs={mobsByClassification.trash}
              acceptedMobIds={acceptedMobIds}
              onToggleMob={toggleMob}
              onToggleAll={(included) => toggleSection(mobsByClassification.trash, included)}
            />
            <SectionGroup
              classification="non-combat"
              mobs={mobsByClassification.nonCombat}
              acceptedMobIds={acceptedMobIds}
              onToggleMob={toggleMob}
              onToggleAll={() => {}}
              initiallyCollapsed
            />
          </>
        )}

        {/* Empty + footnotes */}
        {!playerScaled &&
          diff &&
          mobsByClassification.named.length === 0 &&
          mobsByClassification.trash.length === 0 && (
            <div className="flex min-h-[10rem] items-center justify-center rounded-2xl border border-border-muted bg-[var(--chrome-fill)] px-6 py-8 text-center">
              <div>
                <h3 className="font-display text-base text-text-primary">
                  Everything already matches the target
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">
                  No combat mobs need rewriting. Save the target to persist the level band and difficulty hint for
                  future validation.
                </p>
              </div>
            </div>
          )}

        {!playerScaled && unchangedCount > 0 && (
          <p className="px-2 text-xs text-text-muted">
            {unchangedCount} {pluralize(unchangedCount, "combat mob")} already match the target and{" "}
            {unchangedCount === 1 ? "is" : "are"} hidden.
          </p>
        )}

        {!playerScaled && diff && diff.skippedMobIds.length > 0 && (
          <div className="rounded-2xl border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
            Skipped (tier not in config): {diff.skippedMobIds.join(", ")}.
          </div>
        )}
      </div>
    </DialogShell>
  );

  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}
