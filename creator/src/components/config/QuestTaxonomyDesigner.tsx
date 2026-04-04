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
      <div className="rounded-3xl border border-[rgba(184,216,232,0.14)] bg-[linear-gradient(145deg,rgba(92,106,147,0.18),rgba(42,51,79,0.22))] px-5 py-4 text-sm leading-7 text-text-secondary">
        Objective and completion type IDs are referenced by zone quest data. Renaming is not yet supported — add, edit, or delete types here.
      </div>

      <DefinitionWorkbench
        title="Objective type designer"
        countLabel="Objective types"
        description="Define the verbs authors use when they build quest steps and requirement lists."
        addPlaceholder="New objective type id"
        searchPlaceholder="Search objective types"
        emptyMessage="No objective types match the current search."
        emptyTitle="No quest types catalogued yet"
        emptyDescription="Define the categories and structures for quests in the world."
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
        description="How quests are turned in and completed."
        addPlaceholder="New completion type id"
        searchPlaceholder="Search completion types"
        emptyMessage="No completion types match the current search."
        emptyTitle="No quest types catalogued yet"
        emptyDescription="Define the categories and structures for quests in the world."
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
