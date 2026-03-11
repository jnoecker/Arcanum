import type { AppConfig } from "@/types/config";
import { FieldRow, NumberInput } from "@/components/ui/FormWidgets";
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
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[24px] border border-white/8 bg-black/12 p-5">
        <p className="text-[11px] uppercase tracking-[0.24em] text-text-muted">Character creation</p>
        <h4 className="mt-2 font-display text-2xl text-text-primary">Starting resources</h4>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-text-secondary">
          Set the baseline economy for new characters before class, race, and equipment decisions start differentiating them.
        </p>
        <div className="mt-4 flex flex-col gap-1.5">
          <FieldRow label="Starting Gold" hint="Gold given to new characters. 0 = earn everything. 50-100 = enough for a basic weapon. 500+ = well-equipped start.">
            <NumberInput
              value={config.characterCreation.startingGold}
              onCommit={(v) =>
                onChange({
                  characterCreation: {
                    ...config.characterCreation,
                    startingGold: v ?? 0,
                  },
                })
              }
              min={0}
            />
          </FieldRow>
        </div>
      </div>

      <DefinitionWorkbench
        title="Gender designer"
        countLabel="Gender definitions"
        description="Keep displayed gender labels and sprite filename codes in one place so character presentation rules remain explicit."
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
