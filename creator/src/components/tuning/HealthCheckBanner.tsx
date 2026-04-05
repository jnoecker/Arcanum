// ─── Health Check Banner ────────────────────────────────────────────
// Amber warning banner for post-apply health check results.
// Dismissible, non-blocking per D-08.

import { useTuningWizardStore } from "@/stores/tuningWizardStore";

export function HealthCheckBanner() {
  const healthWarnings = useTuningWizardStore((s) => s.healthWarnings);
  const setHealthWarnings = useTuningWizardStore((s) => s.setHealthWarnings);

  if (healthWarnings.length === 0) return null;

  return (
    <div className="mx-6 mt-4 rounded-lg border border-status-warning/30 bg-status-warning/[0.08] px-4 py-3 animate-unfurl-in">
      <div className="flex items-start gap-3">
        {/* Warning icon */}
        <span className="text-status-warning">&#9888;</span>
        {/* Warning content */}
        <div className="min-w-0 flex-1">
          <h4 className="font-sans text-sm font-semibold text-status-warning">
            Balance Warning
          </h4>
          {healthWarnings.map((w, i) => (
            <p key={i} className="mt-1 font-sans text-sm text-text-secondary">
              {w.message}
            </p>
          ))}
        </div>
        {/* Dismiss button */}
        <button
          type="button"
          onClick={() => setHealthWarnings([])}
          className="ml-auto shrink-0 text-text-muted hover:text-text-primary"
        >
          &#10005;
        </button>
      </div>
    </div>
  );
}
