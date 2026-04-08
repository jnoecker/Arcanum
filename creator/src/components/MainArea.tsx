import { lazy, Suspense, Component, type ReactNode, type ErrorInfo } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { PANEL_MAP, panelTab, type Workspace } from "@/lib/panelRegistry";
import { StudioWorkspace } from "./StudioWorkspace";

class PanelErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Panel crash:", error, info.componentStack); }
  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8">
          <h2 className="font-display text-lg text-status-error">Panel Crashed</h2>
          <pre className="max-w-2xl overflow-auto rounded-lg border border-status-error/30 bg-black/30 p-4 text-xs text-text-secondary">
            {this.state.error.message}{"\n"}{this.state.error.stack}
          </pre>
          <button onClick={() => this.setState({ error: null })} className="rounded-full border border-white/10 px-4 py-2 text-xs text-accent hover:bg-accent/10">
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

export function MainArea({ workspace }: { workspace: Workspace }) {
  const tabs = useProjectStore((s) => s.tabs);
  const activeTabId = useProjectStore((s) => s.activeTabId);
  const openTab = useProjectStore((s) => s.openTab);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeTabIndex = tabs.findIndex((t) => t.id === activeTabId);

  if (!activeTab) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-8">
        <div className="panel-surface max-w-2xl rounded-3xl px-8 py-10 text-center">
          <div className="ornate-divider mb-3" />
          <p className="text-3xs uppercase tracking-wide-ui text-text-muted">
            {workspace === "worldmaker" ? "Awaiting a surface" : "Awaiting a canon task"}
          </p>
          <h2 className="mt-3 font-display text-3xl text-text-primary">
            {workspace === "worldmaker" ? "Open a surface" : "Open a surface"}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-text-secondary">
            {workspace === "worldmaker"
              ? "Choose a zone, open the art studio, or tune the systems that shape this world."
              : "Start with the world setting, build the codex, or chart the maps."}
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
      aria-label={activeTab.label}
      aria-labelledby={activeTabIndex >= 0 ? `workspace-tab-${activeTabIndex}` : undefined}
      className="flex min-h-0 flex-1 flex-col"
    >
      <PanelErrorBoundary>
        <Suspense fallback={<LazyFallback />}>
          {content}
        </Suspense>
      </PanelErrorBoundary>
    </div>
  );
}
