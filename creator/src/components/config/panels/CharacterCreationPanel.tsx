import type { ConfigPanelProps, AppConfig } from "./types";
import type { GenderDefinition } from "@/types/config";
import { Section, FieldRow, NumberInput, TextInput } from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";

export function defaultGenderDefinition(raw: string): GenderDefinition {
  return { displayName: raw };
}

export function summarizeGender(gender: GenderDefinition): string {
  return gender.spriteCode ?? "";
}

export function GenderDetail({
  gender,
  patchGender,
}: {
  gender: GenderDefinition;
  patchGender: (p: Partial<GenderDefinition>) => void;
}) {
  return (
    <>
      <FieldRow label="Display Name">
        <TextInput
          value={gender.displayName}
          onCommit={(v) => patchGender({ displayName: v })}
        />
      </FieldRow>
      <FieldRow label="Sprite Code" hint="Code used in sprite filenames (e.g. 'm' or 'f'). Defaults to the gender's ID if left blank.">
        <TextInput
          value={gender.spriteCode ?? ""}
          onCommit={(v) => patchGender({ spriteCode: v || undefined })}
          placeholder="defaults to id"
        />
      </FieldRow>
    </>
  );
}

export function CharacterCreationPanel({ config, onChange }: ConfigPanelProps) {
  const cc = config.characterCreation;
  const patch = (p: Partial<AppConfig["characterCreation"]>) =>
    onChange({ characterCreation: { ...cc, ...p } });

  return (
    <>
      <Section
        title="Character Creation"
        description="Initial resources given to newly created characters. Starting gold lets players buy basic equipment right away. Set to 0 for a 'start from nothing' experience where players must earn their first gear."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Starting Gold" hint="Gold given to new characters. 0 = earn everything. 50-100 = enough for a basic weapon. 500+ = well-equipped start.">
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
        defaultItem={defaultGenderDefinition}
        renderSummary={(_id, g) => summarizeGender(g)}
        renderDetail={(_id, g, patchGender) => (
          <GenderDetail gender={g} patchGender={patchGender} />
        )}
      />
    </>
  );
}
