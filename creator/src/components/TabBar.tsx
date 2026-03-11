import { useProjectStore } from "@/stores/projectStore";
import tabbarBg from "@/assets/tabbar-bg.jpg";

export function TabBar() {
  const tabs = useProjectStore((s) => s.tabs);
  const activeTabId = useProjectStore((s) => s.activeTabId);
  const setActiveTab = useProjectStore((s) => s.setActiveTab);
  const closeTab = useProjectStore((s) => s.closeTab);

  if (tabs.length === 0) return null;

  return (
    <div className="relative flex h-14 shrink-0 items-center gap-2 overflow-x-auto border-b border-white/10 px-4">
      <img src={tabbarBg} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.08]" />
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={`group flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm transition ${
              isActive
                ? "border-[rgba(184,216,232,0.35)] bg-[linear-gradient(135deg,rgba(168,151,210,0.16),rgba(140,174,201,0.12))] text-text-primary"
                : "border-white/8 bg-black/10 text-text-secondary hover:bg-white/8 hover:text-text-primary"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="truncate">{tab.label}</span>
            <button
              className="ml-1 rounded-full p-0.5 text-text-muted opacity-0 transition-opacity hover:bg-white/10 hover:text-text-primary group-hover:opacity-100"
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
