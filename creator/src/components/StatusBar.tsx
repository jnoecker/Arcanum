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
    <div className="relative z-10 px-4 pb-4">
      <div className="flex min-h-12 items-center gap-4 rounded-[28px] border border-white/10 bg-[linear-gradient(155deg,rgba(50,60,88,0.84),rgba(38,47,71,0.9))] px-5 py-3 text-xs shadow-[0_12px_36px_rgba(8,10,18,0.22)]">
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

      <span className="rounded-full bg-black/10 px-3 py-1 text-text-muted capitalize">{status}</span>
      </div>
    </div>
  );
}
