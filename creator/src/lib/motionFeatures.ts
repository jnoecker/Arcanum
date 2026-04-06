// ─── LazyMotion Feature Loader ───────────────────────────────────
// Async loader for Motion's domAnimation features.
// Usage: <LazyMotion features={loadMotionFeatures}>

export const loadMotionFeatures = () =>
  import("motion/react").then((mod) => mod.domAnimation);
