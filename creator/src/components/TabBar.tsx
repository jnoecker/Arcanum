import { useMemo, useRef } from "react";
import { PANEL_MAP } from "@/lib/panelRegistry";
import { useProjectStore } from "@/stores/projectStore";
import tabbarBg from "@/assets/tabbar-bg.jpg";

function getTabMeta(tab: { kind: string; label: string; panelId?: string }) {
  if (tab.kind === "panel" && tab.panelId) {
    const panel = PANEL_MAP[tab.panelId];
    return {
      kicker: panel?.kicker ?? "Surface",
      title: panel?.title ?? tab.label,
      description: panel?.description ?? "Open working surface.",
    };
  }
  if (tab.kind === "zone") {
    return {
      kicker: "Zone cartography",
      title: tab.label,
      description: "Spatial layout, rooms, exits, media, and supporting assets for a live zone.",
    };
  }
  if (tab.kind === "admin") {
    return {
      kicker: "Runtime command",
      title: "Admin dashboard",
      description: "Live oversight of players, content, world state, and runtime actions.",
    };
  }
  if (tab.kind === "console") {
    return {
      kicker: "Terminal",
      title: "Console",
      description: "Runtime feedback, logs, and command output.",
    };
  }
  return {
    kicker: "Workbench",
    title: tab.label,
    description: "Open working surface.",
  };
}

export function TabBar() {
  const tabs = useProjectStore((s) => s.tabs);
  const activeTabId = useProjectStore((s) => s.activeTabId);
  const setActiveTab = useProjectStore((s) => s.setActiveTab);
  const closeTab = useProjectStore((s) => s.closeTab);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? null;
  const activeMeta = useMemo(
    () => (activeTab ? getTabMeta(activeTab) : {
      kicker: "No surface active",
      title: "Awaiting instruction",
      description: "Choose a surface to begin shaping the world.",
    }),
    [activeTab],
  );

  const focusTab = (index: number) => {
    const nextIndex = (index + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    if (!nextTab) return;
    setActiveTab(nextTab.id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="relative shrink-0 border-b border-white/10 px-5 py-4">
      <img
        src={tabbarBg}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.08]"
      />
      <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 xl:max-w-md">
          <p className="text-[10px] uppercase tracking-wide-ui text-text-muted">Open surfaces</p>
          <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
            <h2 className="font-display text-2xl text-text-primary">{activeMeta.title}</h2>
            <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-[10px] uppercase tracking-ui text-text-secondary">
              {activeMeta.kicker}
            </span>
          </div>
          <p className="mt-2 max-w-xl text-xs leading-6 text-text-secondary">{activeMeta.description}</p>
        </div>

        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Open workspaces"
        >
          {tabs.map((tab, index) => {
            const isActive = tab.id === activeTabId;
            const meta = getTabMeta(tab);
            const tabButtonId = `workspace-tab-${index}`;

            return (
              <div
                key={tab.id}
                className="orbital-tab group flex min-w-[11rem] shrink-0 items-start gap-2 rounded-[24px] px-3 py-3"
                data-active={isActive}
              >
                <button
                  ref={(node) => {
                    tabRefs.current[index] = node;
                  }}
                  id={tabButtonId}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="workspace-panel"
                  tabIndex={isActive ? 0 : -1}
                  className="focus-ring min-w-0 flex-1 rounded-md text-left"
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowRight") {
                      event.preventDefault();
                      focusTab(index + 1);
                    } else if (event.key === "ArrowLeft") {
                      event.preventDefault();
                      focusTab(index - 1);
                    } else if (event.key === "Home") {
                      event.preventDefault();
                      focusTab(0);
                    } else if (event.key === "End") {
                      event.preventDefault();
                      focusTab(tabs.length - 1);
                    }
                  }}
                >
                  <span className="block text-[9px] uppercase tracking-ui text-text-muted">
                    {meta.kicker}
                  </span>
                  <span className="mt-1 block truncate font-display text-base text-text-primary">
                    {tab.label}
                  </span>
                </button>
                <button
                  aria-label={`Close ${tab.label}`}
                className="focus-ring rounded-full p-1 text-text-muted opacity-55 transition-opacity hover:bg-white/10 hover:text-text-primary group-hover:opacity-100 group-focus-within:opacity-100"
                onClick={() => closeTab(tab.id)}
              >
                x
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
