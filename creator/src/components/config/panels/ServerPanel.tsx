import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, NumberInput } from "@/components/ui/FormWidgets";

export function ServerPanel({ config, onChange }: ConfigPanelProps) {
  const s = config.server;
  const patch = (p: Partial<AppConfig["server"]>) =>
    onChange({ server: { ...s, ...p } });

  return (
    <>
      <Section title="Network">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Telnet Port">
            <NumberInput
              value={s.telnetPort}
              onCommit={(v) => patch({ telnetPort: v ?? 4000 })}
              min={1}
              max={65535}
            />
          </FieldRow>
          <FieldRow label="Web Port">
            <NumberInput
              value={s.webPort}
              onCommit={(v) => patch({ webPort: v ?? 8080 })}
              min={1}
              max={65535}
            />
          </FieldRow>
        </div>
      </Section>
    </>
  );
}
