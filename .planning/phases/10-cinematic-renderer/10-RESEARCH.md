# Phase 10: Cinematic Renderer - Research

**Researched:** 2026-04-05
**Domain:** Animation orchestration, scene transitions, typewriter text reveal, CSS motion paths
**Confidence:** HIGH

## Summary

Phase 10 adds animation and playback to the static scene composition built in Phase 9. The core deliverables are: (1) a `CinematicRenderer` component that wraps `ScenePreview` with animation orchestration, (2) crossfade/fade-to-black scene transitions using Motion's `AnimatePresence`, (3) entity entrance/exit movement via CSS `offset-path` + `offsetDistance` animated by Motion, and (4) word-by-word narration reveal using Motion `variants` with `stagger`.

Motion (formerly Framer Motion) v12.38 is the animation library decided in CLAUDE.md. It is not yet installed. The `m` component with `LazyMotion`/`domAnimation` keeps initial cost to ~4.6kb. All animation code must be portable (no Tauri dependencies) so it works in the editor preview, presentation mode (Phase 11), and showcase player (Phase 12). The existing `ScenePreview.tsx` remains unchanged as the static layout engine; `CinematicRenderer` composes it with animation layers.

**Primary recommendation:** Install Motion, implement CinematicRenderer as a wrapper that uses `AnimatePresence` for scene transitions, `offset-path`/`offsetDistance` for entity movement presets, and `stagger` with `variants` for word-by-word narration reveal. Update `story.ts` types from placeholders to full interfaces. Add transition and path UI controls to `SceneDetailEditor`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Preset path library -- builders choose from named movement presets (e.g., "Enter from left", "Enter from right", "Enter from bottom", "Rise from shadows", "Exit stage left", "Exit stage right", "Fade in place"). Each preset is a pre-built SVG path string stored in the `movementPath` field.
- **D-02:** Separate entrance and exit paths per entity. Each `SceneEntity` gets an optional `entrancePath` and optional `exitPath`. Entrance plays when the scene starts, exit plays before transitioning to the next scene.
- **D-03:** No custom waypoint editor in this phase -- presets only. Custom path authoring can be added later if builders need more control.
- **D-04:** Word-by-word reveal animation -- each word fades in sequentially (~150ms per word, ~80ms gap). Think subtitle reveal in a film trailer, not classic character-by-character typewriter.
- **D-05:** Narration speed is configurable: story-level default speed (normal), with per-scene override to slow or fast for dramatic pacing.
- **D-06:** Narration renders in the existing bottom gradient overlay (from Phase 9's ScenePreview), but words animate in during playback mode instead of appearing statically.
- **D-07:** Two transition types available: crossfade (scene A blends into scene B, ~500ms overlap) and fade-to-black (A fades out ~300ms, black hold ~200ms, B fades in ~300ms).
- **D-08:** Default transition is crossfade. Builder can change per-scene via dropdown in the scene detail editor, next to the template picker.
- **D-09:** Transition duration uses sensible defaults (not user-configurable in this phase). Can add duration control later.
- **D-10:** CinematicRenderer wraps ScenePreview -- ScenePreview remains the static scene layout engine (layers, entities, narration, drag interaction). CinematicRenderer adds animation orchestration on top: scene transitions, movement path playback, typewriter narration.
- **D-11:** Editor uses ScenePreview directly (static + drag for entity positioning). Presentation mode and showcase player use CinematicRenderer. Props: `scenes[]`, `playing`, `onComplete`, `onSceneChange`.
- **D-12:** Editor includes a "Preview playback" button that plays the current scene's animations (entity entrance, narration reveal) inline without advancing to the next scene. Lets builders iterate on timing without entering full presentation mode.

### Claude's Discretion
- Exact preset path SVG coordinates and naming
- Movement path animation duration and easing curves
- How CinematicRenderer manages scene sequencing state internally
- Motion `LazyMotion` / `domAnimation` setup and tree-shaking
- Preview playback button placement and design in the scene detail editor
- TypeWriter component implementation details (Motion `variants` + `staggerChildren` vs `useAnimate`)
- Entity exit animation timing relative to scene transition start

### Deferred Ideas (OUT OF SCOPE)
- Custom waypoint path editor (click-to-draw paths on preview) -- future enhancement if presets aren't expressive enough.
- Configurable transition duration per scene -- keep defaults for now, add sliders later if needed.
- Particle effects (sparks, mist, embers) -- listed in FX-02 future requirements, not in Phase 10 scope.
- Parallax background layers -- listed in FX-01 future requirements, not in Phase 10 scope.
- Audio cues per scene -- listed in FX-03 future requirements, not in Phase 10 scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCENE-06 | Builder can set entrance/exit movement paths for entities | Motion `offset-path` + `offsetDistance` animation with preset SVG paths; `entrancePath`/`exitPath` fields on SceneEntity; dropdown UI in scene detail editor |
| SCENE-07 | Narration text reveals with typewriter animation during playback | Motion `variants` + `stagger()` for word-by-word fade-in; `extractWords()` utility from TipTap JSON; narration speed config (story-level + per-scene override) |
| PRES-03 | Scenes transition with crossfade effects | Motion `AnimatePresence` with `mode="sync"` for crossfade and `mode="wait"` for fade-to-black; scene key-swap pattern; TransitionConfig type |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| motion | 12.38.0 | Animation orchestration (transitions, movement paths, typewriter) | Decided in CLAUDE.md. 30M+ monthly npm downloads, declarative React API, AnimatePresence for exit animations, stagger for sequenced reveals, offset-path support. LazyMotion reduces initial bundle to 4.6kb. [VERIFIED: npm registry -- latest 12.38.0] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| motion/react | (bundled) | React-specific imports: motion, AnimatePresence, LazyMotion, m, stagger, useAnimate | All animated components |
| motion/react-m | (bundled) | Lightweight `m` component for LazyMotion tree-shaking | Inside LazyMotion boundary |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Motion AnimatePresence | CSS-only crossfade | No exit animation control, no imperative sequencing, harder to coordinate with entity/narration timing |
| Motion stagger variants | useAnimate imperative | useAnimate is more verbose for simple staggered word reveal; variants + stagger is more declarative and React-idiomatic |
| CSS offset-path via Motion | Manual requestAnimationFrame | Loses Motion's easing, duration control, and integration with AnimatePresence exit timing |

**Installation:**
```bash
cd creator && bun add motion
```

**Version verification:** `motion@12.38.0` confirmed via `npm view motion version` on 2026-04-05. [VERIFIED: npm registry]

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/lore/
    CinematicRenderer.tsx      # Animation orchestrator wrapping ScenePreview
    CinematicScene.tsx         # Single scene with entity movement + narration animation
    AnimatedEntity.tsx         # Entity overlay with entrance/exit offset-path animation
    TypewriterNarration.tsx    # Word-by-word narration reveal
    TransitionDropdown.tsx     # Transition type selector for SceneDetailEditor
    PathPresetPicker.tsx       # Movement path preset selector for entities
    PreviewPlayback.tsx        # Inline playback button + controls
  lib/
    motionFeatures.ts          # LazyMotion feature loader (async domAnimation import)
    movementPresets.ts         # SVG path presets library
    narrationSpeed.ts          # Speed config types and timing calculations
  types/
    story.ts                   # Updated TransitionConfig + EffectConfig + SceneEntity
```

### Pattern 1: CinematicRenderer wraps ScenePreview (D-10, D-11)
**What:** CinematicRenderer does not re-implement scene layout. It wraps `ScenePreview` for the static layer and overlays animated versions of entities and narration during playback.
**When to use:** Presentation mode, showcase player, and editor preview-playback.
**Example:**
```typescript
// Source: Architecture from D-10, D-11 decisions + AnimatePresence docs
// https://motion.dev/docs/react-animate-presence

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";

interface CinematicRendererProps {
  scenes: Scene[];
  currentIndex: number;
  playing: boolean;
  onComplete?: () => void;
  onSceneChange?: (index: number) => void;
  narrationSpeed?: NarrationSpeed;
}

function CinematicRenderer({
  scenes, currentIndex, playing, onComplete, onSceneChange, narrationSpeed
}: CinematicRendererProps) {
  const scene = scenes[currentIndex];
  const transition = scene?.transition ?? { type: "crossfade" };

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      <AnimatePresence mode={transition.type === "crossfade" ? "sync" : "wait"}>
        <CinematicScene
          key={scene.id}
          scene={scene}
          playing={playing}
          transition={transition}
          narrationSpeed={narrationSpeed}
          onAnimationsComplete={handleSceneComplete}
        />
      </AnimatePresence>
    </div>
  );
}
```

### Pattern 2: Scene Crossfade via AnimatePresence key-swap
**What:** Changing the `key` on a `motion.div` inside `AnimatePresence` triggers exit on old, enter on new. With `mode="sync"`, both render simultaneously creating a crossfade.
**When to use:** All scene transitions.
**Example:**
```typescript
// Source: https://motion.dev/docs/react-animate-presence
// https://motion.dev/tutorials/react-animate-presence-modes

// Crossfade: mode="sync" -- both scenes visible during overlap
<AnimatePresence mode="sync">
  <m.div
    key={scene.id}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.5 }}
    className="absolute inset-0"
  >
    {/* Scene content */}
  </m.div>
</AnimatePresence>

// Fade-to-black: mode="wait" -- old exits fully, then new enters
// Exit: opacity 1->0 (300ms). Enter: opacity 0->1 (300ms).
// Black hold: natural gap between exit complete and enter start.
<AnimatePresence mode="wait">
  <m.div
    key={scene.id}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.3 }}
    className="absolute inset-0"
  >
    {/* Scene content */}
  </m.div>
</AnimatePresence>
```

### Pattern 3: Entity Movement via CSS offset-path + Motion (SCENE-06)
**What:** Each preset defines an SVG path string. The entity is positioned with `offsetPath: path("...")` and Motion animates `offsetDistance` from 0% to 100%.
**When to use:** Entity entrance and exit animations.
**Example:**
```typescript
// Source: https://motion.dev/tutorials/react-motion-path
// https://developer.mozilla.org/en-US/docs/Web/CSS/offset-path

const ENTER_FROM_LEFT = "M -120 0 C -60 0 0 0 0 0";

<m.div
  style={{
    offsetPath: `path("${presetPath}")`,
    position: "absolute",
    left: `${entity.position.x}%`,
    top: `${entity.position.y}%`,
  }}
  initial={{ offsetDistance: "0%" }}
  animate={{ offsetDistance: "100%" }}
  transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
>
  <EntityOverlay ... />
</m.div>
```

### Pattern 4: Word-by-Word Narration Reveal (SCENE-07, D-04)
**What:** Narration text is split into words. Each word is a `m.span` with a fade-in variant. The parent uses `stagger()` to delay each child.
**When to use:** Narration display during playback.
**Example:**
```typescript
// Source: https://motion.dev/docs/stagger
// https://motion.dev/docs/react-animation (variants section)

import { stagger } from "motion";
import * as m from "motion/react-m";

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: stagger(0.08), // ~80ms gap between words
    },
  },
};

const wordVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.15 }, // ~150ms per word
  },
};

function TypewriterNarration({ text, playing }: { text: string; playing: boolean }) {
  const words = text.split(/\s+/);
  return (
    <m.p
      variants={containerVariants}
      initial="hidden"
      animate={playing ? "visible" : "hidden"}
      className="font-body text-sm text-white leading-relaxed"
      style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
    >
      {words.map((word, i) => (
        <m.span key={i} variants={wordVariants} className="inline-block mr-[0.3em]">
          {word}
        </m.span>
      ))}
    </m.p>
  );
}
```

### Pattern 5: LazyMotion Setup for Bundle Optimization
**What:** Wrap the CinematicRenderer subtree with `LazyMotion` + `domAnimation` to avoid loading animation features until needed. Use `m` component instead of `motion`.
**When to use:** All animated components in this phase.
**Example:**
```typescript
// Source: https://motion.dev/docs/react-lazy-motion
// https://motion.dev/docs/react-reduce-bundle-size

// lib/motionFeatures.ts -- async loader
export const loadMotionFeatures = () =>
  import("motion/react").then((mod) => mod.domAnimation);

// CinematicRenderer.tsx
import { LazyMotion } from "motion/react";
import { loadMotionFeatures } from "@/lib/motionFeatures";

function CinematicRenderer(props: CinematicRendererProps) {
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      {/* All animated children use m.div, m.span, etc. */}
    </LazyMotion>
  );
}
```

### Pattern 6: Reduced Motion Respect
**What:** Check `prefers-reduced-motion` and skip animations. The project already has CSS `@media (prefers-reduced-motion: reduce)` in `index.css` and runtime checks in `SpringPanel.tsx` and `Starfield.tsx`.
**When to use:** All animation components.
**Example:**
```typescript
// Follow existing pattern from SpringPanel.tsx
const prefersReducedMotion =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// If reduced motion: skip typewriter (show all text), skip movement paths
// (show entities at final position), skip transition animation (instant swap)
```

### Anti-Patterns to Avoid
- **Re-implementing ScenePreview in CinematicRenderer:** D-10 explicitly says CinematicRenderer wraps ScenePreview. Don't duplicate the layer layout, entity resolution, or narration extraction logic.
- **Using `motion.div` instead of `m.div` inside LazyMotion:** This defeats bundle optimization. The full `motion` component includes all features (~34kb). Use `m` from `motion/react-m` with `LazyMotion strict`.
- **Animating entity position with transform instead of offset-path:** CSS `offset-path` + `offsetDistance` is the correct approach for path-following animation. Using `transform: translate()` keyframes would require manual interpolation along curves.
- **Character-by-character typewriter:** D-04 explicitly specifies word-by-word reveal, not character-by-character. Word-by-word reads more naturally at the specified timing.
- **Making CinematicRenderer depend on Tauri APIs:** D-11 requires the renderer to be portable. No `@tauri-apps/*` imports. Image loading uses the `useImageSrc` hook which already abstracts this.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scene crossfade transitions | Manual opacity management with setState + setTimeout | Motion AnimatePresence with mode="sync" | AnimatePresence handles mount/unmount lifecycle, exit animations, and concurrent rendering. Manual approach would miss edge cases (rapid scene advancement, interrupted transitions) |
| Staggered word reveal | Manual setTimeout chain per word | Motion stagger() + variants | stagger handles timing math, easing redistribution, and reverse-order exit. Manual chains leak timers and don't integrate with React lifecycle |
| Path-following animation | requestAnimationFrame loop with manual bezier interpolation | CSS offset-path + Motion offsetDistance | Browser-native path interpolation is hardware-accelerated and handles curve math. Manual interpolation is error-prone and slower |
| Animation sequencing (entrance -> narration -> wait) | Promise chains or callback nesting | Motion useAnimate async/await sequence | useAnimate provides automatic cleanup on unmount, integrates with AnimatePresence, and supports cancellation |
| SVG path generation for presets | Manual coordinate math | Hardcoded preset library | Presets are a finite set (6-8 paths). Pre-authored SVG `d` strings are simpler than generating paths at runtime |

**Key insight:** Motion provides the complete animation primitive set this phase needs. Every animation feature (transitions, path movement, staggered reveals, sequencing) maps to a specific Motion API. The complexity is in orchestration, not in animation primitives.

## Common Pitfalls

### Pitfall 1: AnimatePresence mode mismatch for crossfade vs fade-to-black
**What goes wrong:** Using `mode="wait"` for crossfade produces a gap (old exits, black, new enters) instead of a smooth blend. Using `mode="sync"` for fade-to-black overlaps the scenes.
**Why it happens:** The `mode` prop controls whether entering/exiting elements animate simultaneously or sequentially.
**How to avoid:** Crossfade = `mode="sync"` (both visible during overlap). Fade-to-black = `mode="wait"` (sequential). The mode must change dynamically based on the active scene's `transition.type`.
**Warning signs:** Visible gap between scenes during crossfade, or both scenes visible during fade-to-black.

### Pitfall 2: AnimatePresence requires stable unique keys
**What goes wrong:** Using array index as key causes AnimatePresence to not detect the component swap. No exit animation plays.
**Why it happens:** AnimatePresence detects child removal by comparing `key` props between renders. If the key doesn't change, it doesn't trigger exit/enter.
**How to avoid:** Use `scene.id` as the key, not `currentIndex`. Scene IDs are stable unique strings (e.g., `scene_a3b2c1`).
**Warning signs:** No transition animation when advancing scenes; content just snaps.

### Pitfall 3: offset-path coordinate space confusion
**What goes wrong:** Entities animate along the path but end up in the wrong position because the path coordinates don't account for the entity's percentage-based positioning.
**Why it happens:** CSS `offset-path` uses the element's own coordinate space. The path must be relative to the entity's final resting position (0,0 = final position).
**How to avoid:** Define all preset paths relative to the entity's final position. "Enter from left" means the path starts at (-120, 0) relative to the entity and ends at (0, 0). The entity's `left`/`top` percentage positioning sets where (0,0) maps to in the scene.
**Warning signs:** Entities visible outside the scene container, entities ending at wrong positions after animation.

### Pitfall 4: Narration word splitting breaks on whitespace-only content
**What goes wrong:** Empty narration or whitespace-only content produces empty word arrays that render invisible `m.span` elements.
**Why it happens:** `text.split(/\s+/)` on empty string produces `[""]` (one empty string).
**How to avoid:** Filter empty strings after splitting: `text.split(/\s+/).filter(Boolean)`. Also guard on empty narration before rendering the TypewriterNarration component at all.
**Warning signs:** Animation plays but nothing is visible; stagger timing seems off.

### Pitfall 5: Rapid scene advancement causes animation pile-up
**What goes wrong:** If a user rapidly clicks through scenes, AnimatePresence accumulates exiting elements that haven't finished their exit animations.
**Why it happens:** AnimatePresence keeps elements in the DOM until their exit animation completes. With `mode="sync"`, multiple exiting scenes can stack.
**How to avoid:** Either (a) disable scene advance buttons during transition, or (b) use `initial={false}` on AnimatePresence to skip the initial animation (prevents double-firing on mount), and keep transition durations short enough that pile-up is imperceptible.
**Warning signs:** Multiple scene layers visible simultaneously, performance degradation.

### Pitfall 6: Motion stagger import path
**What goes wrong:** Importing `stagger` from the wrong path or using `delayChildren` as a number instead of `stagger()` function.
**Why it happens:** `stagger` is imported from `"motion"` (not `"motion/react"`). The `delayChildren` transition property accepts either a number (uniform delay) or a `stagger()` return value.
**How to avoid:** `import { stagger } from "motion"` -- note the bare `"motion"` import, not `"motion/react"`.
**Warning signs:** TypeScript import error, or all words appearing at once instead of staggered.

### Pitfall 7: Vite manual chunks not updated for motion
**What goes wrong:** Motion gets bundled into the main chunk instead of its own vendor chunk, increasing initial load time.
**Why it happens:** `vite.config.ts` has `manualChunks` for existing vendor libraries but doesn't include motion.
**How to avoid:** Add a motion chunk to the `manualChunks` function: `if (id.includes("motion")) return "vendor-motion";`
**Warning signs:** Large main bundle size after adding motion.

### Pitfall 8: Portability -- CinematicRenderer must not import Tauri
**What goes wrong:** CinematicRenderer imports `@tauri-apps/*` for image loading or other features, breaking the showcase player.
**Why it happens:** The existing `useImageSrc` hook already handles Tauri image loading. But if someone adds direct Tauri imports to the renderer, it won't work in the showcase.
**How to avoid:** CinematicRenderer accepts scene data as props (images already resolved to URLs/data-URLs). No store access inside the renderer itself. Entity images come through props, not by calling `read_image_data_url`.
**Warning signs:** Runtime errors in showcase player, import resolution failures.

## Code Examples

Verified patterns from official sources:

### Movement Preset Library
```typescript
// Source: Architecture decision D-01, SVG path syntax from MDN
// https://developer.mozilla.org/en-US/docs/Web/CSS/offset-path

export interface MovementPreset {
  id: string;
  label: string;
  path: string; // SVG d attribute relative to final position
  duration: number; // seconds
}

// All paths are relative: (0,0) = entity's final resting position
// Negative x = from left, positive x = from right
// Positive y = from below, negative y = from above
// Units are pixels relative to a 16:9 viewport

export const ENTRANCE_PRESETS: MovementPreset[] = [
  {
    id: "enter-from-left",
    label: "Enter from left",
    path: "M -200 0 C -100 0 -40 0 0 0",
    duration: 1.0,
  },
  {
    id: "enter-from-right",
    label: "Enter from right",
    path: "M 200 0 C 100 0 40 0 0 0",
    duration: 1.0,
  },
  {
    id: "enter-from-bottom",
    label: "Enter from bottom",
    path: "M 0 150 C 0 80 0 30 0 0",
    duration: 1.2,
  },
  {
    id: "rise-from-shadows",
    label: "Rise from shadows",
    path: "M 0 60 C 0 40 -10 20 0 0",
    duration: 1.5,
  },
  {
    id: "fade-in-place",
    label: "Fade in place",
    path: "", // No path -- opacity only
    duration: 0.8,
  },
];

export const EXIT_PRESETS: MovementPreset[] = [
  {
    id: "exit-stage-left",
    label: "Exit stage left",
    path: "M 0 0 C -40 0 -100 0 -200 0",
    duration: 0.8,
  },
  {
    id: "exit-stage-right",
    label: "Exit stage right",
    path: "M 0 0 C 40 0 100 0 200 0",
    duration: 0.8,
  },
  {
    id: "fade-out",
    label: "Fade out",
    path: "", // No path -- opacity only
    duration: 0.6,
  },
];
```

### Updated TransitionConfig Type
```typescript
// Source: D-07, D-08, D-09 decisions
// Replaces placeholder in story.ts

export type TransitionType = "crossfade" | "fade_black";

export interface TransitionConfig {
  type: TransitionType;
  // Duration not user-configurable in Phase 10 (D-09)
  // Crossfade: 500ms overlap. Fade-to-black: 300ms out, 200ms hold, 300ms in.
}

// Remove "slide" from the union -- not in Phase 10 scope
```

### Updated SceneEntity Type
```typescript
// Source: D-01, D-02 decisions
// entrancePath/exitPath replace single movementPath

export interface SceneEntity {
  id: string;
  entityType: "mob" | "item" | "npc";
  entityId: string;
  slot?: EntitySlot;
  position?: { x: number; y: number };
  entrancePath?: string; // Preset ID from ENTRANCE_PRESETS
  exitPath?: string;     // Preset ID from EXIT_PRESETS
  // movementPath field is removed (replaced by entrancePath/exitPath)
}
```

### NarrationSpeed Configuration
```typescript
// Source: D-05 decision

export type NarrationSpeed = "slow" | "normal" | "fast";

export const NARRATION_TIMING: Record<NarrationSpeed, { wordDuration: number; wordGap: number }> = {
  slow:   { wordDuration: 0.2,  wordGap: 0.12 },  // ~200ms per word, ~120ms gap
  normal: { wordDuration: 0.15, wordGap: 0.08 },   // ~150ms per word, ~80ms gap (D-04 default)
  fast:   { wordDuration: 0.1,  wordGap: 0.05 },   // ~100ms per word, ~50ms gap
};

// Story-level default:
export interface Story {
  // ... existing fields ...
  narrationSpeed?: NarrationSpeed; // defaults to "normal"
}

// Per-scene override:
export interface Scene {
  // ... existing fields ...
  narrationSpeed?: NarrationSpeed; // overrides story-level default
}
```

### AnimatePresence Dynamic Mode Selection
```typescript
// Source: https://motion.dev/docs/react-animate-presence
// Crossfade = sync (both visible), fade-to-black = wait (sequential)

function getPresenceMode(transition: TransitionConfig): "sync" | "wait" {
  return transition.type === "crossfade" ? "sync" : "wait";
}

function getTransitionDuration(transition: TransitionConfig): number {
  // Crossfade: 500ms overlap
  // Fade-to-black: 300ms each direction
  return transition.type === "crossfade" ? 0.5 : 0.3;
}
```

### Word Extraction from TipTap JSON
```typescript
// Source: existing extractPlainText in sceneLayout.ts

/** Extracts words from TipTap JSON narration for typewriter animation. */
export function extractWords(narrationJson: string): string[] {
  const text = extractPlainText(narrationJson);
  if (!text) return [];
  return text.split(/\s+/).filter(Boolean);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| framer-motion package | motion package (import from "motion/react") | 2025 rename | Import path changed; API identical. Use `motion/react` not `framer-motion` |
| motion component for all | LazyMotion + m component | motion v10+ | ~30kb bundle savings with async feature loading |
| staggerChildren prop | stagger() function from "motion" | motion v12 | More flexible API; import from `"motion"` not `"motion/react"` |
| delayChildren: number | delayChildren: stagger(n) | motion v12 | stagger() provides `from`, `ease`, `startDelay` options |

**Deprecated/outdated:**
- `framer-motion` npm package: Renamed to `motion`. Same API, new import paths. [VERIFIED: npm registry shows `motion` as latest]
- `useAnimationControls()`: Replaced by `useAnimate()` in Motion v10+. [CITED: motion.dev/docs/react-use-animate]
- `AnimateSharedLayout`: Removed in favor of `layoutId` prop on motion components. Not relevant to this phase but worth noting.

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research. The planner and discuss-phase use this
> section to identify decisions that need user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Preset SVG paths with relative coordinates (e.g., "M -200 0 C -100 0 -40 0 0 0") will produce visually correct entity movement in a percentage-positioned layout | Code Examples (presets) | Paths may need tuning -- coordinates are relative pixel offsets which may look different at various viewport sizes. Mitigated by the preview playback button (D-12) for iterating on feel. |
| A2 | stagger() is imported from bare `"motion"` not `"motion/react"` | Pitfall 6 | If import path is wrong, TypeScript will catch it at build time. LOW risk. |
| A3 | Motion's AnimatePresence mode can be changed dynamically per-render | Architecture Pattern 2 | If mode is locked at mount time, we would need to wrap in a key-changing container. MEDIUM risk -- but official docs show mode as a regular prop. |
| A4 | CSS offset-path works in Tauri WebView2 (Chromium-based) | Architecture Pattern 3 | WebView2 uses Chromium engine which supports offset-path since Chrome 55. Very LOW risk. |

## Open Questions

1. **offset-path pixel values vs viewport scaling**
   - What we know: CSS offset-path uses pixel values in the SVG path string. Entity positions are percentage-based.
   - What's unclear: Whether fixed pixel path values (e.g., 200px sweep) look proportional at all container sizes, or if they need to scale with the viewport.
   - Recommendation: Start with fixed pixel values in presets (simpler). The 16:9 aspect-video container has a relatively predictable size. If scaling is an issue, add a CSS `transform: scale()` on the animated wrapper relative to container width. The preview playback button (D-12) allows visual iteration.

2. **Entity exit timing relative to scene transition**
   - What we know: D-02 says exits play "before transitioning to the next scene." The transition itself is 300-500ms.
   - What's unclear: Exact overlap -- should exit animations complete before the crossfade starts, or overlap?
   - Recommendation: Exit animations should start ~200ms before the crossfade begins. Use `useAnimate` async sequence: trigger exits, wait partial completion, then advance scene index (triggering AnimatePresence transition). This is in Claude's discretion.

3. **Showcase player Motion dependency**
   - What we know: The showcase (Phase 12) must play stories. CLAUDE.md says "Only motion for the embedded story player."
   - What's unclear: Whether the showcase will bundle its own copy of motion or share it from the creator build.
   - Recommendation: Phase 12 concern. For Phase 10, ensure CinematicRenderer is a self-contained component that can be extracted. No store dependencies inside the renderer.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.0 |
| Config file | `creator/vitest.config.ts` |
| Quick run command | `cd creator && bun run test` |
| Full suite command | `cd creator && bun run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCENE-06 | Movement preset library has valid entries with SVG paths and durations | unit | `cd creator && bunx vitest run src/lib/__tests__/movementPresets.test.ts -x` | Wave 0 |
| SCENE-06 | SceneEntity entrancePath/exitPath fields serialize correctly | unit | `cd creator && bunx vitest run src/lib/__tests__/storyPersistence.test.ts -x` | Existing (extend) |
| SCENE-07 | extractWords() correctly splits TipTap narration into words | unit | `cd creator && bunx vitest run src/lib/__tests__/sceneLayout.test.ts -x` | Existing (extend) |
| SCENE-07 | Narration speed timing calculations are correct | unit | `cd creator && bunx vitest run src/lib/__tests__/narrationSpeed.test.ts -x` | Wave 0 |
| PRES-03 | TransitionConfig type validation and defaults | unit | `cd creator && bunx vitest run src/lib/__tests__/sceneLayout.test.ts -x` | Existing (extend) |
| PRES-03 | getPresenceMode maps transition types correctly | unit | `cd creator && bunx vitest run src/lib/__tests__/sceneLayout.test.ts -x` | Existing (extend) |

### Sampling Rate
- **Per task commit:** `cd creator && bun run test`
- **Per wave merge:** `cd creator && bun run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `creator/src/lib/__tests__/movementPresets.test.ts` -- covers SCENE-06 preset validation
- [ ] `creator/src/lib/__tests__/narrationSpeed.test.ts` -- covers SCENE-07 timing calculations
- [ ] Extend `creator/src/lib/__tests__/sceneLayout.test.ts` -- add extractWords tests
- [ ] Extend `creator/src/lib/__tests__/storyPersistence.test.ts` -- add entrancePath/exitPath round-trip tests

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A -- desktop app, no auth in renderer |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | Yes | SVG path strings from presets are hardcoded, not user-input. Narration text comes from TipTap JSON (already sanitized by editor). TransitionConfig type is a constrained union. |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for Motion + React

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SVG path injection via user-provided movementPath | Tampering | Presets only (D-03) -- paths are hardcoded in `movementPresets.ts`, not user-authored. SceneEntity stores preset IDs, not raw SVG. |
| XSS via narration text in TypewriterNarration | Tampering | Text is extracted via `extractPlainText()` which parses TipTap JSON and returns plain text. No `dangerouslySetInnerHTML`. Words render as text content in `m.span` elements. |

## Sources

### Primary (HIGH confidence)
- [Motion AnimatePresence docs](https://motion.dev/docs/react-animate-presence) -- exit animations, mode prop (sync/wait), key-swap pattern [CITED]
- [Motion useAnimate docs](https://motion.dev/docs/react-use-animate) -- imperative animation sequencing, async/await pattern [CITED]
- [Motion stagger docs](https://motion.dev/docs/stagger) -- stagger function API, options (startDelay, from, ease) [CITED]
- [Motion LazyMotion docs](https://motion.dev/docs/react-lazy-motion) -- domAnimation features, m component, bundle size (4.6kb initial) [CITED]
- [Motion bundle size guide](https://motion.dev/docs/react-reduce-bundle-size) -- domAnimation (15kb) vs domMax (25kb), strict mode [CITED]
- [Motion animation docs](https://motion.dev/docs/react-animation) -- variants, staggerChildren, keyframes, transition config [CITED]
- [Motion path tutorial](https://motion.dev/tutorials/react-motion-path) -- offset-path + offsetDistance animation [CITED]
- [AnimatePresence modes tutorial](https://motion.dev/tutorials/react-animate-presence-modes) -- sync vs wait vs popLayout [CITED]
- [MDN offset-path](https://developer.mozilla.org/en-US/docs/Web/CSS/offset-path) -- CSS offset-path specification and browser support [CITED]
- [npm registry: motion](https://www.npmjs.com/package/motion) -- version 12.38.0 confirmed [VERIFIED: npm view]
- [npm registry: @dnd-kit/core](https://www.npmjs.com/package/@dnd-kit/core) -- version 6.3.1 already installed [VERIFIED: npm view]

### Secondary (MEDIUM confidence)
- [WebView2 overview (Microsoft)](https://learn.microsoft.com/en-us/microsoft-edge/webview2/) -- Chromium-based rendering engine, inherits Chrome CSS support [CITED]

### Tertiary (LOW confidence)
- None -- all claims verified against official documentation or npm registry.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Motion is decided in CLAUDE.md, version verified via npm, all APIs confirmed in official docs
- Architecture: HIGH -- CinematicRenderer wrapping pattern is a straightforward composition; AnimatePresence crossfade is a documented primary use case
- Pitfalls: HIGH -- AnimatePresence mode, key requirements, and offset-path coordinate space are well-documented concerns
- Movement presets: MEDIUM -- SVG path coordinates are authored estimates that may need visual tuning (mitigated by D-12 preview button)

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (Motion stable, no breaking changes expected)
