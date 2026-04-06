# Phase 12: Showcase Player - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Stories are playable on the public showcase website with multiple navigation modes. Visitors can browse a stories listing, open a story player, and navigate scenes via click-through, auto-play, or scroll-driven advancement. Stories export to the showcase via the existing "Publish Lore" flow. The CinematicRenderer (Phase 10) provides all animation logic — this phase ports it to the showcase and wraps it with a player UI and navigation controls.

</domain>

<decisions>
## Implementation Decisions

### Animation Strategy
- **D-01:** Add Motion v12.37 to the showcase as a new dependency. Port CinematicRenderer and supporting components directly for exact visual parity with the creator's editor preview and presentation mode.
- **D-02:** Copy CinematicRenderer, CinematicScene, AnimatedEntity, and TypewriterNarration into `showcase/src/components/player/` as independent copies. No shared package or monorepo tooling — showcase evolves independently from creator.

### Story Discovery & Routing
- **D-03:** Add "Stories" as a new nav item in the showcase Layout, between Codex and Maps. New routes: `/stories` (listing) and `/stories/:id` (player).
- **D-04:** Stories listing page (StoriesPage) shows a grid of story cards with cover images, titles, scene counts, and zone names. Visual style consistent with the featured articles grid on HomePage.
- **D-05:** Story articles in the Codex (template="story") get a "Play Story" button that navigates to `/stories/:storyId`.
- **D-06:** Extend ShowcaseData with a `stories[]` array in `showcase.json`. Each story includes resolved scene data (room image URLs, entity image URLs, narration HTML, transitions). Export happens via the existing "Publish Lore" flow in the creator Toolbar.

### Player Chrome & Controls
- **D-07:** Player page lives within the showcase Layout (nav header visible). Player area is a 16:9 aspect ratio container centered on the page with story title above and control bar below.
- **D-08:** Persistent bottom control bar with: prev/next buttons, scene counter ("3 / 8"), play/pause toggle, mode switcher (Click-through | Auto-play | Scroll), and auto-play timing dropdown.
- **D-09:** Click-through is the default mode. Click and keyboard navigation work in all modes (arrows, space, enter to advance; left arrow to go back).
- **D-10:** Auto-play timing uses fixed presets: 5s, 10s (default), 15s. Dropdown selector in control bar. Timer resets when user manually navigates.

### Scroll-Driven Mode
- **D-11:** Mode switcher in control bar toggles between Click-through, Auto-play, and Scroll modes. In scroll mode, the player area expands to show all scenes vertically with CSS `scroll-snap-type: y mandatory`. Control bar hides in scroll mode.
- **D-12:** When a scene snaps into view during scroll, entrance animations play (entity paths, typewriter narration) triggered by IntersectionObserver. Scrolling back to a previous scene shows its final state (no re-animation) — consistent with Phase 11 D-12.
- **D-13:** Scroll mode works on mobile with native touch/swipe. Swipe up snaps to next scene, swipe down to previous. CSS scroll-snap handles this natively with no custom gesture code.

### Claude's Discretion
- Exact story card dimensions and hover effects on StoriesPage
- How to adapt the copied CinematicRenderer for showcase context (remove any creator-specific imports, adapt image URL resolution)
- Control bar icon choices and styling
- Mode switcher UI pattern (tabs, toggle group, or dropdown)
- How "Play Story" button appears on story article pages in Codex
- Scene transition behavior when switching between modes mid-story
- ShowcaseStory TypeScript interface shape (exact field names for resolved scene data)
- Empty state for StoriesPage when no stories are published
- Whether scroll mode uses full-viewport scenes or maintains 16:9 within viewport

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Cinematic renderer (Phase 10 outputs — source for showcase port)
- `creator/src/components/lore/CinematicRenderer.tsx` — Portable renderer with AnimatePresence transitions. Props: scenes[], currentIndex, playing, onComplete, onSceneChange, narrationSpeed, resolvedSceneData.
- `creator/src/components/lore/CinematicScene.tsx` — Individual scene animation (entrance paths, typewriter narration, transition effects)
- `creator/src/components/lore/AnimatedEntity.tsx` — Entity entrance/exit path animation
- `creator/src/components/lore/TypewriterNarration.tsx` — Word-by-word narration reveal
- `creator/src/lib/motionFeatures.ts` — LazyMotion feature loader (needed for Motion setup in showcase)

### Story data model
- `creator/src/types/story.ts` — Story, Scene, SceneEntity, TransitionConfig, NarrationSpeed interfaces
- `creator/src/lib/narrationSpeed.ts` — Narration speed configuration

### Showcase export (integration point)
- `creator/src/lib/exportShowcase.ts` — ShowcaseData types and export logic. Stories[] array to be added here.
- `showcase/src/types/showcase.ts` — Showcase type definitions. ShowcaseStory type to be added.

### Showcase app (integration targets)
- `showcase/src/App.tsx` — Route definitions, lazy loading pattern. New /stories and /stories/:id routes.
- `showcase/src/components/Layout.tsx` — Nav items array. "Stories" to be added.
- `showcase/src/lib/DataContext.tsx` — ShowcaseData provider. Stories data accessible via useShowcase().
- `showcase/src/pages/HomePage.tsx` — Featured articles grid pattern. Reference for StoriesPage card grid.

### Requirements
- `.planning/REQUIREMENTS.md` — SHOW-01 (stories export to showcase), SHOW-02 (click-through + keyboard), SHOW-03 (auto-play with configurable timing), SHOW-04 (scroll-driven with snap)

### Prior phase context
- `.planning/phases/10-cinematic-renderer/10-CONTEXT.md` — Renderer architecture decisions (D-10, D-11), transition types (D-07, D-08)
- `.planning/phases/11-presentation-mode/11-CONTEXT.md` — Presentation controls, DM notes, scene replay behavior (D-12, D-13)
- `.planning/phases/07-story-foundation/07-CONTEXT.md` — Story data model, persistence format, lore-story bridge

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CinematicRenderer.tsx` + supporting components: Direct port target. Uses Motion's AnimatePresence, LazyMotion, useAnimate. No Tauri dependencies.
- `HomePage.tsx` featured articles grid: Pattern for story card layout (responsive grid, image cards, metadata)
- `Layout.tsx` NAV_ITEMS array: Simple addition for "Stories" nav item
- `DataContext.tsx` useShowcase() hook: Stories data will be accessible through the same provider

### Established Patterns
- Lazy-loaded pages: All showcase pages use `lazy(() => import(...).then(m => ({ default: m.Component })))` pattern
- Showcase types mirror creator types: `showcase/src/types/showcase.ts` mirrors `creator/src/lib/exportShowcase.ts`
- Image URLs resolved via `meta.imageBaseUrl` from R2 custom domain
- DOMPurify used for HTML sanitization in article content rendering

### Integration Points
- `exportShowcase.ts`: Add story export logic alongside existing article/map export
- `showcase.json`: Stories array added to ShowcaseData payload
- `App.tsx` Routes: New `/stories` and `/stories/:id` routes
- `Layout.tsx` NAV_ITEMS: "Stories" entry between "Codex" and "Maps"
- `showcase/package.json`: Add `motion` dependency

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-showcase-player*
*Context gathered: 2026-04-06*
