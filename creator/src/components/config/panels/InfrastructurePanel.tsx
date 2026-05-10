import type { ReactNode } from "react";
import type { ConfigPanelProps, AppConfig } from "./types";
import { FieldRow, NumberInput, TextInput, CheckboxInput } from "@/components/ui/FormWidgets";
import { OrnateCard } from "@/components/ui/OrnateCard";

type Mode = AppConfig["mode"];

// ─── Mode picker hero ──────────────────────────────────────────────

interface ModeOption {
  value: Mode;
  title: string;
  description: string;
  meta: string;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    value: "STANDALONE",
    title: "Standalone",
    description: "Single process. Everything in one place. What most worlds want.",
    meta: "Persistence · Login · Transport",
  },
  {
    value: "ENGINE",
    title: "Engine",
    description: "Game logic only. Pairs with one or more Gateways for player connections.",
    meta: "+ Sharding · gRPC server",
  },
  {
    value: "GATEWAY",
    title: "Gateway",
    description: "Player connections only. Routes traffic to a remote Engine over gRPC.",
    meta: "+ gRPC client · Gateway routing",
  },
];

function ModePicker({ mode, onSelect }: { mode: Mode; onSelect: (m: Mode) => void }) {
  return (
    <section aria-labelledby="infra-mode-label" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p
          id="infra-mode-label"
          className="font-display text-2xs font-semibold uppercase tracking-[0.22em] text-text-muted"
        >
          Deployment Mode
        </p>
        <span aria-hidden="true" className="text-text-muted/40">·</span>
        <p className="text-2xs leading-snug text-text-muted/70">
          The architectural choice that gates everything below.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {MODE_OPTIONS.map((opt) => {
          const selected = mode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(opt.value)}
              className={
                "focus-ring group relative flex flex-col gap-2 rounded-2xl border p-4 text-left transition " +
                (selected
                  ? "selected-card"
                  : "border-[var(--chrome-stroke)] bg-gradient-panel-light hover:border-[var(--chrome-stroke-emphasis)]")
              }
            >
              <p
                className={
                  "font-display text-2xs font-semibold uppercase tracking-[0.22em] " +
                  (selected ? "text-accent" : "text-text-muted")
                }
              >
                Mode
              </p>
              <h3 className="font-display text-base font-semibold tracking-wide text-text-primary">
                {opt.title}
              </h3>
              <p className="text-2xs leading-relaxed text-text-secondary">
                {opt.description}
              </p>
              <p className="mt-auto pt-1 font-display text-2xs uppercase tracking-[0.18em] text-text-muted/70">
                {opt.meta}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────

function SubLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-display text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted">
      {children}
    </p>
  );
}

function DimPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-2 py-0.5 font-display text-2xs uppercase tracking-[0.18em] text-text-muted/70">
      {children}
    </span>
  );
}

/**
 * Wraps an OrnateCard body in a dimmed "inactive" treatment when the
 * surrounding mode/config doesn't apply. Card stays visible for
 * discoverability — pointer events are blocked but it can be focused
 * past with the keyboard.
 */
function DimWrap({ dimmed, children }: { dimmed: boolean; children: ReactNode }) {
  if (!dimmed) return <>{children}</>;
  return (
    <div className="opacity-50 pointer-events-none" aria-hidden="true">
      {children}
    </div>
  );
}

// ─── Card content blocks ───────────────────────────────────────────

function PersistenceBody({ config, onChange }: ConfigPanelProps) {
  const p = config.persistence;
  const patch = (v: Partial<AppConfig["persistence"]>) =>
    onChange({ persistence: { ...p, ...v } });

  return (
    <div className="flex flex-col gap-1.5">
      <FieldRow label="Backend" hint="YAML = flat files (no database). POSTGRES = relational database (configure below).">
        <select
          className="ornate-input min-h-9 w-full px-2 py-1 text-xs text-text-primary"
          value={p.backend}
          onChange={(e) => patch({ backend: e.target.value as AppConfig["persistence"]["backend"] })}
        >
          <option value="YAML">YAML (flat files)</option>
          <option value="POSTGRES">PostgreSQL</option>
        </select>
      </FieldRow>
      <FieldRow label="Root directory" hint="Where YAML player files are stored on disk.">
        <TextInput
          value={p.rootDir}
          onCommit={(v) => patch({ rootDir: v || "data/players" })}
          dense
        />
      </FieldRow>
      <FieldRow label="Worker enabled" hint="Background worker that flushes dirty player data.">
        <CheckboxInput
          checked={p.worker.enabled}
          onCommit={(v) => patch({ worker: { ...p.worker, enabled: v } })}
          label="Flush worker active"
        />
      </FieldRow>
      <FieldRow label="Flush interval (ms)" hint="Lower = more durable, more I/O.">
        <NumberInput
          value={p.worker.flushIntervalMs}
          onCommit={(v) => patch({ worker: { ...p.worker, flushIntervalMs: v ?? 5000 } })}
          min={500}
          max={60000}
          dense
        />
      </FieldRow>
    </div>
  );
}

function LoginBody({ config, onChange }: ConfigPanelProps) {
  const l = config.login;
  const patch = (v: Partial<AppConfig["login"]>) =>
    onChange({ login: { ...l, ...v } });

  return (
    <div className="flex flex-col gap-1.5">
      <FieldRow label="Max wrong passwords" hint="Wrong attempts before the session locks.">
        <NumberInput
          value={l.maxWrongPasswordRetries}
          onCommit={(v) => patch({ maxWrongPasswordRetries: v ?? 3 })}
          min={1}
          max={100}
          dense
        />
      </FieldRow>
      <FieldRow label="Max failed attempts" hint="Total failures before connection drops.">
        <NumberInput
          value={l.maxFailedAttemptsBeforeDisconnect}
          onCommit={(v) => patch({ maxFailedAttemptsBeforeDisconnect: v ?? 3 })}
          min={1}
          max={100}
          dense
        />
      </FieldRow>
      <FieldRow label="Max concurrent" hint="Simultaneous in-flight logins. Protects against floods.">
        <NumberInput
          value={l.maxConcurrentLogins}
          onCommit={(v) => patch({ maxConcurrentLogins: v ?? 50 })}
          min={1}
          max={10000}
          dense
        />
      </FieldRow>
      <FieldRow label="Auth threads" hint="Password-hashing threads. Match server core count.">
        <NumberInput
          value={l.authThreads}
          onCommit={(v) => patch({ authThreads: v ?? 8 })}
          min={1}
          max={64}
          dense
        />
      </FieldRow>
    </div>
  );
}

function TelnetBody({ config, onChange }: ConfigPanelProps) {
  const t = config.transport;
  const patchTelnet = (v: Partial<AppConfig["transport"]["telnet"]>) =>
    onChange({ transport: { ...t, telnet: { ...t.telnet, ...v } } });

  return (
    <div className="flex flex-col gap-1.5">
      <FieldRow label="Max line length" hint="Per-line character cap from telnet clients.">
        <NumberInput
          value={t.telnet.maxLineLen}
          onCommit={(v) => patchTelnet({ maxLineLen: v ?? 1024 })}
          min={128}
          max={65535}
          dense
        />
      </FieldRow>
      <FieldRow label="Max non-printable" hint="Non-printable bytes per line. Excess disconnects.">
        <NumberInput
          value={t.telnet.maxNonPrintablePerLine}
          onCommit={(v) => patchTelnet({ maxNonPrintablePerLine: v ?? 32 })}
          min={0}
          max={1024}
          dense
        />
      </FieldRow>
      <FieldRow label="Socket backlog" hint="TCP listen backlog for high-traffic servers.">
        <NumberInput
          value={t.telnet.socketBacklog}
          onCommit={(v) => patchTelnet({ socketBacklog: v ?? 256 })}
          min={1}
          max={65535}
          dense
        />
      </FieldRow>
      <FieldRow label="Max connections" hint="Hard cap on simultaneous telnet sessions.">
        <NumberInput
          value={t.telnet.maxConnections}
          onCommit={(v) => patchTelnet({ maxConnections: v ?? 5000 })}
          min={1}
          max={100000}
          dense
        />
      </FieldRow>
    </div>
  );
}

function WebsocketBody({ config, onChange }: ConfigPanelProps) {
  const t = config.transport;
  const patchWs = (v: Partial<AppConfig["transport"]["websocket"]>) =>
    onChange({ transport: { ...t, websocket: { ...t.websocket, ...v } } });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Host" hint="Bind address. 0.0.0.0 = all interfaces.">
          <TextInput
            value={t.websocket.host}
            onCommit={(v) => patchWs({ host: v || "0.0.0.0" })}
            dense
          />
        </FieldRow>
        <FieldRow label="Stop grace (ms)" hint="Time before forceful close on shutdown.">
          <NumberInput
            value={t.websocket.stopGraceMillis}
            onCommit={(v) => patchWs({ stopGraceMillis: v ?? 1000 })}
            min={0}
            max={30000}
            dense
          />
        </FieldRow>
        <FieldRow label="Stop timeout (ms)" hint="Hard cap before sockets are dropped.">
          <NumberInput
            value={t.websocket.stopTimeoutMillis}
            onCommit={(v) => patchWs({ stopTimeoutMillis: v ?? 2000 })}
            min={0}
            max={60000}
            dense
          />
        </FieldRow>
      </div>

      <div className="ornate-divider" aria-hidden />
      <SubLabel>Backpressure</SubLabel>
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Max failures" hint="Outbound buffer overflows before drop.">
          <NumberInput
            value={t.maxInboundBackpressureFailures}
            onCommit={(v) => onChange({ transport: { ...t, maxInboundBackpressureFailures: v ?? 3 } })}
            min={1}
            max={100}
            dense
          />
        </FieldRow>
      </div>
    </div>
  );
}

function DemoBody({ config, onChange }: ConfigPanelProps) {
  const d = config.demo;
  const patch = (v: Partial<AppConfig["demo"]>) =>
    onChange({ demo: { ...d, ...v } });

  return (
    <div className="flex flex-col gap-1.5">
      <FieldRow label="Auto-launch" hint="Open the web client when the server starts.">
        <CheckboxInput
          checked={d.autoLaunchBrowser}
          onCommit={(v) => patch({ autoLaunchBrowser: v })}
          label="Open browser on start"
        />
      </FieldRow>
      <FieldRow label="Web host" hint="Hostname for the auto-launched URL.">
        <TextInput
          value={d.webClientHost}
          onCommit={(v) => patch({ webClientHost: v || "localhost" })}
          dense
        />
      </FieldRow>
      <FieldRow label="Web URL" hint="Full URL override. Blank to auto-derive from host + port.">
        <TextInput
          value={d.webClientUrl ?? ""}
          onCommit={(v) => patch({ webClientUrl: v || null })}
          dense
        />
      </FieldRow>
    </div>
  );
}

function DatabaseBody({ config, onChange }: ConfigPanelProps) {
  const db = config.database;
  const patch = (v: Partial<AppConfig["database"]>) =>
    onChange({ database: { ...db, ...v } });

  return (
    <div className="flex flex-col gap-1.5">
      <FieldRow label="JDBC URL" hint="PostgreSQL connection string.">
        <TextInput
          value={db.jdbcUrl}
          onCommit={(v) => patch({ jdbcUrl: v || "jdbc:postgresql://localhost:5432/ambonmud" })}
          dense
        />
      </FieldRow>
      <FieldRow label="Username" hint="Database user.">
        <TextInput
          value={db.username}
          onCommit={(v) => patch({ username: v || "ambon" })}
          dense
        />
      </FieldRow>
      <FieldRow label="Password" hint="Stored in plain text — use env injection in production.">
        <TextInput
          value={db.password}
          onCommit={(v) => patch({ password: v || "ambon" })}
          dense
        />
      </FieldRow>
      <FieldRow label="Max pool" hint="Simultaneous DB connections.">
        <NumberInput
          value={db.maxPoolSize}
          onCommit={(v) => patch({ maxPoolSize: v ?? 5 })}
          min={1}
          max={100}
          dense
        />
      </FieldRow>
      <FieldRow label="Min idle" hint="Idle connections kept alive in the pool.">
        <NumberInput
          value={db.minimumIdle}
          onCommit={(v) => patch({ minimumIdle: v ?? 1 })}
          min={0}
          max={100}
          dense
        />
      </FieldRow>
    </div>
  );
}

function RedisBody({ config, onChange }: ConfigPanelProps) {
  const r = config.redis;
  const patch = (v: Partial<AppConfig["redis"]>) =>
    onChange({ redis: { ...r, ...v } });
  const patchBus = (v: Partial<AppConfig["redis"]["bus"]>) =>
    onChange({ redis: { ...r, bus: { ...r.bus, ...v } } });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Enabled" hint="Required for sharding and cross-instance comms.">
          <CheckboxInput
            checked={r.enabled}
            onCommit={(v) => patch({ enabled: v })}
            label="Redis enabled"
          />
        </FieldRow>
        <FieldRow label="URI" hint="e.g. redis://localhost:6379">
          <TextInput
            value={r.uri}
            onCommit={(v) => patch({ uri: v || "redis://localhost:6379" })}
            dense
          />
        </FieldRow>
        <FieldRow label="Cache TTL (s)" hint="How long cached values survive.">
          <NumberInput
            value={r.cacheTtlSeconds}
            onCommit={(v) => patch({ cacheTtlSeconds: v ?? 3600 })}
            min={1}
            max={86400}
            dense
          />
        </FieldRow>
      </div>

      <div className="ornate-divider" aria-hidden />
      <div className="flex items-baseline justify-between gap-2">
        <SubLabel>Message Bus</SubLabel>
        {!r.enabled && <DimPill>Redis required</DimPill>}
      </div>
      <DimWrap dimmed={!r.enabled}>
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Bus enabled" hint="Pub/sub for cross-instance messaging.">
            <CheckboxInput
              checked={r.bus.enabled}
              onCommit={(v) => patchBus({ enabled: v })}
              label="Message bus active"
            />
          </FieldRow>
          <FieldRow label="Inbound" hint="Channel for commands sent to this instance.">
            <TextInput
              value={r.bus.inboundChannel}
              onCommit={(v) => patchBus({ inboundChannel: v || "ambon:inbound" })}
              dense
            />
          </FieldRow>
          <FieldRow label="Outbound" hint="Channel for events broadcast from this instance.">
            <TextInput
              value={r.bus.outboundChannel}
              onCommit={(v) => patchBus({ outboundChannel: v || "ambon:outbound" })}
              dense
            />
          </FieldRow>
          <FieldRow label="Instance ID" hint="Unique identifier for this server on the bus.">
            <TextInput
              value={r.bus.instanceId}
              onCommit={(v) => patchBus({ instanceId: v })}
              dense
            />
          </FieldRow>
          <FieldRow label="Shared secret" hint="HMAC secret authenticating bus messages.">
            <TextInput
              value={r.bus.sharedSecret}
              onCommit={(v) => patchBus({ sharedSecret: v })}
              dense
            />
          </FieldRow>
        </div>
      </DimWrap>
    </div>
  );
}

function GrpcBody({ config, onChange }: ConfigPanelProps) {
  const g = config.grpc;
  const patchServer = (v: Partial<AppConfig["grpc"]["server"]>) =>
    onChange({ grpc: { ...g, server: { ...g.server, ...v } } });
  const patchClient = (v: Partial<AppConfig["grpc"]["client"]>) =>
    onChange({ grpc: { ...g, client: { ...g.client, ...v } } });
  const patch = (v: Partial<AppConfig["grpc"]>) =>
    onChange({ grpc: { ...g, ...v } });

  return (
    <div className="flex flex-col gap-3">
      <SubLabel>Server</SubLabel>
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Port" hint="Engine-mode gRPC listen port.">
          <NumberInput
            value={g.server.port}
            onCommit={(v) => patchServer({ port: v ?? 9090 })}
            min={1}
            max={65535}
            dense
          />
        </FieldRow>
        <FieldRow label="Send timeout" hint="Engine → gateway control-plane timeout (ms).">
          <NumberInput
            value={g.server.controlPlaneSendTimeoutMs}
            onCommit={(v) => patchServer({ controlPlaneSendTimeoutMs: v ?? 2000 })}
            min={100}
            max={60000}
            dense
          />
        </FieldRow>
      </div>

      <div className="ornate-divider" aria-hidden />
      <SubLabel>Client</SubLabel>
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Engine host" hint="Hostname of the engine this gateway connects to.">
          <TextInput
            value={g.client.engineHost}
            onCommit={(v) => patchClient({ engineHost: v || "localhost" })}
            dense
          />
        </FieldRow>
        <FieldRow label="Engine port" hint="Engine gRPC port (must match server port).">
          <NumberInput
            value={g.client.enginePort}
            onCommit={(v) => patchClient({ enginePort: v ?? 9090 })}
            min={1}
            max={65535}
            dense
          />
        </FieldRow>
      </div>

      <div className="ornate-divider" aria-hidden />
      <SubLabel>Security</SubLabel>
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Shared secret" hint="HMAC secret for engine ↔ gateway calls.">
          <TextInput
            value={g.sharedSecret}
            onCommit={(v) => patch({ sharedSecret: v })}
            dense
          />
        </FieldRow>
        <FieldRow label="Plaintext" hint="Disable to require TLS in production.">
          <CheckboxInput
            checked={g.allowPlaintext}
            onCommit={(v) => patch({ allowPlaintext: v })}
            label="Allow unencrypted"
          />
        </FieldRow>
        <FieldRow label="Clock skew" hint="Tolerated timestamp drift in ms.">
          <NumberInput
            value={g.timestampToleranceMs}
            onCommit={(v) => patch({ timestampToleranceMs: v ?? 30000 })}
            min={1000}
            max={300000}
            dense
          />
        </FieldRow>
      </div>
    </div>
  );
}

function GatewayBody({ config, onChange }: ConfigPanelProps) {
  const gw = config.gateway;
  const patch = (v: Partial<AppConfig["gateway"]>) =>
    onChange({ gateway: { ...gw, ...v } });
  const patchReconnect = (v: Partial<AppConfig["gateway"]["reconnect"]>) =>
    onChange({ gateway: { ...gw, reconnect: { ...gw.reconnect, ...v } } });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Gateway ID" hint="Unique numeric ID for this gateway.">
          <NumberInput
            value={gw.id}
            onCommit={(v) => patch({ id: v ?? 0 })}
            min={0}
            max={1023}
            dense
          />
        </FieldRow>
        <FieldRow label="Start zone" hint="Zone new players land in. Blank = global default.">
          <TextInput
            value={gw.startZone}
            onCommit={(v) => patch({ startZone: v })}
            dense
          />
        </FieldRow>
        <FieldRow label="Lease TTL (s)" hint="Snowflake ID lease lifespan before renewal.">
          <NumberInput
            value={gw.snowflake.idLeaseTtlSeconds}
            onCommit={(v) => patch({ snowflake: { idLeaseTtlSeconds: v ?? 300 } })}
            min={10}
            max={3600}
            dense
          />
        </FieldRow>
      </div>

      <div className="ornate-divider" aria-hidden />
      <SubLabel>Reconnect</SubLabel>
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Max attempts" hint="Reconnect tries before giving up.">
          <NumberInput
            value={gw.reconnect.maxAttempts}
            onCommit={(v) => patchReconnect({ maxAttempts: v ?? 10 })}
            min={0}
            max={100}
            dense
          />
        </FieldRow>
        <FieldRow label="Initial delay" hint="First retry delay in ms (then exponential).">
          <NumberInput
            value={gw.reconnect.initialDelayMs}
            onCommit={(v) => patchReconnect({ initialDelayMs: v ?? 1000 })}
            min={100}
            max={60000}
            dense
          />
        </FieldRow>
        <FieldRow label="Max delay" hint="Cap on backoff delay (ms).">
          <NumberInput
            value={gw.reconnect.maxDelayMs}
            onCommit={(v) => patchReconnect({ maxDelayMs: v ?? 30000 })}
            min={1000}
            max={300000}
            dense
          />
        </FieldRow>
        <FieldRow label="Jitter" hint="Random multiplier (0-1) to spread retries.">
          <NumberInput
            value={gw.reconnect.jitterFactor}
            onCommit={(v) => patchReconnect({ jitterFactor: v ?? 0.2 })}
            min={0}
            max={1}
            step={0.05}
            dense
          />
        </FieldRow>
        <FieldRow label="Stream verify" hint="Wait time after reconnect to confirm stream health (ms).">
          <NumberInput
            value={gw.reconnect.streamVerifyMs}
            onCommit={(v) => patchReconnect({ streamVerifyMs: v ?? 2000 })}
            min={100}
            max={30000}
            dense
          />
        </FieldRow>
      </div>
    </div>
  );
}

function ShardingBody({ config, onChange }: ConfigPanelProps) {
  const s = config.sharding;
  const patch = (v: Partial<AppConfig["sharding"]>) =>
    onChange({ sharding: { ...s, ...v } });
  const patchRegistry = (v: Partial<AppConfig["sharding"]["registry"]>) =>
    onChange({ sharding: { ...s, registry: { ...s.registry, ...v } } });
  const patchPlayerIndex = (v: Partial<AppConfig["sharding"]["playerIndex"]>) =>
    onChange({ sharding: { ...s, playerIndex: { ...s.playerIndex, ...v } } });
  const patchInstancing = (v: Partial<AppConfig["sharding"]["instancing"]>) =>
    onChange({ sharding: { ...s, instancing: { ...s.instancing, ...v } } });
  const patchAutoScale = (v: Partial<AppConfig["sharding"]["instancing"]["autoScale"]>) =>
    onChange({ sharding: { ...s, instancing: { ...s.instancing, autoScale: { ...s.instancing.autoScale, ...v } } } });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Enabled" hint="When off, all zones run in a single process.">
          <CheckboxInput
            checked={s.enabled}
            onCommit={(v) => patch({ enabled: v })}
            label="Sharding enabled"
          />
        </FieldRow>
        <FieldRow label="Engine ID" hint="Unique identifier for this engine instance.">
          <TextInput
            value={s.engineId}
            onCommit={(v) => patch({ engineId: v || "engine-1" })}
            dense
          />
        </FieldRow>
        <FieldRow label="Advertise host" hint="Host this engine advertises to gateways.">
          <TextInput
            value={s.advertiseHost}
            onCommit={(v) => patch({ advertiseHost: v || "localhost" })}
            dense
          />
        </FieldRow>
      </div>

      <div className="ornate-divider" aria-hidden />
      <SubLabel>Registry</SubLabel>
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Type" hint="STATIC = config-driven. Future: CONSUL, ETCD.">
          <TextInput
            value={s.registry.type}
            onCommit={(v) => patchRegistry({ type: v || "STATIC" })}
            dense
          />
        </FieldRow>
        <FieldRow label="Lease TTL (s)" hint="Shard lease lifespan before renewal.">
          <NumberInput
            value={s.registry.leaseTtlSeconds}
            onCommit={(v) => patchRegistry({ leaseTtlSeconds: v ?? 30 })}
            min={5}
            max={3600}
            dense
          />
        </FieldRow>
      </div>

      <div className="ornate-divider" aria-hidden />
      <SubLabel>Handoff</SubLabel>
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Ack timeout" hint="Zone-handoff acknowledgement window (ms).">
          <NumberInput
            value={s.handoff.ackTimeoutMs}
            onCommit={(v) => patch({ handoff: { ackTimeoutMs: v ?? 2000 } })}
            min={500}
            max={60000}
            dense
          />
        </FieldRow>
      </div>

      <div className="ornate-divider" aria-hidden />
      <SubLabel>Player Index</SubLabel>
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Enabled" hint="Track each player's engine for cross-shard comms.">
          <CheckboxInput
            checked={s.playerIndex.enabled}
            onCommit={(v) => patchPlayerIndex({ enabled: v })}
            label="Player index active"
          />
        </FieldRow>
        <FieldRow label="Heartbeat" hint="Refresh interval (ms).">
          <NumberInput
            value={s.playerIndex.heartbeatMs}
            onCommit={(v) => patchPlayerIndex({ heartbeatMs: v ?? 10000 })}
            min={1000}
            max={120000}
            dense
          />
        </FieldRow>
      </div>

      <div className="ornate-divider" aria-hidden />
      <SubLabel>Instancing</SubLabel>
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Enabled" hint="Run multiple instances of the same zone for overflow.">
          <CheckboxInput
            checked={s.instancing.enabled}
            onCommit={(v) => patchInstancing({ enabled: v })}
            label="Instancing enabled"
          />
        </FieldRow>
        <FieldRow label="Capacity" hint="Players per instance before a new one spawns.">
          <NumberInput
            value={s.instancing.defaultCapacity}
            onCommit={(v) => patchInstancing({ defaultCapacity: v ?? 200 })}
            min={1}
            max={10000}
            dense
          />
        </FieldRow>
        <FieldRow label="Load report" hint="Engine load-metric report interval (ms).">
          <NumberInput
            value={s.instancing.loadReportIntervalMs}
            onCommit={(v) => patchInstancing({ loadReportIntervalMs: v ?? 5000 })}
            min={1000}
            max={120000}
            dense
          />
        </FieldRow>
        <FieldRow label="Start min" hint="Always-running starter-zone instances.">
          <NumberInput
            value={s.instancing.startZoneMinInstances}
            onCommit={(v) => patchInstancing({ startZoneMinInstances: v ?? 1 })}
            min={1}
            max={100}
            dense
          />
        </FieldRow>
      </div>

      <div className="ornate-divider" aria-hidden />
      <SubLabel>Auto-scale</SubLabel>
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Enabled" hint="Auto-create / destroy instances based on load.">
          <CheckboxInput
            checked={s.instancing.autoScale.enabled}
            onCommit={(v) => patchAutoScale({ enabled: v })}
            label="Auto-scale enabled"
          />
        </FieldRow>
        <FieldRow label="Eval interval" hint="Auto-scaler evaluation cadence (ms).">
          <NumberInput
            value={s.instancing.autoScale.evaluationIntervalMs}
            onCommit={(v) => patchAutoScale({ evaluationIntervalMs: v ?? 30000 })}
            min={5000}
            max={300000}
            dense
          />
        </FieldRow>
        <FieldRow label="Scale up" hint="Load fraction (0-1) above which a new instance spawns.">
          <NumberInput
            value={s.instancing.autoScale.scaleUpThreshold}
            onCommit={(v) => patchAutoScale({ scaleUpThreshold: v ?? 0.8 })}
            min={0.1}
            max={1}
            step={0.05}
            dense
          />
        </FieldRow>
        <FieldRow label="Scale down" hint="Load fraction (0-1) below which an instance is removed.">
          <NumberInput
            value={s.instancing.autoScale.scaleDownThreshold}
            onCommit={(v) => patchAutoScale({ scaleDownThreshold: v ?? 0.2 })}
            min={0}
            max={1}
            step={0.05}
            dense
          />
        </FieldRow>
        <FieldRow label="Cooldown" hint="Min time between scale events (ms) — anti-thrash.">
          <NumberInput
            value={s.instancing.autoScale.cooldownMs}
            onCommit={(v) => patchAutoScale({ cooldownMs: v ?? 60000 })}
            min={1000}
            max={600000}
            dense
          />
        </FieldRow>
      </div>
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────

export function InfrastructurePanel({ config, onChange }: ConfigPanelProps) {
  const mode = config.mode;
  const isStandalone = mode === "STANDALONE";
  const isPostgres = config.persistence.backend === "POSTGRES";

  return (
    <div className="flex flex-col gap-6">
      <ModePicker mode={mode} onSelect={(m) => onChange({ mode: m })} />

      <div className="gap-4 [column-fill:balance] md:columns-2">
        {/* 1 — Persistence */}
        <OrnateCard
          number={1}
          title="Persistence"
          description="How player data is stored. YAML for files, POSTGRES for a relational database."
        >
          <PersistenceBody config={config} onChange={onChange} />
        </OrnateCard>

        {/* 2 — Login */}
        <OrnateCard
          number={2}
          title="Login"
          description="Authentication, rate limiting, and session controls."
        >
          <LoginBody config={config} onChange={onChange} />
        </OrnateCard>

        {/* 3 — Telnet */}
        <OrnateCard
          number={3}
          title="Transport · Telnet"
          description="Low-level settings for the raw telnet listener."
        >
          <TelnetBody config={config} onChange={onChange} />
        </OrnateCard>

        {/* 4 — WebSocket + Backpressure */}
        <OrnateCard
          number={4}
          title="Transport · WebSocket"
          description="Browser-client WebSocket transport and shared backpressure rules."
        >
          <WebsocketBody config={config} onChange={onChange} />
        </OrnateCard>

        {/* 5 — Demo */}
        <OrnateCard
          number={5}
          title="Demo"
          description="Auto-launch the bundled web client when the server starts."
        >
          <DemoBody config={config} onChange={onChange} />
        </OrnateCard>

        {/* 6 — Database (gated on POSTGRES backend) */}
        <OrnateCard
          number={6}
          title="Database"
          description="PostgreSQL connection used when the persistence backend is POSTGRES."
          headerEnd={!isPostgres ? <DimPill>Postgres backend only</DimPill> : undefined}
        >
          <DimWrap dimmed={!isPostgres}>
            <DatabaseBody config={config} onChange={onChange} />
          </DimWrap>
        </OrnateCard>

        {/* 7 — Redis */}
        <OrnateCard
          number={7}
          title="Redis"
          description="Optional cache + cross-instance message bus. Required for sharded deployments."
        >
          <RedisBody config={config} onChange={onChange} />
        </OrnateCard>

        {/* 8 — gRPC (cluster only) */}
        <OrnateCard
          number={8}
          title="gRPC"
          description="Control-plane wiring between Engine and Gateway processes."
          headerEnd={isStandalone ? <DimPill>Sharded mode only</DimPill> : undefined}
        >
          <DimWrap dimmed={isStandalone}>
            <GrpcBody config={config} onChange={onChange} />
          </DimWrap>
        </OrnateCard>

        {/* 9 — Gateway (cluster only) */}
        <OrnateCard
          number={9}
          title="Gateway"
          description="How a Gateway process identifies itself, reconnects, and routes new players."
          headerEnd={isStandalone ? <DimPill>Sharded mode only</DimPill> : undefined}
        >
          <DimWrap dimmed={isStandalone}>
            <GatewayBody config={config} onChange={onChange} />
          </DimWrap>
        </OrnateCard>

        {/* 10 — Sharding (cluster only) */}
        <OrnateCard
          number={10}
          title="Sharding"
          description="Distribute zones across engines, with auto-scaling for crowded instances."
          headerEnd={isStandalone ? <DimPill>Sharded mode only</DimPill> : undefined}
        >
          <DimWrap dimmed={isStandalone}>
            <ShardingBody config={config} onChange={onChange} />
          </DimWrap>
        </OrnateCard>
      </div>
    </div>
  );
}
