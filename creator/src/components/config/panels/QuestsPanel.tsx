import type { ConfigPanelProps } from "./types";
import type {
  QuestObjectiveTypeDefinition,
  QuestCompletionTypeDefinition,
} from "@/types/config";
import { FieldRow, TextInput } from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";

export function defaultQuestObjectiveTypeDefinition(raw: string): QuestObjectiveTypeDefinition {
  return { displayName: raw };
}

export function summarizeQuestObjectiveType(): string {
  return "";
}

export function QuestObjectiveTypeDetail({
  objectiveType,
  patch,
}: {
  objectiveType: QuestObjectiveTypeDefinition;
  patch: (p: Partial<QuestObjectiveTypeDefinition>) => void;
}) {
  return (
    <FieldRow label="Display Name">
      <TextInput
        value={objectiveType.displayName}
        onCommit={(v) => patch({ displayName: v })}
      />
    </FieldRow>
  );
}

export function defaultQuestCompletionTypeDefinition(raw: string): QuestCompletionTypeDefinition {
  return { displayName: raw };
}

export function summarizeQuestCompletionType(): string {
  return "";
}

export function QuestCompletionTypeDetail({
  completionType,
  patch,
}: {
  completionType: QuestCompletionTypeDefinition;
  patch: (p: Partial<QuestCompletionTypeDefinition>) => void;
}) {
  return (
    <FieldRow label="Display Name">
      <TextInput
        value={completionType.displayName}
        onCommit={(v) => patch({ displayName: v })}
      />
    </FieldRow>
  );
}

export function QuestsPanel({ config, onChange }: ConfigPanelProps) {
  return (
    <>
      <RegistryPanel<QuestObjectiveTypeDefinition>
        title="Quest Objective Types"
        items={config.questObjectiveTypes}
        onItemsChange={(questObjectiveTypes) => onChange({ questObjectiveTypes })}
        placeholder="New objective type"
        idTransform={(raw) => raw.trim().toLowerCase().replace(/\s+/g, "_")}
        getDisplayName={(t) => t.displayName}
        defaultItem={defaultQuestObjectiveTypeDefinition}
        renderSummary={summarizeQuestObjectiveType}
        renderDetail={(_id, t, patch) => (
          <QuestObjectiveTypeDetail objectiveType={t} patch={patch} />
        )}
      />

      <RegistryPanel<QuestCompletionTypeDefinition>
        title="Quest Completion Types"
        items={config.questCompletionTypes}
        onItemsChange={(questCompletionTypes) =>
          onChange({ questCompletionTypes })
        }
        placeholder="New completion type"
        idTransform={(raw) => raw.trim().toLowerCase().replace(/\s+/g, "_")}
        getDisplayName={(t) => t.displayName}
        defaultItem={defaultQuestCompletionTypeDefinition}
        renderSummary={summarizeQuestCompletionType}
        renderDetail={(_id, t, patch) => (
          <QuestCompletionTypeDetail completionType={t} patch={patch} />
        )}
      />
    </>
  );
}
