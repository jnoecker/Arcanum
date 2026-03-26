import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, NumberInput, TextInput, CheckboxInput } from "@/components/ui/FormWidgets";

export function ObservabilityPanel({ config, onChange }: ConfigPanelProps) {
  const o = config.observability;
  const patch = (p: Partial<AppConfig["observability"]>) =>
    onChange({ observability: { ...o, ...p } });

  return (
    <>
      <Section
        title="Prometheus metrics"
        description="Expose server metrics for monitoring dashboards. The metrics endpoint runs on a separate HTTP port."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Enabled" hint="Start the Prometheus metrics HTTP server alongside the game engine.">
            <CheckboxInput
              checked={o.metricsEnabled}
              onCommit={(v) => patch({ metricsEnabled: v })}
              label="Enable metrics"
            />
          </FieldRow>
          <FieldRow label="HTTP Port" hint="Port for the metrics endpoint. Default 9090. Prometheus scrapes this port.">
            <NumberInput
              value={o.metricsHttpPort}
              onCommit={(v) => patch({ metricsHttpPort: v ?? 9090 })}
              min={1}
              max={65535}
            />
          </FieldRow>
          <FieldRow label="Endpoint Path" hint="HTTP path where metrics are served. Standard is /metrics.">
            <TextInput
              value={o.metricsEndpoint}
              onCommit={(v) => patch({ metricsEndpoint: v || "/metrics" })}
              placeholder="/metrics"
            />
          </FieldRow>
        </div>
      </Section>
    </>
  );
}
