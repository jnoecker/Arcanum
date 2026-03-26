import { useState } from "react";
import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, NumberInput, TextInput, CheckboxInput } from "@/components/ui/FormWidgets";

export function AdminConfigPanel({ config, onChange }: ConfigPanelProps) {
  const a = config.admin;
  const patch = (p: Partial<AppConfig["admin"]>) =>
    onChange({ admin: { ...a, ...p } });
  const [showToken, setShowToken] = useState(false);

  return (
    <>
      <Section
        title="Admin API"
        description="The admin server lets the Arcanum monitor players, inspect zones, trigger hot reloads, and broadcast messages — all without restarting the server."
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
          <FieldRow label="Auth Token" hint="Required. Every API request must include this token via HTTP Basic Auth. Leave blank to block all access.">
            <div className="flex items-center gap-2">
              <TextInput
                value={a.token}
                onCommit={(v) => patch({ token: v })}
                placeholder="Set a secure token"
                type={showToken ? "text" : "text"}
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="shrink-0 text-2xs text-text-muted hover:text-text-primary"
              >
                {showToken ? "Hide" : "Show"}
              </button>
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
