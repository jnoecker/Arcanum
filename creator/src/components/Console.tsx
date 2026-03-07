import { useEffect, useRef, useState, useCallback } from "react";
import { useServerStore, type LogEntry } from "@/stores/serverStore";

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: "text-text-muted",
  INFO: "text-status-info",
  WARN: "text-status-warning",
  ERROR: "text-status-error",
  STDOUT: "text-text-primary",
};

const LEVELS: LogEntry["level"][] = ["DEBUG", "INFO", "WARN", "ERROR", "STDOUT"];

export function Console() {
  const logs = useServerStore((s) => s.logs);
  const clearLogs = useServerStore((s) => s.clearLogs);
  const status = useServerStore((s) => s.status);

  const [filterLevels, setFilterLevels] = useState<Set<LogEntry["level"]>>(
    new Set(LEVELS),
  );
  const [searchText, setSearchText] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredLogs = logs.filter((log) => {
    if (!filterLevels.has(log.level)) return false;
    if (searchText && !log.text.toLowerCase().includes(searchText.toLowerCase()))
      return false;
    return true;
  });

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  }, []);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs.length, autoScroll]);

  const toggleLevel = (level: LogEntry["level"]) => {
    setFilterLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-1 flex-col bg-bg-primary">
      {/* Console toolbar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border-default bg-bg-secondary px-3 py-1.5">
        {/* Level filters */}
        <div className="flex items-center gap-1">
          {LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => toggleLevel(level)}
              className={`rounded px-2 py-0.5 text-xs transition-colors ${
                filterLevels.has(level)
                  ? "bg-bg-elevated text-text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {level}
            </button>
          ))}
        </div>

        <div className="mx-1 h-4 w-px bg-border-default" />

        {/* Search */}
        <input
          type="text"
          placeholder="Filter logs..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="rounded border border-border-default bg-bg-primary px-2 py-0.5 text-xs text-text-primary placeholder-text-muted outline-none focus:border-border-focus"
        />

        <div className="flex-1" />

        {/* Auto-scroll indicator */}
        {!autoScroll && (
          <button
            onClick={() => setAutoScroll(true)}
            className="text-xs text-accent hover:text-accent-emphasis"
          >
            Resume auto-scroll
          </button>
        )}

        <button
          onClick={clearLogs}
          className="text-xs text-text-muted hover:text-text-primary"
        >
          Clear
        </button>
      </div>

      {/* Log output */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 font-mono text-xs"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-text-muted">
            {status === "stopped"
              ? "Server is stopped. Click Start to begin."
              : "No matching log entries."}
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="flex gap-2 py-px leading-5">
              <span className="shrink-0 text-text-muted">
                {log.timestamp.toLocaleTimeString()}
              </span>
              <span className={`shrink-0 w-12 ${LEVEL_COLORS[log.level]}`}>
                {log.level}
              </span>
              <span className="whitespace-pre-wrap break-all text-text-primary">
                {log.text}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
