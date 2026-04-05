# Domain Pitfalls

**Domain:** Cinematic zone story authoring with timeline editor, animation system, and cross-surface rendering (Tauri desktop + web showcase)
**Researched:** 2026-04-05

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or architectural dead ends.

### Pitfall 1: Undo/Redo Breaks Under Nested Animation Data

**What goes wrong:** Stories contain scenes, scenes contain layers (background, entities, particles), layers contain animation keyframes with timing data. The existing lore undo system uses `structuredClone(state.lore)` on every mutation (50-entry history). When a story has 20 scenes with parallax layers and particle configs, each undo snapshot clones the entire `WorldLore` object including ALL articles, maps, timeline events, and every story's animation data. This creates multi-megabyte clones on every keyframe drag, causing visible UI jank during drag-and-drop timeline editing.

**Why it happens:** The lore store's `snapshotLore()` function (line 29-34 of `loreStore.ts`) does a full `structuredClone(state.lore)` for every mutation. This pattern works fine for text articles but breaks down when the lore object contains dense numerical arrays (keyframe positions, particle configs, animation curves). A story with 20 scenes, each with 3-5 layers and 10+ keyframes, adds thousands of nested objects to every clone.

**Consequences:** Timeline drag-and-drop becomes sluggish. Users see 200-500ms pauses when dragging scene cards or adjusting keyframe positions. The undo stack consumes hundreds of MB for an active editing session. Worst case: the app freezes during rapid-fire edits (e.g., dragging a scene across 10 positions fires 10 snapshots).

**Prevention:**
- Do NOT store story animation data inline in the lore `WorldLore` object. Stories as lore articles should store a reference (story ID) with metadata (title, zone, thumbnail), but the heavy animation/scene data lives in a separate store or separate persistence file.
- Create a dedicated `storyStore` with its own undo/redo that snapshots only the active story, not the entire lore corpus. Pattern: `structuredClone(activeStory)` where a single story is ~50-200KB, not `structuredClone(worldLore)` which could be 5-50MB.
- During drag operations, batch mutations: accumulate changes in local component state during the drag, commit to the store only on `dragEnd`. This means one undo snapshot per drag operation, not one per pixel moved.
- Consider command-based undo (delta patches) instead of snapshot-based undo for the story editor specifically. Record "moved scene 3 from position 2 to position 5" rather than cloning the entire story twice.

**Detection:** If story data is nested inside `WorldLore.articles[id].fields` or a new `WorldLore.stories` collection that gets cloned by `snapshotLore()`, this pitfall is active. If dragging a timeline card causes a visible frame drop, this pitfall is active.

**Phase:** Must be addressed in Phase 1 (data model). The storage architecture decision (inline vs. separate) is the hardest to change later.

---

### Pitfall 2: Story Data Schema Diverges Between Desktop and Showcase

**What goes wrong:** The story data model evolves rapidly during development. The desktop editor adds fields (transition type, particle density, easing curves) that the showcase player does not handle. Or the showcase player expects a flattened format that the editor does not export. Stories render correctly in the desktop preview but break or look wrong on the showcase.

**Why it happens:** The existing showcase export pipeline (`exportShowcase.ts`) converts TipTap JSON to HTML and resolves image URLs. Stories require a fundamentally different export: animation timelines, layer compositions, effect parameters, and timing data must be serialized in a format the showcase JavaScript can interpret and play back. Unlike articles (which are just HTML), stories are executable -- they need a runtime interpreter on the showcase side. Two different rendering engines consuming the same data will inevitably drift unless the schema is the contract.

**Consequences:** The "publish lore" button produces showcase data that crashes the story player, shows wrong timing, or silently drops effects. Builders preview in the desktop editor, publish, and discover the public version looks nothing like what they authored. Trust in the publish workflow erodes.

**Prevention:**
- Define the story schema as a single TypeScript interface shared between creator and showcase (like `ShowcaseData` already is). The story data format IS the contract -- no transformation layer between editor state and player input.
- The story data should be a serializable JSON-compatible structure from the start: no class instances, no functions, no circular references. Plain objects with typed arrays of scenes, layers, and keyframes.
- Both the desktop preview and the showcase player must consume the exact same data format through the exact same rendering logic. Extract the story rendering engine into a shared module or duplicate it with identical behavior.
- Version the story schema explicitly: `{ version: 1, scenes: [...] }`. The showcase player should reject stories with unknown versions rather than silently rendering garbage.
- Write an integration test: export a story, feed it to the showcase player component in isolation, verify it renders the same scene sequence.

**Detection:** If the desktop preview component and the showcase player component read different data shapes or apply different defaults for missing fields, this pitfall is active. If there is no `version` field on story data, this pitfall is active.

**Phase:** Must be addressed in Phase 1 (data model) and enforced through Phase 4 (showcase player). The schema must be locked before either renderer is built.

---

### Pitfall 3: Fullscreen Presentation Mode Fights Tauri Window Management

**What goes wrong:** The DM presentation mode uses `document.documentElement.requestFullscreen()` (the web Fullscreen API). On WebView2 (Windows), pressing Escape exits fullscreen -- but the app also uses Escape to close dialogs, dismiss the command palette, and deselect entities. The Escape key becomes ambiguous. Separately, Tauri's own `appWindow.setFullscreen(true)` makes the entire window fullscreen (including title bar area), which behaves differently from the web API's element-level fullscreen.

**Why it happens:** WebView2 intercepts Escape at the browser engine level for fullscreen exit before the JavaScript keydown handler fires. This is a documented WebView2 behavior (MicrosoftEdge/WebView2Feedback#3985, #2770). The app's existing keyboard shortcut system (`useKeyboardShortcuts.ts`) registers a global keydown listener, but it cannot `preventDefault()` on an Escape that WebView2 has already consumed. Additionally, the existing focus trap (`useFocusTrap.ts`) assumes Escape should propagate up -- in presentation mode, Escape should stay within the presentation context.

**Consequences:** Pressing Escape in presentation mode either (a) unexpectedly exits fullscreen when the user wanted to dismiss an overlay within the presentation, or (b) does nothing because WebView2 swallowed the event. Keyboard-driven DM workflow becomes unpredictable.

**Prevention:**
- Use Tauri's Rust-side `window.set_fullscreen(true)` for presentation mode instead of the web Fullscreen API. This avoids WebView2's built-in Escape-exits-fullscreen behavior entirely. Control exit via a dedicated key (e.g., F5 to toggle, or a visible "Exit Presentation" button).
- Do NOT use the Escape key to exit presentation mode. Use F5 (toggle) or a corner button. Reserve Escape for in-presentation actions (dismiss overlay, close speaker notes).
- The presentation mode should be a completely separate rendering context -- not a CSS overlay on the existing editor. Mount a dedicated `PresentationView` component that takes over the entire viewport with its own keyboard handler, isolated from the editor's shortcut system.
- Test on Windows specifically. WebView2 keyboard behavior differs from Chrome/Firefox, and the app targets Windows as its primary platform.

**Detection:** If the implementation uses `document.requestFullscreen()` rather than Tauri's window API, this pitfall is active. If Escape exits presentation mode, this pitfall is active.

**Phase:** Must be addressed in Phase 3 (DM presentation mode). The decision between web Fullscreen API and Tauri window fullscreen must be made at the start of that phase.

---

### Pitfall 4: Animation Rendering Uses Different Code Paths on Desktop vs. Showcase

**What goes wrong:** The desktop preview renders animations using React component state (useState/useEffect with requestAnimationFrame). The showcase player renders using CSS animations or a different timing engine. Parallax scroll speeds, particle emission rates, fade timings, and sprite movement paths look subtly different between the two. A story authored to feel dramatic on desktop plays too fast or too slow on the showcase.

**Why it happens:** The natural approach is to build the desktop preview first (it is the authoring tool, so it comes first in the roadmap), optimizing for React integration. Then the showcase player is built later as a separate component in a separate codebase (`showcase/`), and the developer re-implements the rendering from scratch using whatever technique seems best for the web context. Even small differences in timing (requestAnimationFrame vs. CSS `animation-duration`, 60fps vs. variable frame rate) produce visible drift over a 30-second story.

**Consequences:** Builders cannot trust the preview. They publish, check the showcase, adjust timing, re-publish, check again -- a painful feedback loop. Or they never check and their public stories look wrong.

**Prevention:**
- Build the story player as a single, self-contained React component that works in BOTH the Tauri webview and the standalone showcase SPA. No Tauri-specific APIs inside the player. No `invoke()` calls, no `@tauri-apps/api` imports. The player receives story data as props and renders pure HTML/CSS/Canvas.
- Use CSS animations and transitions as the primary animation engine (not requestAnimationFrame-driven JS). CSS animations are deterministic: `animation-duration: 2s` means 2 seconds on any browser. RAF-based animation is frame-rate dependent and produces different results on different hardware.
- For particle effects that require imperative rendering (Canvas 2D), encapsulate the particle engine in a single module used by both surfaces. Same code, same random seed, same output.
- Ship the player component as a shared package or simply copy it between creator and showcase with a lint rule that they stay in sync. The showcase is a React 19 SPA with the same React version as the creator -- there is no framework mismatch preventing code sharing.

**Detection:** If the creator's preview component imports from `@tauri-apps/api` or uses Tauri IPC, it cannot run on the showcase. If the creator and showcase use different React component trees to render the same story, drift is inevitable.

**Phase:** Must be planned in Phase 1 (architecture), implemented in Phase 2 (scene editor preview), and validated in Phase 4 (showcase player). The "one player component, two hosts" decision must be made before any rendering code is written.

---

### Pitfall 5: Story YAML Persistence Bloats lore.yaml Beyond Usability

**What goes wrong:** Stories are persisted in `lore.yaml` alongside articles, maps, and timeline events. A single story with 20 scenes, parallax layers, particle configs, and animation keyframes can generate 500-2000 lines of YAML. Five stories push `lore.yaml` past 10,000 lines. The existing `saveLore()` function (`lorePersistence.ts`) serializes the entire `WorldLore` with `yaml.stringify()` on every auto-save (3-second debounce). YAML serialization of large objects is slow, git diffs become unreadable, and the file becomes too large for comfortable manual inspection.

**Why it happens:** The existing lore persistence is designed for text-centric data (articles with string fields). YAML is human-readable but verbose for numerical arrays -- a keyframe `{ time: 0.5, x: 100, y: 200, opacity: 1.0, scale: 1.2 }` takes 5 lines in YAML vs. 1 line in JSON. The auto-save fires on every lore store mutation, and during timeline editing, mutations happen frequently.

**Consequences:** Auto-save causes perceptible pauses during editing. Git commits include thousands of lines of keyframe noise. Merge conflicts in `lore.yaml` become common and hard to resolve. Builders who inspect their YAML files (a core workflow for MUD builders) are overwhelmed.

**Prevention:**
- Store story data in separate files: `stories/{storyId}.json` or `stories/{storyId}.yaml`. The lore store references stories by ID with lightweight metadata (title, zone, thumbnail) but the heavy scene/animation data lives in its own file.
- Use JSON (not YAML) for story files. Animation keyframes are dense numerical data that serializes 3-5x more compactly in JSON. JSON also round-trips without the type coercion surprises that YAML has (e.g., `on` becoming `true`, bare numbers losing precision).
- Implement separate save logic for stories: save on explicit action or on a longer debounce (5-10 seconds), not on the lore auto-save cycle. The lore metadata reference (`stories` array in `WorldLore`) auto-saves normally; the story content file saves independently.
- Each story file is independently versioned in git, making diffs reviewable and merge conflicts localized.

**Detection:** If story animation data is serialized inside `lore.yaml`, this pitfall is active. If auto-save pauses are perceptible during timeline editing, this pitfall is active.

**Phase:** Must be addressed in Phase 1 (data model and persistence). The file layout decision affects everything downstream.

## Moderate Pitfalls

### Pitfall 6: Drag-and-Drop Timeline Causes Render Thrashing

**What goes wrong:** Dragging a scene card across the timeline fires continuous state updates to reorder the scenes array. Each state update triggers a React re-render of the entire timeline. With 20+ scene cards (each rendering a thumbnail, duration label, and effect badges), the re-render takes >16ms and the drag animation stutters.

**Prevention:**
- Use local component state (or a ref) for the drag position during the drag. Only commit the final position to the Zustand store on `dragEnd`. This means zero store mutations during the drag itself.
- Memoize scene card components with `React.memo` so only the moving card and its swap target re-render.
- Do NOT update scene array order on every `dragOver` event. Track the intended drop position visually (CSS transform on the dragged element, gap indicator) and reorder on drop.
- Consider the native HTML drag-and-drop API or a lightweight library (dnd-kit) rather than mouse-event-based drag. Native DnD does not re-render React on `dragover`.

**Detection:** If the timeline component calls `set()` on a store during `onDrag` or `onDragOver` events, this pitfall is active.

**Phase:** Phase 2 (timeline editor UI). Must be tested with 20+ scenes.

---

### Pitfall 7: Particle Effects Leak Memory on Scene Transitions

**What goes wrong:** Each scene can have particle effects (sparks, mist, fireflies). The particle system uses a Canvas 2D element with a `requestAnimationFrame` loop. When transitioning between scenes, the old scene's particle canvas is unmounted but the RAF loop is not canceled. After navigating through 15-20 scenes in the editor, the app accumulates orphaned RAF loops consuming CPU. In presentation mode (which auto-advances), this compounds quickly.

**Prevention:**
- Every `requestAnimationFrame` call must have a corresponding `cancelAnimationFrame` in the component's cleanup (useEffect return). Store the frame ID in a ref, not state.
- Use an `AbortController`-like pattern: pass a `{ cancelled: boolean }` ref to the render loop. Check it at the top of each frame before doing work.
- When a scene unmounts, explicitly clear the canvas context (`ctx.clearRect(0, 0, w, h)`) and null out the canvas ref. This ensures the GPU texture is released.
- Test by rapidly clicking through scenes in the editor and monitoring memory in DevTools. Memory should stay flat, not grow linearly with scenes visited.

**Detection:** Open DevTools Performance tab, click through 20 scenes rapidly, check if multiple RAF loops are running simultaneously. If task manager shows growing memory during scene navigation, this pitfall is active.

**Phase:** Phase 2 (scene effects) and Phase 3 (presentation mode auto-advance).

---

### Pitfall 8: Entity Picker Creates Tight Coupling Between Zone and Story Stores

**What goes wrong:** The entity picker lets builders drag mobs, items, and NPCs from zone data into story scenes. The natural implementation reads from `zoneStore` to populate the picker and writes entity references into the story data. But zone data is mutable -- a mob can be renamed, deleted, or moved to a different room. The story now contains stale references that point to entities that no longer exist.

**Prevention:**
- Stories should store entity snapshots at authoring time, not live references. When a builder drags a mob into a scene, copy the mob's display name, image, and relevant fields into the scene data. The scene does not hold a pointer to `zoneStore.zones["forest"].data.mobs["wolf"]` -- it holds `{ name: "Wolf", image: "abc123.png", sourceZone: "forest", sourceId: "wolf" }`.
- Provide a "refresh from zone" action that re-syncs a scene entity with current zone data, but never do this automatically. The builder chose the entity's state at a point in time; auto-syncing would silently change their authored story.
- When the referenced zone entity is deleted, show a warning badge on the scene card ("Source entity deleted") but do not break the story -- the snapshot is still valid for rendering.
- The entity picker reads from `zoneStore` (read-only), the story data is self-contained. No bidirectional dependency.

**Detection:** If story scenes contain zone entity IDs without accompanying snapshot data, this pitfall is active. If deleting a mob from a zone causes a story to crash or show blank entities, this pitfall is active.

**Phase:** Phase 2 (entity picker and scene composition). The snapshot-vs-reference decision must be made when designing the scene data model.

---

### Pitfall 9: Parallax and Layer Z-Ordering Breaks With Dynamic Content

**What goes wrong:** Scenes have layered composition: background image (room art), midground entities (mobs/NPCs with sprite animations), foreground effects (particles, vignette). The z-ordering is managed with CSS `z-index` or canvas draw order. When a builder adds a text overlay (narration), it needs to appear above particles but below the vignette. The layer ordering logic becomes a fragile cascade of z-index values that breaks when new layer types are added.

**Prevention:**
- Define a fixed layer stack with explicit, well-spaced z-index values as constants:
  - Background: 0
  - Midground entities: 10
  - Entity animations: 20
  - Particle effects: 30
  - Text overlays: 40
  - Transition effects: 50
  - UI controls (in editor only): 100
- Do NOT let builders set arbitrary z-index values. Expose layer ordering as a drag-to-reorder list with a fixed set of layer types, not a numeric input.
- Use a single rendering pipeline (either all CSS layers or all Canvas) per scene. Mixing CSS-positioned elements over a Canvas creates z-index interactions that are browser-dependent.
- If using Canvas for effects, render all visual layers to Canvas and overlay only non-visual UI (editor controls, narration text input) as HTML.

**Detection:** If the codebase has `z-index` values above 50 for story-related components (excluding editor UI), the z-ordering scheme is ad-hoc. If adding a new layer type requires changing z-index of existing layers, this pitfall is active.

**Phase:** Phase 2 (scene composition). Define the layer stack before implementing any rendering.

---

### Pitfall 10: Keyboard Shortcut Conflicts Between Editor, Presentation, and Existing App

**What goes wrong:** The app already has Ctrl+Z (undo), Ctrl+S (save), Ctrl+K (command palette), Ctrl+W (close tab), Ctrl+1-9 (tab switching), and Escape (dismiss). The timeline editor wants arrow keys for scene navigation, Space for play/pause, Delete for removing scenes. The presentation mode wants arrow keys for slide advance, Escape to exit, Space for pause. These overlap with each other and with the existing global shortcuts.

**Prevention:**
- Implement a shortcut scope system: `"global"`, `"editor"`, `"timeline"`, `"presentation"`. Each scope defines which shortcuts are active. When entering presentation mode, disable all global shortcuts except Ctrl+S and the presentation exit key.
- The existing `useKeyboardShortcuts.ts` hook registers global handlers. The story editor and presentation mode should NOT add more global handlers. Instead, they should use scoped handlers attached to their container element (not `window`).
- Document all shortcut scopes in one file (not scattered across components). The `ShortcutsHelp.tsx` panel should show context-sensitive shortcuts.
- Presentation mode shortcuts: Right arrow / Space = advance, Left arrow = back, F5 = exit. These are conventional (PowerPoint, Google Slides, reveal.js) and do not conflict with editor shortcuts.

**Detection:** If two `addEventListener("keydown", ...)` handlers on `window` both respond to the same key in the same context, this pitfall is active.

**Phase:** Phase 2 (timeline editor shortcuts) and Phase 3 (presentation mode shortcuts). The scope system should be designed in Phase 2.

---

### Pitfall 11: Showcase Story Player Bundle Size Explodes

**What goes wrong:** The showcase is a lightweight SPA (currently loads articles, maps, timeline, graph). Adding a story player with particle effects, animation engine, and parallax rendering triples the JavaScript bundle. The showcase loads slowly for visitors who just want to read articles.

**Prevention:**
- Lazy-load the story player component. The showcase already uses route-based pages -- the story player should be a separate route (`/stories/:id`) with a `React.lazy()` import.
- The particle engine (Canvas 2D) should be its own chunk, loaded only when a story with particles is opened. Use dynamic `import()` for the particle module.
- Keep the story player dependency-free: no animation libraries (Framer Motion, GSAP). CSS animations + a small RAF loop for Canvas particles is sufficient and adds zero bundle weight.
- Set a bundle budget: the story player chunk should be under 50KB gzipped. If it exceeds this, something has been over-engineered.

**Detection:** If the showcase's initial bundle includes story player code (visible in Vite's build output), this pitfall is active. If the story player imports a third-party animation library, evaluate whether it is necessary.

**Phase:** Phase 4 (showcase player). Code-splitting must be verified in the production build.

## Minor Pitfalls

### Pitfall 12: Story Export Misses Asset URLs for Scene Images

**What goes wrong:** Stories reference room background images and entity sprites via local asset paths or content-addressed hashes (the existing asset system). The showcase export must resolve these to R2 URLs, just like article images. But stories have many more image references per item (each scene can have a background + multiple entity sprites), and a missed reference produces a broken scene rather than a missing thumbnail.

**Prevention:**
- Reuse the existing image URL resolution logic from `exportShowcase.ts`. Story export should iterate all scenes, collect all image references (backgrounds, entity sprites, thumbnails), and resolve them through the same `imageBaseUrl` mechanism.
- Add a validation step before publish: scan all story image references and warn if any are not synced to R2. The existing asset sync workflow handles this for articles -- extend it to stories.
- Store image references in stories using the same content-addressed hash format as the asset manifest, not file paths. This ensures the R2 resolution works identically.

**Phase:** Phase 4 (showcase export). Validate with a story that has 10+ unique images across scenes.

---

### Pitfall 13: Auto-Play Timing Assumes Consistent Frame Rate

**What goes wrong:** The showcase auto-play mode advances scenes after a duration (e.g., 5 seconds per scene). The timer uses `setTimeout` or RAF frame counting. On a slow device or backgrounded tab, `setTimeout` fires late and RAF stops entirely. The story plays at wrong speed or freezes.

**Prevention:**
- Use wall-clock time (`performance.now()` or `Date.now()`) to track elapsed time, not frame count. Compare elapsed time against scene duration on each frame.
- Handle the `visibilitychange` event: when the tab is backgrounded, pause the story. Resume from where it left off when the tab returns.
- For CSS animations, use `animation-play-state: paused/running` controlled by a React state that tracks play/pause.

**Phase:** Phase 4 (showcase auto-play). Test with Chrome DevTools CPU throttling.

---

### Pitfall 14: Scene Transition Effects Incompatible Between CSS and Canvas Layers

**What goes wrong:** Scene transitions (fade, dissolve, slide) are implemented as CSS transitions on the scene container. But the Canvas particle layer does not participate in CSS transitions -- it is a separate rendering surface. During a fade transition, the HTML content fades but the canvas snaps abruptly, creating a visual glitch.

**Prevention:**
- Transition effects must control ALL layers, including Canvas. For fade: set Canvas `globalAlpha` to match the CSS opacity transition. For slide: translate both the HTML layer and the Canvas position.
- Alternatively, render everything to a single Canvas (including text and images) so transitions affect the entire scene uniformly. This is more complex to build but eliminates the mixed-surface problem.
- The simplest approach: during transitions, capture the outgoing scene as a static image (via `canvas.toDataURL()` or DOM screenshot), crossfade between two images, then mount the new scene's live layers. This sidesteps the mixed-surface problem entirely.

**Phase:** Phase 2 (scene transitions) and Phase 3 (presentation mode transitions).

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Data model design | Inline story data bloats undo cloning (Pitfall 1) | Separate story store with independent undo |
| Data model design | YAML persistence bloats lore.yaml (Pitfall 5) | Separate story files in JSON format |
| Data model design | Schema divergence desktop vs showcase (Pitfall 2) | Single shared TypeScript interface, version field |
| Scene composition | Entity references go stale (Pitfall 8) | Snapshot entities at authoring time, not live refs |
| Scene composition | Layer z-ordering fragility (Pitfall 9) | Fixed layer stack with constant z-index values |
| Timeline editor | Drag-and-drop render thrashing (Pitfall 6) | Local state during drag, commit on drop |
| Timeline editor | Keyboard shortcut conflicts (Pitfall 10) | Scoped shortcut system, not more global handlers |
| Cinematic effects | Particle memory leaks (Pitfall 7) | Cancel RAF in cleanup, clear canvas on unmount |
| Cinematic effects | Mixed CSS/Canvas transitions (Pitfall 14) | Unified transition control across all layers |
| Presentation mode | Tauri fullscreen Escape key (Pitfall 3) | Use Tauri window API, not web Fullscreen API |
| Rendering architecture | Different code paths desktop vs web (Pitfall 4) | Single player component, no Tauri API deps |
| Showcase player | Bundle size explosion (Pitfall 11) | Lazy-load player, no animation library deps |
| Showcase player | Missing asset URLs (Pitfall 12) | Reuse existing image resolution, validate before publish |
| Showcase player | Auto-play timing drift (Pitfall 13) | Wall-clock elapsed time, handle tab visibility |

## Sources

- Codebase: `creator/src/stores/loreStore.ts` -- `snapshotLore()` uses `structuredClone(state.lore)` (line 31), 50-entry undo history
- Codebase: `creator/src/lib/lorePersistence.ts` -- `saveLore()` serializes entire `WorldLore` via `yaml.stringify()`
- Codebase: `creator/src/lib/exportShowcase.ts` -- `ShowcaseData` schema, image URL resolution
- Codebase: `creator/src/lib/useKeyboardShortcuts.ts` -- global keyboard handler with Ctrl+Z, Ctrl+S, Escape, Ctrl+K conflicts
- Codebase: `creator/src/lib/useFocusTrap.ts` -- Escape key handling in modal contexts
- Codebase: `creator/src/components/lore/LorePanelHost.tsx` -- 3-second auto-save debounce on lore dirty flag
- Codebase: `showcase/src/lib/DataContext.tsx` -- showcase data loading, single JSON fetch
- Codebase: `showcase/src/types/showcase.ts` -- current `ShowcaseData` shape (no story support)
- [WebView2 Escape key fullscreen issue](https://github.com/MicrosoftEdge/WebView2Feedback/discussions/3985) -- Escape exits fullscreen at browser engine level
- [Tauri canvas/CSS GPU acceleration issue](https://github.com/tauri-apps/tauri/issues/4891) -- WebView2 uses CPU for CSS filters and canvas
- [Tauri CSS animation performance on Linux](https://github.com/tauri-apps/wry/issues/617) -- CSS animations slower than Chromium
- [Web Animation Performance Tier List](https://motion.dev/magazine/web-animation-performance-tier-list) -- CSS transforms/opacity are GPU-composited; other properties are not
- [Parallax Done Right](https://medium.com/@dhg/parallax-done-right-82ced812e61c) -- only animate translate3d, scale, rotation, opacity for 60fps
- [Parallax scrolling best practices 2026](https://www.builder.io/blog/parallax-scrolling-effect) -- direct scroll with transform is library-free and runs on compositor thread
- [Rewriting History: Undo/Redo in Complex Web Apps](https://engineering.contentsquare.com/2023/history-undo-redo/) -- snapshot vs command undo, memory management, concurrency
- [Undo/Redo in Level Design](https://www.wayline.io/blog/undo-redo-level-design) -- dependency tracking between objects, memory optimization
- [Immer vs structuredClone performance comparison](https://www.pkgpulse.com/blog/immer-vs-structuredclone-vs-deep-clone-immutable-2026) -- structuredClone 482ms on large objects vs Immer's structural sharing
- [React useEffect cleanup for memory leaks](https://blog.logrocket.com/understanding-react-useeffect-cleanup-function/) -- cleanup runs before re-render with changed deps
- [Focus Trapping & Keyboard Shortcuts](https://frontendmasters.com/courses/react-accessibility/focus-trapping-keyboard-shortcuts/) -- shortcut scoping, conflict prevention
- [Using the Fullscreen API with React](https://dev.to/darthknoppix/using-the-fullscreen-api-with-react-1lgf) -- element-level vs window-level fullscreen considerations
