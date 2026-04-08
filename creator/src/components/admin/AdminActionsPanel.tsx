import { AdminReloadPanel } from "./AdminReloadPanel";
import { AdminBroadcastPanel } from "./AdminBroadcastPanel";

export function AdminActionsPanel() {
  return (
    <div className="flex flex-col gap-8">
      <AdminReloadPanel />
      <div className="h-px bg-[var(--chrome-highlight-strong)]" />
      <AdminBroadcastPanel />
    </div>
  );
}
