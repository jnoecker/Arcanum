import { useRef, useState } from "react";
import type { AppConfig } from "@/types/config";
import { Section } from "@/components/ui/FormWidgets";
import { ServerPanel } from "./panels/ServerPanel";
import { AdminConfigPanel } from "./panels/AdminConfigPanel";
import { ObservabilityPanel } from "./panels/ObservabilityPanel";
import { LoggingPanel } from "./panels/LoggingPanel";

interface Props {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}

type TabId = "ports" | "admin" | "observability";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "ports", label: "Ports & Server" },
  { id: "admin", label: "Admin API" },
  { id: "observability", label: "Metrics & Logging" },
];

/**
 * Spire → Server Config. Three-tab layout matching the Achievements / Quests
 * pattern. Reuses the existing ServerPanel / AdminConfigPanel / Observability
 * / Logging panels as tab bodies.
 */
export function ServerConfigStudio({ config, onChange }: Props) {
  const [active, setActive] = useState<TabId>("ports");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div
          className="segmented-control"
          role="tablist"
          aria-label="Server config views"
        >
          {TABS.map((tab, index) => (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              role="tab"
              aria-selected={active === tab.id}
              aria-controls={`server-tab-${tab.id}`}
              tabIndex={active === tab.id ? 0 : -1}
              onClick={() => setActive(tab.id)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  const next = (index + 1) % TABS.length;
                  setActive(TABS[next]!.id);
                  tabRefs.current[next]?.focus();
                } else if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  const next = (index - 1 + TABS.length) % TABS.length;
                  setActive(TABS[next]!.id);
                  tabRefs.current[next]?.focus();
                }
              }}
              className="segmented-button focus-ring px-4 py-2 text-xs font-medium"
              data-active={active === tab.id}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div
        id={`server-tab-${active}`}
        role="tabpanel"
        aria-labelledby={`server-tab-${active}`}
      >
        {active === "ports" && (
          <Section
            title="Ports & Server"
            description="Network ports and server process behavior."
          >
            <ServerPanel config={config} onChange={onChange} />
          </Section>
        )}

        {active === "admin" && (
          <Section
            title="Admin API"
            description="HTTP endpoint Arcanum uses to read live world state. Set a token to authenticate the connection."
          >
            <AdminConfigPanel config={config} onChange={onChange} />
          </Section>
        )}

        {active === "observability" && (
          <div className="flex flex-col gap-5">
            <Section
              title="Metrics"
              description="Prometheus metrics endpoint for server health and performance data."
            >
              <ObservabilityPanel config={config} onChange={onChange} />
            </Section>
            <Section
              title="Logging"
              description="Server log verbosity. Per-package overrides let you debug specific systems without flooding the console."
            >
              <LoggingPanel config={config} onChange={onChange} />
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
