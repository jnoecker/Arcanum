---
phase: 12-showcase-player
plan: 01
subsystem: showcase
tags: [motion, animation, cinematic, story, export, react]

# Dependency graph
requires:
  - phase: 10-cinematic-renderer
    provides: CinematicRenderer components and animation logic in creator
  - phase: 07-story-foundation
    provides: Story and Scene type definitions, story persistence
provides:
  - Motion library installed in showcase
  - CinematicRenderer, CinematicScene, AnimatedEntity, TypewriterNarration components in showcase
  - ShowcaseStory and ShowcaseScene types in showcase
  - Scene layout, movement presets, narration speed, and motion features libs in showcase
  - exportStories function in creator export pipeline
  - StoryExportContext interface for story data resolution
affects: [12-showcase-player]

# Tech tracking
tech-stack:
  added: [motion@12.38.0 in showcase]
  patterns: [showcase-independent component copies, pre-resolved scene data]

key-files:
  created:
    - showcase/src/components/player/CinematicRenderer.tsx
    - showcase/src/components/player/CinematicScene.tsx
    - showcase/src/components/player/AnimatedEntity.tsx
    - showcase/src/components/player/TypewriterNarration.tsx
    - showcase/src/types/story.ts
    - showcase/src/lib/narrationSpeed.ts
    - showcase/src/lib/motionFeatures.ts
    - showcase/src/lib/movementPresets.ts
    - showcase/src/lib/sceneLayout.ts
  modified:
    - showcase/src/types/showcase.ts
    - showcase/src/lib/buildGraph.ts
    - showcase/src/lib/templates.ts
    - showcase/package.json
    - creator/src/lib/exportShowcase.ts

key-decisions:
  - "Ported creator scene layout with exact position values (y:72/48) for visual parity"
  - "CinematicRenderer accepts ShowcaseScene directly -- no resolvedSceneData prop needed since showcase data is pre-resolved"
  - "Added story to ArticleTemplate union and updated all Record<ArticleTemplate> maps for type safety"
  - "exportStories uses callback-based resolution (StoryExportContext) for decoupled entity/room data lookup"

patterns-established:
  - "Showcase components are independent copies of creator components with showcase-local imports"
  - "ShowcaseScene contains pre-resolved entity names and image URLs for zero-dependency rendering"
  - "font-sans replaces font-body in showcase, bg-bg-tertiary replaces bg-bg-elevated"

requirements-completed: [SHOW-01]

# Metrics
duration: 15min
completed: 2026-04-06
---

# Phase 12 Plan 01: Showcase Player Foundation Summary

**Motion library installed in showcase with 4 ported cinematic renderer components, story types, supporting libs, and creator export pipeline for story data**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-06T05:44:50Z
- **Completed:** 2026-04-06T05:59:50Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Installed Motion v12.38 in showcase and created async LazyMotion feature loader
- Ported all 4 cinematic renderer components (CinematicRenderer, CinematicScene, AnimatedEntity, TypewriterNarration) as independent copies with showcase-local imports
- Created showcase story types (ShowcaseStory, ShowcaseScene) and scene data types (SceneEntity, EntitySlot, TransitionConfig, NarrationSpeed)
- Created scene layout utilities (resolveEntityPosition, isBackRow, getEntityScale, extractWords) and movement presets matching creator source
- Extended creator export pipeline with exportStories function and StoryExportContext interface
- Added stories field to ShowcaseData in both creator and showcase types

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Motion, create showcase story types, and extend export pipeline** - `c7562a5` (feat)
2. **Task 2: Port CinematicRenderer and supporting components to showcase** - `5fbe946` (feat)

## Files Created/Modified
- `showcase/package.json` - Added motion@^12.38.0 dependency
- `showcase/src/types/story.ts` - Standalone scene entity types for showcase renderer
- `showcase/src/types/showcase.ts` - Added ShowcaseScene, ShowcaseStory interfaces and stories field to ShowcaseData
- `showcase/src/lib/narrationSpeed.ts` - Narration timing constants (word duration/gap per speed)
- `showcase/src/lib/motionFeatures.ts` - Async LazyMotion feature loader
- `showcase/src/lib/movementPresets.ts` - Entrance/exit animation presets with SVG motion paths
- `showcase/src/lib/sceneLayout.ts` - Entity slot positions, scale, position resolution, TipTap text extraction
- `showcase/src/lib/buildGraph.ts` - Added story entry to TEMPLATE_NODE_COLORS and TEMPLATE_SHORT
- `showcase/src/lib/templates.ts` - Added story entry to TEMPLATE_LABELS and TEMPLATE_COLORS
- `showcase/src/components/player/CinematicRenderer.tsx` - Top-level renderer with LazyMotion, AnimatePresence, ShowcaseScene integration
- `showcase/src/components/player/CinematicScene.tsx` - Scene animation with entity layers, room background, narration overlay
- `showcase/src/components/player/AnimatedEntity.tsx` - Entity entrance/exit animations with motion paths and placeholder icons
- `showcase/src/components/player/TypewriterNarration.tsx` - Word-by-word typewriter narration reveal
- `creator/src/lib/exportShowcase.ts` - Added ShowcaseStory/ShowcaseScene types, exportStories function, StoryExportContext

## Decisions Made
- Ported scene layout with exact y-position values (72 for front row, 48 for back row) from creator source for visual parity
- CinematicRenderer in showcase accepts ShowcaseScene directly and maps entities inline, avoiding the resolvedSceneData indirection the creator uses
- Used callback-based StoryExportContext pattern for entity/room resolution to decouple story export from zone data access patterns
- Added "story" to ArticleTemplate union (Rule 3 deviation) which required updating 4 exhaustive Record maps

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added "story" to exhaustive Record<ArticleTemplate> maps**
- **Found during:** Task 1 (extending showcase types)
- **Issue:** Adding "story" to ArticleTemplate union caused TypeScript errors in buildGraph.ts and templates.ts which have exhaustive Record<ArticleTemplate, string> maps
- **Fix:** Added story entries to TEMPLATE_NODE_COLORS, TEMPLATE_SHORT, TEMPLATE_LABELS, and TEMPLATE_COLORS
- **Files modified:** showcase/src/lib/buildGraph.ts, showcase/src/lib/templates.ts
- **Verification:** npx tsc --noEmit passes with zero errors
- **Committed in:** c7562a5 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for type safety. No scope creep.

## Issues Encountered
- Worktree was based on wrong commit (main instead of feature branch HEAD). Fixed with git reset --soft and git checkout to restore correct file state from base commit 9692e6b.
- Creator TypeScript check shows pre-existing errors from phases 7-11 files that import motion/react and @dnd-kit (not yet in creator package.json). These are not caused by this plan's changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 renderer components available for Plan 02 (Stories nav/routes, StoriesPage, StoryPlayerPage)
- ShowcaseStory/ShowcaseScene types ready for data consumption
- exportStories function ready for wiring in the Toolbar publish flow
- Motion library installed and LazyMotion pattern established

---
*Phase: 12-showcase-player*
*Completed: 2026-04-06*

## Self-Check: PASSED

All 10 created files verified present. Both commit hashes (c7562a5, 5fbe946) verified in git log.
