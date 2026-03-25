import { useEffect, useRef } from "react";

/**
 * Ambient animated starfield canvas for the zone map background.
 * Renders slowly drifting particles behind the ReactFlow dot grid.
 * Respects prefers-reduced-motion (renders static stars only).
 * Pauses rendering when the canvas is not visible.
 */

interface Star {
  x: number;
  y: number;
  r: number;
  alpha: number;
  drift: number; // px per second
  twinkleSpeed: number; // radians per second
  twinkleOffset: number;
}

const STAR_COUNT = 120;
const STAR_COLOR = [106, 122, 172]; // GRAPH.edge rgb

function createStars(w: number, h: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.4 + Math.random() * 1.2,
      alpha: 0.15 + Math.random() * 0.45,
      drift: 0.5 + Math.random() * 1.5,
      twinkleSpeed: 0.3 + Math.random() * 0.8,
      twinkleOffset: Math.random() * Math.PI * 2,
    });
  }
  return stars;
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const rafRef = useRef<number>(0);
  const reducedMotion = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => {
      reducedMotion.current = e.matches;
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Size canvas to container
    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      starsRef.current = createStars(rect.width, rect.height);
    };
    resize();

    const resizeObs = new ResizeObserver(resize);
    resizeObs.observe(canvas.parentElement!);

    // Visibility — pause when off-screen
    let visible = true;
    const visObs = new IntersectionObserver(
      ([entry]) => {
        visible = !!entry?.isIntersecting;
      },
      { threshold: 0 },
    );
    visObs.observe(canvas);

    let lastTime = performance.now();

    const draw = (now: number) => {
      rafRef.current = requestAnimationFrame(draw);
      if (!visible) return;

      const dt = (now - lastTime) / 1000;
      lastTime = now;
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);

      ctx.clearRect(0, 0, w, h);

      const [r, g, b] = STAR_COLOR;
      const stars = starsRef.current;
      const animated = !reducedMotion.current;

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i]!;

        if (animated) {
          // Gentle upward drift (like looking down from above)
          s.y -= s.drift * dt;
          if (s.y < -2) {
            s.y = h + 2;
            s.x = Math.random() * w;
          }
        }

        // Twinkle
        const twinkle = animated
          ? 0.5 + 0.5 * Math.sin(now * 0.001 * s.twinkleSpeed + s.twinkleOffset)
          : 0.7;
        const a = s.alpha * twinkle;

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
        ctx.fill();
      }
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      resizeObs.disconnect();
      visObs.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 0 }}
    />
  );
}
