import { useEffect, useState } from "react";
import { useToastStore } from "@/stores/toastStore";

export function Toast() {
  const toast = useToastStore((s) => s.toast);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [displayedToast, setDisplayedToast] = useState(toast);

  useEffect(() => {
    if (toast) {
      setDisplayedToast(toast);
      setRendered(true);
      // Trigger enter transition on next frame.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisible(true);
        });
      });
    } else {
      setVisible(false);
      // Wait for exit transition before unmounting.
      const id = setTimeout(() => setRendered(false), 200);
      return () => clearTimeout(id);
    }
  }, [toast]);

  if (!rendered) return null;

  const variant = displayedToast?.variant ?? "default";
  const glyph = displayedToast?.glyph ?? (variant === "ember" ? "\u2726" : variant === "astral" ? "\u2736" : "\u2727");

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center"
    >
      <div
        className={`toast-shell toast-shell-${variant} max-w-md transition-[opacity,transform] duration-200 ease-out ${
          visible
            ? "translate-y-0 opacity-100"
            : "translate-y-2 opacity-0"
        }`}
      >
        <div className="toast-ornament" aria-hidden="true">
          <span className="toast-glyph">{glyph}</span>
          <span className="toast-tail" />
        </div>
        <div className="min-w-0">
          {displayedToast?.kicker && (
            <p className="toast-kicker">{displayedToast.kicker}</p>
          )}
          <p className="toast-message">{displayedToast?.message}</p>
        </div>
      </div>
    </div>
  );
}
