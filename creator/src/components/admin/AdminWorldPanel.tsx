import { useAdminStore } from "@/stores/adminStore";
import { AdminZoneList } from "./AdminZoneList";
import { AdminMobList } from "./AdminMobList";
import { AdminRoomDetail } from "./AdminRoomDetail";
import { AdminMobDetail } from "./AdminMobDetail";

export function AdminWorldPanel() {
  const selectedRoom = useAdminStore((s) => s.selectedRoom);
  const selectedMob = useAdminStore((s) => s.selectedMob);

  if (selectedRoom) return <AdminRoomDetail />;
  if (selectedMob) return <AdminMobDetail />;

  return (
    <div className="flex flex-col gap-6">
      <AdminZoneList />
      <AdminMobList />
    </div>
  );
}
