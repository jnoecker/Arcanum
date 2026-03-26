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

  const dirtyZones = [...zones.values()].filter((z) => z.dirty).length;
  const totalZones = zones.size;
  const hasDirty = dirtyZones > 0 || configDirty;

  // Validation summary
  const allIssues = validationResults
    ? [...validationResults.values()].flat()
    : [];
  const errorCount = allIssues.filter((i) => i.severity === "error").length;
  const warningCount = allIssues.filter((i) => i.severity === "warning").length;

  return (
    <div className="relative z-10 shrink-0 px-4 pb-4">
      <div className="flex min-h-12 items-center gap-4 rounded-[28px] border border-white/10 bg-[linear-gradient(155deg,rgba(50,60,88,0.84),rgba(38,47,71,0.9))] px-5 py-3 text-xs shadow-bar">
      <span className="text-text-muted">
        {totalZones} zone{totalZones !== 1 ? "s" : ""} loaded
      </span>

      {/* Dirty indicator */}
      {hasDirty && (
        <span className="rounded-full bg-status-warning/12 px-2.5 py-0.5 text-status-warning">
          {dirtyZones > 0 && `${dirtyZones} zone${dirtyZones !== 1 ? "s" : ""} modified`}
          {dirtyZones > 0 && configDirty && " · "}
          {configDirty && "Config modified"}
        </span>
      )}

      {/* Validation summary */}
      {validationResults && (
        <button
          onClick={openValidationPanel}
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs transition-colors hover:brightness-125 ${
            errorCount > 0
              ? "bg-status-error/15 text-status-error"
              : warningCount > 0
                ? "bg-status-warning/12 text-status-warning"
                : "bg-status-success/12 text-status-success"
          }`}
          title="Open validation results"
        >
          {errorCount > 0 && (
            <span className={errorCount > 0 ? "animate-crimson-pulse" : ""}>
              {errorCount} error{errorCount !== 1 ? "s" : ""}
            </span>
          )}
          {errorCount > 0 && warningCount > 0 && (
            <span className="text-text-muted/60">·</span>
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

      {/* Admin connection error */}
      {adminStatus === "error" && lastError && (
        <span className="truncate text-status-error">{lastError}</span>
      )}

      <span className={`rounded-full px-3 py-1 ${
        adminStatus === "connected"
          ? "bg-server-running/15 text-server-running"
          : adminStatus === "error"
            ? "bg-server-error/15 text-server-error"
            : adminStatus === "connecting"
              ? "bg-server-starting/15 text-server-starting"
              : "bg-black/10 text-text-muted"
      }`}>{
        adminStatus === "connected" ? "Linked"
          : adminStatus === "connecting" ? "Reaching..."
          : adminStatus === "error" ? "Link lost"
          : "No link"
      }</span>
      </div>
    </div>
  );
}
