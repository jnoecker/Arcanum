import { lazy, Suspense } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { PANEL_MAP } from "@/lib/panelRegistry";
import { StudioWorkspace } from "./StudioWorkspace";

const ZoneEditor = lazy(() => import("./zone/ZoneEditor").then(m => ({ default: m.ZoneEditor })));
const ConfigPanelHost = lazy(() => import("./config/ConfigPanelHost").then(m => ({ default: m.ConfigPanelHost })));
const LorePanelHost = lazy(() => import("./lore/LorePanelHost").then(m => ({ default: m.LorePanelHost })));
const PlayerSpriteManager = lazy(() => import("./PlayerSpriteManager").then(m => ({ default: m.PlayerSpriteManager })));
const Console = lazy(() => import("./Console").then(m => ({ default: m.Console })));
const AdminDashboard = lazy(() => import("./admin/AdminDashboard").then(m => ({ default: m.AdminDashboard })));

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
        Open a zone or panel from the sidebar
      </div>
    );
  }

  let content: React.ReactNode;
  switch (activeTab.kind) {
    case "panel": {
      const panelId = activeTab.panelId ?? "art";
      const def = PANEL_MAP[panelId];
      if (def?.host === "studio") {
        content = <StudioWorkspace panelId={panelId} />;
      } else if (def?.host === "lore") {
        content = <LorePanelHost panelId={panelId} />;
      } else {
        content = <ConfigPanelHost panelId={panelId} />;
      }
      break;
    }
    case "zone": {
      const zoneId = activeTab.id.replace(/^zone:/, "");
      content = <ZoneEditor key={zoneId} zoneId={zoneId} />;
      break;
    }
    case "console":
      content = <Console />;
      break;
    case "sprites":
      content = <PlayerSpriteManager />;
      break;
    case "admin":
      content = <AdminDashboard />;
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
