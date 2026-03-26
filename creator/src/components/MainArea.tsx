import { lazy, Suspense } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { StudioWorkspace } from "./StudioWorkspace";

const ZoneEditor = lazy(() => import("./zone/ZoneEditor").then(m => ({ default: m.ZoneEditor })));
const ConfigEditor = lazy(() => import("./config/ConfigEditor").then(m => ({ default: m.ConfigEditor })));
const PlayerSpriteManager = lazy(() => import("./PlayerSpriteManager").then(m => ({ default: m.PlayerSpriteManager })));
const Console = lazy(() => import("./Console").then(m => ({ default: m.Console })));

function LazyFallback() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center text-text-muted">
      Loading...
    </div>
  );
}

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
    case "studio":
      content = <StudioWorkspace />;
      break;
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
    case "sprites":
      content = <PlayerSpriteManager />;
      break;
    default:
      content = null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<LazyFallback />}>
        {content}
      </Suspense>
    </div>
  );
}
