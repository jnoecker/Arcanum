import { lazy, Suspense, Component, type ReactNode, type ErrorInfo } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { PANEL_MAP } from "@/lib/panelRegistry";
import { StudioWorkspace } from "./StudioWorkspace";
import { WorldMap } from "./map/WorldMap";
import { IslandView } from "./map/IslandView";

class PanelErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Panel crash:", error, info.componentStack); }
  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8">
          <h2 className="font-display text-lg text-status-error">Panel Crashed</h2>
          <pre className="max-w-2xl overflow-auto rounded-lg border border-status-error/30 bg-[var(--chrome-fill-strong)] p-4 text-xs text-text-secondary">
            {this.state.error.message}{"\n"}{this.state.error.stack}
          </pre>
          <button onClick={() => this.setState({ error: null })} className="rounded-full border border-[var(--chrome-stroke)] px-4 py-2 text-xs text-accent hover:bg-accent/10">
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ZoneEditor = lazy(() => import("./zone/ZoneEditor").then(m => ({ default: m.ZoneEditor })));
const ConfigPanelHost = lazy(() => import("./config/ConfigPanelHost").then(m => ({ default: m.ConfigPanelHost })));
const LorePanelHost = lazy(() => import("./lore/LorePanelHost").then(m => ({ default: m.LorePanelHost })));
const PlayerSpriteManager = lazy(() => import("./PlayerSpriteManager").then(m => ({ default: m.PlayerSpriteManager })));
const Console = lazy(() => import("./Console").then(m => ({ default: m.Console })));
const AdminDashboard = lazy(() => import("./admin/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
const TuningWizard = lazy(() => import("./tuning/TuningWizard").then(m => ({ default: m.TuningWizard })));
const AppearancePanel = lazy(() => import("./AppearancePanel").then(m => ({ default: m.AppearancePanel })));

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

export function MainArea() {
  const tabs = useProjectStore((s) => s.tabs);
  const activeTabId = useProjectStore((s) => s.activeTabId);
  const mapView = useProjectStore((s) => s.mapView);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeTabIndex = tabs.findIndex((t) => t.id === activeTabId);

  // Map takes precedence over the active tab when it's the current surface.
  if (mapView === "world" || !activeTab) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <WorldMap />
      </div>
    );
  }
  if (mapView && typeof mapView === "object" && "island" in mapView) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <IslandView island={mapView.island} />
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
      } else if (def?.host === "command") {
        // Route command panels to their dedicated components
        switch (panelId) {
          case "sprites": content = <PlayerSpriteManager />; break;
          case "console": content = <Console />; break;
          case "admin": content = <AdminDashboard />; break;
          case "tuningWizard": content = <TuningWizard />; break;
          case "appearance": content = <AppearancePanel />; break;
          default: content = null;
        }
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
    // Legacy tab kinds — kept for backward compatibility with persisted tabs
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
      aria-labelledby={activeTabIndex >= 0 ? `workspace-tab-${activeTabIndex}` : undefined}
      className="flex min-h-0 flex-1 flex-col"
      style={{ viewTransitionName: "workspace-panel" }}
    >
      <PanelErrorBoundary>
        <Suspense fallback={<LazyFallback />}>
          {content}
        </Suspense>
      </PanelErrorBoundary>
    </div>
  );
}
