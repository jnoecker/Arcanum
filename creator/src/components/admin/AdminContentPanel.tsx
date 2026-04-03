import { Suspense, lazy, useRef } from "react";
import { useProjectStore } from "@/stores/projectStore";
import type { AdminContentSubView } from "@/types/project";

const AdminAbilityList = lazy(() =>
  import("./AdminAbilityList").then((m) => ({ default: m.AdminAbilityList }))
);
const AdminEffectList = lazy(() =>
  import("./AdminEffectList").then((m) => ({ default: m.AdminEffectList }))
);
const AdminQuestList = lazy(() =>
  import("./AdminQuestList").then((m) => ({ default: m.AdminQuestList }))
);
const AdminAchievementList = lazy(() =>
  import("./AdminAchievementList").then((m) => ({ default: m.AdminAchievementList }))
);
const AdminShopList = lazy(() =>
  import("./AdminShopList").then((m) => ({ default: m.AdminShopList }))
);
const AdminItemList = lazy(() =>
  import("./AdminItemList").then((m) => ({ default: m.AdminItemList }))
);

const CONTENT_VIEWS: Array<{ id: AdminContentSubView; label: string }> = [
  { id: "abilities", label: "Abilities" },
  { id: "effects", label: "Effects" },
  { id: "quests", label: "Quests" },
  { id: "achievements", label: "Achievements" },
  { id: "shops", label: "Shops" },
  { id: "items", label: "Items" },
];

export function AdminContentPanel() {
  const activeView = useProjectStore((s) => s.adminContentSubView);
  const setActiveView = useProjectStore((s) => s.setAdminContentSubView);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-navigation pills */}
      <div className="segmented-control" role="tablist" aria-label="Admin content views">
        {CONTENT_VIEWS.map((view, index) => (
          <button
            key={view.id}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            id={`admin-content-tab-${view.id}`}
            role="tab"
            aria-selected={activeView === view.id}
            aria-controls="admin-content-panel"
            tabIndex={activeView === view.id ? 0 : -1}
            onClick={() => setActiveView(view.id)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") {
                event.preventDefault();
                const nextIndex = (index + 1) % CONTENT_VIEWS.length;
                setActiveView(CONTENT_VIEWS[nextIndex]!.id);
                tabRefs.current[nextIndex]?.focus();
              } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                const nextIndex = (index - 1 + CONTENT_VIEWS.length) % CONTENT_VIEWS.length;
                setActiveView(CONTENT_VIEWS[nextIndex]!.id);
                tabRefs.current[nextIndex]?.focus();
              } else if (event.key === "Home") {
                event.preventDefault();
                setActiveView(CONTENT_VIEWS[0]!.id);
                tabRefs.current[0]?.focus();
              } else if (event.key === "End") {
                event.preventDefault();
                setActiveView(CONTENT_VIEWS[CONTENT_VIEWS.length - 1]!.id);
                tabRefs.current[CONTENT_VIEWS.length - 1]?.focus();
              }
            }}
            className="segmented-button focus-ring px-3 py-1.5 text-2xs font-medium"
            data-active={activeView === view.id}
          >
            {view.label}
          </button>
        ))}
      </div>

      {/* Active panel */}
      <div id="admin-content-panel" role="tabpanel" aria-labelledby={`admin-content-tab-${activeView}`}>
        <Suspense
          fallback={
            <div className="py-12 text-center text-sm text-text-muted">Summoning the selected content ledger...</div>
          }
        >
          {activeView === "abilities" && <AdminAbilityList />}
          {activeView === "effects" && <AdminEffectList />}
          {activeView === "quests" && <AdminQuestList />}
          {activeView === "achievements" && <AdminAchievementList />}
          {activeView === "shops" && <AdminShopList />}
          {activeView === "items" && <AdminItemList />}
        </Suspense>
      </div>
    </div>
  );
}
