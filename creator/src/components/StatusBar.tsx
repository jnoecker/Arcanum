import { useServerStore } from "@/stores/serverStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useConfigStore } from "@/stores/configStore";
import { useValidationStore } from "@/stores/validationStore";

export function StatusBar() {
  const status = useServerStore((s) => s.status);
  const lastError = useServerStore((s) => s.lastError);
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
    <div className="flex h-6 shrink-0 items-center gap-4 border-t border-border-default bg-bg-secondary px-3 text-xs">
      {/* Zone count */}
      <span className="text-text-muted">
        {totalZones} zone{totalZones !== 1 ? "s" : ""} loaded
      </span>

      {/* Dirty indicator */}
      {hasDirty && (
        <span className="text-status-warning">
          {dirtyZones > 0 && `${dirtyZones} zone${dirtyZones !== 1 ? "s" : ""} modified`}
          {dirtyZones > 0 && configDirty && " | "}
          {configDirty && "Config modified"}
        </span>
      )}

      {/* Validation summary */}
      {validationResults && (
        <button
          onClick={openValidationPanel}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-bg-elevated"
          title="Open validation results"
        >
          {errorCount > 0 && (
            <span className="text-status-error">
              {errorCount} error{errorCount !== 1 ? "s" : ""}
            </span>
          )}
          {errorCount > 0 && warningCount > 0 && (
            <span className="text-text-muted">/</span>
          )}
          {warningCount > 0 && (
            <span className="text-status-warning">
              {warningCount} warning{warningCount !== 1 ? "s" : ""}
            </span>
          )}
          {errorCount === 0 && warningCount === 0 && (
            <span className="text-status-success">&#x2713; valid</span>
          )}
        </button>
      )}

      <div className="flex-1" />

      {/* Server error */}
      {status === "error" && lastError && (
        <span className="truncate text-status-error">{lastError}</span>
      )}

      {/* Server status */}
      <span className="text-text-muted capitalize">{status}</span>
    </div>
  );
}
