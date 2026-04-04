import { useAdminStore } from "@/stores/adminStore";
import type { ZoneDetail } from "@/types/admin";

export function AdminZoneDetail({
  zone,
  onBack,
}: {
  zone: ZoneDetail;
  onBack: () => void;
}) {
  const fetchRoomDetail = useAdminStore((s) => s.fetchRoomDetail);

  const handleRoomClick = (roomId: string) => {
    // Room ID format is "zone:room" — extract the room part
    const parts = roomId.split(":");
    const roomPart = parts.length > 1 ? parts.slice(1).join(":") : roomId;
    fetchRoomDetail(zone.name, roomPart);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs text-text-muted transition hover:bg-white/10 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none"
        >
          &#x2190; Back
        </button>
        <h3 className="font-display text-xl text-text-primary">{zone.name}</h3>
        <span className="text-2xs uppercase tracking-ui text-text-muted">
          {zone.rooms.length} room{zone.rooms.length !== 1 ? "s" : ""}
        </span>
      </div>

      <p className="text-xs text-text-muted">Click a room to inspect its full detail.</p>

      <div className="flex flex-col gap-1.5">
        {zone.rooms.map((room) => (
          <button
            key={room.id}
            onClick={() => handleRoomClick(room.id)}
            className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors duration-200 hover:border-accent/20 hover:bg-accent/[0.04] hover:shadow-[inset_3px_0_0_var(--color-accent)] focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none ${
              room.players.length > 0
                ? "border-accent/15 bg-accent/[0.03]"
                : "border-white/8 bg-white/4"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-display text-sm text-text-primary">
                  {room.title}
                </div>
                <div className="mt-0.5 text-2xs text-text-muted">{room.id}</div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1 text-2xs text-text-muted">
                {room.exits.map((exit) => (
                  <span key={exit} className="rounded-full bg-black/15 px-2 py-0.5">
                    {exit}
                  </span>
                ))}
              </div>
            </div>

            {(room.players.length > 0 || room.mobs.length > 0) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {room.players.map((name, i) => (
                  <span
                    key={`p:${name}:${i}`}
                    className="rounded-full bg-status-success/12 px-2 py-0.5 text-2xs text-status-success"
                  >
                    {name}
                  </span>
                ))}
                {room.mobs.map((name, i) => (
                  <span
                    key={`m:${name}:${i}`}
                    className="rounded-full bg-status-warning/12 px-2 py-0.5 text-2xs text-status-warning"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
