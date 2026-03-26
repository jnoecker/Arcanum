import { AdminReloadPanel } from "./AdminReloadPanel";
import { AdminBroadcastPanel } from "./AdminBroadcastPanel";

export function AdminActionsPanel() {
  return (
    <div className="flex flex-col gap-8">
      <AdminReloadPanel />
      <div className="h-px bg-white/8" />
      <AdminBroadcastPanel />
    </div>
  );
}
