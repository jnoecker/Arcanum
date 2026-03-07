import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, NumberInput } from "@/components/ui/FormWidgets";

export function GroupPanel({ config, onChange }: ConfigPanelProps) {
  const g = config.group;
  const patch = (p: Partial<AppConfig["group"]>) =>
    onChange({ group: { ...g, ...p } });

  return (
    <>
      <Section title="Group Settings">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Max Size">
            <NumberInput
              value={g.maxSize}
              onCommit={(v) => patch({ maxSize: v ?? 5 })}
              min={2}
            />
          </FieldRow>
          <FieldRow label="Invite Timeout">
            <NumberInput
              value={g.inviteTimeoutMs}
              onCommit={(v) => patch({ inviteTimeoutMs: v ?? 60000 })}
              min={1000}
            />
          </FieldRow>
          <FieldRow label="XP Bonus / Member">
            <NumberInput
              value={g.xpBonusPerMember}
              onCommit={(v) => patch({ xpBonusPerMember: v ?? 0.1 })}
              min={0}
              step={0.01}
            />
          </FieldRow>
        </div>
      </Section>
    </>
  );
}
