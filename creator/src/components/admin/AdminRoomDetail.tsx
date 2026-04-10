import { memo } from "react";
import { useAdminStore } from "@/stores/adminStore";
import { ActionButton } from "@/components/ui/FormWidgets";

const Section = memo(function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-[var(--chrome-stroke)] bg-gradient-panel-light p-4 shadow-section">
      <h4 className="mb-2 text-2xs uppercase tracking-wide-ui text-text-muted">{title}</h4>
      {children}
    </div>
  );
});

const StatRow = memo(function StatRow({ label, value, valueClass }: { label: string; value: string | number; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--chrome-stroke)] py-2 last:border-b-0">
      <span className="text-xs capitalize text-text-muted">{label}</span>
      <span className={`text-xs ${valueClass ?? "text-text-primary"}`}>{value}</span>
    </div>
  );
});

const HpBar = memo(function HpBar({ label, current, max }: { label: string; current: number; max: number }) {
  if (max <= 0) return null;
  const pct = Math.round((current / max) * 100);
  const color = pct > 60 ? "bg-status-success" : pct > 25 ? "bg-status-warning" : "bg-status-error";
  return (
    <div className="flex items-center justify-between border-b border-[var(--chrome-stroke)] py-2 last:border-b-0">
      <span className="text-xs text-text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <div
          className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--chrome-highlight-strong)]"
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={`${label} health`}
        >
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-2xs text-text-muted">
          {current}/{max}
        </span>
      </div>
    </div>
  );
});

export function AdminRoomDetail() {
  const room = useAdminStore((s) => s.selectedRoom);
  const clearSelectedRoom = useAdminStore((s) => s.clearSelectedRoom);

  if (!room) return null;

  const hasMedia = room.image || room.music || room.ambient || room.video;
  const hasCoords = room.mapX != null && room.mapY != null;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ActionButton variant="ghost" size="sm" onClick={clearSelectedRoom}>
          &#x2190; Back
        </ActionButton>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-xl text-text-primary">{room.title}</h3>
          <p className="mt-0.5 font-mono text-2xs text-text-muted">{room.id}</p>
        </div>
        {hasCoords && (
          <span className="shrink-0 rounded-full bg-[var(--chrome-fill)] px-2.5 py-0.5 font-mono text-2xs text-text-muted">
            ({room.mapX}, {room.mapY})
          </span>
        )}
      </div>

      {/* Description */}
      {room.description && (
        <div className="rounded-3xl border border-[var(--chrome-stroke)] bg-gradient-panel-light p-4 shadow-section">
          <p className="text-sm leading-6 text-text-secondary">{room.description}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {/* Exits */}
        <Section title="Exits">
          {room.exits.length > 0 ? (
            <div className="flex flex-col gap-1">
              {room.exits.map((exit) => (
                <div
                  key={exit.direction}
                  className="flex items-center justify-between border-b border-[var(--chrome-stroke)] py-2 last:border-b-0"
                >
                  <span className="text-xs font-medium text-stellar-blue">{exit.direction}</span>
                  <span className="font-mono text-xs text-text-secondary">{exit.target}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted">No exits</p>
          )}
        </Section>

        {/* Players */}
        <Section title="Players present">
          {room.players.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {room.players.map((name) => (
                <span
                  key={name}
                  className="rounded-full bg-status-success/12 px-2.5 py-1 text-2xs text-status-success"
                >
                  {name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted">None</p>
          )}
        </Section>

        {/* Mobs */}
        <Section title="Creatures">
          {room.mobs.length > 0 ? (
            <div className="flex flex-col gap-1">
              {room.mobs.map((mob) => (
                <div key={mob.id}>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-text-primary">{mob.name}</span>
                    <span className="font-mono text-2xs text-text-muted">{mob.templateKey}</span>
                  </div>
                  <HpBar label="HP" current={mob.hp} max={mob.maxHp} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted">None</p>
          )}
        </Section>
      </div>

      {/* Features */}
      {room.features.length > 0 && (
        <Section title="Features">
          <div className="flex flex-wrap gap-1.5">
            {room.features.map((feature) => (
              <span
                key={feature}
                className="rounded-full bg-[var(--chrome-fill)] px-2.5 py-1 text-2xs text-text-muted"
              >
                {feature}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Station */}
      {room.station && (
        <Section title="Station">
          <StatRow label="Type" value={room.station} valueClass="text-stellar-blue" />
        </Section>
      )}

      {/* Media */}
      {hasMedia && (
        <Section title="Media">
          {room.image && <StatRow label="Image" value={room.image} valueClass="font-mono text-text-secondary" />}
          {room.music && <StatRow label="Music" value={room.music} valueClass="font-mono text-text-secondary" />}
          {room.ambient && <StatRow label="Ambient" value={room.ambient} valueClass="font-mono text-text-secondary" />}
          {room.video && <StatRow label="Video" value={room.video} valueClass="font-mono text-text-secondary" />}
        </Section>
      )}
    </div>
  );
}
