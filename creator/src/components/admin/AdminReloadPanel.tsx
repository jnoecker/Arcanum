import { useState, useRef, useEffect } from "react";
import { useAdminStore } from "@/stores/adminStore";
import { Spinner } from "@/components/ui/FormWidgets";
import type { ReloadTarget } from "@/types/admin";

const RELOAD_TARGETS: Array<{ id: ReloadTarget; label: string; description: string }> = [
  { id: "all", label: "Everything", description: "World, abilities, and status effects" },
  { id: "world", label: "World", description: "Rooms, mobs, items, shops, quests" },
  { id: "abilities", label: "Abilities", description: "Ability and spell definitions" },
  { id: "effects", label: "Effects", description: "Status effect definitions" },
];

export function AdminReloadPanel() {
  const reload = useAdminStore((s) => s.reload);
  const lastReload = useAdminStore((s) => s.lastReload);
  const [selectedTarget, setSelectedTarget] = useState<ReloadTarget>("all");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const [showRipple, setShowRipple] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const handleReloadClick = () => {
    if (!confirming) {
      setConfirming(true);
      setResultMessage(null);
      setResultError(null);
      confirmTimer.current = setTimeout(() => setConfirming(false), 4000);
      return;
    }
    setConfirming(false);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    doReload();
  };

  const handleCancel = () => {
    setConfirming(false);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
  };

  const doReload = async () => {
    setLoading(true);
    setResultMessage(null);
    setResultError(null);
    const result = await reload(selectedTarget);
    setLoading(false);
    if (result) {
      setResultMessage(result.summary);
      // Gold ripple — the world has been reshaped
      setShowRipple(true);
      setTimeout(() => setShowRipple(false), 700);
    } else {
      setResultError(useAdminStore.getState().lastError ?? "Reload failed");
    }
  };

  return (
    <div className="relative flex flex-col gap-5">
      {/* Gold ripple on successful reload */}
      {showRipple && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center pt-20">
          <div className="h-16 w-16 rounded-full bg-accent/30 motion-safe:animate-reload-ripple" />
        </div>
      )}

      <div>
        <h3 className="font-display text-lg text-text-primary">Reshape the world</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Reload definitions from disk. Active players stay connected; new data takes effect on next spawn cycle.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {RELOAD_TARGETS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedTarget(t.id)}
            className={`rounded-2xl border px-4 py-3 text-left transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none ${
              selectedTarget === t.id
                ? "border-border-active bg-gradient-active-strong shadow-sm shadow-accent/10"
                : "border-[var(--chrome-stroke)] bg-[var(--chrome-highlight)] hover:border-[var(--chrome-stroke-strong)] hover:bg-[var(--chrome-highlight)]"
            }`}
          >
            <div className="font-display text-sm text-text-primary">{t.label}</div>
            <div className="mt-1 text-2xs text-text-muted">{t.description}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleReloadClick}
          disabled={loading}
          className={`relative overflow-hidden rounded-xl border px-5 py-2 text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
            confirming
              ? "border-status-warning/50 bg-status-warning/15 text-status-warning"
              : "border-border-active bg-gradient-active-strong text-text-primary hover:shadow-glow"
          }`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Spinner /> Reshaping...
            </span>
          ) : confirming ? (
            "Confirm reload"
          ) : (
            `Reload ${RELOAD_TARGETS.find((t) => t.id === selectedTarget)?.label}`
          )}
        </button>
        {confirming && (
          <button
            onClick={handleCancel}
            className="rounded text-xs text-text-muted hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none"
          >
            Cancel
          </button>
        )}

        {resultMessage && (
          <span className="motion-safe:animate-unfurl-in rounded-full bg-status-success/12 px-3 py-1 text-xs text-status-success">
            {resultMessage}
          </span>
        )}
        {resultError && (
          <span className="motion-safe:animate-unfurl-in rounded-full bg-status-error/15 px-3 py-1 text-xs text-status-error">
            {resultError}
          </span>
        )}
      </div>

      {lastReload && !resultMessage && !resultError && (
        <p className="text-xs text-text-muted">
          Last reshaped: {lastReload.summary}
        </p>
      )}
    </div>
  );
}
