import { m } from "motion/react";
import { extractWords } from "@/lib/sceneLayout";
import { NARRATION_TIMING } from "@/lib/narrationSpeed";
import type { NarrationSpeed } from "@/lib/narrationSpeed";

// ─── Props ─────────────────────────────────────────────────────────

interface TypewriterNarrationProps {
  narrationJson: string;
  playing: boolean;
  speed: NarrationSpeed;
}

// ─── Reduced motion check ──────────────────────────────────────────

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ─── Easing ────────────────────────────────────────────────────────

const EASE_UNFURL: [number, number, number, number] = [0.16, 1, 0.3, 1];

// ─── TypewriterNarration ───────────────────────────────────────────

export function TypewriterNarration({
  narrationJson,
  playing,
  speed,
}: TypewriterNarrationProps) {
  const words = extractWords(narrationJson);

  if (words.length === 0) return null;

  const timing = NARRATION_TIMING[speed];

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: timing.wordGap,
        delayChildren: 0,
      },
    },
  };

  const wordVariants = prefersReducedMotion
    ? {
        hidden: { opacity: 1, y: 0 },
        visible: { opacity: 1, y: 0 },
      }
    : {
        hidden: { opacity: 0, y: 4 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: timing.wordDuration, ease: EASE_UNFURL },
        },
      };

  return (
    <m.p
      variants={containerVariants}
      initial={prefersReducedMotion ? "visible" : "hidden"}
      animate={playing ? "visible" : "hidden"}
      className="text-[15px] text-text-primary leading-relaxed px-6 py-4"
      style={{ textShadow: "var(--shadow-text)" }}
      aria-live="polite"
    >
      {words.map((word, i) => (
        <m.span key={i} variants={wordVariants} className="inline-block mr-[0.3em]">
          {word}
        </m.span>
      ))}
    </m.p>
  );
}
