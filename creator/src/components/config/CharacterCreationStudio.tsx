import { useMemo } from "react";
import type { AppConfig } from "@/types/config";
import { FieldRow, NumberInput, SelectInput } from "@/components/ui/FormWidgets";
import { DefinitionWorkbench } from "./DefinitionWorkbench";
import {
  GenderDetail,
  defaultGenderDefinition,
  summarizeGender,
} from "@/components/config/panels/CharacterCreationPanel";

export function CharacterCreationStudio({
  config,
  onChange,
}: {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}) {
  const patchCC = (p: Partial<AppConfig["characterCreation"]>) =>
    onChange({ characterCreation: { ...config.characterCreation, ...p } });

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
    <div className="flex flex-col gap-6">
      <div className="rounded-3xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-5">
        <p className="text-2xs uppercase tracking-ui text-text-muted">Character creation</p>
        <h4 className="mt-2 font-display text-2xl text-text-primary">Starting resources</h4>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-text-secondary">
          Set the baseline economy for new characters before class, race, and equipment decisions start differentiating them.
        </p>
        <div className="mt-4 flex flex-col gap-1.5">
          <FieldRow label="Starting Gold" hint="Gold given to new characters. 0 = earn everything. 50-100 = enough for a basic weapon. 500+ = well-equipped start.">
            <NumberInput
              value={config.characterCreation.startingGold}
              onCommit={(v) => patchCC({ startingGold: v ?? 0 })}
              min={0}
            />
          </FieldRow>
        </div>
      </div>

      <div className="rounded-3xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-5">
        <p className="text-2xs uppercase tracking-ui text-text-muted">Character creation</p>
        <h4 className="mt-2 font-display text-2xl text-text-primary">New-player defaults</h4>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-text-secondary">
          Pre-selected values for new accounts. Players can still choose during character creation, but these set the initial selection.
        </p>
        <div className="mt-4 flex flex-col gap-1.5">
          <FieldRow label="Default Race" hint="Pre-selected race for new characters.">
            <SelectInput
              value={config.characterCreation.defaultRace ?? ""}
              options={raceOptions}
              onCommit={(v) => patchCC({ defaultRace: v || undefined })}
              allowEmpty
              placeholder="(none)"
            />
          </FieldRow>
          <FieldRow label="Default Class" hint="Pre-selected class for new characters.">
            <SelectInput
              value={config.characterCreation.defaultClass ?? ""}
              options={classOptions}
              onCommit={(v) => patchCC({ defaultClass: v || undefined })}
              allowEmpty
              placeholder="(none)"
            />
          </FieldRow>
          <FieldRow label="Default Gender" hint="Pre-selected gender for new characters.">
            <SelectInput
              value={config.characterCreation.defaultGender ?? ""}
              options={genderOptions}
              onCommit={(v) => patchCC({ defaultGender: v || undefined })}
              allowEmpty
              placeholder="(none)"
            />
          </FieldRow>
        </div>
      </div>

      <DefinitionWorkbench
        title="Gender designer"
        countLabel="Gender definitions"
        description="Manage displayed gender labels and sprite filename codes."
        addPlaceholder="New gender id"
        searchPlaceholder="Search genders"
        emptyMessage="No genders match the current search."
        items={config.genders}
        defaultItem={defaultGenderDefinition}
        getDisplayName={(gender) => gender.displayName}
        renderSummary={summarizeGender}
        renderBadges={(gender) => (gender.spriteCode ? [gender.spriteCode] : ["Uses id"])}
        renderDetail={(gender, patch) => (
          <GenderDetail gender={gender} patchGender={patch} />
        )}
        onItemsChange={(genders) => onChange({ genders })}
      />
    </div>
  );
}
