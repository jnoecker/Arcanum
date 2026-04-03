import { lazy, Suspense } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { PANEL_MAP, panelTab, type Workspace } from "@/lib/panelRegistry";
import { StudioWorkspace } from "./StudioWorkspace";

const ZoneEditor = lazy(() => import("./zone/ZoneEditor").then(m => ({ default: m.ZoneEditor })));
const ConfigPanelHost = lazy(() => import("./config/ConfigPanelHost").then(m => ({ default: m.ConfigPanelHost })));
const LorePanelHost = lazy(() => import("./lore/LorePanelHost").then(m => ({ default: m.LorePanelHost })));
const PlayerSpriteManager = lazy(() => import("./PlayerSpriteManager").then(m => ({ default: m.PlayerSpriteManager })));
const Console = lazy(() => import("./Console").then(m => ({ default: m.Console })));
const AdminDashboard = lazy(() => import("./admin/AdminDashboard").then(m => ({ default: m.AdminDashboard })));

function LazyFallback() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
      <div className="h-8 w-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
      <p className="text-sm text-text-muted animate-unfurl-in">
        Opening the active worldmaking surface...
      </p>
    </div>
  );
}

export function MainArea({ workspace }: { workspace: Workspace }) {
  const tabs = useProjectStore((s) => s.tabs);
  const activeTabId = useProjectStore((s) => s.activeTabId);
  const openTab = useProjectStore((s) => s.openTab);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeTabIndex = tabs.findIndex((t) => t.id === activeTabId);

  if (!activeTab) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-8">
        <div className="panel-surface max-w-2xl rounded-[32px] px-8 py-10 text-center">
          <div className="mx-auto mb-5 h-px w-16 bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
          <p className="text-[10px] uppercase tracking-wide-ui text-text-muted">
            {workspace === "worldmaker" ? "Awaiting a surface" : "Awaiting a canon task"}
          </p>
          <h2 className="mt-3 font-display text-3xl text-text-primary">
            {workspace === "worldmaker" ? "Open the next worldmaking lens." : "Open the next lore surface."}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-text-secondary">
            {workspace === "worldmaker"
              ? "Start in the art studio, open a zone, or move directly into the systems that give the world its laws."
              : "Begin with world setting, maps, or codex articles and let the canon spread outward from there."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {(workspace === "worldmaker"
              ? [panelTab("art"), panelTab("worldServer"), panelTab("classes")]
              : [panelTab("lore"), panelTab("worldSetting"), panelTab("loreMaps")]
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => openTab(tab)}
                className="focus-ring shell-pill-primary rounded-full px-4 py-2 text-xs font-medium"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
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
    <div
      id="workspace-panel"
      role="tabpanel"
      aria-label={activeTab.label}
      aria-labelledby={activeTabIndex >= 0 ? `workspace-tab-${activeTabIndex}` : undefined}
      className="flex min-h-0 flex-1 flex-col"
    >
      <Suspense fallback={<LazyFallback />}>
        {content}
      </Suspense>
    </div>
  );
}
