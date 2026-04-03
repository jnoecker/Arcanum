import { useState, useRef, useEffect } from "react";
import { useAdminStore } from "@/stores/adminStore";
import { Spinner } from "@/components/ui/FormWidgets";

const MAX_LENGTH = 500;

export function AdminBroadcastPanel() {
  const broadcast = useAdminStore((s) => s.broadcast);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const handleSendClick = () => {
    if (!confirming) {
      setConfirming(true);
      setResultMessage(null);
      setResultError(null);
      confirmTimer.current = setTimeout(() => setConfirming(false), 4000);
      return;
    }
    setConfirming(false);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    doSend();
  };

  const handleCancel = () => {
    setConfirming(false);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
  };

  const doSend = async () => {
    setLoading(true);
    setResultMessage(null);
    setResultError(null);
    const result = await broadcast(message);
    setLoading(false);
    if (result) {
      setResultMessage(`Delivered to ${result.recipients} player${result.recipients !== 1 ? "s" : ""}`);
      setMessage("");
    } else {
      setResultError(useAdminStore.getState().lastError ?? "Broadcast failed");
    }
  };

  const trimmed = message.trim();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="font-display text-lg text-text-primary">Address the world</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Send a message to all connected players.
        </p>
      </div>

      <div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
          placeholder="Enter your message to the world..."
          rows={3}
          className="w-full resize-none rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-border-active focus:outline-none focus-visible:ring-2 focus-visible:ring-border-active"
        />
        <div className="mt-1 text-right text-[11px] text-text-muted">
          {message.length}/{MAX_LENGTH}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSendClick}
          disabled={loading || !trimmed}
          className={`rounded-xl border px-5 py-2 text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-border-active focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
            confirming
              ? "border-status-warning/50 bg-status-warning/15 text-status-warning"
              : "border-border-active bg-gradient-active-strong text-text-primary hover:-translate-y-0.5 hover:shadow-glow"
          }`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Spinner /> Sending...
            </span>
          ) : confirming ? (
            "Confirm broadcast"
          ) : (
            "Send broadcast"
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
    </div>
  );
}
