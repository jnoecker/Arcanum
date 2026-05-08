import { useShallow } from "zustand/shallow";
import { useProjectStore } from "@/stores/projectStore";
import { useSidebarStore } from "@/stores/sidebarStore";
import { panelsForIsland, panelTab, type Island } from "@/lib/panelRegistry";
import { PANEL_ICONS } from "@/assets/ui";

interface Props {
  island: Island;
}

export function IslandPanelList({ island }: Props) {
  const { activeTabId, openTab } = useProjectStore(
    useShallow((s) => ({ activeTabId: s.activeTabId, openTab: s.openTab })),
  );
  const drillInto = useSidebarStore((s) => s.drillInto);
  const panels = panelsForIsland(island);

  const handlePanelClick = (panelId: string) => {
    openTab(panelTab(panelId));
    // The "Articles" lore panel is the same surface as the top-level
    // Articles entry — clicking it inside Arcanum also drills the sidebar
    // into the article tree so the user can navigate articles in place.
    if (panelId === "lore") {
      drillInto("articles");
    }
  };

  if (panels.length === 0) {
    return (
      <div className="px-4 pb-4 pt-1 text-sm text-text-muted">
        No panels live on this island yet.
      </div>
    );
  }

  return (
    <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-4 pb-4 pt-1">
      {panels.map((panel) => {
        const tabId = `panel:${panel.id}`;
        const isActive = activeTabId === tabId;
        return (
          <li key={panel.id}>
            <button
              onClick={() => handlePanelClick(panel.id)}
              className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
                isActive
                  ? "border-border-active bg-gradient-active text-text-primary"
                  : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] text-text-secondary hover:bg-[var(--chrome-highlight-strong)] hover:text-text-primary"
              }`}
              title={panel.description}
            >
              {PANEL_ICONS[panel.id] ? (
                <img
                  src={PANEL_ICONS[panel.id]}
                  alt=""
                  aria-hidden="true"
                  className="h-8 w-8 shrink-0 rounded-md object-contain"
                />
              ) : panel.glyph ? (
                <span className="mt-0.5 shrink-0 text-base leading-none" aria-hidden="true">
                  {panel.glyph}
                </span>
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{panel.label}</span>
                <span className="mt-0.5 block truncate text-2xs text-text-muted">
                  {panel.kicker}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
