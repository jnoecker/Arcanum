import { useState } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useServerStore } from "@/stores/serverStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useValidationStore } from "@/stores/validationStore";
import { useServerManager } from "@/lib/useServerManager";
import { saveAllZones } from "@/lib/saveZone";
import { validateAllZones } from "@/lib/validateZone";
import { ErrorDialog } from "./ErrorDialog";
import { ValidationPanel } from "./ValidationPanel";

const STATUS_COLORS: Record<string, string> = {
  stopped: "bg-server-stopped",
  starting: "bg-server-starting",
  running: "bg-server-running",
  stopping: "bg-server-starting",
  error: "bg-server-error",
};

const STATUS_LABELS: Record<string, string> = {
  stopped: "Stopped",
  starting: "Starting...",
  running: "Running",
  stopping: "Stopping...",
  error: "Error",
};

export function Toolbar() {
  const project = useProjectStore((s) => s.project);
  const status = useServerStore((s) => s.status);
  const dirtyCount = useZoneStore(
    (s) => Array.from(s.zones.values()).filter((z) => z.dirty).length,
  );
  const zones = useZoneStore((s) => s.zones);
  const setValidationResults = useValidationStore((s) => s.setResults);
  const openValidationPanel = useValidationStore((s) => s.openPanel);
  const { startServer, stopServer } = useServerManager();
  const [errors, setErrors] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  const handleStart = async () => {
    const result = await startServer();
    if (!result.success && result.preflightErrors) {
      setErrors(result.preflightErrors);
    }
  };

  const handleRestart = async () => {
    await stopServer();
    // Wait for the server to actually reach stopped/error state before restarting
    await new Promise<void>((resolve) => {
      const unsub = useServerStore.subscribe((state) => {
        if (state.status === "stopped" || state.status === "error") {
          unsub();
          resolve();
        }
      });
      // If already stopped (synchronous kill), resolve immediately
      const current = useServerStore.getState().status;
      if (current === "stopped" || current === "error") {
        unsub();
        resolve();
      }
    });
    await handleStart();
  };

  return (
    <div className="flex h-11 shrink-0 items-center gap-3 border-b border-border-default bg-bg-secondary px-4">
      {/* Project name */}
      <span className="text-sm font-medium text-text-primary">
        {project?.name ?? "AmbonMUD Creator"}
      </span>

      <div className="mx-2 h-4 w-px bg-border-default" />

      {/* Server controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleStart}
          disabled={status !== "stopped" && status !== "error"}
          className="rounded px-3 py-1 text-xs font-medium text-text-primary transition-colors enabled:bg-bg-elevated enabled:hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start
        </button>
        <button
          onClick={stopServer}
          disabled={status !== "running"}
          className="rounded px-3 py-1 text-xs font-medium text-text-primary transition-colors enabled:bg-bg-elevated enabled:hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Stop
        </button>
        <button
          onClick={handleRestart}
          disabled={status !== "running"}
          className="rounded px-3 py-1 text-xs font-medium text-text-primary transition-colors enabled:bg-bg-elevated enabled:hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Restart
        </button>
      </div>

      {/* Server status badge */}
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${STATUS_COLORS[status]}`} />
        <span className="text-xs text-text-secondary">
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="flex-1" />

      {/* Right side actions */}
      <button
        onClick={async () => {
          setSaving(true);
          try {
            await saveAllZones();
          } catch (err) {
            console.error("Save failed:", err);
          } finally {
            setSaving(false);
          }
        }}
        disabled={dirtyCount === 0 || saving}
        className="rounded px-3 py-1 text-xs font-medium transition-colors enabled:bg-bg-elevated enabled:text-text-primary enabled:hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? "Saving..." : dirtyCount > 0 ? `Save All (${dirtyCount})` : "Save All"}
      </button>
      <button
        onClick={() => {
          const results = validateAllZones(zones);
          setValidationResults(results);
          openValidationPanel();
        }}
        disabled={zones.size === 0}
        className="rounded px-3 py-1 text-xs font-medium transition-colors enabled:text-text-primary enabled:hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-40"
      >
        Validate
      </button>

      <ValidationPanel />

      {errors && (
        <ErrorDialog
          title="Pre-flight Check Failed"
          messages={errors}
          onClose={() => setErrors(null)}
        />
      )}
    </div>
  );
}
