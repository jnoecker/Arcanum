import { useMemo } from "react";
import { m } from "motion/react";
import { getEntrancePreset, getExitPreset } from "@/lib/movementPresets";
import { resolveEntityPosition, isBackRow, getEntityScale } from "@/lib/sceneLayout";
import type { SceneEntity } from "@/types/story";

// ─── Props ─────────────────────────────────────────────────────────

interface AnimatedEntityProps {
  entity: SceneEntity;
  entityName: string;
  imageSrc?: string;
  playing: boolean;
  exiting: boolean;
}

// ─── Reduced motion check ──────────────────────────────────────────

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ─── Easing curves ─────────────────────────────────────────────────

const EASE_UNFURL: [number, number, number, number] = [0.16, 1, 0.3, 1];
const EASE_DISSOLVE: [number, number, number, number] = [0.7, 0, 0.84, 0];

// ─── Placeholder icons (inline SVG, 20px) ──────────────────────────

function PlaceholderIcon({ type }: { type: SceneEntity["entityType"] }) {
  if (type === "mob") {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-text-muted">
        <path
          d="M10 2C6.5 2 4 5 4 8c0 2 1 3.5 2 4.5L5 18h10l-1-5.5c1-1 2-2.5 2-4.5 0-3-2.5-6-6-6z"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        <circle cx="7.5" cy="7.5" r="1" fill="currentColor" />
        <circle cx="12.5" cy="7.5" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (type === "item") {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-text-muted">
        <path
          d="M10 2l2.5 5.5L18 8.5l-4 4 1 5.5-5-2.5-5 2.5 1-5.5-4-4 5.5-1z"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
      </svg>
    );
  }
  // npc
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-text-muted">
      <circle cx="10" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path
        d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

// ─── AnimatedEntity ────────────────────────────────────────────────

export function AnimatedEntity({
  entity,
  entityName,
  imageSrc,
  playing,
  exiting,
}: AnimatedEntityProps) {
  const pos = resolveEntityPosition(entity);
  const scale = getEntityScale(entity);
  const backRow = isBackRow(entity.slot);
  const baseWidth = 72;
  const width = Math.round(baseWidth * scale);

  const entrancePreset = getEntrancePreset(entity.entrancePath);
  const exitPreset = getExitPreset(entity.exitPath);

  // ─── Compute animation state ─────────────────────────────────

  const animationProps = useMemo(() => {
    if (prefersReducedMotion) {
      // Reduced motion: instant transitions
      if (exiting) {
        return {
          animate: { opacity: 0 },
          transition: { duration: 0.2 },
        };
      }
      return {
        initial: { opacity: playing ? 0 : 1 },
        animate: { opacity: 1 },
        transition: { duration: 0.2 },
      };
    }

    // ─── Exit animation ──────────────────────────────────────
    if (exiting) {
      if (exitPreset && exitPreset.path) {
        return {
          animate: { offsetDistance: "100%", opacity: 0 },
          transition: {
            duration: exitPreset.duration,
            ease: EASE_DISSOLVE,
          },
          style: {
            offsetPath: `path("${exitPreset.path}")`,
            offsetDistance: "0%",
          },
        };
      }
      // Fade out
      const dur = exitPreset?.duration ?? 0.6;
      return {
        animate: { opacity: 0 },
        transition: { duration: dur, ease: EASE_DISSOLVE },
      };
    }

    // ─── Entrance animation ──────────────────────────────────
    if (playing) {
      if (entrancePreset && entrancePreset.path) {
        return {
          initial: { offsetDistance: "0%", opacity: 0 },
          animate: { offsetDistance: "100%", opacity: 1 },
          transition: {
            duration: entrancePreset.duration,
            ease: EASE_UNFURL,
          },
          style: {
            offsetPath: `path("${entrancePreset.path}")`,
          },
        };
      }
      // Fade in place
      const dur = entrancePreset?.duration ?? 0.8;
      return {
        initial: { opacity: 0, y: 4 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: dur, ease: EASE_UNFURL },
      };
    }

    // ─── Static state (not playing, not exiting) ─────────────
    return {
      initial: false as const,
      animate: { opacity: 1 },
    };
  }, [playing, exiting, entrancePreset, exitPreset]);

  // Separate style from motion props to avoid type conflicts
  const extraStyle = (animationProps as Record<string, unknown>).style as
    | React.CSSProperties
    | undefined;
  const { style: _style, ...motionProps } = animationProps as Record<string, unknown> & {
    style?: React.CSSProperties;
  };

  // ─── Render ──────────────────────────────────────────────────

  return (
    <m.div
      className="absolute pointer-events-none"
      {...motionProps}
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: "translate(-50%, -100%)",
        opacity: backRow ? 0.9 : 1,
        width: `${width}px`,
        ...extraStyle,
      }}
    >
      {/* Entity sprite or placeholder */}
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={entityName}
          className="w-full h-auto object-contain pointer-events-none"
          draggable={false}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded bg-bg-elevated/80"
          style={{ width: `${width}px`, height: `${Math.round(width * 1.2)}px` }}
        >
          <PlaceholderIcon type={entity.entityType} />
        </div>
      )}

      {/* Name label */}
      <p
        className="text-center font-body text-xs text-white whitespace-nowrap overflow-hidden text-ellipsis pointer-events-none"
        style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
      >
        {entityName}
      </p>
    </m.div>
  );
}
