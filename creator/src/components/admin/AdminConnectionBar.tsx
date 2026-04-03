import { useState } from "react";
import { useAdminStore } from "@/stores/adminStore";
import { useProjectStore } from "@/stores/projectStore";
import { Spinner } from "@/components/ui/FormWidgets";

const STATUS_STYLES: Record<string, string> = {
  disconnected: "bg-server-stopped",
  connecting: "bg-server-starting animate-aurum-pulse",
  connected: "bg-server-running animate-aurum-pulse",
  error: "bg-server-error animate-crimson-pulse",
};

export function AdminConnectionBar() {
  const url = useAdminStore((s) => s.url);
  const token = useAdminStore((s) => s.token);
  const connectionStatus = useAdminStore((s) => s.connectionStatus);
  const lastError = useAdminStore((s) => s.lastError);
  const setUrl = useAdminStore((s) => s.setUrl);
  const setToken = useAdminStore((s) => s.setToken);
  const connect = useAdminStore((s) => s.connect);
  const disconnect = useAdminStore((s) => s.disconnect);
  const saveConfig = useAdminStore((s) => s.saveConfig);
  const project = useProjectStore((s) => s.project);
  const [showToken, setShowToken] = useState(false);

  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";

  const handleConnect = async () => {
    await connect();
    // Save config on successful connect
    if (project && useAdminStore.getState().connectionStatus === "connected") {
      await saveConfig(project.mudDir);
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  return (
    <div className={`rounded-[22px] border p-4 shadow-section-sm transition-colors duration-500 ${
      isConnected
        ? "border-accent/20 bg-gradient-to-r from-accent/[0.05] via-bg-elevated/80 to-bg-elevated/80"
        : "border-white/10 bg-gradient-panel-light"
    }`}>
      <div className="flex items-center gap-3">
        <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_STYLES[connectionStatus]}`} />
        <span className={`text-[11px] uppercase tracking-wide-ui transition-colors duration-500 ${
          isConnected ? "text-accent" : "text-text-muted"
        }`}>
          {connectionStatus === "connected" ? "Link established" : connectionStatus === "connecting" ? "Reaching out..." : connectionStatus === "error" ? "Link failed" : "Awaiting connection"}
        </span>
        {lastError && connectionStatus === "error" && (
          <span className="min-w-0 truncate text-xs text-status-error" title={lastError}>{lastError}</span>
        )}
      </div>

      {/* Contextual help for error state */}
      {connectionStatus === "error" && (
        <p className="mt-2 text-[11px] leading-4 text-text-muted">
          Check that the server is running, the URL is correct, and <span className="font-mono text-stellar-blue">ambonmud.admin.enabled</span> is set to <span className="font-mono text-stellar-blue">true</span>.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="admin-url" className="mb-1 block text-[11px] uppercase tracking-ui text-text-muted">
            Admin URL
          </label>
          <input
            id="admin-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:9091"
            disabled={isConnected || isConnecting}
            className="h-9 w-full rounded-xl border border-white/10 bg-black/15 px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-border-active focus:outline-none focus-visible:ring-2 focus-visible:ring-border-active disabled:opacity-50"
          />
        </div>

        <div className="min-w-48 flex-[0.4]">
          <label htmlFor="admin-token" className="mb-1 block text-[11px] uppercase tracking-ui text-text-muted">
            Token
          </label>
          <div className="relative">
            <input
              id="admin-token"
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="admin token"
              disabled={isConnected || isConnecting}
              className="h-9 w-full rounded-xl border border-white/10 bg-black/15 px-3 pr-8 text-sm text-text-primary placeholder:text-text-muted focus:border-border-active focus:outline-none focus-visible:ring-2 focus-visible:ring-border-active disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-text-primary focus-visible:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-active"
              title={showToken ? "Hide token" : "Show token"}
              aria-label={showToken ? "Hide token" : "Show token"}
            >
              {showToken ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {isConnected ? (
          <button
            onClick={handleDisconnect}
            className="h-9 rounded-xl border border-white/10 bg-black/10 px-4 text-xs font-medium text-text-primary transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={isConnecting || !url || !token}
            className="h-9 rounded-xl border border-border-active bg-gradient-active-strong px-4 text-xs font-medium text-text-primary transition hover:-translate-y-0.5 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none"
          >
            {isConnecting ? <Spinner /> : "Connect"}
          </button>
        )}
      </div>
    </div>
  );
}
