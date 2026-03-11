import type { ConfigPanelProps } from "./types";
import type {
  AchievementCategoryDefinition,
  AchievementCriterionTypeDefinition,
} from "@/types/config";
import { FieldRow, TextInput } from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";

export function defaultAchievementCategoryDefinition(raw: string): AchievementCategoryDefinition {
  return { displayName: raw };
}

export function summarizeAchievementCategory(): string {
  return "";
}

export function AchievementCategoryDetail({
  category,
  patch,
}: {
  category: AchievementCategoryDefinition;
  patch: (p: Partial<AchievementCategoryDefinition>) => void;
}) {
  return (
    <FieldRow label="Display Name">
      <TextInput
        value={category.displayName}
        onCommit={(v) => patch({ displayName: v })}
      />
    </FieldRow>
  );
}

export function defaultAchievementCriterionTypeDefinition(raw: string): AchievementCriterionTypeDefinition {
  return { displayName: raw };
}

export function summarizeAchievementCriterionType(
  criterion: AchievementCriterionTypeDefinition,
): string {
  return criterion.progressFormat ?? "";
}

export function AchievementCriterionTypeDetail({
  criterion,
  patch,
}: {
  criterion: AchievementCriterionTypeDefinition;
  patch: (p: Partial<AchievementCriterionTypeDefinition>) => void;
}) {
  return (
    <>
      <FieldRow label="Display Name">
        <TextInput
          value={criterion.displayName}
          onCommit={(v) => patch({ displayName: v })}
        />
      </FieldRow>
      <FieldRow label="Progress Format">
        <TextInput
          value={criterion.progressFormat ?? ""}
          onCommit={(v) => patch({ progressFormat: v || undefined })}
          placeholder="{current}/{required}"
        />
      </FieldRow>
    </>
  );
}

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
        defaultItem={defaultAchievementCategoryDefinition}
        renderSummary={summarizeAchievementCategory}
        renderDetail={(_id, c, patch) => (
          <AchievementCategoryDetail category={c} patch={patch} />
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
        defaultItem={defaultAchievementCriterionTypeDefinition}
        renderSummary={(_id, c) => summarizeAchievementCriterionType(c)}
        renderDetail={(_id, c, patch) => (
          <AchievementCriterionTypeDetail criterion={c} patch={patch} />
        )}
      />
    </>
  );
}
