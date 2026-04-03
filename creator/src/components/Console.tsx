import { useEffect, useRef, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAdminStore } from "@/stores/adminStore";

interface LogEntry {
  timestamp: string;
  epochMs: number;
  level: string;
  logger: string;
  message: string;
  thread: string;
}

const LEVELS = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR"] as const;

const LEVEL_COLORS: Record<string, string> = {
  TRACE: "text-text-muted",
  DEBUG: "text-text-muted",
  INFO: "text-status-info",
  WARN: "text-status-warning",
  ERROR: "text-status-error",
};

const LOGGER_PRESETS = [
  { value: "", label: "All" },
  { value: "dev.ambon.engine", label: "Engine" },
  { value: "dev.ambon.transport", label: "Transport" },
  { value: "dev.ambon.admin", label: "Admin" },
  { value: "dev.ambon.persistence", label: "Persistence" },
  { value: "dev.ambon.bus", label: "Bus" },
  { value: "dev.ambon.grpc", label: "gRPC" },
];

const POLL_MS = 3000;

export function Console() {
  const url = useAdminStore((s) => s.url);
  const token = useAdminStore((s) => s.token);
  const connectionStatus = useAdminStore((s) => s.connectionStatus);
  const connected = connectionStatus === "connected";

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [minLevel, setMinLevel] = useState("INFO");
  const [loggerFilter, setLoggerFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sinceRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!url || !token) return;
    try {
      const entries = await invoke<LogEntry[]>("admin_logs", {
        url,
        token,
        since: sinceRef.current,
        level: minLevel !== "TRACE" ? minLevel : null,
        logger: loggerFilter || null,
        limit: sinceRef.current ? 500 : 1000,
      });
      if (entries.length > 0) {
        sinceRef.current = entries[entries.length - 1]!.epochMs + 1;
        setLogs((prev) => {
          const combined = [...prev, ...entries];
          // Keep last 5000 entries to avoid unbounded memory growth
          return combined.length > 5000 ? combined.slice(-5000) : combined;
        });
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [url, token, minLevel, loggerFilter]);

  // Start/stop polling
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (!connected || !polling) return;

    // Reset and do initial fetch
    sinceRef.current = null;
    setLogs([]);
    fetchLogs();
    pollRef.current = setInterval(fetchLogs, POLL_MS);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [connected, polling, fetchLogs]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
  }, []);

  const filteredLogs = searchText
    ? logs.filter(
        (log) =>
          log.message.toLowerCase().includes(searchText.toLowerCase()) ||
          log.logger.toLowerCase().includes(searchText.toLowerCase()),
      )
    : logs;

  // Short logger name for display (last 2 segments)
  const shortLogger = (logger: string) => {
    const parts = logger.split(".");
    return parts.length > 2 ? parts.slice(-2).join(".") : logger;
  };

  if (!connected) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-text-muted">
        <div className="text-center">
          <p className="font-display text-lg">Not connected</p>
          <p className="mt-1 text-sm">
            Connect to the admin server from the Admin panel to view logs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg-primary">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border-default bg-bg-secondary px-3 py-1.5">
        {/* Play/Pause */}
        <button
          onClick={() => setPolling(!polling)}
          className={`rounded-lg border px-3 py-1 text-xs font-medium transition ${
            polling
              ? "border-status-error/30 bg-status-error/10 text-status-error"
              : "border-accent/30 bg-accent/10 text-accent"
          }`}
        >
          {polling ? "Pause" : "Stream"}
        </button>

        <div className="mx-0.5 h-4 w-px bg-border-default" />

        {/* Level filter */}
        <select
          value={minLevel}
          onChange={(e) => {
            setMinLevel(e.target.value);
            if (polling) {
              sinceRef.current = null;
              setLogs([]);
            }
          }}
          className="rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
        >
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}+
            </option>
          ))}
        </select>

        {/* Logger filter */}
        <select
          value={loggerFilter}
          onChange={(e) => {
            setLoggerFilter(e.target.value);
            if (polling) {
              sinceRef.current = null;
              setLogs([]);
            }
          }}
          className="rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-active"
        >
          {LOGGER_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        <div className="mx-0.5 h-4 w-px bg-border-default" />

        {/* Search */}
        <input
          type="text"
          placeholder="Search logs..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-40 rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-border-focus focus-visible:ring-2 focus-visible:ring-border-active"
        />

        <div className="flex-1" />

        {error && (
          <span className="text-xs text-status-error" title={error}>
            Poll error
          </span>
        )}

        {!autoScroll && (
          <button
            onClick={() => setAutoScroll(true)}
            className="text-xs text-accent hover:text-accent-emphasis"
          >
            Resume scroll
          </button>
        )}

        <span className="text-xs text-text-muted">
          {logs.length} entries
        </span>

        <button
          onClick={() => {
            setLogs([]);
            sinceRef.current = null;
          }}
          className="text-xs text-text-muted hover:text-text-primary"
        >
          Clear
        </button>
      </div>

      {/* Log output */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 font-mono text-xs leading-5"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-text-muted">
            {!polling
              ? "Click Stream to begin tailing server logs."
              : "Waiting for log entries..."}
          </div>
        ) : (
          filteredLogs.map((log, i) => (
            <div key={`${log.epochMs}-${i}`} className="flex gap-2 py-px">
              <span className="shrink-0 text-text-muted">
                {log.timestamp.slice(11, 23)}
              </span>
              <span
                className={`w-12 shrink-0 text-right ${LEVEL_COLORS[log.level] ?? "text-text-primary"}`}
              >
                {log.level}
              </span>
              <span className="w-28 shrink-0 truncate text-text-secondary" title={log.logger}>
                {shortLogger(log.logger)}
              </span>
              <span className="whitespace-pre-wrap break-all text-text-primary">
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
