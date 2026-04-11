import { useRef, useState } from "react";
import type { AppConfig } from "@/types/config";
import { DefinitionWorkbench } from "./DefinitionWorkbench";
import { AchievementDefEditor } from "./AchievementDefEditor";
import {
  AchievementCategoryDetail,
  AchievementCriterionTypeDetail,
  defaultAchievementCategoryDefinition,
  defaultAchievementCriterionTypeDefinition,
  summarizeAchievementCategory,
  summarizeAchievementCriterionType,
} from "@/components/config/panels/AchievementsPanel";

type TabId = "builder" | "categories" | "criterionTypes";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "builder", label: "Builder" },
  { id: "categories", label: "Categories" },
  { id: "criterionTypes", label: "Criterion Types" },
];

interface AchievementDesignerProps {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}

export function AchievementDesigner({ config, onChange }: AchievementDesignerProps) {
  const [active, setActive] = useState<TabId>("builder");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const categoryCount = Object.keys(config.achievementCategories).length;
  const criterionCount = Object.keys(config.achievementCriterionTypes).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div
          className="segmented-control"
          role="tablist"
          aria-label="Achievement views"
        >
          {TABS.map((tab, index) => {
            const count =
              tab.id === "categories"
                ? categoryCount
                : tab.id === "criterionTypes"
                  ? criterionCount
                  : null;
            return (
              <button
                key={tab.id}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                role="tab"
                aria-selected={active === tab.id}
                aria-controls={`achievement-tab-${tab.id}`}
                tabIndex={active === tab.id ? 0 : -1}
                onClick={() => setActive(tab.id)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight") {
                    event.preventDefault();
                    const next = (index + 1) % TABS.length;
                    setActive(TABS[next]!.id);
                    tabRefs.current[next]?.focus();
                  } else if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    const next = (index - 1 + TABS.length) % TABS.length;
                    setActive(TABS[next]!.id);
                    tabRefs.current[next]?.focus();
                  }
                }}
                className="segmented-button focus-ring px-4 py-2 text-xs font-medium"
                data-active={active === tab.id}
              >
                {tab.label}
                {count !== null && (
                  <span className="ml-2 text-2xs text-text-muted">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div
        id={`achievement-tab-${active}`}
        role="tabpanel"
        aria-labelledby={`achievement-tab-${active}`}
      >
        {active === "builder" && (
          <AchievementDefEditor config={config} onChange={onChange} />
        )}
        {active === "categories" && (
          <DefinitionWorkbench
            title="Achievement category designer"
            countLabel="Achievement categories"
            description="Top-level groupings for the achievement system."
            addPlaceholder="New category id"
            searchPlaceholder="Search categories"
            emptyMessage="No categories match the current search."
            emptyTitle="No categories designed yet"
            emptyDescription="Categories let you group achievements by theme (combat, crafting, exploration, etc.)."
            items={config.achievementCategories}
            defaultItem={defaultAchievementCategoryDefinition}
            getDisplayName={(category) => category.displayName}
            renderSummary={summarizeAchievementCategory}
            renderDetail={(_id, category, patch) => (
              <AchievementCategoryDetail category={category} patch={patch} />
            )}
            onItemsChange={(achievementCategories) => onChange({ achievementCategories })}
          />
        )}
        {active === "criterionTypes" && (
          <DefinitionWorkbench
            title="Criterion type designer"
            countLabel="Criterion types"
            description="Progress tracking types and display formats."
            addPlaceholder="New criterion type id"
            searchPlaceholder="Search criterion types"
            emptyMessage="No criterion types match the current search."
            emptyTitle="No criterion types designed yet"
            emptyDescription="Criterion types define how achievement progress is tracked and displayed (counters, percentages, collections)."
            items={config.achievementCriterionTypes}
            defaultItem={defaultAchievementCriterionTypeDefinition}
            getDisplayName={(criterion) => criterion.displayName}
            renderSummary={summarizeAchievementCriterionType}
            renderBadges={(criterion) => (criterion.progressFormat ? ["Tracked"] : ["Simple"])}
            renderDetail={(_id, criterion, patch) => (
              <AchievementCriterionTypeDetail criterion={criterion} patch={patch} />
            )}
            onItemsChange={(achievementCriterionTypes) => onChange({ achievementCriterionTypes })}
          />
        )}
      </div>
    </div>
  );
}
