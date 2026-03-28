import { memo } from "react";
import { useAdminStore } from "@/stores/adminStore";

const Section = memo(function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-gradient-panel-light p-4 shadow-section-sm">
      <h4 className="mb-2 text-[11px] uppercase tracking-wide-ui text-text-muted">{title}</h4>
      {children}
    </div>
  );
});

const StatRow = memo(function StatRow({ label, value, valueClass }: { label: string; value: string | number; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/6 py-2 last:border-b-0">
      <span className="text-xs capitalize text-text-muted">{label}</span>
      <span className={`text-xs ${valueClass ?? "text-text-primary"}`}>{value}</span>
    </div>
  );
});

const VitalBar = memo(function VitalBar({
  label,
  current,
  max,
  color,
  ariaLabel,
}: {
  label: string;
  current: number;
  max: number;
  color: string;
  ariaLabel: string;
}) {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0;
  return (
    <div className="flex items-center justify-between border-b border-white/6 py-2 last:border-b-0">
      <span className="text-xs text-text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <div
          className="h-1.5 w-14 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={ariaLabel}
        >
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-text-primary">
          {current} / {max}
        </span>
      </div>
    </div>
  );
});

export function AdminMobDetail() {
  const mob = useAdminStore((s) => s.selectedMob);
  const clearSelectedMob = useAdminStore((s) => s.clearSelectedMob);

  if (!mob) return null;

  const hpPct = mob.maxHp > 0 ? (mob.hp / mob.maxHp) * 100 : 0;
  const hpColor = hpPct > 60 ? "bg-status-success" : hpPct > 25 ? "bg-status-warning" : "bg-status-error";

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={clearSelectedMob}
          className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs text-text-muted transition hover:bg-white/10 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none"
        >
          &#x2190; Back
        </button>
        <h3 className="font-display text-xl text-text-primary">{mob.name}</h3>
        {mob.aggressive && (
          <span className="rounded-full bg-status-error/12 px-2 py-0.5 text-2xs text-status-error">
            Aggressive
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {/* Identity */}
        <Section title="Identity">
          <StatRow label="Name" value={mob.name} />
          <StatRow label="ID" value={mob.id} valueClass="font-mono text-text-secondary" />
          <StatRow label="Template" value={mob.templateKey} valueClass="text-stellar-blue" />
          <StatRow label="Room" value={mob.roomId} valueClass="font-mono text-text-secondary" />
          <StatRow label="Spawn room" value={mob.spawnRoomId} valueClass="font-mono text-text-secondary" />
        </Section>

        {/* Combat */}
        <Section title="Combat">
          <VitalBar label="HP" current={mob.hp} max={mob.maxHp} color={hpColor} ariaLabel="Health" />
          <StatRow label="Armor" value={mob.armor} />
          <StatRow label="XP reward" value={mob.xpReward.toLocaleString()} valueClass="text-status-warning" />
          <StatRow
            label="Aggressive"
            value={mob.aggressive ? "Yes" : "No"}
            valueClass={mob.aggressive ? "text-status-error" : "text-text-primary"}
          />
        </Section>

        {/* Quests */}
        <Section title="Quests">
          {mob.questIds.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {mob.questIds.map((id) => (
                <span
                  key={id}
                  className="rounded-full bg-status-warning/12 px-2.5 py-1 text-2xs text-status-warning"
                >
                  {id}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted">None</p>
          )}
        </Section>
      </div>
    </div>
  );
}
