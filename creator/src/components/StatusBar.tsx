import { useAdminStore } from "@/stores/adminStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useConfigStore } from "@/stores/configStore";
import { useValidationStore } from "@/stores/validationStore";

export function StatusBar() {
  const adminStatus = useAdminStore((s) => s.connectionStatus);
  const lastError = useAdminStore((s) => s.lastError);
  const zones = useZoneStore((s) => s.zones);
  const configDirty = useConfigStore((s) => s.dirty);
  const validationResults = useValidationStore((s) => s.results);
  const openValidationPanel = useValidationStore((s) => s.openPanel);

  const dirtyZones = [...zones.values()].filter((zone) => zone.dirty).length;
  const totalZones = zones.size;
  const hasDirty = dirtyZones > 0 || configDirty;

  const allIssues = validationResults ? [...validationResults.values()].flat() : [];
  const errorCount = allIssues.filter((issue) => issue.severity === "error").length;
  const warningCount = allIssues.filter((issue) => issue.severity === "warning").length;

  return (
    <div className="relative z-10 shrink-0 px-4 pb-4">
      <div className="instrument-panel flex min-h-12 flex-wrap items-center gap-3 rounded-[28px] px-5 py-3 text-xs">
        <span className="text-[10px] uppercase tracking-wide-ui text-text-muted">
          World pulse
        </span>

        <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-text-secondary">
          {totalZones} zone{totalZones !== 1 ? "s" : ""} loaded
        </span>

        {hasDirty && (
          <span className="rounded-full border border-status-warning/20 bg-status-warning/12 px-3 py-1 text-status-warning">
            {dirtyZones > 0 && `${dirtyZones} zone${dirtyZones !== 1 ? "s" : ""} modified`}
            {dirtyZones > 0 && configDirty && " | "}
            {configDirty && "Config modified"}
          </span>
        )}

        {validationResults && (
          <button
            onClick={openValidationPanel}
            className={`focus-ring flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors hover:brightness-125 ${
              errorCount > 0
                ? "border border-status-error/20 bg-status-error/15 text-status-error"
                : warningCount > 0
                  ? "border border-status-warning/20 bg-status-warning/12 text-status-warning"
                  : "border border-status-success/20 bg-status-success/12 text-status-success"
            }`}
            title="Open validation results"
          >
            {errorCount > 0 && (
              <span className="animate-crimson-pulse">
                {errorCount} error{errorCount !== 1 ? "s" : ""}
              </span>
            )}
            {errorCount > 0 && warningCount > 0 && (
              <span className="text-text-muted/60">|</span>
            )}
            {warningCount > 0 && (
              <span>
                {warningCount} warning{warningCount !== 1 ? "s" : ""}
              </span>
            )}
            {errorCount === 0 && warningCount === 0 && (
              <span>&#x2713; valid</span>
            )}
          </button>
        )}

        <div className="flex-1" />

        {adminStatus === "error" && lastError && (
          <span className="truncate text-status-error">{lastError}</span>
        )}

        <span
          className={`rounded-full border px-3 py-1 ${
            adminStatus === "connected"
              ? "border-server-running/20 bg-server-running/15 text-server-running"
              : adminStatus === "error"
                ? "border-server-error/20 bg-server-error/15 text-server-error"
                : adminStatus === "connecting"
                  ? "border-server-starting/20 bg-server-starting/15 text-server-starting"
                  : "border-white/10 bg-black/10 text-text-muted"
          }`}
        >
          {adminStatus === "connected"
            ? "Linked"
            : adminStatus === "connecting"
              ? "Reaching..."
              : adminStatus === "error"
                ? "Link lost"
                : "No link"}
        </span>
      </div>
    </div>
  );
}
