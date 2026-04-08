import { useRef, useEffect, useState, useCallback } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { PANEL_MAP } from "@/lib/panelRegistry";
import type { Workspace } from "@/lib/panelRegistry";

export function TabBar({ workspace }: { workspace: Workspace }) {
  const tabs = useProjectStore((s) => s.tabs);
  const activeTabId = useProjectStore((s) => s.activeTabId);
  const setActiveTab = useProjectStore((s) => s.setActiveTab);
  const closeTab = useProjectStore((s) => s.closeTab);
  const closeAllTabs = useProjectStore((s) => s.closeAllTabs);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  const checkOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      setHasOverflow(el.scrollWidth > el.clientWidth + 4 && !atEnd);
    }
  }, []);

  useEffect(() => {
    checkOverflow();
    const el = scrollRef.current;
    if (el && typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(checkOverflow);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [checkOverflow, tabs.length]);

  // Scroll active tab into view
  useEffect(() => {
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    const el = tabRefs.current[idx]?.parentElement;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeTabId, tabs]);

  const focusTab = (index: number) => {
    const nextIndex = (index + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    if (!nextTab) return;
    setActiveTab(nextTab.id);
    tabRefs.current[nextIndex]?.focus();
  };

  const isTabInWorkspace = (tab: typeof tabs[number]): boolean => {
    if (tab.kind === "panel" && tab.panelId) {
      const panel = PANEL_MAP[tab.panelId];
      return panel ? (panel.host === "lore" ? workspace === "lore" : workspace === "worldmaker") : true;
    }
    // Zone, console, admin, sprites are worldmaker
    return workspace === "worldmaker";
  };

  if (tabs.length === 0) return null;

  return (
    <div className="relative shrink-0 border-b border-[var(--chrome-stroke)] bg-bg-secondary/40 px-3 py-1.5">
      {hasOverflow && (
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-10 bg-gradient-to-l from-bg-secondary/80 to-transparent" />
      )}
      <div
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto scrollbar-hide"
        role="tablist"
        aria-label="Open workspaces"
        onScroll={checkOverflow}
      >
        {tabs.length > 1 && (
          <button
            onClick={closeAllTabs}
            title="Close all tabs"
            aria-label="Close all tabs"
            className="focus-ring flex shrink-0 items-center rounded-lg px-2 py-1.5 text-text-muted transition hover:bg-[var(--chrome-highlight)] hover:text-text-primary"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        )}
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const inWorkspace = isTabInWorkspace(tab);
          const panel = tab.kind === "panel" && tab.panelId ? PANEL_MAP[tab.panelId] : null;
          const kicker = panel?.kicker ?? (tab.kind === "zone" ? "Zone" : tab.kind === "admin" ? "Admin" : tab.kind === "console" ? "Console" : "Surface");

          return (
            <div
              key={tab.id}
              className={`group flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                isActive
                  ? "bg-[var(--chrome-highlight-strong)] shadow-sm"
                  : inWorkspace
                    ? "hover:bg-[var(--chrome-highlight)]"
                    : "opacity-40 hover:bg-[var(--chrome-highlight)] hover:opacity-70"
              }`}
            >
              <button
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                id={`workspace-tab-${index}`}
                role="tab"
                aria-selected={isActive}
                aria-controls="workspace-panel"
                tabIndex={isActive ? 0 : -1}
                className="focus-ring min-w-0 rounded text-left"
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
                <span className={`text-[9px] uppercase tracking-ui ${isActive ? "text-text-secondary" : "text-text-muted"}`}>
                  {kicker}
                </span>
                <span className={`ml-1.5 truncate font-display text-sm ${isActive ? "text-accent" : "text-text-secondary"}`} title={tab.label}>
                  {tab.label}
                </span>
              </button>
              <button
                aria-label={`Close ${tab.label}`}
                className="focus-ring rounded-full p-0.5 text-text-muted opacity-0 transition-opacity hover:bg-[var(--chrome-highlight-strong)] hover:text-text-primary group-hover:opacity-70 group-focus-within:opacity-70"
                onClick={() => closeTab(tab.id)}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
