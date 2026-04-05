# Project Research Summary

**Project:** Arcanum v1.1 Zone Stories
**Domain:** Cinematic zone story authoring for MUD world builder (new milestone in existing Tauri 2 desktop app + web showcase)
**Researched:** 2026-04-05
**Confidence:** MEDIUM-HIGH

## Executive Summary

Zone Stories adds a cinematic story authoring system to the existing Arcanum world builder. Builders compose linear scene sequences from their zone data (rooms, mobs, items), layering backgrounds, entity sprites, narration text, and atmospheric effects (parallax, particles) into presentations they can deliver to players as a DM or publish to the showcase website. The domain draws from visual novel engines (Ren'Py scene composition model), presentation frameworks (Reveal.js keyboard navigation), and narrative authoring tools (Plottr scene card timelines). Each pillar is well-understood individually; the combination is novel but the technical risk is manageable.

The recommended approach adds only two external dependencies: Motion v12.37 for declarative animation orchestration (scene transitions, sprite paths, text reveals) and dnd-kit v6.3 for drag-and-drop scene reordering. Everything else -- particles, parallax, fullscreen presentation, the story player -- is built with custom code on top of CSS transforms and Canvas 2D. The architecture integrates stories as a new lore data type, persisted in separate JSON files per story (not inline in lore.yaml), with a dedicated store for undo/redo that snapshots only the active story. The CinematicRenderer component is designed to work identically in the desktop editor preview, fullscreen presentation mode, and the showcase web player.

The most critical risks are all in the data model layer (Phase 1). First, storing dense animation data inside the WorldLore object would bloat undo snapshots and lore.yaml persistence -- stories must use separate files and a separate store. Second, the story data schema must be locked as a contract between the desktop renderer and the showcase player before either is built, or the two will drift and stories will render differently on each surface. Third, fullscreen presentation mode on Windows must use Tauri's Rust-side window API rather than the web Fullscreen API, because WebView2 intercepts Escape at the engine level before JavaScript keydown handlers fire. These are all preventable with the right architectural decisions made upfront.

## Key Findings

### Recommended Stack

The existing stack (React 19, Zustand 5, Tailwind 4, TipTap 3, Tauri 2) handles the vast majority of this milestone's needs. Only two new runtime dependencies are required, plus a custom particle system.

**New dependencies:**
- **Motion ^12.37**: Declarative animation engine for React. Scene transitions via `animate` prop, imperative scene sequencing via `useAnimate`, sprite path animation via CSS `offset-path` + `offsetDistance`, text reveal via `variants` + `staggerChildren`, per-frame particle updates via `useAnimationFrame`. LazyMotion reduces initial cost to 4.6KB with +15KB on first use. 30M+ monthly npm downloads. React 19 compatible.
- **@dnd-kit/core ^6.3 + @dnd-kit/sortable ^10.0**: Lightweight drag-and-drop (10KB core + 3KB sortable) for scene card reordering in the timeline editor. Keyboard accessible, horizontal sorting strategy, battle-tested stable release.
- **Custom Canvas 2D particle system**: ~200-300 lines of TypeScript for 5-6 ambient effect presets (sparks, mist, embers, rain, dust, snow). Renders on a single Canvas overlay with `requestAnimationFrame`. Dramatically lighter than tsParticles (45-60KB) for the narrow scope needed.

**Total new bundle impact:** ~34KB loaded on demand via Vite code splitting. Showcase adds only Motion (~20KB on story player load).

**Explicitly rejected:** PixiJS (overkill for 1-5 sprites), tsParticles (overkill for 5 presets), GSAP (license concerns), react-spring (weaker sequencing), @react-spring/parallax (scroll-based, wrong paradigm), Spectacle/Reveal.js (text slides, not cinematic scenes), Three.js (no 3D content).

### Expected Features

**Must have (table stakes):**
- Scene card timeline with drag-and-drop reordering
- Scene composition: room background + entity sprites + narration text
- Entity picker browsing zone rooms, mobs, items with thumbnails
- Narration text editor per scene (reuse TipTap)
- Fullscreen DM presentation mode with keyboard navigation (arrows, space, escape)
- Scene transition effects (crossfade at minimum)
- Story persistence with undo/redo
- Stories as a lore article type (inherits tags, relations, showcase export)
- Showcase story player (click-through navigation)
- Single-zone scope per story

**Should have (differentiators):**
- Room background auto-population from zone data
- Entity spotlight positioning (left/center/right/drag)
- Parallax background layers (2-3 depth layers per scene)
- Particle effects overlay (sparks, mist, embers, rain, dust, snow)
- Sprite movement paths (entrance/exit choreography)
- Scene preview in editor (live miniature of composed scene)
- Auto-play mode for showcase with configurable pace
- DM speaker notes (hidden from audience)
- Narration text reveal animation (typewriter/fade-in)
- Scene templates/presets (Establishing Shot, Encounter, Discovery)

**Defer to v2+:**
- Multi-zone stories (architecture supports it via `zoneId` on SceneEntity)
- Scene templates (need real usage patterns first)
- Video rendering/export
- Branching narratives (fundamentally different product)
- Voice-over / TTS
- Scene scripting language

### Architecture Approach

Stories integrate as a new vertical slice through the existing architecture: types in `types/story.ts`, data in a dedicated `storyStore` with independent undo/redo, components in `components/story/`, export extension in `exportShowcase.ts`, and a player component in the showcase app. The CinematicRenderer uses a DOM + Canvas hybrid approach -- CSS transforms for parallax layers and entity positioning (GPU-accelerated), a single Canvas overlay for particle effects, and HTML for narration text. Stories persist in separate `stories/{storyId}.json` files, with lightweight metadata references in `WorldLore.stories` for lore system integration. The showcase player duplicates the ~200 LOC particle system rather than sharing via a monorepo package, since the duplication cost is far lower than the tooling overhead.

**Major components:**
1. **StoryEditor** -- Top-level authoring surface with timeline, scene detail editor, and preview pane (video-editor-inspired layout: preview top-left, properties top-right, timeline strip bottom)
2. **CinematicRenderer** -- Core rendering engine compositing parallax layers, room backgrounds, entity sprites, particle canvas, and narration text. Works in editor preview (600x400), fullscreen presentation, and showcase player contexts.
3. **StoryTimeline** -- Horizontal draggable scene card strip with @dnd-kit/sortable for reordering
4. **EntityPicker** -- Modal/panel for browsing zone entities (rooms, mobs, items) grouped by type with thumbnails
5. **PresentationMode** -- Portal-based fullscreen overlay with keyboard navigation, scene counter, and speaker notes panel
6. **StoryPlayer (showcase)** -- Embedded click-through + auto-play player for the public showcase website
7. **ParticleCanvas** -- Self-contained Canvas 2D particle system with preset configs and RAF cleanup

### Critical Pitfalls

1. **Undo/redo breaks with nested animation data** -- The lore store clones the entire WorldLore object on every mutation. Dense scene/keyframe data makes clones multi-megabyte and causes visible jank during timeline editing. **Prevention:** Dedicated story store with independent undo that snapshots only the active story (~50-200KB), not the entire lore corpus. Batch drag mutations: commit to store only on dragEnd.

2. **Story YAML bloats lore.yaml beyond usability** -- A single 20-scene story generates 500-2000 lines of YAML. Five stories push lore.yaml past 10K lines, slowing auto-save and making git diffs unreadable. **Prevention:** Store story scene data in separate `stories/{storyId}.json` files. Use JSON, not YAML, for dense numerical animation data (3-5x more compact). Lore.yaml keeps only lightweight story metadata references.

3. **Schema diverges between desktop and showcase renderers** -- Stories are executable (they need a runtime interpreter), not just displayable. Two rendering engines consuming the same data will drift unless the schema is the contract. **Prevention:** Single TypeScript interface defining story data format, consumed identically by both renderers. Version field on story schema. No transformation layer between editor state and player input.

4. **Fullscreen presentation fights Tauri window management** -- WebView2 intercepts Escape at the engine level for fullscreen exit before JavaScript keydown handlers fire. Escape becomes ambiguous. **Prevention:** Use Tauri's Rust-side `window.set_fullscreen(true)` instead of the web Fullscreen API. Do NOT use Escape to exit presentation -- use F5 toggle or a visible button.

5. **Animation rendering differs between desktop and showcase** -- Natural approach builds desktop preview first, then reimplements for showcase. Even small timing differences produce visible drift over a 30-second story. **Prevention:** Build the story player as a single React component with no Tauri API dependencies. Use CSS animations as the primary engine (deterministic timing). Same particle code in both surfaces.

## Implications for Roadmap

Based on research, the feature set decomposes into 6 phases with clear dependency ordering. The data model and persistence architecture MUST come first because three of the five critical pitfalls (undo bloat, YAML bloat, schema divergence) are all data layer decisions that become extremely expensive to change after rendering code is built on top of them.

### Phase 1: Data Model + Story Foundation
**Rationale:** Three critical pitfalls (1, 2, 5) are exclusively data model decisions. The storage architecture (separate files vs inline, JSON vs YAML, separate store vs lore store) constrains every downstream component. This phase must be settled and tested before any rendering code is written.
**Delivers:** `types/story.ts` with Story, StoryScene, SceneEntity, SceneEffect interfaces. Dedicated `storyStore` with CRUD mutations and independent undo/redo (snapshot active story only). Persistence layer writing `stories/{storyId}.json` files. Lightweight `WorldLore.stories` metadata array. Panel registry entry for "stories" in the Lore group. StoryBrowser component (list, create, delete -- analogous to ArticleBrowser).
**Addresses:** Story as lore article type, story persistence, single-zone scope, story cover/thumbnail
**Avoids:** Pitfall 1 (undo bloat), Pitfall 2 (schema divergence -- lock schema here), Pitfall 5 (YAML bloat)

### Phase 2: Story Editor + Scene Composition
**Rationale:** With the data foundation proven, build the core authoring experience. The editor layout (preview + detail + timeline) is the primary user interaction surface. Entity integration depends on having the editor shell in place.
**Delivers:** StoryEditor layout shell, SceneCard, SceneDetailEditor, NarrationEditor (TipTap reuse), StoryTimeline with @dnd-kit/sortable drag reordering, EntityPicker for browsing zone rooms/mobs/items, room background auto-population, entity spotlight positioning (left/center/right/custom), scene preview pane.
**Addresses:** Scene card timeline, drag-and-drop reordering, narration text editor, entity picker, scene composition (background + entities + text), room background auto-population, entity spotlight positioning, scene preview in editor
**Avoids:** Pitfall 6 (drag render thrashing -- local state during drag, commit on drop), Pitfall 8 (entity staleness -- snapshot entities at authoring time), Pitfall 9 (layer z-ordering -- define fixed layer stack with constant values), Pitfall 10 (keyboard conflicts -- scoped shortcut system)

### Phase 3: Cinematic Renderer + Effects
**Rationale:** This is the most technically complex phase. The CinematicRenderer must be designed as a portable component (no Tauri deps) so it can serve all three contexts (editor, presentation, showcase). Building it after the editor gives concrete scene data to render against.
**Delivers:** CinematicRenderer (DOM + Canvas hybrid), ParticleCanvas with 5-6 preset effects, parallax background layers via CSS transforms, scene transition effects (crossfade, slide), narration text reveal animation (typewriter/fade-in), sprite movement paths via CSS offset-path + Motion.
**Addresses:** Parallax background layers, particle effects overlay, sprite movement paths, narration text reveal, scene transition effects
**Avoids:** Pitfall 4 (different code paths -- one renderer component, no Tauri imports), Pitfall 7 (particle memory leaks -- cancel RAF in cleanup, clear canvas on unmount), Pitfall 14 (CSS/Canvas transition mismatch -- unified transition control)

### Phase 4: DM Presentation Mode
**Rationale:** Depends on the CinematicRenderer (Phase 3). The presentation mode wraps it in a fullscreen container with keyboard navigation. Must use Tauri's window API, not the web Fullscreen API.
**Delivers:** PresentationMode portal component, Tauri Rust-side fullscreen toggle, keystroke navigation (arrows, space, F5), scene counter/progress indicator, DM speaker notes panel, auto-advance timer.
**Addresses:** Fullscreen presentation mode, keystroke navigation, DM speaker notes, scene-level audio cues (optional)
**Avoids:** Pitfall 3 (Tauri fullscreen Escape -- use Rust window API, F5 toggle instead of Escape), Pitfall 10 (keyboard conflicts -- presentation-scoped handlers, disable global shortcuts)

### Phase 5: Showcase Story Player
**Rationale:** The showcase player is a separate deployment target (Cloudflare Pages SPA). It consumes pre-resolved story data (URLs, HTML narration) exported from the creator. Building it after the CinematicRenderer means the rendering approach is proven and can be replicated.
**Delivers:** ShowcaseStory/ShowcaseScene types in both creator and showcase, export logic in `exportShowcaseData()` resolving entity refs to R2 URLs, StoryPlayer component (click-through + auto-play), StoriesPage + StoryPage in showcase, routing updates, duplicated particle system (~200 LOC).
**Addresses:** Showcase story player (click-through), auto-play mode, story cover/thumbnail in showcase listing
**Avoids:** Pitfall 11 (bundle size -- lazy-load player, no animation library in showcase), Pitfall 12 (missing asset URLs -- reuse existing image resolution, validate before publish), Pitfall 13 (auto-play timing -- wall-clock time, handle tab visibility)

### Phase 6: Polish + Templates
**Rationale:** After the full pipeline works (author -> preview -> present -> publish), add convenience features that accelerate the workflow. Scene templates need real usage patterns to design well.
**Delivers:** 3-5 scene templates/presets (Establishing Shot, Encounter, Discovery), story cover auto-suggestion from first scene, UX refinements based on testing, scene-level audio cue integration (if warranted).
**Addresses:** Scene templates/presets, story cover/thumbnail auto-suggest
**Avoids:** Over-engineering templates before real usage patterns emerge

### Phase Ordering Rationale

- **Phase 1 before everything:** Three critical pitfalls are data model decisions. The storage format (separate JSON files), undo strategy (dedicated store), and schema versioning cannot be retrofitted without significant rework.
- **Phase 2 before Phase 3:** The editor provides concrete scene data for the renderer to consume. Building the renderer without real authored scenes leads to over-abstraction.
- **Phase 3 before Phases 4-5:** Both presentation mode and the showcase player wrap the CinematicRenderer. Building it once as a portable component (no Tauri deps) serves all three consumers.
- **Phase 4 before Phase 5:** Desktop presentation is the higher-priority use case (DMs presenting to players). The showcase player is a "nice to have" that extends reach but is not required for the core authoring workflow.
- **Phase 6 last:** Templates and polish benefit from real usage of the authoring pipeline. Premature template design produces templates nobody uses.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Data Model):** The separation between story store and lore store needs careful design to maintain lore system integration (tags, relations, showcase export) while isolating heavy scene data. The persistence split (metadata in lore.yaml, content in stories/*.json) needs implementation validation.
- **Phase 3 (Cinematic Renderer):** The DOM + Canvas hybrid rendering approach, particle system implementation, and CSS offset-path animation are the most technically novel parts. Motion's `useAnimate` for imperative scene sequencing needs prototyping.
- **Phase 4 (Presentation Mode):** Tauri Rust-side fullscreen API behavior on Windows needs testing. WebView2 keyboard interception specifics may require workarounds.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Story Editor):** Follows established patterns from the codebase: DefinitionWorkbench layout, TipTap editor reuse, dnd-kit is well-documented, entity picker is a filtered view of zoneStore data.
- **Phase 5 (Showcase Player):** The showcase export pipeline is well-established (articles, maps already export). The player is a simplified read-only version of the CinematicRenderer. Routing additions follow existing showcase patterns.
- **Phase 6 (Polish):** Template/preset patterns are trivial once the authoring pipeline works.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Only 2 new dependencies, both well-maintained with confirmed React 19 compatibility. Custom particle system is bounded scope. Motion v12.37 docs verified. dnd-kit v6.3 stable and battle-tested. |
| Features | MEDIUM-HIGH | Table stakes drawn from visual novels, presentation frameworks, and narrative tools -- each pillar well-understood. The specific combination (zone-data-aware cinematic authoring) is novel but low risk since it composes known patterns. |
| Architecture | HIGH | Integrates through established codebase patterns (lore system, panel registry, showcase export). Data flow is clear. The CinematicRenderer portability constraint (no Tauri deps) is a clean architectural boundary. Direct codebase analysis underpins all integration points. |
| Pitfalls | HIGH | Pitfalls are specific, actionable, and grounded in direct codebase analysis (snapshotLore cloning behavior, lore.yaml serialization, WebView2 Escape interception). Phase-specific warnings are mapped. External sources confirm WebView2 fullscreen issues. |

**Overall confidence:** MEDIUM-HIGH

The slight reduction from HIGH is due to the CinematicRenderer being the most technically novel component. The DOM + Canvas hybrid approach, particle system, and cross-surface rendering (same component in Tauri webview and standalone SPA) have not been validated with a prototype. The individual techniques are well-documented, but their composition in this specific context is untested.

### Gaps to Address

- **Story store vs lore store integration boundary:** The pitfalls research argues strongly for a separate story store, while the architecture research initially proposed stories inside loreStore. The synthesis recommendation is a dedicated store, but the exact integration pattern (how story metadata in WorldLore stays in sync with story content in storyStore) needs design validation during Phase 1.
- **Entity snapshot vs reference trade-off:** Pitfalls research recommends snapshots (copy entity name + image at authoring time). Architecture research recommends references (resolve at render time for freshness). The recommended approach is references for the desktop editor (always fresh) and resolved snapshots at export time (showcase gets a frozen version). This needs explicit implementation during Phase 2.
- **Motion in showcase:** Stack research recommends Motion for the showcase player. Pitfalls research warns against animation library dependencies in the showcase bundle. The resolution is to use Motion with LazyMotion for the showcase (4.6KB initial, loaded on demand), but evaluate whether CSS-only transitions suffice for the player's simpler needs. Decide during Phase 5.
- **Tauri fullscreen API specifics:** The Rust-side `window.set_fullscreen(true)` behavior on Windows 11 with WebView2 needs hands-on testing. Does it handle multi-monitor correctly? Does it cover the taskbar? Testing required at the start of Phase 4.
- **Particle system performance:** Custom Canvas 2D particles at 60fps with 50-200 particles per preset should be fine, but performance on lower-end Windows machines running WebView2 is unverified. Profile during Phase 3 implementation.

## Sources

### Primary (HIGH confidence)
- [Motion official site](https://motion.dev) -- v12.37+, React 19 compatible, LazyMotion bundle optimization
- [Motion path tutorial](https://motion.dev/tutorials/react-motion-path) -- offset-path + offsetDistance animation
- [@dnd-kit npm](https://www.npmjs.com/package/@dnd-kit/core) -- v6.3.1, stable, 2400+ dependents
- [@dnd-kit sortable docs](https://docs.dndkit.com/presets/sortable) -- SortableContext, useSortable, arrayMove
- [MDN offset-path](https://developer.mozilla.org/en-US/docs/Web/CSS/offset-path) -- browser support table
- [Fullscreen API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API) -- universal browser support
- Codebase analysis: `loreStore.ts`, `exportShowcase.ts`, `LorePanelHost.tsx`, `panelRegistry.ts`, `types/lore.ts`, `zoneStore.ts`, `assetStore.ts`, `lorePersistence.ts`, `useKeyboardShortcuts.ts`

### Secondary (MEDIUM confidence)
- [Ren'Py - Visual Novel Engine](https://www.renpy.org/) -- scene composition model (background + sprites + dialogue)
- [Reveal.js](https://revealjs.com/) -- presentation mode patterns (keyboard navigation, speaker notes, fullscreen)
- [Plottr](https://plottr.com/features/) -- scene card timeline and drag-and-drop patterns
- [WebView2 Escape key fullscreen issue](https://github.com/MicrosoftEdge/WebView2Feedback/discussions/3985) -- Escape exits fullscreen at engine level
- [Web Animation Performance Tier List](https://motion.dev/magazine/web-animation-performance-tier-list) -- CSS transform/opacity are GPU-composited
- [Undo/Redo in Complex Web Apps](https://engineering.contentsquare.com/2023/history-undo-redo/) -- snapshot vs command undo patterns
- [Motion vs React Spring comparison (2025)](https://hookedonui.com/animating-react-uis-in-2025-framer-motion-12-vs-react-spring-10/)

### Tertiary (LOW confidence)
- MUD-specific cinematic storytelling tooling is nonexistent. Patterns are inferred from visual novel engines, DM presentation tools (Owlbear Rodeo, MasterScreen), and web cinematic experiences. The specific combination is novel.
- Custom Canvas 2D particle system performance characteristics are estimated, not benchmarked. Needs validation during implementation.

---
*Research completed: 2026-04-05*
*Ready for roadmap: yes*
