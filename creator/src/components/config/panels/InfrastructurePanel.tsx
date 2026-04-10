import type { ConfigPanelProps, AppConfig } from "./types";
import { Section, FieldRow, NumberInput, TextInput, SelectInput, CheckboxInput } from "@/components/ui/FormWidgets";

// ─── Deployment mode ───────────────────────────────────────────────

function ModeSection({ config, onChange }: ConfigPanelProps) {
  return (
    <Section
      title="Deployment mode"
      description="How the server process is deployed. Standalone runs everything in one process. Engine and Gateway are for sharded multi-process setups."
    >
      <FieldRow label="Mode" hint="STANDALONE = single process (default). ENGINE = game engine only (no transports). GATEWAY = transport layer only (no local engine).">
        <SelectInput
          value={config.mode}
          options={[
            { value: "STANDALONE", label: "Standalone" },
            { value: "ENGINE", label: "Engine" },
            { value: "GATEWAY", label: "Gateway" },
          ]}
          onCommit={(v) => onChange({ mode: v as AppConfig["mode"] })}
        />
      </FieldRow>
    </Section>
  );
}

// ─── Persistence ───────────────────────────────────────────────────

function PersistenceSection({ config, onChange }: ConfigPanelProps) {
  const p = config.persistence;
  const patch = (v: Partial<AppConfig["persistence"]>) =>
    onChange({ persistence: { ...p, ...v } });

  return (
    <Section
      title="Persistence"
      description="How player data is stored. YAML writes flat files to disk; POSTGRES uses a database connection from the Database section below."
    >
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Backend" hint="YAML = flat files (simple, no database required). POSTGRES = relational database (requires database config below).">
          <SelectInput
            value={p.backend}
            options={[
              { value: "YAML", label: "YAML (flat files)" },
              { value: "POSTGRES", label: "PostgreSQL" },
            ]}
            onCommit={(v) => patch({ backend: v as AppConfig["persistence"]["backend"] })}
          />
        </FieldRow>
        <FieldRow label="Root directory" hint="Where YAML player files are stored on disk. Relative to the server working directory.">
          <TextInput
            value={p.rootDir}
            onCommit={(v) => patch({ rootDir: v || "data/players" })}
          />
        </FieldRow>
        <FieldRow label="Worker enabled" hint="Background worker that periodically flushes dirty player data to disk/database.">
          <CheckboxInput
            checked={p.worker.enabled}
            onCommit={(v) => patch({ worker: { ...p.worker, enabled: v } })}
            label="Flush worker active"
          />
        </FieldRow>
        <FieldRow label="Flush interval (ms)" hint="How often the persistence worker writes dirty player data. Lower = more durable but more I/O.">
          <NumberInput
            value={p.worker.flushIntervalMs}
            onCommit={(v) => patch({ worker: { ...p.worker, flushIntervalMs: v ?? 5000 } })}
            min={500}
            max={60000}
          />
        </FieldRow>
      </div>
    </Section>
  );
}

// ─── Login ─────────────────────────────────────────────────────────

function LoginSection({ config, onChange }: ConfigPanelProps) {
  const l = config.login;
  const patch = (v: Partial<AppConfig["login"]>) =>
    onChange({ login: { ...l, ...v } });

  return (
    <Section
      title="Login"
      description="Controls for player authentication, rate limiting, and concurrent session handling."
    >
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Max wrong passwords" hint="Wrong password attempts before the account is temporarily locked for that session.">
          <NumberInput
            value={l.maxWrongPasswordRetries}
            onCommit={(v) => patch({ maxWrongPasswordRetries: v ?? 3 })}
            min={1}
            max={100}
          />
        </FieldRow>
        <FieldRow label="Max failed attempts" hint="Total failed login attempts (wrong user + wrong password) before the connection is dropped.">
          <NumberInput
            value={l.maxFailedAttemptsBeforeDisconnect}
            onCommit={(v) => patch({ maxFailedAttemptsBeforeDisconnect: v ?? 3 })}
            min={1}
            max={100}
          />
        </FieldRow>
        <FieldRow label="Max concurrent logins" hint="How many players can be logging in simultaneously. Protects against login-flood attacks.">
          <NumberInput
            value={l.maxConcurrentLogins}
            onCommit={(v) => patch({ maxConcurrentLogins: v ?? 50 })}
            min={1}
            max={10000}
          />
        </FieldRow>
        <FieldRow label="Auth threads" hint="Thread pool size for password hashing. More threads = faster login throughput but more CPU. Match to your server's core count.">
          <NumberInput
            value={l.authThreads}
            onCommit={(v) => patch({ authThreads: v ?? 8 })}
            min={1}
            max={64}
          />
        </FieldRow>
      </div>
    </Section>
  );
}

// ─── Transport ─────────────────────────────────────────────────────

function TransportSection({ config, onChange }: ConfigPanelProps) {
  const t = config.transport;
  const patchTelnet = (v: Partial<AppConfig["transport"]["telnet"]>) =>
    onChange({ transport: { ...t, telnet: { ...t.telnet, ...v } } });
  const patchWs = (v: Partial<AppConfig["transport"]["websocket"]>) =>
    onChange({ transport: { ...t, websocket: { ...t.websocket, ...v } } });

  return (
    <Section
      title="Transport"
      description="Low-level settings for the telnet and WebSocket connection layers."
    >
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-display uppercase tracking-wide-ui text-text-muted mb-1">Telnet</p>
        <FieldRow label="Max line length" hint="Maximum characters per line from a telnet client. Lines exceeding this are truncated.">
          <NumberInput
            value={t.telnet.maxLineLen}
            onCommit={(v) => patchTelnet({ maxLineLen: v ?? 1024 })}
            min={128}
            max={65535}
          />
        </FieldRow>
        <FieldRow label="Max non-printable/line" hint="Maximum non-printable characters per line (telnet negotiation bytes, escape sequences). Excess triggers disconnect.">
          <NumberInput
            value={t.telnet.maxNonPrintablePerLine}
            onCommit={(v) => patchTelnet({ maxNonPrintablePerLine: v ?? 32 })}
            min={0}
            max={1024}
          />
        </FieldRow>
        <FieldRow label="Socket backlog" hint="TCP listen backlog. Increase for high-traffic servers where many connections arrive simultaneously.">
          <NumberInput
            value={t.telnet.socketBacklog}
            onCommit={(v) => patchTelnet({ socketBacklog: v ?? 256 })}
            min={1}
            max={65535}
          />
        </FieldRow>
        <FieldRow label="Max connections" hint="Hard cap on simultaneous telnet connections.">
          <NumberInput
            value={t.telnet.maxConnections}
            onCommit={(v) => patchTelnet({ maxConnections: v ?? 5000 })}
            min={1}
            max={100000}
          />
        </FieldRow>

        <p className="text-xs font-display uppercase tracking-wide-ui text-text-muted mb-1 mt-3">WebSocket</p>
        <FieldRow label="Host" hint="Bind address for the WebSocket server. 0.0.0.0 listens on all interfaces.">
          <TextInput
            value={t.websocket.host}
            onCommit={(v) => patchWs({ host: v || "0.0.0.0" })}
          />
        </FieldRow>
        <FieldRow label="Stop grace (ms)" hint="Grace period before forcefully closing WebSocket connections during shutdown.">
          <NumberInput
            value={t.websocket.stopGraceMillis}
            onCommit={(v) => patchWs({ stopGraceMillis: v ?? 1000 })}
            min={0}
            max={30000}
          />
        </FieldRow>
        <FieldRow label="Stop timeout (ms)" hint="Hard timeout for WebSocket shutdown. Connections still open after this are forcefully dropped.">
          <NumberInput
            value={t.websocket.stopTimeoutMillis}
            onCommit={(v) => patchWs({ stopTimeoutMillis: v ?? 2000 })}
            min={0}
            max={60000}
          />
        </FieldRow>

        <p className="text-xs font-display uppercase tracking-wide-ui text-text-muted mb-1 mt-3">Backpressure</p>
        <FieldRow label="Max backpressure failures" hint="How many times a session's outbound buffer can overflow before the connection is dropped.">
          <NumberInput
            value={t.maxInboundBackpressureFailures}
            onCommit={(v) => onChange({ transport: { ...t, maxInboundBackpressureFailures: v ?? 3 } })}
            min={1}
            max={100}
          />
        </FieldRow>
      </div>
    </Section>
  );
}

// ─── Demo ──────────────────────────────────────────────────────────

function DemoSection({ config, onChange }: ConfigPanelProps) {
  const d = config.demo;
  const patch = (v: Partial<AppConfig["demo"]>) =>
    onChange({ demo: { ...d, ...v } });

  return (
    <Section
      title="Demo"
      description="Demo-mode settings for launching a browser-based client automatically on server start."
    >
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Auto-launch browser" hint="Open the web client in the default browser when the server starts.">
          <CheckboxInput
            checked={d.autoLaunchBrowser}
            onCommit={(v) => patch({ autoLaunchBrowser: v })}
            label="Open browser on start"
          />
        </FieldRow>
        <FieldRow label="Web client host" hint="Hostname for the auto-launched browser URL.">
          <TextInput
            value={d.webClientHost}
            onCommit={(v) => patch({ webClientHost: v || "localhost" })}
          />
        </FieldRow>
        <FieldRow label="Web client URL" hint="Full URL override. When set, this is opened instead of constructing one from host + port. Leave blank to auto-derive.">
          <TextInput
            value={d.webClientUrl ?? ""}
            onCommit={(v) => patch({ webClientUrl: v || null })}
          />
        </FieldRow>
      </div>
    </Section>
  );
}

// ─── Database ──────────────────────────────────────────────────────

function DatabaseSection({ config, onChange }: ConfigPanelProps) {
  const db = config.database;
  const patch = (v: Partial<AppConfig["database"]>) =>
    onChange({ database: { ...db, ...v } });

  return (
    <Section
      title="Database"
      description="PostgreSQL connection settings. Only used when persistence backend is set to POSTGRES."
    >
      <div className="flex flex-col gap-1.5">
        <FieldRow label="JDBC URL" hint="PostgreSQL connection string. Include host, port, and database name.">
          <TextInput
            value={db.jdbcUrl}
            onCommit={(v) => patch({ jdbcUrl: v || "jdbc:postgresql://localhost:5432/ambonmud" })}
          />
        </FieldRow>
        <FieldRow label="Username" hint="Database user.">
          <TextInput
            value={db.username}
            onCommit={(v) => patch({ username: v || "ambon" })}
          />
        </FieldRow>
        <FieldRow label="Password" hint="Database password. Stored in the config file in plain text — use environment variable injection in production.">
          <TextInput
            value={db.password}
            onCommit={(v) => patch({ password: v || "ambon" })}
          />
        </FieldRow>
        <FieldRow label="Max pool size" hint="Maximum simultaneous database connections. Increase for high-write loads.">
          <NumberInput
            value={db.maxPoolSize}
            onCommit={(v) => patch({ maxPoolSize: v ?? 5 })}
            min={1}
            max={100}
          />
        </FieldRow>
        <FieldRow label="Minimum idle" hint="Minimum idle connections kept alive in the pool. Avoids cold-start latency on first queries.">
          <NumberInput
            value={db.minimumIdle}
            onCommit={(v) => patch({ minimumIdle: v ?? 1 })}
            min={0}
            max={100}
          />
        </FieldRow>
      </div>
    </Section>
  );
}

// ─── Redis ─────────────────────────────────────────────────────────

function RedisSection({ config, onChange }: ConfigPanelProps) {
  const r = config.redis;
  const patch = (v: Partial<AppConfig["redis"]>) =>
    onChange({ redis: { ...r, ...v } });
  const patchBus = (v: Partial<AppConfig["redis"]["bus"]>) =>
    onChange({ redis: { ...r, bus: { ...r.bus, ...v } } });

  return (
    <Section
      title="Redis"
      description="Optional Redis integration for caching and cross-instance message bus (required for sharded deployments)."
    >
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Enabled" hint="Enable Redis connection. Required for sharding and cross-instance communication.">
          <CheckboxInput
            checked={r.enabled}
            onCommit={(v) => patch({ enabled: v })}
            label="Redis enabled"
          />
        </FieldRow>
        <FieldRow label="URI" hint="Redis connection string (e.g. redis://localhost:6379).">
          <TextInput
            value={r.uri}
            onCommit={(v) => patch({ uri: v || "redis://localhost:6379" })}
          />
        </FieldRow>
        <FieldRow label="Cache TTL (seconds)" hint="How long cached values are kept before they expire.">
          <NumberInput
            value={r.cacheTtlSeconds}
            onCommit={(v) => patch({ cacheTtlSeconds: v ?? 3600 })}
            min={1}
            max={86400}
          />
        </FieldRow>

        <p className="text-xs font-display uppercase tracking-wide-ui text-text-muted mb-1 mt-3">Message bus</p>
        <FieldRow label="Bus enabled" hint="Enable the Redis pub/sub message bus for cross-instance communication.">
          <CheckboxInput
            checked={r.bus.enabled}
            onCommit={(v) => patchBus({ enabled: v })}
            label="Message bus active"
          />
        </FieldRow>
        <FieldRow label="Inbound channel" hint="Redis channel name for commands sent to this instance.">
          <TextInput
            value={r.bus.inboundChannel}
            onCommit={(v) => patchBus({ inboundChannel: v || "ambon:inbound" })}
          />
        </FieldRow>
        <FieldRow label="Outbound channel" hint="Redis channel name for events broadcast from this instance.">
          <TextInput
            value={r.bus.outboundChannel}
            onCommit={(v) => patchBus({ outboundChannel: v || "ambon:outbound" })}
          />
        </FieldRow>
        <FieldRow label="Instance ID" hint="Unique identifier for this server instance on the bus. Used to avoid echoing messages back to the sender.">
          <TextInput
            value={r.bus.instanceId}
            onCommit={(v) => patchBus({ instanceId: v })}
          />
        </FieldRow>
        <FieldRow label="Shared secret" hint="HMAC secret for authenticating bus messages between instances.">
          <TextInput
            value={r.bus.sharedSecret}
            onCommit={(v) => patchBus({ sharedSecret: v })}
          />
        </FieldRow>
      </div>
    </Section>
  );
}

// ─── gRPC ──────────────────────────────────────────────────────────

function GrpcSection({ config, onChange }: ConfigPanelProps) {
  const g = config.grpc;
  const patchServer = (v: Partial<AppConfig["grpc"]["server"]>) =>
    onChange({ grpc: { ...g, server: { ...g.server, ...v } } });
  const patchClient = (v: Partial<AppConfig["grpc"]["client"]>) =>
    onChange({ grpc: { ...g, client: { ...g.client, ...v } } });
  const patch = (v: Partial<AppConfig["grpc"]>) =>
    onChange({ grpc: { ...g, ...v } });

  return (
    <Section
      title="gRPC"
      description="Settings for the gRPC control plane used in sharded (Engine + Gateway) deployments."
    >
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-display uppercase tracking-wide-ui text-text-muted mb-1">Server</p>
        <FieldRow label="Port" hint="Port the gRPC server listens on (Engine mode).">
          <NumberInput
            value={g.server.port}
            onCommit={(v) => patchServer({ port: v ?? 9090 })}
            min={1}
            max={65535}
          />
        </FieldRow>
        <FieldRow label="Send timeout (ms)" hint="Timeout for control-plane messages sent from the engine to gateways.">
          <NumberInput
            value={g.server.controlPlaneSendTimeoutMs}
            onCommit={(v) => patchServer({ controlPlaneSendTimeoutMs: v ?? 2000 })}
            min={100}
            max={60000}
          />
        </FieldRow>

        <p className="text-xs font-display uppercase tracking-wide-ui text-text-muted mb-1 mt-3">Client</p>
        <FieldRow label="Engine host" hint="Hostname of the engine to connect to (Gateway mode).">
          <TextInput
            value={g.client.engineHost}
            onCommit={(v) => patchClient({ engineHost: v || "localhost" })}
          />
        </FieldRow>
        <FieldRow label="Engine port" hint="gRPC port of the engine to connect to (Gateway mode).">
          <NumberInput
            value={g.client.enginePort}
            onCommit={(v) => patchClient({ enginePort: v ?? 9090 })}
            min={1}
            max={65535}
          />
        </FieldRow>

        <p className="text-xs font-display uppercase tracking-wide-ui text-text-muted mb-1 mt-3">Security</p>
        <FieldRow label="Shared secret" hint="HMAC secret for authenticating gRPC calls between engine and gateway.">
          <TextInput
            value={g.sharedSecret}
            onCommit={(v) => patch({ sharedSecret: v })}
          />
        </FieldRow>
        <FieldRow label="Allow plaintext" hint="Accept unencrypted gRPC connections. Disable in production to require TLS.">
          <CheckboxInput
            checked={g.allowPlaintext}
            onCommit={(v) => patch({ allowPlaintext: v })}
            label="Allow unencrypted"
          />
        </FieldRow>
        <FieldRow label="Timestamp tolerance (ms)" hint="Maximum clock skew allowed between engine and gateway for request authentication.">
          <NumberInput
            value={g.timestampToleranceMs}
            onCommit={(v) => patch({ timestampToleranceMs: v ?? 30000 })}
            min={1000}
            max={300000}
          />
        </FieldRow>
      </div>
    </Section>
  );
}

// ─── Gateway ───────────────────────────────────────────────────────

function GatewaySection({ config, onChange }: ConfigPanelProps) {
  const gw = config.gateway;
  const patch = (v: Partial<AppConfig["gateway"]>) =>
    onChange({ gateway: { ...gw, ...v } });
  const patchReconnect = (v: Partial<AppConfig["gateway"]["reconnect"]>) =>
    onChange({ gateway: { ...gw, reconnect: { ...gw.reconnect, ...v } } });

  return (
    <Section
      title="Gateway"
      description="Settings for the Gateway process in a sharded deployment. Controls how the gateway identifies itself, reconnects to engines, and routes players."
    >
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Gateway ID" hint="Unique numeric ID for this gateway instance.">
          <NumberInput
            value={gw.id}
            onCommit={(v) => patch({ id: v ?? 0 })}
            min={0}
            max={1023}
          />
        </FieldRow>
        <FieldRow label="Start zone" hint="Zone new players are placed into when connecting through this gateway. Leave blank to use the global start room.">
          <TextInput
            value={gw.startZone}
            onCommit={(v) => patch({ startZone: v })}
          />
        </FieldRow>
        <FieldRow label="Snowflake lease TTL (s)" hint="How long a snowflake ID lease is valid before it must be renewed.">
          <NumberInput
            value={gw.snowflake.idLeaseTtlSeconds}
            onCommit={(v) => patch({ snowflake: { idLeaseTtlSeconds: v ?? 300 } })}
            min={10}
            max={3600}
          />
        </FieldRow>

        <p className="text-xs font-display uppercase tracking-wide-ui text-text-muted mb-1 mt-3">Reconnect</p>
        <FieldRow label="Max attempts" hint="How many times the gateway will try to reconnect to a lost engine before giving up.">
          <NumberInput
            value={gw.reconnect.maxAttempts}
            onCommit={(v) => patchReconnect({ maxAttempts: v ?? 10 })}
            min={0}
            max={100}
          />
        </FieldRow>
        <FieldRow label="Initial delay (ms)" hint="First reconnect attempt delay. Subsequent attempts use exponential backoff.">
          <NumberInput
            value={gw.reconnect.initialDelayMs}
            onCommit={(v) => patchReconnect({ initialDelayMs: v ?? 1000 })}
            min={100}
            max={60000}
          />
        </FieldRow>
        <FieldRow label="Max delay (ms)" hint="Cap on exponential backoff delay between reconnect attempts.">
          <NumberInput
            value={gw.reconnect.maxDelayMs}
            onCommit={(v) => patchReconnect({ maxDelayMs: v ?? 30000 })}
            min={1000}
            max={300000}
          />
        </FieldRow>
        <FieldRow label="Jitter factor" hint="Random jitter multiplier (0-1) added to backoff delay to avoid thundering herd.">
          <NumberInput
            value={gw.reconnect.jitterFactor}
            onCommit={(v) => patchReconnect({ jitterFactor: v ?? 0.2 })}
            min={0}
            max={1}
            step={0.05}
          />
        </FieldRow>
        <FieldRow label="Stream verify (ms)" hint="Time to wait for the gRPC stream to prove healthy after reconnect before declaring success.">
          <NumberInput
            value={gw.reconnect.streamVerifyMs}
            onCommit={(v) => patchReconnect({ streamVerifyMs: v ?? 2000 })}
            min={100}
            max={30000}
          />
        </FieldRow>
      </div>
    </Section>
  );
}

// ─── Sharding ──────────────────────────────────────────────────────

function ShardingSection({ config, onChange }: ConfigPanelProps) {
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
    <Section
      title="Sharding"
      description="Distribute zones across multiple engine processes. Enable sharding, assign zones, and configure instance auto-scaling."
    >
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Enabled" hint="Enable zone sharding. When off, all zones run in a single process.">
          <CheckboxInput
            checked={s.enabled}
            onCommit={(v) => patch({ enabled: v })}
            label="Sharding enabled"
          />
        </FieldRow>
        <FieldRow label="Engine ID" hint="Unique string identifier for this engine instance (e.g. engine-1).">
          <TextInput
            value={s.engineId}
            onCommit={(v) => patch({ engineId: v || "engine-1" })}
          />
        </FieldRow>
        <FieldRow label="Advertise host" hint="Hostname this engine advertises to gateways and other engines.">
          <TextInput
            value={s.advertiseHost}
            onCommit={(v) => patch({ advertiseHost: v || "localhost" })}
          />
        </FieldRow>

        <p className="text-xs font-display uppercase tracking-wide-ui text-text-muted mb-1 mt-3">Registry</p>
        <FieldRow label="Type" hint="How zone-to-engine assignments are resolved. STATIC = config-driven. Future: CONSUL, ETCD.">
          <TextInput
            value={s.registry.type}
            onCommit={(v) => patchRegistry({ type: v || "STATIC" })}
          />
        </FieldRow>
        <FieldRow label="Lease TTL (s)" hint="How long a shard lease is valid before the engine must renew it.">
          <NumberInput
            value={s.registry.leaseTtlSeconds}
            onCommit={(v) => patchRegistry({ leaseTtlSeconds: v ?? 30 })}
            min={5}
            max={3600}
          />
        </FieldRow>

        <p className="text-xs font-display uppercase tracking-wide-ui text-text-muted mb-1 mt-3">Handoff</p>
        <FieldRow label="Ack timeout (ms)" hint="How long to wait for a zone handoff acknowledgment before considering it failed.">
          <NumberInput
            value={s.handoff.ackTimeoutMs}
            onCommit={(v) => patch({ handoff: { ackTimeoutMs: v ?? 2000 } })}
            min={500}
            max={60000}
          />
        </FieldRow>

        <p className="text-xs font-display uppercase tracking-wide-ui text-text-muted mb-1 mt-3">Player index</p>
        <FieldRow label="Enabled" hint="Track which engine each player is on for cross-shard communication.">
          <CheckboxInput
            checked={s.playerIndex.enabled}
            onCommit={(v) => patchPlayerIndex({ enabled: v })}
            label="Player index active"
          />
        </FieldRow>
        <FieldRow label="Heartbeat (ms)" hint="How often the player index is refreshed.">
          <NumberInput
            value={s.playerIndex.heartbeatMs}
            onCommit={(v) => patchPlayerIndex({ heartbeatMs: v ?? 10000 })}
            min={1000}
            max={120000}
          />
        </FieldRow>

        <p className="text-xs font-display uppercase tracking-wide-ui text-text-muted mb-1 mt-3">Instancing</p>
        <FieldRow label="Enabled" hint="Allow multiple instances of the same zone to run concurrently (for overflow).">
          <CheckboxInput
            checked={s.instancing.enabled}
            onCommit={(v) => patchInstancing({ enabled: v })}
            label="Instancing enabled"
          />
        </FieldRow>
        <FieldRow label="Default capacity" hint="Max players per zone instance before a new instance is created.">
          <NumberInput
            value={s.instancing.defaultCapacity}
            onCommit={(v) => patchInstancing({ defaultCapacity: v ?? 200 })}
            min={1}
            max={10000}
          />
        </FieldRow>
        <FieldRow label="Load report interval (ms)" hint="How often each engine reports its zone load metrics.">
          <NumberInput
            value={s.instancing.loadReportIntervalMs}
            onCommit={(v) => patchInstancing({ loadReportIntervalMs: v ?? 5000 })}
            min={1000}
            max={120000}
          />
        </FieldRow>
        <FieldRow label="Start zone min instances" hint="Minimum instances always running for the starting zone. Prevents new players from hitting a cold start.">
          <NumberInput
            value={s.instancing.startZoneMinInstances}
            onCommit={(v) => patchInstancing({ startZoneMinInstances: v ?? 1 })}
            min={1}
            max={100}
          />
        </FieldRow>

        <p className="text-xs font-display uppercase tracking-wide-ui text-text-muted mb-1 mt-3">Auto-scale</p>
        <FieldRow label="Enabled" hint="Automatically create/destroy zone instances based on load thresholds.">
          <CheckboxInput
            checked={s.instancing.autoScale.enabled}
            onCommit={(v) => patchAutoScale({ enabled: v })}
            label="Auto-scale enabled"
          />
        </FieldRow>
        <FieldRow label="Evaluation interval (ms)" hint="How often the auto-scaler checks load metrics.">
          <NumberInput
            value={s.instancing.autoScale.evaluationIntervalMs}
            onCommit={(v) => patchAutoScale({ evaluationIntervalMs: v ?? 30000 })}
            min={5000}
            max={300000}
          />
        </FieldRow>
        <FieldRow label="Scale-up threshold" hint="Load fraction (0-1) above which a new instance is created. E.g. 0.8 = at 80% capacity.">
          <NumberInput
            value={s.instancing.autoScale.scaleUpThreshold}
            onCommit={(v) => patchAutoScale({ scaleUpThreshold: v ?? 0.8 })}
            min={0.1}
            max={1}
            step={0.05}
          />
        </FieldRow>
        <FieldRow label="Scale-down threshold" hint="Load fraction (0-1) below which an instance is removed. E.g. 0.2 = below 20% capacity.">
          <NumberInput
            value={s.instancing.autoScale.scaleDownThreshold}
            onCommit={(v) => patchAutoScale({ scaleDownThreshold: v ?? 0.2 })}
            min={0}
            max={1}
            step={0.05}
          />
        </FieldRow>
        <FieldRow label="Cooldown (ms)" hint="Minimum time between scale events to prevent thrashing.">
          <NumberInput
            value={s.instancing.autoScale.cooldownMs}
            onCommit={(v) => patchAutoScale({ cooldownMs: v ?? 60000 })}
            min={1000}
            max={600000}
          />
        </FieldRow>
      </div>
    </Section>
  );
}

// ─── Main panel ────────────────────────────────────────────────────

export function InfrastructurePanel({ config, onChange }: ConfigPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <ModeSection config={config} onChange={onChange} />
      <PersistenceSection config={config} onChange={onChange} />
      <LoginSection config={config} onChange={onChange} />
      <TransportSection config={config} onChange={onChange} />
      <DemoSection config={config} onChange={onChange} />
      <DatabaseSection config={config} onChange={onChange} />
      <RedisSection config={config} onChange={onChange} />
      <GrpcSection config={config} onChange={onChange} />
      <GatewaySection config={config} onChange={onChange} />
      <ShardingSection config={config} onChange={onChange} />
    </div>
  );
}
