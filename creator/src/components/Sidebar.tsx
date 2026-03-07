import { useZoneStore } from "@/stores/zoneStore";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import type { Tab } from "@/types/project";

export function Sidebar() {
  const zones = useZoneStore((s) => s.zones);
  const configDirty = useConfigStore((s) => s.dirty);
  const openTab = useProjectStore((s) => s.openTab);
  const activeTabId = useProjectStore((s) => s.activeTabId);

  const sortedZones = [...zones.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <div className="flex h-full w-56 shrink-0 flex-col border-r border-border-default bg-bg-secondary">
      {/* Zones section */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Zones
          </h2>
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
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Config
          </h2>
          <ul className="flex flex-col gap-0.5">
            {(
              [
                { id: "config", kind: "config" as const, label: "Game Config" },
                { id: "classes", kind: "classes" as const, label: "Classes" },
                { id: "races", kind: "races" as const, label: "Races" },
              ] as Tab[]
            ).map((tab) => (
              <li key={tab.id}>
                <button
                  onClick={() => openTab(tab)}
                  className={`w-full rounded px-2 py-1 text-left text-sm transition-colors ${
                    activeTabId === tab.id
                      ? "bg-bg-hover text-text-primary"
                      : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  }`}
                >
                  {tab.label}
                  {tab.id === "config" && configDirty && (
                    <span className="ml-1 text-accent">*</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
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
    </div>
  );
}
