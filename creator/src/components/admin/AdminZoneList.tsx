import { useAdminStore } from "@/stores/adminStore";
import type { ZoneSummary } from "@/types/admin";
import { AdminZoneDetail } from "./AdminZoneDetail";

function ZoneRow({
  zone,
  onSelect,
}: {
  zone: ZoneSummary;
  onSelect: (name: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(zone.name)}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200 hover:border-accent/20 hover:bg-accent/[0.04] hover:shadow-[inset_3px_0_0_var(--color-accent)] focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none ${
        zone.playersOnline > 0
          ? "border-accent/15 bg-accent/[0.03]"
          : "border-white/8 bg-white/4"
      }`}
    >
      <div className="min-w-0 flex-1">
        <span className="truncate font-display text-sm text-text-primary">{zone.name}</span>
      </div>
      <div className="flex shrink-0 gap-3 text-[11px] text-text-muted">
        <span className="rounded-full bg-black/15 px-2 py-1">
          {zone.roomCount} room{zone.roomCount !== 1 ? "s" : ""}
        </span>
        {zone.playersOnline > 0 && (
          <span className="rounded-full bg-status-success/12 px-2 py-1 text-status-success">
            {zone.playersOnline} player{zone.playersOnline !== 1 ? "s" : ""}
          </span>
        )}
        <span className="rounded-full bg-black/15 px-2 py-1">
          {zone.mobsAlive} mob{zone.mobsAlive !== 1 ? "s" : ""}
        </span>
      </div>
    </button>
  );
}

export function AdminZoneList() {
  const zones = useAdminStore((s) => s.zones);
  const selectedZone = useAdminStore((s) => s.selectedZone);
  const fetchZoneDetail = useAdminStore((s) => s.fetchZoneDetail);
  const clearSelectedZone = useAdminStore((s) => s.clearSelectedZone);

  if (selectedZone) {
    return <AdminZoneDetail zone={selectedZone} onBack={clearSelectedZone} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg text-text-primary">Regions</h3>
          <p className="mt-0.5 text-xs text-text-muted">Zones loaded on the server. Click to see rooms and occupants.</p>
        </div>
        <span className="text-[11px] uppercase tracking-ui text-text-muted">
          {zones.length} active
        </span>
      </div>

      {zones.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-white/12 bg-white/4 px-6 py-12 text-center">
          <p className="font-display text-base text-text-secondary">No regions manifest</p>
          <p className="mt-1 text-sm text-text-muted">The server has no zones loaded.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {zones.map((z) => (
            <ZoneRow key={z.name} zone={z} onSelect={fetchZoneDetail} />
          ))}
        </div>
      )}
    </div>
  );
}
