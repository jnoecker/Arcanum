import type { AppConfig } from "@/types/config";
import { DefinitionWorkbench } from "./DefinitionWorkbench";
import {
  QuestCompletionTypeDetail,
  QuestObjectiveTypeDetail,
  defaultQuestCompletionTypeDefinition,
  defaultQuestObjectiveTypeDefinition,
  summarizeQuestCompletionType,
  summarizeQuestObjectiveType,
} from "@/components/config/panels/QuestsPanel";

export function QuestTaxonomyDesigner({
  config,
  onChange,
}: {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[24px] border border-[rgba(184,216,232,0.14)] bg-[linear-gradient(145deg,rgba(92,106,147,0.18),rgba(42,51,79,0.22))] px-5 py-4 text-sm leading-7 text-text-secondary">
        Quest objective and completion IDs are used directly by zone quest data. This pass keeps editing safe by supporting add, search, edit, and delete within config, but it does not expose rename actions until those changes can cascade through quest files automatically.
      </div>

      <DefinitionWorkbench
        title="Objective type designer"
        countLabel="Objective types"
        description="Define the verbs authors use when they build quest steps and requirement lists."
        addPlaceholder="New objective type id"
        searchPlaceholder="Search objective types"
        emptyMessage="No objective types match the current search."
        items={config.questObjectiveTypes}
        defaultItem={defaultQuestObjectiveTypeDefinition}
        getDisplayName={(objectiveType) => objectiveType.displayName}
        renderSummary={summarizeQuestObjectiveType}
        renderDetail={(objectiveType, patch) => (
          <QuestObjectiveTypeDetail objectiveType={objectiveType} patch={patch} />
        )}
        onItemsChange={(questObjectiveTypes) => onChange({ questObjectiveTypes })}
      />

      <DefinitionWorkbench
        title="Completion type designer"
        countLabel="Completion types"
        description="Tune how quests resolve so authors can choose between automatic, turn-in, and future completion flows cleanly."
        addPlaceholder="New completion type id"
        searchPlaceholder="Search completion types"
        emptyMessage="No completion types match the current search."
        items={config.questCompletionTypes}
        defaultItem={defaultQuestCompletionTypeDefinition}
        getDisplayName={(completionType) => completionType.displayName}
        renderSummary={summarizeQuestCompletionType}
        renderDetail={(completionType, patch) => (
          <QuestCompletionTypeDetail completionType={completionType} patch={patch} />
        )}
        onItemsChange={(questCompletionTypes) => onChange({ questCompletionTypes })}
      />
    </div>
  );
}
