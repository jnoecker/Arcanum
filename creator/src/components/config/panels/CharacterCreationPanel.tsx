import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, NumberInput } from "@/components/ui/FormWidgets";

export function CharacterCreationPanel({ config, onChange }: ConfigPanelProps) {
  const cc = config.characterCreation;
  const patch = (p: Partial<AppConfig["characterCreation"]>) =>
    onChange({ characterCreation: { ...cc, ...p } });

  return (
    <Section title="Character Creation">
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Starting Gold">
          <NumberInput
            value={cc.startingGold}
            onCommit={(v) => patch({ startingGold: v ?? 0 })}
            min={0}
          />
        </FieldRow>
      </div>
    </Section>
  );
}
