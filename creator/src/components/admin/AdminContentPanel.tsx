import { Suspense, lazy } from "react";
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

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-navigation pills */}
      <div className="flex gap-0.5 rounded-full border border-white/8 bg-black/15 p-0.5">
        {CONTENT_VIEWS.map((view) => (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id)}
            className={`rounded-full px-3 py-1.5 text-2xs font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none ${
              activeView === view.id
                ? "bg-gradient-active-strong text-text-primary shadow-sm shadow-accent/10"
                : "border border-transparent text-text-muted hover:border-white/8 hover:text-text-secondary"
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      {/* Active panel */}
      <Suspense
        fallback={
          <div className="py-12 text-center text-sm text-text-muted">Loading...</div>
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
  );
}
