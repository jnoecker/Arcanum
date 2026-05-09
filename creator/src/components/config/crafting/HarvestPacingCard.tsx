import type { AppConfig } from "@/types/config";
import { NumberInput } from "@/components/ui/FormWidgets";
import { SectionCard } from "../panels/factions/SectionCard";

interface HarvestPacingCardProps {
  crafting: AppConfig["crafting"];
  onPatch: (p: Partial<AppConfig["crafting"]>) => void;
}

export function HarvestPacingCard({ crafting, onPatch }: HarvestPacingCardProps) {
  return (
    <SectionCard
      title="Harvest Pacing"
      description="Control how quickly players harvest nodes and output."
    >
      <div className="flex flex-col gap-3">
        <RowField
          label="Cooldown (ms)"
          hint="Delay between harvest attempts on same node."
        >
          <NumberInput
            value={crafting.gatherCooldownMs}
            onCommit={(v) => onPatch({ gatherCooldownMs: v ?? 3000 })}
            min={0}
            dense
          />
        </RowField>
        <RowField
          label="Station Bonus"
          hint="Multiplier to yield when at a station in field."
        >
          <NumberInput
            value={crafting.stationBonusQuantity}
            onCommit={(v) => onPatch({ stationBonusQuantity: v ?? 1 })}
            min={0}
            dense
          />
        </RowField>
        <RowField
          label="Specialization XP Bonus"
          hint="Fractional XP bonus for a player's specialization (e.g. 0.25 = +25%)."
        >
          <NumberInput
            value={crafting.specializationXpBonus ?? 0}
            onCommit={(v) => onPatch({ specializationXpBonus: v })}
            min={0}
            step={0.05}
            placeholder="0.25"
            dense
          />
        </RowField>
      </div>

      <div className="mt-3 rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-2">
        <p className="text-2xs leading-snug text-text-muted/80">
          Station bonus of <code className="font-mono text-text-secondary">1.0</code>{" "}
          = no bonus. Higher values yield more when at a station.
        </p>
      </div>
    </SectionCard>
  );
}

function RowField({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-32 shrink-0 font-display text-2xs uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <div className="w-24 shrink-0">{children}</div>
      <span className="min-w-0 flex-1 text-2xs leading-snug text-text-muted/70">
        {hint}
      </span>
    </div>
  );
}

