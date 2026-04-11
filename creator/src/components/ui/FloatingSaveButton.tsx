import { useState } from "react";
import { useZoneStore, selectDirtyCount } from "@/stores/zoneStore";
import { useConfigStore } from "@/stores/configStore";
import { useToastStore } from "@/stores/toastStore";
import { saveEverything } from "@/lib/saveAll";

export function FloatingSaveButton() {
  const dirtyZones = useZoneStore(selectDirtyCount);
  const configDirty = useConfigStore((s) => s.dirty);
  const show = useToastStore((s) => s.show);
  const [saving, setSaving] = useState(false);

  const totalDirty = dirtyZones + (configDirty ? 1 : 0);
  if (totalDirty === 0) return null;

  const handleClick = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const { savedZones, savedConfig } = await saveEverything();
      const parts: string[] = [];
      if (savedZones.length > 0) {
        parts.push(`${savedZones.length} zone${savedZones.length === 1 ? "" : "s"}`);
      }
      if (savedConfig) parts.push("config");
      show({
        kicker: "Saved",
        message: parts.length > 0 ? parts.join(" + ") : "No changes",
        variant: "astral",
      });
    } catch (err) {
      console.error("Save all failed:", err);
      show({
        kicker: "Save failed",
        message: err instanceof Error ? err.message : "Unknown error",
        variant: "ember",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-40 flex items-end justify-end">
      <button
        type="button"
        onClick={handleClick}
        disabled={saving}
        className="focus-ring pointer-events-auto flex items-center gap-2.5 rounded-full border border-accent/50 bg-[var(--bg-active-strong)] px-5 py-2.5 font-display text-sm font-semibold uppercase tracking-label text-accent shadow-[0_0_22px_rgb(var(--accent-rgb)/0.35)] transition hover:border-accent hover:bg-accent/18 hover:shadow-[0_0_28px_rgb(var(--accent-rgb)/0.55)] active:scale-[0.97] disabled:opacity-70 animate-warm-breathe"
        title={`Save all unsaved changes (Ctrl+S) — ${totalDirty} pending`}
        aria-label={`Save all unsaved changes, ${totalDirty} pending`}
      >
        <span aria-hidden="true" className="text-base leading-none">✦</span>
        <span>{saving ? "Saving" : "Save"}</span>
        <span
          aria-hidden="true"
          className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-2xs font-medium tabular-nums text-accent"
        >
          {totalDirty}
        </span>
      </button>
    </div>
  );
}
