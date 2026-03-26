import { useEffect } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useAdminStore, startAdminPolling, stopAdminPolling } from "@/stores/adminStore";
import type { AdminSubView } from "@/types/project";
import { AdminConnectionBar } from "./AdminConnectionBar";
import { AdminOverviewPanel } from "./AdminOverviewPanel";
import { AdminPlayerList } from "./AdminPlayerList";
import { AdminZoneList } from "./AdminZoneList";
import { AdminReloadPanel } from "./AdminReloadPanel";
import configBg from "@/assets/config-bg.png";

const ADMIN_VIEWS: Array<{ id: AdminSubView; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "players", label: "Players" },
  { id: "zones", label: "Zones" },
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
  }, [adminSubView, clearSelectedPlayer, clearSelectedZone]);

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
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      {/* Ambient background texture */}
      <div className="pointer-events-none sticky top-0 z-0 -mb-[100vh] h-[100vh] w-full overflow-hidden">
        <img
          src={configBg}
          alt=""
          className="h-full w-full object-cover opacity-[0.12]"
          style={{ objectPosition: "center 30%" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-bg-primary/60 via-transparent to-bg-primary/80" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-6">
        {/* Header */}
        <div>
          <p className="text-[11px] uppercase tracking-wide-ui text-text-muted">
            Server Admin
          </p>
          <h2 className="mt-2 font-display text-2xl text-text-primary">
            The Living World
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Observe and shape the running server from above.
          </p>
        </div>

        {/* Connection bar */}
        <AdminConnectionBar />

        {/* Sub-view selector */}
        <div className="flex gap-1 rounded-full border border-white/10 bg-black/20 p-1 backdrop-blur-sm">
          {ADMIN_VIEWS.map((view) => (
            <button
              key={view.id}
              onClick={() => setAdminSubView(view.id)}
              className={`rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none ${
                adminSubView === view.id
                  ? "bg-gradient-active-strong text-text-primary shadow-sm shadow-accent/10"
                  : "border border-transparent text-text-muted hover:border-white/8 hover:text-text-secondary"
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="pb-8">
          {!isConnected ? (
            <div className="flex flex-col items-center gap-6 rounded-[28px] border border-white/8 bg-gradient-panel px-8 py-16 text-center shadow-section">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-black/20">
                <div className="h-3 w-3 rounded-full bg-server-stopped" />
              </div>
              <div>
                <p className="font-display text-xl tracking-wide text-text-secondary">
                  No server connected
                </p>
                <p className="mt-2 max-w-md text-sm leading-6 text-text-muted">
                  Enter a server URL and admin token above to reach into the running world.
                </p>
              </div>

              {/* Setup guidance */}
              <div className="mt-2 grid max-w-lg gap-3 text-left">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-ui text-text-muted">1. Start the admin server</p>
                  <p className="mt-1 text-xs leading-5 text-text-secondary">
                    Set <span className="font-mono text-stellar-blue">ambonmud.admin.enabled: true</span> and
                    a <span className="font-mono text-stellar-blue">token</span> in your server config.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-ui text-text-muted">2. Connect from here</p>
                  <p className="mt-1 text-xs leading-5 text-text-secondary">
                    Enter the admin URL (default <span className="font-mono text-text-muted">http://localhost:9091</span>) and
                    the token you configured.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-ui text-text-muted">3. Observe and reshape</p>
                  <p className="mt-1 text-xs leading-5 text-text-secondary">
                    Monitor players, inspect zones, and hot-reload world data without restarting the server.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="motion-safe:animate-unfurl-in">
              {adminSubView === "overview" && <AdminOverviewPanel />}
              {adminSubView === "players" && <AdminPlayerList />}
              {adminSubView === "zones" && <AdminZoneList />}
              {adminSubView === "actions" && <AdminReloadPanel />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
