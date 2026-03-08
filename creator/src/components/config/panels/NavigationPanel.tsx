import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, NumberInput, TextInput } from "@/components/ui/FormWidgets";

export function NavigationPanel({ config, onChange }: ConfigPanelProps) {
  const recall = config.navigation.recall;

  const patchRecall = (p: Partial<AppConfig["navigation"]["recall"]>) =>
    onChange({ navigation: { ...config.navigation, recall: { ...recall, ...p } } });

  const patchMessages = (p: Partial<AppConfig["navigation"]["recall"]["messages"]>) =>
    patchRecall({ messages: { ...recall.messages, ...p } });

  return (
    <>
      <Section title="Recall">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Cooldown (ms)">
            <NumberInput
              value={recall.cooldownMs}
              onCommit={(v) => patchRecall({ cooldownMs: v ?? 300000 })}
              min={0}
            />
          </FieldRow>
        </div>
      </Section>

      <Section title="Recall Messages">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Combat Blocked">
            <TextInput
              value={recall.messages.combatBlocked}
              onCommit={(v) => patchMessages({ combatBlocked: v })}
            />
          </FieldRow>
          <FieldRow label="Cooldown">
            <TextInput
              value={recall.messages.cooldownRemaining}
              onCommit={(v) => patchMessages({ cooldownRemaining: v })}
              placeholder="Use {seconds} for remaining time"
            />
          </FieldRow>
          <FieldRow label="Cast Begin">
            <TextInput
              value={recall.messages.castBegin}
              onCommit={(v) => patchMessages({ castBegin: v })}
            />
          </FieldRow>
          <FieldRow label="Unreachable">
            <TextInput
              value={recall.messages.unreachable}
              onCommit={(v) => patchMessages({ unreachable: v })}
            />
          </FieldRow>
          <FieldRow label="Depart Notice">
            <TextInput
              value={recall.messages.departNotice}
              onCommit={(v) => patchMessages({ departNotice: v })}
            />
          </FieldRow>
          <FieldRow label="Arrive Notice">
            <TextInput
              value={recall.messages.arriveNotice}
              onCommit={(v) => patchMessages({ arriveNotice: v })}
            />
          </FieldRow>
          <FieldRow label="Arrival">
            <TextInput
              value={recall.messages.arrival}
              onCommit={(v) => patchMessages({ arrival: v })}
            />
          </FieldRow>
        </div>
      </Section>
    </>
  );
}
