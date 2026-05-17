import { useMemo, useState } from "react";
import { ActionButton, DialogShell, NumberInput } from "@/components/ui/FormWidgets";
import { useConfigStore } from "@/stores/configStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useToastStore } from "@/stores/toastStore";
import { useFocusTrap } from "@/lib/useFocusTrap";
import {
  bandAndDifficultyFromLevelMix,
  inferLevelBand,
  levelMixFromBandAndDifficulty,
  rebalanceZone,
  type LevelMix,
  type ZoneRebalanceSummary,
} from "@/lib/zoneRebalance";

interface RebalanceZoneDialogProps {
  zoneId: string;
  onClose: () => void;
}

interface MixOption {
  value: LevelMix;
  label: string;
  hint: (level: number) => string;
}

const MIX_OPTIONS: MixOption[] = [
  {
    value: "easy",
    label: "Easy",
    hint: (n) => `Everything at level ${n}.`,
  },
  {
    value: "medium",
    label: "Medium",
    hint: (n) => `Mostly level ${n}, with a level ${n + 1} boss.`,
  },
  {
    value: "hard",
    label: "Hard",
    hint: (n) => `Mostly level ${n + 1}, with level ${n} trash.`,
  },
];

export function RebalanceZoneDialog({ zoneId, onClose }: RebalanceZoneDialogProps) {
  const config = useConfigStore((s) => s.config);
  const zoneState = useZoneStore((s) => s.zones.get(zoneId));
  const updateZone = useZoneStore((s) => s.updateZone);
  const showToast = useToastStore((s) => s.show);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  const initial = useMemo(() => {
    if (!zoneState?.data) return { level: 1, mix: "easy" as LevelMix };
    const band = zoneState.data.levelBand ?? inferLevelBand(zoneState.data);
    const difficulty = zoneState.data.difficultyHint ?? "standard";
    return levelMixFromBandAndDifficulty(band, difficulty);
  }, [zoneState?.data]);

  const [level, setLevel] = useState(initial.level);
  const [mix, setMix] = useState<LevelMix>(initial.mix);
  const [summary, setSummary] = useState<ZoneRebalanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const playerScaled = zoneState?.data?.scaling?.mode === "player";

  if (!zoneState?.data || !config) return null;

  const handleRebalance = () => {
    setError(null);
    const { band, difficulty } = bandAndDifficultyFromLevelMix(level, mix);
    const stagedWorld = {
      ...zoneState.data,
      levelBand: band,
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

  const activeOption = MIX_OPTIONS.find((o) => o.value === mix) ?? MIX_OPTIONS[0]!;

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
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-text-secondary">Target level</span>
              <NumberInput
                value={level}
                onCommit={(v) => setLevel(Math.max(1, v ?? 1))}
                min={1}
              />
              <span className="text-2xs text-text-muted">
                The level players are expected to be at when they enter this zone.
              </span>
            </label>

            <div className="flex flex-col gap-1 text-sm">
              <span className="text-text-secondary">Mix</span>
              <div role="radiogroup" aria-label="Difficulty mix" className="flex gap-2">
                {MIX_OPTIONS.map((opt) => {
                  const active = opt.value === mix;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setMix(opt.value)}
                      className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                        active
                          ? "border-accent bg-accent/15 text-accent"
                          : "border-border-default bg-bg-primary text-text-muted hover:border-border-focus hover:text-text-primary"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <span className="text-2xs text-text-muted">
                {activeOption.hint(Math.max(1, Math.floor(level)))}
              </span>
            </div>
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
