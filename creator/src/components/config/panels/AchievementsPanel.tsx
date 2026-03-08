import type { ConfigPanelProps } from "./types";
import type {
  AchievementCategoryDefinition,
  AchievementCriterionTypeDefinition,
} from "@/types/config";
import { FieldRow, TextInput } from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";

export function AchievementsPanel({ config, onChange }: ConfigPanelProps) {
  return (
    <>
      <RegistryPanel<AchievementCategoryDefinition>
        title="Achievement Categories"
        items={config.achievementCategories}
        onItemsChange={(achievementCategories) => onChange({ achievementCategories })}
        placeholder="New category"
        idTransform={(raw) => raw.trim().toLowerCase().replace(/\s+/g, "_")}
        getDisplayName={(c) => c.displayName}
        defaultItem={(raw) => ({ displayName: raw })}
        renderSummary={() => ""}
        renderDetail={(_id, c, patch) => (
          <FieldRow label="Display Name">
            <TextInput
              value={c.displayName}
              onCommit={(v) => patch({ displayName: v })}
            />
          </FieldRow>
        )}
      />

      <RegistryPanel<AchievementCriterionTypeDefinition>
        title="Criterion Types"
        items={config.achievementCriterionTypes}
        onItemsChange={(achievementCriterionTypes) =>
          onChange({ achievementCriterionTypes })
        }
        placeholder="New criterion type"
        idTransform={(raw) => raw.trim().toLowerCase().replace(/\s+/g, "_")}
        getDisplayName={(c) => c.displayName}
        defaultItem={(raw) => ({ displayName: raw })}
        renderSummary={(_id, c) => c.progressFormat ?? ""}
        renderDetail={(_id, c, patch) => (
          <>
            <FieldRow label="Display Name">
              <TextInput
                value={c.displayName}
                onCommit={(v) => patch({ displayName: v })}
              />
            </FieldRow>
            <FieldRow label="Progress Format">
              <TextInput
                value={c.progressFormat ?? ""}
                onCommit={(v) => patch({ progressFormat: v || undefined })}
                placeholder="{current}/{required}"
              />
            </FieldRow>
          </>
        )}
      />
    </>
  );
}
