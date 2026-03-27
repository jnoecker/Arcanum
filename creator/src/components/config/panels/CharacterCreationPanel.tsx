import { useMemo } from "react";
import type { ConfigPanelProps, AppConfig } from "./types";
import type { GenderDefinition } from "@/types/config";
import { Section, FieldRow, NumberInput, TextInput, SelectInput } from "@/components/ui/FormWidgets";
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

  const raceOptions = useMemo(
    () =>
      Object.entries(config.races).map(([id, r]) => ({
        value: id,
        label: r.displayName || id,
      })),
    [config.races],
  );

  const classOptions = useMemo(
    () =>
      Object.entries(config.classes).map(([id, c]) => ({
        value: id,
        label: c.displayName || id,
      })),
    [config.classes],
  );

  const genderOptions = useMemo(
    () =>
      Object.entries(config.genders).map(([id, g]) => ({
        value: id,
        label: g.displayName || id,
      })),
    [config.genders],
  );

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
          <FieldRow label="Default Race" hint="Pre-selected race for new characters.">
            <SelectInput
              value={cc.defaultRace ?? ""}
              options={raceOptions}
              onCommit={(v) => patch({ defaultRace: v || undefined })}
              allowEmpty
              placeholder="(none)"
            />
          </FieldRow>
          <FieldRow label="Default Class" hint="Pre-selected class for new characters.">
            <SelectInput
              value={cc.defaultClass ?? ""}
              options={classOptions}
              onCommit={(v) => patch({ defaultClass: v || undefined })}
              allowEmpty
              placeholder="(none)"
            />
          </FieldRow>
          <FieldRow label="Default Gender" hint="Pre-selected gender for new characters.">
            <SelectInput
              value={cc.defaultGender ?? ""}
              options={genderOptions}
              onCommit={(v) => patch({ defaultGender: v || undefined })}
              allowEmpty
              placeholder="(none)"
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
