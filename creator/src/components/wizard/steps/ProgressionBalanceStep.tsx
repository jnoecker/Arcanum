import type { WizardData } from "@/lib/useProjectWizard";

interface ProgressionBalanceStepProps {
  data: WizardData;
  onChange: (update: Partial<WizardData>) => void;
}

function xpForLevel(level: number, baseXp: number, exponent: number, linearXp: number, multiplier: number): number {
  return Math.floor((baseXp * Math.pow(level, exponent) + linearXp * level) * multiplier);
}

export function ProgressionBalanceStep({
  data,
  onChange,
}: ProgressionBalanceStepProps) {
  const xpPreview = Array.from({ length: 10 }, (_, i) => {
    const level = i + 1;
    const xp = xpForLevel(
      level,
      data.xpCurve.baseXp,
      data.xpCurve.exponent,
      data.xpCurve.linearXp,
      data.xpCurve.multiplier,
    );
    return { level, xp };
  });
  const maxXp = Math.max(...xpPreview.map((r) => r.xp), 1);

  return (
    <div className="flex flex-col gap-5">
      {/* Max Level + XP Curve */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-muted">
          Progression
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-0.5 block text-2xs text-text-muted">
              Max Level
            </label>
            <input
              type="number"
              value={data.maxLevel}
              onChange={(e) => onChange({ maxLevel: Number(e.target.value) })}
              min={1}
              max={999}
              className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-2xs text-text-muted">
              Base XP
            </label>
            <input
              type="number"
              value={data.xpCurve.baseXp}
              onChange={(e) =>
                onChange({
                  xpCurve: { ...data.xpCurve, baseXp: Number(e.target.value) },
                })
              }
              className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-2xs text-text-muted">
              Exponent
            </label>
            <input
              type="number"
              value={data.xpCurve.exponent}
              onChange={(e) =>
                onChange({
                  xpCurve: {
                    ...data.xpCurve,
                    exponent: Number(e.target.value),
                  },
                })
              }
              step={0.1}
              className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-2xs text-text-muted">
              Linear XP
            </label>
            <input
              type="number"
              value={data.xpCurve.linearXp}
              onChange={(e) =>
                onChange({
                  xpCurve: {
                    ...data.xpCurve,
                    linearXp: Number(e.target.value),
                  },
                })
              }
              className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
            />
          </div>
        </div>

        {/* XP Curve Chart */}
        <div className="mt-3 rounded border border-border-default bg-bg-primary p-2">
          <div className="mb-1 text-2xs text-text-muted">
            XP required per level (1-10)
          </div>
          <div className="flex h-16 items-end gap-1">
            {xpPreview.map((row) => (
              <div
                key={row.level}
                className="group relative flex flex-1 flex-col items-center"
              >
                <div
                  className="w-full rounded-t bg-accent/40 transition-all group-hover:bg-accent/60"
                  style={{
                    height: `${Math.max((row.xp / maxXp) * 100, 4)}%`,
                  }}
                />
                <span className="mt-0.5 text-[8px] text-text-muted">
                  {row.level}
                </span>
                <div className="pointer-events-none absolute -top-5 rounded bg-bg-elevated px-1 py-0.5 text-[8px] text-text-secondary opacity-0 shadow group-hover:opacity-100">
                  {row.xp.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Level-up Rewards */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-muted">
          Level-Up Rewards
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-0.5 block text-2xs text-text-muted">
              HP / Level
            </label>
            <input
              type="number"
              value={data.levelRewards.hpPerLevel}
              onChange={(e) =>
                onChange({
                  levelRewards: {
                    ...data.levelRewards,
                    hpPerLevel: Number(e.target.value),
                  },
                })
              }
              className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-2xs text-text-muted">
              Mana / Level
            </label>
            <input
              type="number"
              value={data.levelRewards.manaPerLevel}
              onChange={(e) =>
                onChange({
                  levelRewards: {
                    ...data.levelRewards,
                    manaPerLevel: Number(e.target.value),
                  },
                })
              }
              className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-2xs text-text-muted">
              Base HP
            </label>
            <input
              type="number"
              value={data.levelRewards.baseHp}
              onChange={(e) =>
                onChange({
                  levelRewards: {
                    ...data.levelRewards,
                    baseHp: Number(e.target.value),
                  },
                })
              }
              className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-2xs text-text-muted">
              Base Mana
            </label>
            <input
              type="number"
              value={data.levelRewards.baseMana}
              onChange={(e) =>
                onChange({
                  levelRewards: {
                    ...data.levelRewards,
                    baseMana: Number(e.target.value),
                  },
                })
              }
              className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
            />
          </div>
        </div>
      </div>

      {/* Economy */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-muted">
          Economy
        </label>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-0.5 block text-2xs text-text-muted">
              Starting Gold
            </label>
            <input
              type="number"
              value={data.startingGold}
              onChange={(e) =>
                onChange({ startingGold: Number(e.target.value) })
              }
              className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-2xs text-text-muted">
              Buy Multiplier
            </label>
            <input
              type="number"
              value={data.buyMultiplier}
              onChange={(e) =>
                onChange({ buyMultiplier: Number(e.target.value) })
              }
              step={0.1}
              className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-2xs text-text-muted">
              Sell Multiplier
            </label>
            <input
              type="number"
              value={data.sellMultiplier}
              onChange={(e) =>
                onChange({ sellMultiplier: Number(e.target.value) })
              }
              step={0.1}
              className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
