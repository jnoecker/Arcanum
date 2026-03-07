import { useProjectStore } from "@/stores/projectStore";
import { Console } from "./Console";
import { ZoneEditor } from "./zone/ZoneEditor";
import { ConfigEditor } from "./config/ConfigEditor";

export function MainArea() {
  const tabs = useProjectStore((s) => s.tabs);
  const activeTabId = useProjectStore((s) => s.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId);

  if (!activeTab) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-text-muted">
        Open a zone or config tab from the sidebar
      </div>
    );
  }

  let content: React.ReactNode;
  switch (activeTab.kind) {
    case "console":
      content = <Console />;
      break;
    case "zone": {
      const zoneId = activeTab.id.replace(/^zone:/, "");
      content = <ZoneEditor key={zoneId} zoneId={zoneId} />;
      break;
    }
    case "config":
      content = <ConfigEditor />;
      break;
    default:
      content = null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {content}
    </div>
  );
}
