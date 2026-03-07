import { useProjectStore } from "@/stores/projectStore";
import { Console } from "./Console";
import { ZoneEditor } from "./zone/ZoneEditor";

export function MainArea() {
  const tabs = useProjectStore((s) => s.tabs);
  const activeTabId = useProjectStore((s) => s.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId);

  if (!activeTab) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-muted">
        Open a zone or config tab from the sidebar
      </div>
    );
  }

  switch (activeTab.kind) {
    case "console":
      return <Console />;
    case "zone": {
      const zoneId = activeTab.id.replace(/^zone:/, "");
      return <ZoneEditor key={zoneId} zoneId={zoneId} />;
    }
    case "config":
      return (
        <div className="flex flex-1 items-center justify-center text-text-muted">
          Config editor (Phase 4)
        </div>
      );
    case "classes":
      return (
        <div className="flex flex-1 items-center justify-center text-text-muted">
          Class designer (Phase 5)
        </div>
      );
    case "races":
      return (
        <div className="flex flex-1 items-center justify-center text-text-muted">
          Race designer (Phase 5)
        </div>
      );
    default:
      return null;
  }
}
