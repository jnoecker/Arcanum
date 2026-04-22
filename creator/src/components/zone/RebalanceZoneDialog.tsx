// ─── Rebalance Zone Dialog ──────────────────────────────────────────
// Modal for retargeting a zone's level band + difficulty. Shows a
// per-mob diff (named mobs require review, trash auto-applies) and an
// estimated time-to-clear under the chosen band so designers can
// calibrate against world progression.

import { useMemo, useState } from "react";
import { useConfigStore } from "@/stores/configStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useFocusTrap } from "@/lib/useFocusTrap";
import {
  applyZoneRebalance,
  computeZoneRebalance,
  inferLevelBand,
  type MobRebalanceDiff,
  type OverrideAction,
  type ZoneRebalanceTarget,
} from "@/lib/zoneRebalance";
import { estimateXpPerHour } from "@/lib/tuning/pacing";
import { xpForLevel } from "@/lib/tuning/formulas";

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

const DIFFICULTY_LABELS: Array<{ value: ZoneRebalanceTarget["difficultyHint"]; label: string }> = [
  { value: "casual", label: "Casual" },
  { value: "standard", label: "Standard" },
  { value: "challenging", label: "Challenging" },
];

const ACTION_LABELS: Record<OverrideAction, string> = {
  drop: "reset to tier",
  keep: "kept",
  flag: "kept (diverges)",
};

function fmtMinutes(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "—";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function MobRow({
  diff,
  accepted,
  onToggle,
}: {
  diff: MobRebalanceDiff;
  accepted: boolean;
  onToggle: () => void;
}) {
  const levelLabel =
    diff.currentLevel != null
      ? `L${diff.currentLevel} → L${diff.targetLevel}`
      : `tier-default → L${diff.targetLevel}`;
  const overrideSummary = diff.overrideChanges.length
    ? diff.overrideChanges
        .map((c) => `${c.field}: ${c.currentOverride} ${ACTION_LABELS[c.action]} (~${c.tierBaseline})`)
        .join(", ")
    : "no override changes";

  return (
    <li className="flex items-start gap-3 px-3 py-2">
      <input
        id={`reb-mob-${diff.mobId}`}
        type="checkbox"
        checked={accepted}
        onChange={onToggle}
        className="mt-1"
      />
      <label htmlFor={`reb-mob-${diff.mobId}`} className="min-w-0 flex-1 cursor-pointer">
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-sm text-text-primary">{diff.displayName}</span>
          <span className="font-mono text-2xs text-text-muted">
            {TIER_LABELS[diff.tier] ?? diff.tier} · {levelLabel}
          </span>
        </div>
        <p className="mt-0.5 text-2xs leading-snug text-text-muted">{overrideSummary}</p>
      </label>
    </li>
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

  const target: ZoneRebalanceTarget = {
    levelBand: { min: bandMin, max: Math.max(bandMin, bandMax) },
    difficultyHint: difficulty,
  };

  const diff = useMemo(() => {
    if (!zoneState?.data || !config) return null;
    return computeZoneRebalance(zoneState.data, config, target);
  }, [zoneState?.data, config, target]);

  const namedMobs = diff?.mobs.filter((m) => m.classification === "named") ?? [];
  const trashMobs = diff?.mobs.filter((m) => m.classification === "trash") ?? [];

  const [acceptedMobIds, setAcceptedMobIds] = useState<Set<string>>(() => new Set());

  const trashWithChanges = useMemo(
    () => trashMobs.filter((m) => m.levelChanged || m.overrideChanges.length > 0),
    [trashMobs],
  );
  const allTrashAccepted =
    trashWithChanges.length > 0 && trashWithChanges.every((m) => acceptedMobIds.has(m.mobId));

  const toggleMob = (mobId: string) => {
    setAcceptedMobIds((prev) => {
      const next = new Set(prev);
      if (next.has(mobId)) next.delete(mobId);
      else next.add(mobId);
      return next;
    });
  };

  const toggleAllTrash = () => {
    setAcceptedMobIds((prev) => {
      const next = new Set(prev);
      if (allTrashAccepted) {
        for (const m of trashWithChanges) next.delete(m.mobId);
      } else {
        for (const m of trashWithChanges) next.add(m.mobId);
      }
      return next;
    });
  };

  // Pacing readout: estimated minutes to clear levels across the band
  const pacingEstimate = useMemo(() => {
    if (!config) return null;
    const xpRate = estimateXpPerHour(config, Math.round((bandMin + bandMax) / 2));
    if (xpRate <= 0) return null;
    const xpCurve = config.progression.xp;
    const xpForBand = xpForLevel(bandMax + 1, xpCurve) - xpForLevel(bandMin, xpCurve);
    const minutes = (xpForBand / xpRate) * 60;
    return { minutes, xpRate: Math.round(xpRate) };
  }, [config, bandMin, bandMax]);

  const handleApply = () => {
    if (!zoneState?.data || !diff) return;
    const next = applyZoneRebalance(zoneState.data, diff, { acceptedMobIds });
    updateZone(zoneId, next);
    onClose();
  };

  const acceptedCount = acceptedMobIds.size;
  const canApply = acceptedCount > 0 || zoneState?.data?.levelBand?.min !== bandMin || zoneState?.data?.levelBand?.max !== bandMax;

  if (!zoneState || !config) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rebalance-zone-title"
        className="mx-4 flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-border-default bg-bg-secondary shadow-xl"
      >
        <div className="border-b border-border-default px-5 py-3">
          <h2 id="rebalance-zone-title" className="font-display text-sm tracking-wide text-text-primary">
            Rebalance Zone — {zoneState.data.zone}
          </h2>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto px-5 py-4">
          {/* Target controls */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-2xs uppercase tracking-wider text-text-muted" htmlFor="rb-level-min">
                Level min
              </label>
              <input
                id="rb-level-min"
                type="number"
                min={1}
                value={bandMin}
                onChange={(e) => setBandMin(Math.max(1, Number(e.target.value) || 1))}
                className="h-8 w-full rounded border border-border-default bg-bg-primary px-2 font-mono text-xs text-text-primary outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-2xs uppercase tracking-wider text-text-muted" htmlFor="rb-level-max">
                Level max
              </label>
              <input
                id="rb-level-max"
                type="number"
                min={1}
                value={bandMax}
                onChange={(e) => setBandMax(Math.max(1, Number(e.target.value) || 1))}
                className="h-8 w-full rounded border border-border-default bg-bg-primary px-2 font-mono text-xs text-text-primary outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-2xs uppercase tracking-wider text-text-muted" htmlFor="rb-difficulty">
                Difficulty hint
              </label>
              <select
                id="rb-difficulty"
                value={difficulty ?? ""}
                onChange={(e) => setDifficulty((e.target.value || undefined) as ZoneRebalanceTarget["difficultyHint"])}
                className="h-8 w-full rounded border border-border-default bg-bg-primary px-2 text-xs text-text-primary outline-none focus:border-accent"
              >
                <option value="">—</option>
                {DIFFICULTY_LABELS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </section>

          {/* Pacing readout */}
          {pacingEstimate && (
            <section className="rounded border border-border-default bg-bg-primary px-3 py-2">
              <p className="text-2xs uppercase tracking-wider text-text-muted">
                Estimated time to clear band L{bandMin}–L{bandMax}
              </p>
              <p className="mt-1 font-mono text-sm text-text-primary">
                {fmtMinutes(pacingEstimate.minutes)}
                <span className="ml-2 text-2xs text-text-muted">
                  at {pacingEstimate.xpRate.toLocaleString()} XP/hr (canonical trash run)
                </span>
              </p>
            </section>
          )}

          {/* Named mobs — review required */}
          {namedMobs.length > 0 && (
            <section>
              <header className="mb-2 flex items-baseline justify-between">
                <h3 className="font-display text-2xs uppercase tracking-wide text-text-secondary">
                  Review required ({namedMobs.length})
                </h3>
                <span className="text-2xs text-text-muted">Bosses, quest-givers, mobs with drops</span>
              </header>
              <ul className="divide-y divide-border-default rounded border border-border-default bg-bg-primary">
                {namedMobs.map((m) => (
                  <MobRow
                    key={m.mobId}
                    diff={m}
                    accepted={acceptedMobIds.has(m.mobId)}
                    onToggle={() => toggleMob(m.mobId)}
                  />
                ))}
              </ul>
            </section>
          )}

          {/* Trash mobs — auto-apply block */}
          {trashWithChanges.length > 0 && (
            <section>
              <header className="mb-2 flex items-baseline justify-between">
                <h3 className="font-display text-2xs uppercase tracking-wide text-text-secondary">
                  Trash mobs ({trashWithChanges.length})
                </h3>
                <button
                  type="button"
                  onClick={toggleAllTrash}
                  className="text-2xs text-accent underline-offset-2 hover:underline"
                >
                  {allTrashAccepted ? "Deselect all" : "Accept all"}
                </button>
              </header>
              <ul className="divide-y divide-border-default rounded border border-border-default bg-bg-primary">
                {trashWithChanges.map((m) => (
                  <MobRow
                    key={m.mobId}
                    diff={m}
                    accepted={acceptedMobIds.has(m.mobId)}
                    onToggle={() => toggleMob(m.mobId)}
                  />
                ))}
              </ul>
            </section>
          )}

          {diff && diff.mobs.length === 0 && (
            <p className="text-xs text-text-muted">No mobs to rebalance in this zone.</p>
          )}
          {diff && trashWithChanges.length === 0 && namedMobs.length === 0 && diff.mobs.length > 0 && (
            <p className="text-xs text-text-muted">All mobs already match the target band.</p>
          )}
          {diff && diff.skippedMobIds.length > 0 && (
            <p className="text-2xs text-status-warning">
              Skipped (unknown tier): {diff.skippedMobIds.join(", ")}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border-default px-5 py-3">
          <span className="text-2xs text-text-muted">
            {acceptedCount} mob{acceptedCount === 1 ? "" : "s"} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!canApply}
              className="rounded bg-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition-[color,background-color,box-shadow,filter,opacity] hover:shadow-[var(--glow-aurum)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Apply Rebalance
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
