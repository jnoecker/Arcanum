import { useEffect, useRef, useState } from "react";
import { LazyMotion, m } from "motion/react";
import { loadMotionFeatures } from "@/lib/motionFeatures";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

const BUTTERFLY_SPRITES = [
  "/butterflies/ember.png",
  "/butterflies/sapphire.png",
  "/butterflies/jade.png",
  "/butterflies/rose.png",
  "/butterflies/amethyst.png",
  "/butterflies/prism.png",
  "/butterflies/cyberpunk.png",
];

interface Member {
  sprite: string;
  offsetX: number;
  offsetY: number;
  size: number;
  wingSpeed: number;
  flapDepth: number;
  bobRange: number;
  bobSpeed: number;
}

interface CloudInstance {
  id: number;
  fromLeft: boolean;
  startY: number;
  midY: number;
  endY: number;
  duration: number;
  members: Member[];
}

const MIN_DELAY_MS = 30_000;
const MAX_DELAY_MS = 90_000;
const INITIAL_DELAY_MIN_MS = 12_000;
const INITIAL_DELAY_RANGE_MS = 18_000;

function pickSprites(count: number): string[] {
  const pool = [...BUTTERFLY_SPRITES];
  const picked: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]!);
  }
  return picked;
}

function createCloud(id: number): CloudInstance {
  const fromLeft = Math.random() < 0.5;
  const direction = Math.random() < 0.5 ? -1 : 1;
  const startY = direction > 0 ? 10 + Math.random() * 30 : 60 + Math.random() * 30;
  const verticalTravel = 35 + Math.random() * 30;
  const endY = Math.max(5, Math.min(95, startY + direction * verticalTravel));
  const midY = (startY + endY) / 2 + (Math.random() - 0.5) * 10;
  const duration = 26 + Math.random() * 12;
  const count = 3 + Math.floor(Math.random() * 3); // 3-5
  const sprites = pickSprites(count);
  const members: Member[] = sprites.map((sprite) => ({
    sprite,
    offsetX: (Math.random() - 0.5) * 220,
    offsetY: (Math.random() - 0.5) * 150,
    size: 22 + Math.pow(Math.random(), 1.6) * 48,
    wingSpeed: 0.32 + Math.random() * 0.18,
    flapDepth: 0.55 + Math.random() * 0.2,
    bobRange: 4 + Math.random() * 6,
    bobSpeed: 2.4 + Math.random() * 1.6,
  }));
  return { id, fromLeft, startY, midY, endY, duration, members };
}

/**
 * Rare, idle butterfly clouds drifting across the World Map.
 *
 * A cloud of 3–5 ornamental butterflies appears every 30–90 seconds of idle
 * time, each with its own flap rate, float offset, and size. Honors
 * prefers-reduced-motion.
 */
export function Butterflies() {
  const reducedMotion = usePrefersReducedMotion();
  const [clouds, setClouds] = useState<CloudInstance[]>([]);
  const nextIdRef = useRef(1);

  useEffect(() => {
    if (reducedMotion) return;

    let timeoutId: number | null = null;
    let cancelled = false;

    const schedule = (delay: number) => {
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        if (!document.hidden) {
          const id = nextIdRef.current++;
          setClouds((prev) => [...prev, createCloud(id)]);
        }
        schedule(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
      }, delay);
    };

    schedule(INITIAL_DELAY_MIN_MS + Math.random() * INITIAL_DELAY_RANGE_MS);

    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [reducedMotion]);

  if (reducedMotion) return null;

  const handleExit = (id: number) => {
    setClouds((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
      >
        {clouds.map((c) => (
          <Cloud key={c.id} cloud={c} onExit={() => handleExit(c.id)} />
        ))}
      </div>
    </LazyMotion>
  );
}

interface CloudProps {
  cloud: CloudInstance;
  onExit: () => void;
}

function Cloud({ cloud, onExit }: CloudProps) {
  const { fromLeft, startY, midY, endY, duration, members } = cloud;
  const startX = fromLeft ? -14 : 114;
  const midX = 50;
  const endX = fromLeft ? 114 : -14;

  return (
    <m.div
      className="absolute"
      style={{ left: 0, top: 0 }}
      initial={{ left: `${startX}%`, top: `${startY}%`, opacity: 0 }}
      animate={{
        left: [`${startX}%`, `${midX}%`, `${endX}%`],
        top: [`${startY}%`, `${midY}%`, `${endY}%`],
        opacity: [0, 0.92, 0.92, 0],
      }}
      transition={{
        left: { duration, ease: "linear" },
        top: { duration, ease: "easeInOut" },
        opacity: { duration, times: [0, 0.14, 0.86, 1], ease: "easeInOut" },
      }}
      onAnimationComplete={onExit}
    >
      {members.map((member, i) => (
        <Butterfly key={i} member={member} facingLeft={!fromLeft} />
      ))}
    </m.div>
  );
}

interface ButterflyProps {
  member: Member;
  facingLeft: boolean;
}

function Butterfly({ member, facingLeft }: ButterflyProps) {
  const { sprite, offsetX, offsetY, size, wingSpeed, flapDepth, bobRange, bobSpeed } = member;
  return (
    <m.div
      className="absolute"
      style={{
        left: offsetX,
        top: offsetY,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        filter: "drop-shadow(0 2px 4px rgba(0, 21, 36, 0.45))",
      }}
      animate={{
        y: [0, -bobRange, 0, bobRange * 0.6, 0],
      }}
      transition={{
        y: { duration: bobSpeed, repeat: Infinity, ease: "easeInOut" },
      }}
    >
      <m.img
        src={sprite}
        alt=""
        draggable={false}
        className="h-full w-full select-none"
        style={{ transformOrigin: "50% 50%" }}
        animate={{
          scaleX: facingLeft
            ? [-1, -flapDepth, -1]
            : [1, flapDepth, 1],
        }}
        transition={{
          scaleX: { duration: wingSpeed, repeat: Infinity, ease: "easeInOut" },
        }}
      />
    </m.div>
  );
}
