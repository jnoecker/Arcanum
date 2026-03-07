import { useProjectStore } from "@/stores/projectStore";
import { useServerStore } from "@/stores/serverStore";
import { useServerManager } from "@/lib/useServerManager";

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
  const { startServer, stopServer } = useServerManager();

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
          onClick={startServer}
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
          onClick={async () => {
            await stopServer();
            // Small delay before restart
            setTimeout(startServer, 500);
          }}
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
      <button className="rounded px-3 py-1 text-xs font-medium text-text-primary transition-colors hover:bg-bg-elevated">
        Save All
      </button>
      <button className="rounded px-3 py-1 text-xs font-medium text-text-primary transition-colors hover:bg-bg-elevated">
        Validate
      </button>
    </div>
  );
}
