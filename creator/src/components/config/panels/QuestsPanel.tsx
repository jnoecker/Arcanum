import type { ConfigPanelProps } from "./types";
import type {
  QuestObjectiveTypeDefinition,
  QuestCompletionTypeDefinition,
} from "@/types/config";
import { FieldRow, TextInput } from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";

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
        defaultItem={(raw) => ({ displayName: raw })}
        renderSummary={() => ""}
        renderDetail={(_id, t, patch) => (
          <FieldRow label="Display Name">
            <TextInput
              value={t.displayName}
              onCommit={(v) => patch({ displayName: v })}
            />
          </FieldRow>
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
        defaultItem={(raw) => ({ displayName: raw })}
        renderSummary={() => ""}
        renderDetail={(_id, t, patch) => (
          <FieldRow label="Display Name">
            <TextInput
              value={t.displayName}
              onCommit={(v) => patch({ displayName: v })}
            />
          </FieldRow>
        )}
      />
    </>
  );
}
