import { useRef, useState, useEffect, useCallback } from "react";
import { useZoneStore } from "@/stores/zoneStore";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import type { Tab, ConfigSubTab } from "@/types/project";
import { useGlobalSearch, ENTITY_TYPE_LABELS } from "@/lib/useGlobalSearch";
import { NewZoneDialog } from "./NewZoneDialog";

export function Sidebar() {
  const zones = useZoneStore((s) => s.zones);
  const configDirty = useConfigStore((s) => s.dirty);
  const openTab = useProjectStore((s) => s.openTab);
  const setConfigSubTab = useProjectStore((s) => s.setConfigSubTab);
  const activeTabId = useProjectStore((s) => s.activeTabId);

  const { query, setQuery, clearQuery, grouped, isSearching } =
    useGlobalSearch();
  const searchRef = useRef<HTMLInputElement>(null);
  const [showNewZone, setShowNewZone] = useState(false);
  const hasProject = !!useProjectStore((s) => s.project);

  // Ctrl+K to focus search
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        clearQuery();
        searchRef.current?.blur();
      }
    },
    [clearQuery],
  );

  const sortedZones = [...zones.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <div className="flex h-full w-56 shrink-0 flex-col border-r border-border-default bg-bg-secondary">
      {/* Search */}
      <div className="shrink-0 border-b border-border-default px-3 py-2">
        <div className="relative">
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search... (Ctrl+K)"
            className="h-7 w-full rounded border border-border-default bg-bg-primary px-2 pr-6 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
          />
          {query && (
            <button
              onClick={clearQuery}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-text-primary"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Zones section (or search results) */}
      <div className="flex-1 overflow-y-auto">
        {isSearching ? (
          <div className="px-3 py-2">
            {grouped.size === 0 ? (
              <p className="text-xs text-text-muted">No results</p>
            ) : (
              [...grouped.entries()].map(([zoneId, entries]) => (
                <div key={zoneId} className="mb-3">
                  <h3 className="mb-1 font-display text-xs text-text-muted">
                    {zoneId}
                  </h3>
                  <ul className="flex flex-col gap-0.5">
                    {entries.map((entry) => (
                      <li key={`${entry.entityType}:${entry.entityId}`}>
                        <button
                          onClick={() => {
                            const tab: Tab = {
                              id: `zone:${entry.zoneId}`,
                              kind: "zone",
                              label: entry.zoneId,
                            };
                            openTab(tab);
                            clearQuery();
                          }}
                          className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs transition-colors text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                        >
                          <span className="shrink-0 rounded bg-bg-elevated px-1 py-0.5 font-mono text-[10px] text-text-muted">
                            {ENTITY_TYPE_LABELS[entry.entityType]}
                          </span>
                          <span className="truncate">{entry.displayName}</span>
                          {entry.entityId !== entry.displayName && (
                            <span className="ml-auto shrink-0 text-[10px] text-text-muted">
                              {entry.entityId}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        ) : (
        <>
        <div className="px-3 py-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-xs uppercase tracking-widest text-text-muted">
              Zones
            </h2>
            {hasProject && (
              <button
                onClick={() => setShowNewZone(true)}
                className="rounded px-1.5 py-0.5 text-xs text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
                title="New Zone"
              >
                +
              </button>
            )}
          </div>
          {sortedZones.length === 0 ? (
            <p className="text-xs text-text-muted">No zones loaded</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {sortedZones.map(([zoneId, zoneState]) => {
                const tabId = `zone:${zoneId}`;
                const isActive = activeTabId === tabId;
                return (
                  <li key={zoneId}>
                    <button
                      onClick={() => {
                        const tab: Tab = {
                          id: tabId,
                          kind: "zone",
                          label: zoneId,
                        };
                        openTab(tab);
                      }}
                      className={`w-full rounded px-2 py-1 text-left text-sm transition-colors ${
                        isActive
                          ? "bg-bg-hover text-text-primary"
                          : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                      }`}
                    >
                      <span>{zoneId}</span>
                      {zoneState.dirty && (
                        <span className="ml-1 text-accent">*</span>
                      )}
                      <span className="ml-auto text-xs text-text-muted">
                        {" "}
                        {Object.keys(zoneState.data.rooms).length}r
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Config section */}
        <div className="px-3 py-2">
          <h2 className="mb-2 font-display text-xs uppercase tracking-widest text-text-muted">
            Config
          </h2>
          <ul className="flex flex-col gap-0.5">
            {(
              [
                { label: "Game Config", subTab: "server" as ConfigSubTab },
                { label: "Classes", subTab: "classes" as ConfigSubTab },
                { label: "Races", subTab: "races" as ConfigSubTab },
              ]
            ).map((entry) => (
              <li key={entry.subTab}>
                <button
                  onClick={() => {
                    setConfigSubTab(entry.subTab);
                    openTab({ id: "config", kind: "config", label: "Config" });
                  }}
                  className={`w-full rounded px-2 py-1 text-left text-sm transition-colors ${
                    activeTabId === "config"
                      ? "bg-bg-hover text-text-primary"
                      : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  }`}
                >
                  {entry.label}
                  {entry.subTab === "server" && configDirty && (
                    <span className="ml-1 text-accent">*</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
        </>
        )}
      </div>

      {/* Console shortcut at bottom */}
      <div className="border-t border-border-default px-3 py-2">
        <button
          onClick={() =>
            openTab({ id: "console", kind: "console", label: "Console" })
          }
          className={`w-full rounded px-2 py-1 text-left text-sm transition-colors ${
            activeTabId === "console"
              ? "bg-bg-hover text-text-primary"
              : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          }`}
        >
          Console
        </button>
      </div>

      {showNewZone && <NewZoneDialog onClose={() => setShowNewZone(false)} />}
    </div>
  );
}
