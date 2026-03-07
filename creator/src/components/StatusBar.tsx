import { useServerStore } from "@/stores/serverStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useConfigStore } from "@/stores/configStore";

export function StatusBar() {
  const status = useServerStore((s) => s.status);
  const lastError = useServerStore((s) => s.lastError);
  const zones = useZoneStore((s) => s.zones);
  const configDirty = useConfigStore((s) => s.dirty);

  const dirtyZones = [...zones.values()].filter((z) => z.dirty).length;
  const totalZones = zones.size;
  const hasDirty = dirtyZones > 0 || configDirty;

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
