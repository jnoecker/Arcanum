import { useState, useEffect } from "react";
import { useAdminStore } from "@/stores/adminStore";

/** Returns a human-readable relative time string, updating every 5 seconds. */
function useRelativeTime(date: Date | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!date) return;
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, [date]);

  if (!date) return "";
  const diffMs = now - date.getTime();
  const secs = Math.max(0, Math.floor(diffMs / 1000));
  if (secs < 10) return "just now";
  if (secs < 60) return `${Math.floor(secs / 5) * 5}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return date.toLocaleTimeString();
}

export function AdminOverviewPanel() {
  const overview = useAdminStore((s) => s.overview);
  const lastRefreshed = useAdminStore((s) => s.lastRefreshed);
  const relativeTime = useRelativeTime(lastRefreshed);

  if (!overview) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[22px] border border-dashed border-white/12 bg-white/4 px-6 py-12 text-center">
        <div className="h-2 w-2 rounded-full bg-server-starting motion-safe:animate-aurum-pulse" />
        <p className="text-sm text-text-muted">Reaching into the world...</p>
      </div>
    );
  }

  const hasPlayers = overview.playersOnline > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Hero stat — players online */}
      <div className={`relative overflow-hidden rounded-[28px] border p-6 shadow-section transition-colors duration-700 ${
        hasPlayers
          ? "border-accent/25 bg-gradient-to-br from-accent/8 via-bg-elevated/80 to-bg-secondary"
          : "border-white/10 bg-gradient-panel"
      }`}>
        {/* Aurum glow — breathes when souls are present */}
        {hasPlayers && (
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-accent/8 blur-[80px] motion-safe:animate-aurum-pulse" />
        )}

        <div className="relative flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide-ui text-text-muted">
              Souls in the world
            </p>
            <p className={`mt-1 font-display text-3xl tracking-wide ${
              hasPlayers ? "text-accent" : "text-text-muted"
            }`}>
              {overview.playersOnline}
            </p>
          </div>
          <div className="pb-1 text-right">
            <p className="text-sm text-text-secondary">
              {hasPlayers
                ? `${overview.playersOnline} player${overview.playersOnline !== 1 ? "s" : ""} across ${overview.zonesLoaded} zone${overview.zonesLoaded !== 1 ? "s" : ""}`
                : "The world awaits its visitors"}
            </p>
            {lastRefreshed && (
              <p className="mt-1 text-[11px] text-text-muted">Updated {relativeTime}</p>
            )}
          </div>
        </div>
      </div>

      {/* Supporting stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[22px] border border-white/10 bg-gradient-panel-light p-4 shadow-section-sm">
          <p className="text-[11px] uppercase tracking-wide-ui text-text-muted">Zones loaded</p>
          <p className="mt-1 font-display text-2xl text-text-primary">{overview.zonesLoaded}</p>
          <p className="mt-0.5 text-[11px] text-text-muted">{overview.roomsTotal} rooms</p>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-gradient-panel-light p-4 shadow-section-sm">
          <p className="text-[11px] uppercase tracking-wide-ui text-text-muted">Mobs alive</p>
          <p className="mt-1 font-display text-2xl text-text-primary">{overview.mobsAlive}</p>
          <p className="mt-0.5 text-[11px] text-text-muted">active creatures</p>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-gradient-panel-light p-4 shadow-section-sm">
          <p className="text-[11px] uppercase tracking-wide-ui text-text-muted">Rooms total</p>
          <p className="mt-1 font-display text-2xl text-text-primary">{overview.roomsTotal}</p>
          {overview.grafanaUrl && (
            <a
              href={overview.grafanaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-block text-[11px] text-text-link hover:underline"
            >
              Open Grafana
            </a>
          )}
          {!overview.grafanaUrl && (
            <p className="mt-0.5 text-[11px] text-text-muted">across all zones</p>
          )}
        </div>
      </div>
    </div>
  );
}
