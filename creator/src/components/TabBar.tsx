import { useProjectStore } from "@/stores/projectStore";
import tabbarBg from "@/assets/tabbar-bg.jpg";

export function TabBar() {
  const tabs = useProjectStore((s) => s.tabs);
  const activeTabId = useProjectStore((s) => s.activeTabId);
  const setActiveTab = useProjectStore((s) => s.setActiveTab);
  const closeTab = useProjectStore((s) => s.closeTab);

  if (tabs.length === 0) return null;

  return (
    <div className="relative flex h-9 shrink-0 items-end gap-0 overflow-x-auto border-b border-border-default bg-bg-secondary">
      <img src={tabbarBg} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.10]" />
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={`group flex h-full cursor-pointer items-center gap-2 border-r border-border-muted px-3 text-xs transition-colors ${
              isActive
                ? "border-b-2 border-b-accent bg-bg-primary text-accent-emphasis"
                : "text-accent-muted hover:text-accent"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="truncate">{tab.label}</span>
            <button
              className="ml-1 rounded p-0.5 text-text-muted opacity-0 transition-opacity hover:text-text-primary group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
            >
              x
            </button>
          </div>
        );
      })}
    </div>
  );
}
