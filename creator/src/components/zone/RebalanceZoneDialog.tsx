import { useMemo, useState } from "react";
import { ActionButton, DialogShell, NumberInput, SelectInput } from "@/components/ui/FormWidgets";
import { useConfigStore } from "@/stores/configStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useToastStore } from "@/stores/toastStore";
import { useFocusTrap } from "@/lib/useFocusTrap";
import {
  inferLevelBand,
  rebalanceZone,
  type DifficultyHint,
  type ZoneRebalanceSummary,
} from "@/lib/zoneRebalance";

interface RebalanceZoneDialogProps {
  zoneId: string;
  onClose: () => void;
}

const DIFFICULTY_OPTIONS: Array<{ value: DifficultyHint; label: string }> = [
  { value: "casual", label: "Casual — standard/elite biased low" },
  { value: "standard", label: "Standard — even spread" },
  { value: "challenging", label: "Challenging — standard/elite biased high" },
];

export function RebalanceZoneDialog({ zoneId, onClose }: RebalanceZoneDialogProps) {
  const config = useConfigStore((s) => s.config);
  const zoneState = useZoneStore((s) => s.zones.get(zoneId));
  const updateZone = useZoneStore((s) => s.updateZone);
  const showToast = useToastStore((s) => s.show);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  const initial = useMemo(() => {
    if (!zoneState?.data) return { band: { min: 1, max: 5 }, difficulty: "standard" as DifficultyHint };
    const band = zoneState.data.levelBand ?? inferLevelBand(zoneState.data);
    const difficulty: DifficultyHint = zoneState.data.difficultyHint ?? "standard";
    return { band, difficulty };
  }, [zoneState?.data]);

  const [bandMin, setBandMin] = useState(initial.band.min);
  const [bandMax, setBandMax] = useState(initial.band.max);
  const [difficulty, setDifficulty] = useState<DifficultyHint>(initial.difficulty);
  const [summary, setSummary] = useState<ZoneRebalanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const playerScaled = zoneState?.data?.scaling?.mode === "player";

  if (!zoneState?.data || !config) return null;

  const handleRebalance = () => {
    setError(null);
    const effectiveMax = Math.max(bandMin, bandMax);
    const stagedWorld = {
      ...zoneState.data,
      levelBand: { min: bandMin, max: effectiveMax },
      difficultyHint: difficulty,
    };
    try {
      const result = rebalanceZone(stagedWorld, config);
      updateZone(zoneId, result.world);
      setSummary(result.summary);
      const msg = result.summary.playerScaledNoOp
        ? "Player-scaled zone — nothing to rewrite."
        : `Restated ${result.summary.mobsRestated} mob${result.summary.mobsRestated === 1 ? "" : "s"} and ${result.summary.itemsRestated} item${result.summary.itemsRestated === 1 ? "" : "s"}.`;
      showToast({ kicker: "Rebalance", message: msg, variant: "astral" });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <DialogShell
      dialogRef={trapRef}
      titleId="rebalance-zone-title"
      title="Rebalance to tier"
      subtitle="Restate every combatant mob and equippable item to match this world's tier baselines. Names, descriptions, behavior, dialogue, and class restrictions are preserved; HP, damage, XP, gold, and item stats are recomputed."
      widthClassName="max-w-[460px]"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <ActionButton onClick={onClose}>Close</ActionButton>
          {!playerScaled && (
            <ActionButton variant="primary" onClick={handleRebalance}>
              Rebalance
            </ActionButton>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {playerScaled ? (
          <div className="rounded-md border border-status-warning/30 bg-status-warning/[0.08] p-3 text-sm text-text-secondary">
            This zone uses player-scaled mobs — levels are derived at runtime from the killer's
            level, so rebalance is a no-op. Switch to bounded or unscaled to use this tool.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-text-secondary">Level band min</span>
                <NumberInput
                  value={bandMin}
                  onCommit={(v) => setBandMin(Math.max(1, v ?? 1))}
                  min={1}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-text-secondary">Level band max</span>
                <NumberInput
                  value={bandMax}
                  onCommit={(v) => setBandMax(Math.max(bandMin, v ?? bandMin))}
                  min={bandMin}
                />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-text-secondary">Difficulty</span>
              <SelectInput
                value={difficulty}
                options={DIFFICULTY_OPTIONS}
                onCommit={(v) => setDifficulty((v || "standard") as DifficultyHint)}
              />
            </label>
          </>
        )}

        {error && (
          <p className="text-sm text-status-danger">{error}</p>
        )}

        {summary && !summary.playerScaledNoOp && (
          <div className="rounded-md border border-border-default bg-bg-secondary/40 p-3 text-sm text-text-secondary">
            <div>
              <strong className="text-text-primary">{summary.mobsRestated}</strong> mobs restated
              {summary.mobsSkippedNonCombat > 0
                ? ` (${summary.mobsSkippedNonCombat} non-combat skipped)`
                : ""}
              {summary.mobsSkippedNoTier > 0
                ? `, ${summary.mobsSkippedNoTier} skipped (unknown tier)`
                : ""}
            </div>
            <div>
              <strong className="text-text-primary">{summary.itemsRestated}</strong> items restated
              {summary.itemsSkipped > 0 ? ` (${summary.itemsSkipped} skipped)` : ""}
            </div>
            {summary.bandClampedToScaling && (
              <div className="mt-1 text-status-warning">
                Band clamped to the zone's bounded scaling range.
              </div>
            )}
          </div>
        )}
      </div>
    </DialogShell>
  );
}
