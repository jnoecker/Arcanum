// ─── Lazy Motion feature loader ───────────────────────────────────
// Loads domAnimation features asynchronously for LazyMotion wrapper.

export const loadMotionFeatures = () =>
  import("motion/react").then((mod) => mod.domAnimation);
