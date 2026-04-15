import { useEffect, useRef, type ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Dialog({ open, onClose, labelledBy, describedBy, children }: DialogProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;

    const surface = surfaceRef.current;
    if (surface) {
      const first = surface.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? surface).focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !surface) return;
      const focusables = Array.from(
        surface.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) {
        e.preventDefault();
        surface.focus();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={surfaceRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}
