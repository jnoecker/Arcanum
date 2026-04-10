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
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-default/40 bg-bg-secondary/60 px-6 py-12 text-center">
        <div className="h-2 w-2 rounded-full bg-server-starting motion-safe:animate-aurum-pulse" />
        <p className="text-sm text-text-muted">Reaching into the world...</p>
      </div>
    );
  }

  const hasPlayers = overview.playersOnline > 0;
  const plural = (n: number, word: string) => `${word}${n !== 1 ? "s" : ""}`;

  return (
    <div className="rounded-xl border border-border-default/60 bg-bg-secondary/80 px-6 py-5 shadow-section">
      {/* Header */}
      <h3 className="font-display text-sm uppercase tracking-widest text-text-muted">
        Scrying Report
      </h3>

      <div className="my-3 h-px bg-border-default/40" />

      {/* Narrative readout */}
      <div className="space-y-2 text-base leading-relaxed text-text-secondary">
        <p>
          {hasPlayers ? (
            <>
              <span className="font-display text-xl text-accent">{overview.playersOnline}</span>
              {" "}{plural(overview.playersOnline, "soul")} {overview.playersOnline === 1 ? "wanders" : "wander"} the realm across{" "}
              <span className="font-display text-xl text-accent">{overview.zonesLoaded}</span>
              {" "}{plural(overview.zonesLoaded, "zone")} with{" "}
              <span className="font-display text-xl text-accent">{overview.roomsTotal}</span>
              {" "}{plural(overview.roomsTotal, "chamber")} mapped.
            </>
          ) : (
            <>
              The world lies still. No souls walk its{" "}
              <span className="font-display text-xl text-accent">{overview.zonesLoaded}</span>
              {" "}{plural(overview.zonesLoaded, "zone")} or{" "}
              <span className="font-display text-xl text-accent">{overview.roomsTotal}</span>
              {" "}{plural(overview.roomsTotal, "chamber")}.
            </>
          )}
        </p>
        <p>
          <span className="font-display text-xl text-accent">{overview.mobsAlive}</span>
          {" "}{plural(overview.mobsAlive, "creature")} {overview.mobsAlive === 1 ? "stirs" : "stir"} in the shadows.
        </p>
      </div>

      {/* Conditions footer */}
      <div className="my-3 flex items-center gap-3 text-text-muted/60">
        <div className="h-px flex-1 bg-border-default/40" />
        <span className="font-display text-3xs uppercase tracking-widest">Current Conditions</span>
        <div className="h-px flex-1 bg-border-default/40" />
      </div>

      <div className="space-y-1 text-xs text-text-muted">
        {lastRefreshed && (
          <p>Last scrying: <span className="text-text-secondary">{relativeTime}</span></p>
        )}
        {overview.grafanaUrl && (
          <p>
            Deeper insight:{" "}
            <a
              href={overview.grafanaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-link hover:text-accent hover:underline"
            >
              Open Grafana
            </a>
          </p>
        )}
        {overview.metricsUrl && (
          <p>
            Raw metrics:{" "}
            <a
              href={overview.metricsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-link hover:text-accent hover:underline"
            >
              View Metrics
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
