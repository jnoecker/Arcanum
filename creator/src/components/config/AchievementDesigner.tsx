import { useRef, useState } from "react";
import type { AppConfig } from "@/types/config";
import { AchievementDefEditor } from "./AchievementDefEditor";
import { TaxonomyWorkbench } from "./achievements/TaxonomyWorkbench";
import {
  CategoryDetail,
  CriterionTypeDetail,
  defaultAchievementCategoryDefinition,
  defaultAchievementCriterionTypeDefinition,
  summarizeCriterionType,
} from "./achievements/TaxonomyDetails";

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
          <AchievementDefEditor
            config={config}
            onChange={onChange}
            onSwitchTab={setActive}
          />
        )}
        {active === "categories" && (
          <TaxonomyWorkbench
            listTitle="Categories"
            detailKicker="Category"
            addPlaceholder="New category id"
            searchPlaceholder="Search categories…"
            emptyListMessage="No categories yet — add one above."
            emptyDetailTitle="No category selected"
            emptyDetailDescription="Categories let you group achievements by theme — combat, crafting, exploration, and so on."
            items={config.achievementCategories}
            defaultItem={defaultAchievementCategoryDefinition}
            getDisplayName={(category) => category.displayName}
            renderDetail={(_id, category, patch) => (
              <CategoryDetail category={category} patch={patch} />
            )}
            onItemsChange={(achievementCategories) => onChange({ achievementCategories })}
          />
        )}
        {active === "criterionTypes" && (
          <TaxonomyWorkbench
            listTitle="Criterion types"
            detailKicker="Criterion type"
            addPlaceholder="New criterion type id"
            searchPlaceholder="Search criterion types…"
            emptyListMessage="No criterion types yet — add one above."
            emptyDetailTitle="No criterion type selected"
            emptyDetailDescription="Criterion types control how achievement progress is shown to players — a counter, percentage, or simple boolean."
            items={config.achievementCriterionTypes}
            defaultItem={defaultAchievementCriterionTypeDefinition}
            getDisplayName={(criterion) => criterion.displayName}
            renderRowSummary={(_id, criterion) => summarizeCriterionType(criterion)}
            renderDetail={(_id, criterion, patch) => (
              <CriterionTypeDetail criterion={criterion} patch={patch} />
            )}
            onItemsChange={(achievementCriterionTypes) => onChange({ achievementCriterionTypes })}
          />
        )}
      </div>
    </div>
  );
}
