import type { AppConfig } from "@/types/config";
import { DefinitionWorkbench } from "./DefinitionWorkbench";
import {
  AchievementCategoryDetail,
  AchievementCriterionTypeDetail,
  defaultAchievementCategoryDefinition,
  defaultAchievementCriterionTypeDefinition,
  summarizeAchievementCategory,
  summarizeAchievementCriterionType,
} from "@/components/config/panels/AchievementsPanel";

export function AchievementDesigner({
  config,
  onChange,
}: {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <DefinitionWorkbench
        title="Achievement category designer"
        countLabel="Achievement categories"
        description="Top-level groupings for the achievement system."
        addPlaceholder="New category id"
        searchPlaceholder="Search categories"
        emptyMessage="No categories match the current search."
        emptyTitle="No achievements designed yet"
        emptyDescription="Create milestones and trophies that celebrate player accomplishments."
        items={config.achievementCategories}
        defaultItem={defaultAchievementCategoryDefinition}
        getDisplayName={(category) => category.displayName}
        renderSummary={summarizeAchievementCategory}
        renderDetail={(category, patch) => (
          <AchievementCategoryDetail category={category} patch={patch} />
        )}
        onItemsChange={(achievementCategories) => onChange({ achievementCategories })}
      />

      <DefinitionWorkbench
        title="Criterion type designer"
        countLabel="Criterion types"
        description="Progress tracking types and display formats."
        addPlaceholder="New criterion type id"
        searchPlaceholder="Search criterion types"
        emptyMessage="No criterion types match the current search."
        emptyTitle="No achievements designed yet"
        emptyDescription="Create milestones and trophies that celebrate player accomplishments."
        items={config.achievementCriterionTypes}
        defaultItem={defaultAchievementCriterionTypeDefinition}
        getDisplayName={(criterion) => criterion.displayName}
        renderSummary={summarizeAchievementCriterionType}
        renderBadges={(criterion) => (criterion.progressFormat ? ["Tracked"] : ["Simple"])}
        renderDetail={(criterion, patch) => (
          <AchievementCriterionTypeDetail criterion={criterion} patch={patch} />
        )}
        onItemsChange={(achievementCriterionTypes) => onChange({ achievementCriterionTypes })}
      />
    </div>
  );
}
