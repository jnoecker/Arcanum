import { useEffect, useState } from "react";
import { useAdminStore } from "@/stores/adminStore";
import type { MobSummary } from "@/types/admin";

function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  if (maxHp <= 0) return null;
  const pct = Math.round((hp / maxHp) * 100);
  const color =
    pct > 60 ? "bg-status-success" : pct > 25 ? "bg-status-warning" : "bg-status-error";
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={hp}
        aria-valuemin={0}
        aria-valuemax={maxHp}
        aria-label="Health"
      >
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-2xs text-text-muted">
        {hp}/{maxHp}
      </span>
    </div>
  );
}

function MobRow({
  mob,
  onSelect,
}: {
  mob: MobSummary;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(mob.id)}
      className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-left transition-all duration-200 hover:border-accent/20 hover:bg-accent/[0.04] hover:shadow-[inset_3px_0_0_var(--color-accent)] focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-sm text-text-primary">{mob.name}</span>
          {mob.aggressive && (
            <span className="rounded-full bg-status-error/12 px-2 py-0.5 text-2xs text-status-error">
              Aggressive
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
          <span className="font-mono text-text-muted" title={mob.roomId}>
            {mob.roomId.length > 30 ? mob.roomId.slice(0, 27) + "..." : mob.roomId}
          </span>
          <span className="text-text-secondary">{mob.templateKey}</span>
        </div>
      </div>
      <div className="shrink-0">
        <HpBar hp={mob.hp} maxHp={mob.maxHp} />
      </div>
    </button>
  );
}

export function AdminMobList() {
  const mobs = useAdminStore((s) => s.mobs);
  const zones = useAdminStore((s) => s.zones);
  const fetchMobs = useAdminStore((s) => s.fetchMobs);
  const fetchMobDetail = useAdminStore((s) => s.fetchMobDetail);
  const [zoneFilter, setZoneFilter] = useState("");

  useEffect(() => {
    fetchMobs(zoneFilter || undefined);
  }, [fetchMobs, zoneFilter]);

  const filteredMobs = mobs;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg text-text-primary">Live creatures</h3>
          <p className="mt-0.5 text-xs text-text-muted">
            All active mob instances across the world.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {zones.length > 0 && (
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-text-secondary backdrop-blur-sm transition focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none"
              aria-label="Filter by zone"
            >
              <option value="">All zones</option>
              {zones.map((z) => (
                <option key={z.name} value={z.name}>
                  {z.name}
                </option>
              ))}
            </select>
          )}
          <span className="text-[11px] uppercase tracking-ui text-text-muted">
            {filteredMobs.length} active
          </span>
        </div>
      </div>

      {filteredMobs.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-white/12 bg-white/4 px-6 py-12 text-center">
          <p className="font-display text-base text-text-secondary">No creatures stir</p>
          <p className="mt-1 text-sm text-text-muted">
            {zoneFilter
              ? "No mobs are alive in this zone."
              : "No mobs are alive on the server."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filteredMobs.map((mob) => (
            <MobRow key={mob.id} mob={mob} onSelect={fetchMobDetail} />
          ))}
        </div>
      )}
    </div>
  );
}
