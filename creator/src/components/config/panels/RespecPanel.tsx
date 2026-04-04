import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, NumberInput } from "@/components/ui/FormWidgets";

export function RespecPanel({ config, onChange }: ConfigPanelProps) {
  const respec = config.respec ?? { goldCost: 1000, cooldownMs: 3600000 };
  const patch = (p: Partial<typeof respec>) =>
    onChange({ respec: { ...respec, ...p } } as Partial<AppConfig>);

  return (
    <Section title="Stat Respec">
      <div className="flex flex-col gap-3">
        <FieldRow label="Gold Cost">
          <NumberInput value={respec.goldCost} onCommit={(v) => patch({ goldCost: v ?? 1000 })} />
        </FieldRow>
        <FieldRow label="Cooldown (ms)" hint="Time between respec attempts">
          <NumberInput value={respec.cooldownMs} onCommit={(v) => patch({ cooldownMs: v ?? 3600000 })} />
        </FieldRow>
      </div>
    </Section>
  );
}
