import { useEffect, useState } from "react";
import { useToastStore } from "@/stores/toastStore";

export function Toast() {
  const message = useToastStore((s) => s.message);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (message) {
      setRendered(true);
      // Trigger enter transition on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisible(true);
        });
      });
    } else {
      setVisible(false);
      // Wait for exit transition before unmounting
      const id = setTimeout(() => setRendered(false), 200);
      return () => clearTimeout(id);
    }
  }, [message]);

  if (!rendered) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center"
    >
      <div
        className={`max-w-sm rounded-xl border border-border-default/60 bg-bg-tertiary px-4 py-2 font-body text-sm text-text-secondary shadow-section transition-[opacity,transform] duration-200 ease-out ${
          visible
            ? "translate-y-0 opacity-100"
            : "translate-y-2 opacity-0"
        }`}
      >
        {message}
      </div>
    </div>
  );
}
