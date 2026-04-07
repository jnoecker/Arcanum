import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, NumberInput, TextInput, CheckboxInput } from "@/components/ui/FormWidgets";

export function AdminConfigPanel({ config, onChange }: ConfigPanelProps) {
  const a = config.admin;
  const patch = (p: Partial<AppConfig["admin"]>) =>
    onChange({ admin: { ...a, ...p } });

  return (
    <>
      <Section
        title="Admin API"
        description="The admin server lets the Arcanum monitor players, inspect zones, trigger hot reloads, and broadcast messages without restarting the server."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Enabled" hint="Start the admin HTTP server alongside the game engine. Required for the Arcanum's Admin tab to connect.">
            <CheckboxInput
              checked={a.enabled}
              onCommit={(v) => patch({ enabled: v })}
              label="Enable admin server"
            />
          </FieldRow>
          <FieldRow label="Port" hint="HTTP port for the admin API. Default 9091 avoids conflicts with the game's web port.">
            <NumberInput
              value={a.port}
              onCommit={(v) => patch({ port: v ?? 9091 })}
              min={1}
              max={65535}
            />
          </FieldRow>
          <FieldRow label="Base Path" hint="URL path prefix for the admin API. Default /admin/. Useful for reverse proxies or custom routing.">
            <TextInput
              value={a.basePath}
              onCommit={(v) => patch({ basePath: v })}
              placeholder="/admin/"
            />
          </FieldRow>
          <FieldRow
            label="Auth Token"
            hint="Managed by the mud deployment layer. Arcanum writes a blank token to project YAML and expects the runtime token to come from SSM or environment variables."
          >
            <div className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-sm leading-6 text-text-secondary">
              Runtime-managed via <span className="font-mono text-stellar-blue">AMBONMUD_ADMIN_TOKEN</span>.
            </div>
          </FieldRow>
          <FieldRow label="Grafana URL" hint="Optional. If set, the admin dashboard will show a link to your Grafana board.">
            <TextInput
              value={a.grafanaUrl}
              onCommit={(v) => patch({ grafanaUrl: v })}
              placeholder="https://grafana.example.com/d/ambonmud"
            />
          </FieldRow>
        </div>
      </Section>
    </>
  );
}
