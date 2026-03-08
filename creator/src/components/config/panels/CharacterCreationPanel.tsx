import type { ConfigPanelProps, AppConfig } from "./types";
import type { GenderDefinition } from "@/types/config";
import { Section, FieldRow, NumberInput, TextInput } from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";

export function CharacterCreationPanel({ config, onChange }: ConfigPanelProps) {
  const cc = config.characterCreation;
  const patch = (p: Partial<AppConfig["characterCreation"]>) =>
    onChange({ characterCreation: { ...cc, ...p } });

  return (
    <>
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

      <RegistryPanel<GenderDefinition>
        title="Genders"
        items={config.genders}
        onItemsChange={(genders) => onChange({ genders })}
        placeholder="New gender"
        idTransform={(raw) => raw.trim().toLowerCase().replace(/\s+/g, "_")}
        getDisplayName={(g) => g.displayName}
        defaultItem={(raw) => ({ displayName: raw })}
        renderSummary={() => ""}
        renderDetail={(_id, g, patchGender) => (
          <>
            <FieldRow label="Display Name">
              <TextInput
                value={g.displayName}
                onCommit={(v) => patchGender({ displayName: v })}
              />
            </FieldRow>
            <FieldRow label="Sprite Code">
              <TextInput
                value={g.spriteCode ?? ""}
                onCommit={(v) => patchGender({ spriteCode: v || undefined })}
                placeholder="defaults to id"
              />
            </FieldRow>
          </>
        )}
      />
    </>
  );
}
