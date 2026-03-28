import { useEffect, useRef, type ReactNode } from "react";

/**
 * Wraps a side panel (RoomPanel / EntityPanel) with a spring-physics
 * slide-in animation using the Web Animations API.
 *
 * On mount: slides in from the right with spring easing.
 * On key change: cross-fades content with a subtle slide.
 * Respects prefers-reduced-motion (no animation, instant display).
 */

// Design system easings (Web Animations API doesn't support var())
const EASE_UNFURL = "cubic-bezier(0.16, 1, 0.3, 1)"; // --ease-unfurl: entry
const EASE_COSMIC = "cubic-bezier(0.4, 0, 0.2, 1)";  // --ease-cosmic: bidirectional

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
          easing: EASE_UNFURL,
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
          easing: EASE_COSMIC,
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
