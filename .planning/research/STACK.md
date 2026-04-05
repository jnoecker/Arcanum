# Technology Stack: Zone Stories (Cinematic Story Authoring)

**Project:** Arcanum v1.1 Zone Stories
**Researched:** 2026-04-05
**Mode:** Ecosystem (stack dimension for new milestone in existing app)

## Context

Zone Stories adds cinematic story authoring to an existing Tauri 2 desktop app. The app already has React 19, Zustand 5, Tailwind CSS 4, TipTap 3, XY Flow, Leaflet, Recharts, and a comprehensive lore + zone system. This research covers **only new dependencies** needed for the cinematic authoring features -- not the existing stack.

**New capabilities needed:**
1. Timeline/scene editor with draggable scene cards (reorder, add, remove)
2. Cinematic effects: parallax background layers, particle effects (sparks, mist), sprite movement along paths
3. Fullscreen DM presentation mode with keystroke advance
4. Embedded story player for the showcase site (click-through + auto-play)
5. Animation engine for scene transitions, entity spotlights, text reveals

## Recommended Additions

### Animation Engine

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| motion | ^12.37 | Scene transitions, sprite movement, text reveals, parallax interpolation, presentation slide transitions | Declarative React-native API (`<motion.div>`). Supports keyframe sequences, spring physics, CSS `offset-path` animation (sprite movement along paths), `useAnimate` for imperative sequencing, `useAnimationFrame` for per-frame control. LazyMotion + `m` component reduces initial cost to 4.6kb (load `domAnimation` features on demand at +15kb). Timeline sequencing via `useAnimate` avoids needing a separate sequencing library. 30M+ monthly npm downloads, actively maintained, React 18.2+ compatible. |

**Confidence:** HIGH -- Motion v12.37+ confirmed on npm (March 2026), official docs verify all needed APIs, React 19 compatible.

**Why Motion over alternatives:**
- **react-spring**: Better for physics-heavy gesture interactions (drag inertia, spring-only systems). Weaker at timeline sequencing, exit animations, and layout animations. Motion's `useAnimate` provides imperative sequence control that maps directly to scene-by-scene cinematic playback. react-spring's `Parallax` component is scroll-based -- our parallax is time/scene-based, not scroll-based.
- **CSS animations only**: Insufficient for imperative sequencing (play scene 1, then 2, then 3 with variable timing). No spring physics for natural-feeling entity movements. CSS `offset-path` alone can't be dynamically orchestrated scene-by-scene.
- **GSAP**: Powerful but license concerns for commercial use (GreenSock license), large bundle, imperative-only API feels foreign in React component tree.
- **anime.js**: Less React integration, no declarative component API, smaller ecosystem.
- **Rive/Lottie**: Designed for pre-built vector animations, not dynamic scene composition from runtime data (room images, entity sprites).

**Key Motion APIs for this project:**
- `animate` prop: Declarative scene transitions (fade, slide, scale for background/entity/text layers)
- `useAnimate`: Imperative sequence control for presentation mode (advance through scenes programmatically)
- `useAnimationFrame(callback)`: Per-frame particle updates and continuous effects
- `offsetPath` + `offsetDistance` animation: Sprite movement along defined SVG paths
- `AnimatePresence`: Exit animations when switching between scenes
- `variants` + `staggerChildren`: Coordinated text reveal (narration appearing word-by-word or line-by-line)
- `LazyMotion` + `domAnimation`: Bundle-optimized feature loading

### Drag-and-Drop (Timeline Scene Reordering)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @dnd-kit/core | ^6.3 | Drag-and-drop primitives for scene card reordering in timeline editor | Lightweight (10kb), zero-dependency drag engine with sensors (pointer, keyboard), collision detection, and accessibility built-in. Modular architecture -- only import what you need. |
| @dnd-kit/sortable | ^10.0 | Sortable preset for reorderable scene card list | Thin layer on @dnd-kit/core optimized for sortable lists. `useSortable` hook + `SortableContext` provides drag handles, reorder animations, and `arrayMove` utility. Supports horizontal layout constraint via `restrictToHorizontalAxis` modifier. |
| @dnd-kit/utilities | ^3.2 | CSS transform utilities for drag visuals | `CSS.Transform.toString()` for smooth drag overlay rendering. |

**Confidence:** HIGH -- @dnd-kit/core v6.3.1 is stable (2400+ dependents on npm), well-documented, widely used for sortable interfaces. The legacy/stable v6.x line is production-ready and battle-tested.

**Why @dnd-kit over alternatives:**
- **react-beautiful-dnd / @hello-pangea/dnd**: Higher-level but more opinionated. Heavier bundle. The original (Atlassian) is deprecated; hello-pangea fork is maintained but adds unnecessary abstraction for our simple flat list of scene cards.
- **pragmatic-drag-and-drop**: Atlassian's newer library is framework-agnostic (not React-specific), which means more boilerplate for React integration. Better for complex cross-framework scenarios we don't have.
- **HTML5 drag-and-drop**: No animation support, poor accessibility, inconsistent cross-browser behavior, no keyboard navigation.
- **@dnd-kit/react (v0.3.x)**: The experimental rewrite is promising but at v0.3 -- too early for production use. Stick with the stable v6.x core.

**Implementation pattern for timeline:**
```
DndContext (sensors: pointer + keyboard)
  SortableContext (items: scene IDs, strategy: horizontalListSortingStrategy)
    SceneCard[] (useSortable hook each)
```

### Particle Effects

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Custom Canvas + `useAnimationFrame` | N/A | Sparks, mist, ambient particles per scene | The particle needs are narrow and specific: 3-5 effect presets (sparks, mist/fog, embers, rain, dust motes) rendered over scene backgrounds. A custom `<ParticleCanvas>` component using HTML5 Canvas 2D + Motion's `useAnimationFrame` for the render loop is simpler, lighter, and more controllable than tsParticles. |

**Confidence:** MEDIUM -- Custom implementation requires more upfront work, but the scope is well-bounded (fixed presets, not user-configurable particle physics).

**Why custom over tsParticles:**
- **@tsparticles/slim**: ~45-60kb gzipped for the slim bundle. Brings a full particle physics engine, interactivity system, and dozens of shape/movement plugins we don't need. The `@tsparticles/react` wrapper hasn't been updated in 2 years (v3.0.0). Configuration is JSON-heavy and harder to integrate with a scene-data-driven model.
- **Custom approach**: 200-400 lines of TypeScript for a particle system with 5 presets. Each preset is a config object (particle count, velocity range, color, opacity curve, size range, spawn region). The render loop uses `useAnimationFrame` from Motion. Canvas is composited over the scene background with `pointer-events: none`. Full control over performance (particle budget per scene).
- **Proton.js**: Another full physics engine -- same problem as tsParticles. Overkill for ambient effects.

**Preset structure (TypeScript, not JSON config):**
```typescript
interface ParticlePreset {
  name: "sparks" | "mist" | "embers" | "rain" | "dust";
  count: number;         // max particles
  velocity: [number, number]; // min/max px per frame
  angle: [number, number];    // direction range in radians
  size: [number, number];     // min/max radius
  opacity: [number, number];  // fade in/out range
  color: string[];            // CSS colors to pick from
  lifetime: [number, number]; // frames before respawn
  gravity: number;            // downward pull (0 for mist, positive for sparks)
  spawn: "top" | "bottom" | "edges" | "random";
}
```

### Parallax Layers

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| CSS transforms + Motion `animate` | N/A | Multi-layer parallax depth effect in scene backgrounds | Scene parallax is NOT scroll-driven -- it's time/animation-driven (layers shift during scene transitions or in response to presentation advance). CSS `transform: translateZ()` with `perspective` parent, animated by Motion's `animate` prop, gives precise per-layer control without any parallax library. |

**Confidence:** HIGH -- CSS perspective transforms are universally supported, Motion handles the interpolation, no library needed.

**Why no parallax library:**
- **@react-spring/parallax**: Scroll-based parallax container. Our parallax is scene-transition-based (layers move when a scene changes or during cinematic playback), not on user scroll.
- **react-scroll-parallax**: Same problem -- designed for scroll-driven websites, not discrete scene transitions.
- **Custom CSS + Motion**: Parallax layers are just divs with different `translateX`/`translateY` offsets that interpolate when the scene changes. Motion's `animate` prop handles this declaratively. No library needed.

**Implementation pattern:**
```tsx
// Each scene has 1-3 parallax background layers
<div style={{ perspective: "1000px" }}>
  <motion.div animate={{ x: layer0X }} style={{ zIndex: 0 }}> {/* far bg */} </motion.div>
  <motion.div animate={{ x: layer1X }} style={{ zIndex: 1 }}> {/* mid bg */} </motion.div>
  <motion.div animate={{ x: layer2X }} style={{ zIndex: 2 }}> {/* near bg */} </motion.div>
  <ParticleCanvas /> {/* particles overlay */}
  <EntitySpotlights /> {/* mob/item sprites with motion paths */}
  <NarrationText /> {/* text overlay with reveal animation */}
</div>
```

### Sprite Movement Paths

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| CSS `offset-path` + Motion | N/A | Animate entity sprites along defined movement paths within a scene | CSS `offset-path: path("M 0 0 C ...")` defines an SVG path; Motion animates `offsetDistance` from "0%" to "100%". Builders define paths in the scene editor (click waypoints); paths are stored as SVG `d` attributes. Motion provides timing, easing, and sequencing. |

**Confidence:** HIGH -- CSS offset-path is supported in all modern browsers (Chrome 55+, Firefox 72+, Safari 16+, Edge 79+). Motion's docs include a dedicated tutorial for path animation.

**Implementation:**
- Scene editor: Builders click 3-5 waypoints on the scene preview. Waypoints are converted to a cubic bezier SVG path string (`M x0 y0 C x1 y1 x2 y2 x3 y3 ...`).
- Playback: `<motion.div animate={{ offsetDistance: "100%" }} transition={{ duration: 3 }} style={{ offsetPath: 'path("...")' }} />`
- Stored in scene data as `movementPath: string` (SVG d attribute).

### Fullscreen Presentation & Embedded Player

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Fullscreen API (browser native) | N/A | Enter/exit fullscreen for DM presentation mode | `document.documentElement.requestFullscreen()` is universally supported. No library needed. Tauri 2 supports the Fullscreen API in its webview. |
| Custom `usePresentation` hook | N/A | Keystroke navigation, auto-play timer, scene sequencing | A Zustand slice or custom hook managing: current scene index, playing/paused state, advance/retreat via ArrowRight/ArrowLeft/Space, auto-play with configurable interval. This is 50-100 lines of custom code -- no presentation framework (Spectacle, Reveal.js) is appropriate because our "slides" are rich cinematic scenes, not markdown/HTML slides. |

**Confidence:** HIGH -- Fullscreen API is stable and well-supported. Presentation logic is straightforward state machine.

**Why no presentation library:**
- **Spectacle**: Designed for developer conference talks with markdown/JSX slides. Our "slides" are rich layered scenes with parallax, particles, entities, and narration. Spectacle's slide model doesn't fit.
- **Reveal.js**: Same mismatch -- HTML-based slide decks, not cinematic scene composition.
- **Swiper/Embla**: Carousel libraries designed for image galleries. Missing: per-scene animation orchestration, particle effects, entity movement sequencing.

## Explicitly NOT Adding

| Category | Rejected | Why Not |
|----------|----------|---------|
| Canvas framework | PixiJS / @pixi/react | Massive overkill (200kb+) for layered divs with CSS transforms. PixiJS is for game rendering with thousands of sprites at 60fps. We have 1-5 entity sprites per scene rendered as DOM elements. CSS + Motion handles this elegantly without a WebGL context. |
| Particle library | @tsparticles/slim | 45-60kb for a full particle physics engine when we need 5 fixed presets with 50-200 particles each. Custom Canvas 2D with `useAnimationFrame` is lighter, simpler, and gives full control. |
| Scroll parallax | @react-spring/parallax, react-scroll-parallax | Wrong paradigm. Our parallax is scene-transition-driven, not scroll-driven. Motion's `animate` prop on positioned divs does exactly what we need. |
| Video rendering | ffmpeg.wasm, MediaRecorder | Exporting stories as video is out of scope for v1.1. The showcase player renders stories live in the browser. |
| 3D engine | Three.js, React Three Fiber | No 3D content in the story system. Parallax depth is simulated with CSS transforms on 2D layers. |
| Timeline library | dnd-timeline, Gantt chart libs | These are scheduling/calendar timeline UIs. Our timeline is a horizontal strip of scene cards -- a sortable list, not a time-range scheduler. @dnd-kit/sortable is the right abstraction. |
| Presentation framework | Spectacle, Reveal.js | Designed for text-based slide decks. Our presentation is a cinematic engine with layered backgrounds, particles, entity animations, and narration overlays. |
| Animation (alt) | react-spring | Weaker at imperative sequencing (scene-by-scene playback), no built-in `AnimatePresence` for exit animations, scroll-based parallax doesn't fit our model. Motion is better for timeline-driven cinematic sequences. |
| Animation (alt) | GSAP | License concerns for desktop app distribution. Imperative-only API is a poor fit for React component tree. Heavy bundle. |
| State library | XState, Redux | Presentation state is a simple index + playing boolean. Zustand slice or custom hook is sufficient. No finite state machine library needed. |

## Alternatives Considered (Full Matrix)

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Animation | motion ^12.37 | react-spring ^9.7 | Weaker imperative sequencing, scroll-based parallax wrong paradigm, no AnimatePresence |
| Animation | motion ^12.37 | GSAP ^3.12 | License concerns, imperative-only, not React-native |
| Animation | motion ^12.37 | CSS only | No imperative orchestration for scene sequences, no spring physics |
| Drag-and-drop | @dnd-kit/core ^6.3 | @hello-pangea/dnd | Heavier, more opinionated, unnecessary abstraction for flat list |
| Drag-and-drop | @dnd-kit/core ^6.3 | pragmatic-drag-and-drop | Framework-agnostic = more React boilerplate |
| Drag-and-drop | @dnd-kit/core ^6.3 | @dnd-kit/react ^0.3 | Experimental, pre-1.0 -- not production ready |
| Particles | Custom Canvas 2D | @tsparticles/slim | 45-60kb for 5 fixed presets we can write in 300 lines |
| Particles | Custom Canvas 2D | Proton.js | Full physics engine overkill for ambient effects |
| Parallax | CSS + Motion | @react-spring/parallax | Scroll-based, not scene-transition-based |
| Path animation | CSS offset-path + Motion | SVG SMIL | Deprecated by Chrome, poor React integration |
| Path animation | CSS offset-path + Motion | Canvas path rendering | Harder to compose with DOM entity elements |
| Presentation | Custom hook + Fullscreen API | Spectacle | Wrong abstraction (text slides vs cinematic scenes) |
| Presentation | Custom hook + Fullscreen API | Swiper/Embla | Missing animation orchestration, particle effects |

## Installation

```bash
cd creator

# New dependencies for cinematic story authoring
bun add motion @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Bundle impact estimate:**
- motion (with LazyMotion/domAnimation): ~4.6kb initial + 15kb on first animation use (tree-shakeable)
- @dnd-kit/core: ~10kb
- @dnd-kit/sortable: ~3kb
- @dnd-kit/utilities: ~1kb
- **Total new code: ~34kb** (loaded on demand via Vite code splitting)

**Showcase site additions:**
```bash
cd showcase

# Only motion for the embedded story player (no dnd-kit needed -- playback only)
npm install motion
```

**Showcase bundle impact:** ~4.6kb initial + 15kb on story player load.

**Vite chunk configuration** (add to existing `manualChunks` in `creator/vite.config.ts`):
```typescript
if (id.includes("motion")) return "vendor-animation";
if (id.includes("@dnd-kit")) return "vendor-dnd";
```

## Integration with Existing Stack

| Existing Tech | How Zone Stories Uses It |
|---------------|------------------------|
| zoneStore (Zustand) | Reads zone data (rooms, mobs, items) for entity picker and scene composition |
| loreStore (Zustand) | Stories are a new lore article type -- inherits undo/redo, persistence, showcase export |
| assetStore (Zustand) | Room background images and entity sprites loaded via existing asset pipeline |
| TipTap 3 | Narration text editing within scenes (reuse existing rich text editor) |
| XY Flow | Zone map for entity picking (click a room/mob on the map to add to scene) |
| Tailwind CSS 4 | All wizard UI styled with existing design tokens (`bg-bg-primary`, `text-accent`, etc.) |
| Panel registry | Story editor registered as new panel in Lore group |
| Showcase export | `exportShowcaseData()` extended to include story scenes with animation metadata |
| R2 sync | Story entity images already in R2 via existing asset sync |
| Recharts | Potential reuse for any story analytics (scene count, duration estimates) |

## Motion Configuration for Arcanum

Motion components should use Arcanum design tokens for transitions:

```typescript
// Standard scene transition
const SCENE_TRANSITION = {
  type: "tween",
  duration: 0.8,
  ease: [0.25, 0.1, 0.25, 1.0], // custom ease matching Arcanum's feel
} as const;

// Entity entrance (spring for organic feel)
const ENTITY_ENTRANCE = {
  type: "spring",
  stiffness: 120,
  damping: 14,
} as const;

// Text reveal (stagger children for line-by-line narration)
const TEXT_REVEAL = {
  staggerChildren: 0.12,
  delayChildren: 0.3,
} as const;
```

Use `LazyMotion` with `domAnimation` features at the story editor root to minimize bundle impact:

```tsx
import { LazyMotion, domAnimation } from "motion/react";

function StoryEditor() {
  return (
    <LazyMotion features={domAnimation}>
      {/* All motion components inside use m.div instead of motion.div */}
    </LazyMotion>
  );
}
```

## Data Model Implications (Stack-Relevant)

Stories are stored as lore article type with structured scene data. The scene data references existing zone entities by ID, not by embedding copies. This means:

- **No new database or storage format** -- scenes serialize to the existing `lore.yaml` structure
- **Image references** are asset IDs resolved via the existing asset manifest
- **Movement paths** are SVG `d` attribute strings (compact, portable)
- **Particle presets** are enum strings (`"sparks" | "mist" | "embers" | "rain" | "dust"`)
- **Parallax config** is layer count + depth multiplier per layer (2-3 numbers per scene)

This keeps the data layer thin and serialization-friendly -- all complexity lives in the rendering/animation code.

## Showcase Player Architecture

The embedded story player on the showcase site uses the same Motion library but a reduced feature set:

| Feature | Creator (Editor) | Showcase (Player) |
|---------|------------------|-------------------|
| Scene editing | Yes (dnd-kit, TipTap) | No (read-only) |
| Parallax layers | Yes | Yes (same Motion code) |
| Particle effects | Yes | Yes (same Canvas code) |
| Sprite paths | Yes (editable waypoints) | Yes (playback only) |
| Narration text | Yes (editable) | Yes (display only) |
| Presentation mode | Yes (fullscreen) | Yes (inline + fullscreen) |
| Auto-play | Yes | Yes |
| Keyboard nav | Yes | Yes |

The particle canvas and Motion animation code can be shared between creator and showcase via a shared types/utilities approach, or duplicated (small enough that duplication is acceptable).

## Sources

- [Motion official site](https://motion.dev) -- v12.37+, March 2026
- [Motion React installation docs](https://motion.dev/docs/react-installation) -- React 18.2+ compatible
- [Motion LazyMotion docs](https://motion.dev/docs/react-lazy-motion) -- 4.6kb initial, domAnimation +15kb
- [Motion reduce bundle size](https://motion.dev/docs/react-reduce-bundle-size) -- domAnimation vs domMax features
- [Motion animation docs](https://motion.dev/docs/react-animation) -- keyframes, springs, variants
- [Motion path tutorial](https://motion.dev/tutorials/react-motion-path) -- offset-path + offsetDistance
- [Motion useAnimationFrame](https://motion.dev/docs/react-use-animation-frame) -- per-frame callbacks
- [Motion GitHub](https://github.com/motiondivision/motion) -- 30M+ monthly downloads
- [@dnd-kit/core npm](https://www.npmjs.com/package/@dnd-kit/core) -- v6.3.1, 2400+ dependents
- [@dnd-kit sortable docs](https://docs.dndkit.com/presets/sortable) -- SortableContext, useSortable, arrayMove
- [MDN offset-path](https://developer.mozilla.org/en-US/docs/Web/CSS/offset-path) -- browser support table
- [CSS motion path MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Motion_path)
- [Fullscreen API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API)
- [Motion vs React Spring comparison (2025)](https://hookedonui.com/animating-react-uis-in-2025-framer-motion-12-vs-react-spring-10/)
- [React animation libraries comparison (2026)](https://blog.logrocket.com/best-react-animation-libraries/)
- [tsParticles GitHub](https://github.com/tsparticles/tsparticles) -- considered and rejected for bundle size

---

*Stack analysis: 2026-04-05*
