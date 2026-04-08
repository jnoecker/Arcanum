import { useEffect, lazy, Suspense, useRef } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useAdminStore, startAdminPolling, stopAdminPolling } from "@/stores/adminStore";
import type { AdminSubView } from "@/types/project";
import { AdminConnectionBar } from "./AdminConnectionBar";
import { AdminOverviewPanel } from "./AdminOverviewPanel";
import { AdminPlayerList } from "./AdminPlayerList";
import configBg from "@/assets/config-bg.png";

const AdminWorldPanel = lazy(() => import("./AdminWorldPanel").then(m => ({ default: m.AdminWorldPanel })));
const AdminContentPanel = lazy(() => import("./AdminContentPanel").then(m => ({ default: m.AdminContentPanel })));
const AdminActionsPanel = lazy(() => import("./AdminActionsPanel").then(m => ({ default: m.AdminActionsPanel })));

const ADMIN_VIEWS: Array<{ id: AdminSubView; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "players", label: "Players" },
  { id: "world", label: "World" },
  { id: "content", label: "Content" },
  { id: "actions", label: "Actions" },
];

export function AdminDashboard() {
  const project = useProjectStore((s) => s.project);
  const adminSubView = useProjectStore((s) => s.adminSubView);
  const setAdminSubView = useProjectStore((s) => s.setAdminSubView);
  const activeTabId = useProjectStore((s) => s.activeTabId);
  const connectionStatus = useAdminStore((s) => s.connectionStatus);
  const loadConfig = useAdminStore((s) => s.loadConfig);
  const clearSelectedPlayer = useAdminStore((s) => s.clearSelectedPlayer);
  const clearSelectedZone = useAdminStore((s) => s.clearSelectedZone);
  const clearSelectedRoom = useAdminStore((s) => s.clearSelectedRoom);
  const clearSelectedMob = useAdminStore((s) => s.clearSelectedMob);
  const clearSelectedAbility = useAdminStore((s) => s.clearSelectedAbility);
  const clearSelectedEffect = useAdminStore((s) => s.clearSelectedEffect);
  const clearSelectedQuest = useAdminStore((s) => s.clearSelectedQuest);
  const clearSelectedAchievement = useAdminStore((s) => s.clearSelectedAchievement);
  const clearPlayerSearch = useAdminStore((s) => s.clearPlayerSearch);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Load saved admin config when the dashboard mounts
  useEffect(() => {
    if (project) {
      loadConfig(project.mudDir);
    }
  }, [project, loadConfig]);

  // Clear stale detail selections when switching sub-views
  useEffect(() => {
    clearSelectedPlayer();
    clearSelectedZone();
    clearSelectedRoom();
    clearSelectedMob();
    clearSelectedAbility();
    clearSelectedEffect();
    clearSelectedQuest();
    clearSelectedAchievement();
    clearPlayerSearch();
  }, [adminSubView, clearSelectedPlayer, clearSelectedZone, clearSelectedRoom, clearSelectedMob, clearSelectedAbility, clearSelectedEffect, clearSelectedQuest, clearSelectedAchievement, clearPlayerSearch]);

  // Manage polling — only poll when admin tab is active and connected
  const isAdminTabActive = activeTabId === "admin";
  useEffect(() => {
    if (connectionStatus === "connected" && isAdminTabActive) {
      startAdminPolling(adminSubView);
    } else {
      stopAdminPolling();
    }
    return () => stopAdminPolling();
  }, [connectionStatus, adminSubView, isAdminTabActive]);

  const isConnected = connectionStatus === "connected";

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Ambient background texture */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <img
          src={configBg}
          alt=""
          className="h-full w-full object-cover opacity-[0.12]"
          style={{ objectPosition: "center 30%" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-bg-primary/60 via-transparent to-bg-primary/80" />
      </div>

      {/* Fixed header area — always visible */}
      <div className="relative z-10 shrink-0 mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 pt-6 pb-2">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xs uppercase tracking-wide-ui text-text-muted">
              Server Admin
            </p>
            <h2 className="mt-1 font-display text-2xl text-text-primary">
              The Living World
            </h2>
          </div>
          <p className="text-sm text-text-secondary">
            Observe and shape the running server from above.
          </p>
        </div>

        {/* Connection bar */}
        <AdminConnectionBar />

        {/* Sub-view selector */}
        <div className="segmented-control" role="tablist" aria-label="Admin views">
          {ADMIN_VIEWS.map((view, index) => (
            <button
              key={view.id}
              id={`admin-tab-${view.id}`}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              role="tab"
              aria-selected={adminSubView === view.id}
              aria-controls="admin-panel"
              tabIndex={adminSubView === view.id ? 0 : -1}
              onClick={() => setAdminSubView(view.id)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  const nextIndex = (index + 1) % ADMIN_VIEWS.length;
                  setAdminSubView(ADMIN_VIEWS[nextIndex]!.id);
                  tabRefs.current[nextIndex]?.focus();
                } else if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  const nextIndex = (index - 1 + ADMIN_VIEWS.length) % ADMIN_VIEWS.length;
                  setAdminSubView(ADMIN_VIEWS[nextIndex]!.id);
                  tabRefs.current[nextIndex]?.focus();
                } else if (event.key === "Home") {
                  event.preventDefault();
                  setAdminSubView(ADMIN_VIEWS[0]!.id);
                  tabRefs.current[0]?.focus();
                } else if (event.key === "End") {
                  event.preventDefault();
                  setAdminSubView(ADMIN_VIEWS[ADMIN_VIEWS.length - 1]!.id);
                  tabRefs.current[ADMIN_VIEWS.length - 1]?.focus();
                }
              }}
              className="segmented-button focus-ring px-4 py-2 text-xs font-medium"
              data-active={adminSubView === view.id}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">
        <div id="admin-panel" role="tabpanel" aria-labelledby={`admin-tab-${adminSubView}`} className="mx-auto w-full max-w-5xl px-6 py-4 pb-8">
          {!isConnected ? (
            <div className="flex flex-col items-center gap-6 rounded-3xl border border-[var(--chrome-stroke)] bg-gradient-panel px-8 py-16 text-center shadow-section">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-strong)]">
                <div className="h-3 w-3 rounded-full bg-server-stopped" />
              </div>
              <div>
                <p className="font-display text-xl tracking-wide text-text-secondary">
                  No server connected
                </p>
                <p className="mt-2 max-w-md text-sm leading-6 text-text-muted">
                  Enter the server URL and admin token above to reach into the running world.
                </p>
              </div>

              {/* Setup guidance */}
              <div className="mt-2 grid max-w-lg gap-3 text-left">
                <div className="rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] px-4 py-3">
                  <p className="text-2xs uppercase tracking-ui text-text-muted">1. Start the admin server</p>
                  <p className="mt-1 text-xs leading-5 text-text-secondary">
                    Set <span className="font-mono text-stellar-blue">ambonmud.admin.enabled: true</span> and
                    a <span className="font-mono text-stellar-blue">token</span> in your server config.
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] px-4 py-3">
                  <p className="text-2xs uppercase tracking-ui text-text-muted">2. Connect from here</p>
                  <p className="mt-1 text-xs leading-5 text-text-secondary">
                    Enter the admin URL (default <span className="font-mono text-text-muted">http://localhost:9091</span>) and
                    the token you configured.
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] px-4 py-3">
                  <p className="text-2xs uppercase tracking-ui text-text-muted">3. Observe and reshape</p>
                  <p className="mt-1 text-xs leading-5 text-text-secondary">
                    Monitor players, inspect zones, and hot-reload world data without restarting the server.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="motion-safe:animate-unfurl-in">
              <Suspense fallback={<div className="py-12 text-center text-sm text-text-muted">Opening the selected runtime lens...</div>}>
                {adminSubView === "overview" && <AdminOverviewPanel />}
                {adminSubView === "players" && <AdminPlayerList />}
                {adminSubView === "world" && <AdminWorldPanel />}
                {adminSubView === "content" && <AdminContentPanel />}
                {adminSubView === "actions" && <AdminActionsPanel />}
              </Suspense>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
