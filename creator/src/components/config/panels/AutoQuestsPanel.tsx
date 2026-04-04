import type { ConfigPanelProps } from "./types";
import type { AutoQuestsConfig } from "@/types/config";
import {
  Section,
  FieldRow,
  NumberInput,
  CheckboxInput,
} from "@/components/ui/FormWidgets";

const DEFAULT_AUTO_QUESTS: AutoQuestsConfig = {
  enabled: false,
  timeLimitMs: 600_000,
  cooldownMs: 300_000,
  rewardScaling: 1.0,
};

export function AutoQuestsPanel({ config, onChange }: ConfigPanelProps) {
  const aq = config.autoQuests ?? DEFAULT_AUTO_QUESTS;
  const patch = (p: Partial<AutoQuestsConfig>) =>
    onChange({ autoQuests: { ...aq, ...p } });

  return (
    <Section
      title="Bounty Quests"
      description="Auto-generated bounty quests that appear on a timer. Players accept a bounty, complete it within the time limit, and earn scaled rewards. A cooldown prevents farming."
    >
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Enabled" hint="Toggle the bounty quest system on or off.">
          <CheckboxInput
            checked={aq.enabled}
            onCommit={(v) => patch({ enabled: v })}
            label="Bounties enabled"
          />
        </FieldRow>
        <FieldRow label="Time Limit (ms)" hint="How long a player has to complete a bounty once accepted. 600000 = 10 minutes.">
          <NumberInput
            value={aq.timeLimitMs}
            onCommit={(v) => patch({ timeLimitMs: v ?? 600_000 })}
            min={1000}
          />
        </FieldRow>
        <FieldRow label="Cooldown (ms)" hint="Delay before a new bounty can be accepted after completing or abandoning one. 300000 = 5 minutes.">
          <NumberInput
            value={aq.cooldownMs}
            onCommit={(v) => patch({ cooldownMs: v ?? 300_000 })}
            min={0}
          />
        </FieldRow>
        <FieldRow label="Reward Scaling" hint="Multiplier applied to bounty rewards. 1.0 = normal, 1.5 = 50% bonus. Stacks with level scaling.">
          <NumberInput
            value={aq.rewardScaling}
            onCommit={(v) => patch({ rewardScaling: v ?? 1.0 })}
            min={0}
            step={0.1}
          />
        </FieldRow>
      </div>
    </Section>
  );
}
