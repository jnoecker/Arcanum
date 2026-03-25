import { useEffect, useRef, type ReactNode } from "react";

/**
 * Wraps a side panel (RoomPanel / EntityPanel) with a spring-physics
 * slide-in animation using the Web Animations API.
 *
 * On mount: slides in from the right with spring easing.
 * On key change: cross-fades content with a subtle slide.
 * Respects prefers-reduced-motion (no animation, instant display).
 */

// Spring approximation via CSS linear() easing — matches a spring with
// damping ~0.7, stiffness ~180. Pre-computed 20 keyframes.
const SPRING_EASING =
  "linear(0, 0.009, 0.035, 0.078, 0.136, 0.207, 0.290, 0.381, 0.476, 0.571, 0.662, 0.745, 0.818, 0.878, 0.924, 0.957, 0.979, 0.991, 0.998, 1)";

interface SpringPanelProps {
  /** Key that changes when the panel content switches (e.g. roomId) */
  contentKey: string;
  children: ReactNode;
}

export function SpringPanel({ contentKey, children }: SpringPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevKeyRef = useRef<string | null>(null);
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el || reducedMotion.current) {
      prevKeyRef.current = contentKey;
      return;
    }

    if (prevKeyRef.current === null) {
      // First mount — slide in from right
      el.animate(
        [
          { transform: "translateX(2rem)", opacity: 0 },
          { transform: "translateX(0)", opacity: 1 },
        ],
        {
          duration: 400,
          easing: SPRING_EASING,
          fill: "backwards",
        },
      );
    } else if (prevKeyRef.current !== contentKey) {
      // Content switch — subtle cross-fade with slide
      el.animate(
        [
          { transform: "translateX(0.5rem)", opacity: 0.3 },
          { transform: "translateX(0)", opacity: 1 },
        ],
        {
          duration: 250,
          easing: SPRING_EASING,
          fill: "backwards",
        },
      );
    }

    prevKeyRef.current = contentKey;
  }, [contentKey]);

  return (
    <div ref={containerRef} className="flex min-h-0 shrink-0 flex-col">
      {children}
    </div>
  );
}
