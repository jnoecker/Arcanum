import { useProjectStore } from "@/stores/projectStore";
import tabbarBg from "@/assets/tabbar-bg.jpg";

export function TabBar() {
  const tabs = useProjectStore((s) => s.tabs);
  const activeTabId = useProjectStore((s) => s.activeTabId);
  const setActiveTab = useProjectStore((s) => s.setActiveTab);
  const closeTab = useProjectStore((s) => s.closeTab);

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
                ? "border-border-active bg-gradient-active text-text-primary"
                : "border-white/8 bg-black/10 text-text-secondary hover:bg-white/8 hover:text-text-primary"
            }`}
          >
            <button
              className="truncate"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
            <button
              aria-label={`Close ${tab.label}`}
              className="ml-1 rounded-full p-0.5 text-text-muted opacity-0 transition-opacity hover:bg-white/10 hover:text-text-primary group-hover:opacity-100"
              onClick={() => closeTab(tab.id)}
            >
              x
            </button>
          </div>
        );
      })}
    </div>
  );
}
