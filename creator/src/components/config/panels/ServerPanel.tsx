import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, NumberInput } from "@/components/ui/FormWidgets";

export function ServerPanel({ config, onChange }: ConfigPanelProps) {
  const s = config.server;
  const patch = (p: Partial<AppConfig["server"]>) =>
    onChange({ server: { ...s, ...p } });

  return (
    <>
      <Section
        title="Network"
        description="Ports the AmbonMUD server listens on. Telnet is for traditional MUD clients; the web port serves the browser-based client and REST API."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Telnet Port" hint="Classic MUD client connections. Standard MUD port is 4000. Use 23 for the well-known telnet port, though it may require elevated privileges.">
            <NumberInput
              value={s.telnetPort}
              onCommit={(v) => patch({ telnetPort: v ?? 4000 })}
              min={1}
              max={65535}
            />
          </FieldRow>
          <FieldRow label="Web Port" hint="HTTP port for the web client and API. Default 8080 avoids requiring admin privileges. Use 80 or 443 for production behind a reverse proxy.">
            <NumberInput
              value={s.webPort}
              onCommit={(v) => patch({ webPort: v ?? 8080 })}
              min={1}
              max={65535}
            />
          </FieldRow>
        </div>
      </Section>
      <Section
        title="Event loop"
        description="Internal channel sizes, tick rate, and inbound budget. These control how the server processes player commands and game events each tick."
      >
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Tick (ms)" hint="Game loop interval in milliseconds. Lower values make the world feel more responsive but cost more CPU. Default 100 ms = 10 ticks/sec.">
            <NumberInput
              value={s.tickMillis}
              onCommit={(v) => patch({ tickMillis: v ?? 100 })}
              min={10}
              max={5000}
            />
          </FieldRow>
          <FieldRow label="Inbound budget (ms)" hint="Max time per tick spent processing player commands before yielding to game logic. Prevents command floods from starving NPC AI and combat.">
            <NumberInput
              value={s.inboundBudgetMs}
              onCommit={(v) => patch({ inboundBudgetMs: v ?? 30 })}
              min={1}
              max={5000}
            />
          </FieldRow>
          <FieldRow label="Max inbound/tick" hint="Hard cap on how many player commands are processed per tick. Excess commands wait for the next tick.">
            <NumberInput
              value={s.maxInboundEventsPerTick}
              onCommit={(v) => patch({ maxInboundEventsPerTick: v ?? 1000 })}
              min={1}
              max={100000}
            />
          </FieldRow>
          <FieldRow label="Inbound channel" hint="Buffer size for incoming player commands. Increase for high-population servers.">
            <NumberInput
              value={s.inboundChannelCapacity}
              onCommit={(v) => patch({ inboundChannelCapacity: v ?? 10000 })}
              min={100}
              max={1000000}
            />
          </FieldRow>
          <FieldRow label="Outbound channel" hint="Buffer size for outgoing messages (room descriptions, combat output, etc.).">
            <NumberInput
              value={s.outboundChannelCapacity}
              onCommit={(v) => patch({ outboundChannelCapacity: v ?? 10000 })}
              min={100}
              max={1000000}
            />
          </FieldRow>
          <FieldRow label="Session queue" hint="Per-session outbound queue depth. If a single player's connection can't keep up, messages beyond this limit are dropped.">
            <NumberInput
              value={s.sessionOutboundQueueCapacity}
              onCommit={(v) => patch({ sessionOutboundQueueCapacity: v ?? 200 })}
              min={10}
              max={10000}
            />
          </FieldRow>
        </div>
      </Section>
    </>
  );
}
