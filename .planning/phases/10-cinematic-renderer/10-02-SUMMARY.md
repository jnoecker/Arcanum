---
phase: 10-cinematic-renderer
plan: 02
subsystem: ui
tags: [react, zustand, scene-editor, dropdown, segmented-control, animation-presets]

# Dependency graph
requires:
  - phase: 09-scene-composition
    provides: SceneDetailEditor layout, ScenePreview, EntityPicker, story types
  - phase: 10-cinematic-renderer plan 01
    provides: TransitionType, MovementPreset, NarrationSpeed types, movementPresets.ts, narrationSpeed.ts
provides:
  - TransitionDropdown component for crossfade/fade-to-black selection per scene
  - PathPresetPicker component for entity entrance/exit movement preset selection
  - NarrationSpeedSelector segmented control for per-scene narration speed override
  - Updated SceneDetailEditor integrating all three new controls
affects: [10-cinematic-renderer plan 03, 11-presentation-mode, 12-showcase-player]

# Tech tracking
tech-stack:
  added: []
  patterns: [dropdown-with-outside-click-close, segmented-control-with-override-indicator, entity-path-preset-picker]

key-files:
  created:
    - creator/src/components/lore/TransitionDropdown.tsx
    - creator/src/components/lore/PathPresetPicker.tsx
    - creator/src/components/lore/NarrationSpeedSelector.tsx
    - creator/src/lib/movementPresets.ts
    - creator/src/lib/narrationSpeed.ts
  modified:
    - creator/src/components/lore/SceneDetailEditor.tsx
    - creator/src/types/story.ts

key-decisions:
  - "PathPresetPicker uses selectedEntityId pattern rather than rendering all entities inline -- simpler integration, matches plan revised approach"
  - "Created stub movementPresets.ts and narrationSpeed.ts for Plan 01 merge compatibility since both plans run in parallel wave"
  - "Updated story.ts types (TransitionType, entrancePath/exitPath, narrationSpeed) as part of this plan since Plan 01 runs in parallel worktree"

patterns-established:
  - "Dropdown pattern: useRef container + useEffect mousedown outside-click handler, shared across TransitionDropdown and PresetDropdown"
  - "Segmented control pattern: radiogroup role with aria-checked, override indicator dot when value differs from default"
  - "Scene editor section ordering: title, template+transition, preview, narration, speed, dm-notes, movement-paths"

requirements-completed: [SCENE-06, SCENE-07, PRES-03]

# Metrics
duration: 8min
completed: 2026-04-06
---

# Phase 10 Plan 02: Scene Editor Controls Summary

**TransitionDropdown, PathPresetPicker, and NarrationSpeedSelector components with full ARIA support integrated into SceneDetailEditor**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-06T03:10:34Z
- **Completed:** 2026-04-06T03:19:24Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created TransitionDropdown with crossfade/fade-to-black options, ARIA listbox role, outside-click-to-close
- Created PathPresetPicker with entrance (5 presets) and exit (3 presets) dropdowns per selected entity
- Created NarrationSpeedSelector as 3-option segmented control with override indicator dot
- Integrated all three controls into SceneDetailEditor at correct layout positions per UI-SPEC
- Updated story.ts with TransitionType, entrancePath/exitPath on SceneEntity, narrationSpeed on Scene/Story

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TransitionDropdown, PathPresetPicker, and NarrationSpeedSelector** - `64e6524` (feat)
2. **Task 2: Integrate new controls into SceneDetailEditor** - `ba1975d` (feat)

## Files Created/Modified
- `creator/src/components/lore/TransitionDropdown.tsx` - Dropdown for selecting crossfade or fade-to-black per scene
- `creator/src/components/lore/PathPresetPicker.tsx` - Entrance/exit path preset picker for scene entities
- `creator/src/components/lore/NarrationSpeedSelector.tsx` - 3-option segmented control for narration speed
- `creator/src/components/lore/SceneDetailEditor.tsx` - Integrated all three new controls into layout
- `creator/src/types/story.ts` - Added TransitionType, entrancePath/exitPath, narrationSpeed fields
- `creator/src/lib/movementPresets.ts` - Movement preset library (stub for Plan 01 merge)
- `creator/src/lib/narrationSpeed.ts` - Narration speed types and timing (stub for Plan 01 merge)

## Decisions Made
- Created local stubs for movementPresets.ts and narrationSpeed.ts because Plan 01 (which creates these files) runs in a parallel worktree. After merge, Plan 01's versions will take precedence since they include the same content plus tests and additional utilities.
- PathPresetPicker shows controls for the selected entity (via selectedEntityId) rather than all entities at once, keeping the UI clean and focused.
- Updated story.ts types directly since Plan 01 makes the same changes in parallel -- merge will reconcile.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created stub files for Plan 01 dependencies**
- **Found during:** Task 1
- **Issue:** movementPresets.ts and narrationSpeed.ts (created by Plan 01) do not exist in this worktree since Plan 01 runs in a parallel worktree
- **Fix:** Created stub versions matching Plan 01's interface specification so components can import and compile
- **Files modified:** creator/src/lib/movementPresets.ts, creator/src/lib/narrationSpeed.ts
- **Verification:** TypeScript compiles cleanly with only pre-existing storyStore errors
- **Committed in:** 64e6524 (Task 1 commit)

**2. [Rule 3 - Blocking] Updated story.ts types for Plan 02 dependencies**
- **Found during:** Task 1
- **Issue:** story.ts did not have TransitionType export, entrancePath/exitPath on SceneEntity, or narrationSpeed on Scene -- required by the new components
- **Fix:** Updated story.ts to add these types (same changes Plan 01 makes)
- **Files modified:** creator/src/types/story.ts
- **Verification:** All new components compile and type-check correctly
- **Committed in:** 64e6524 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for compilation in parallel worktree environment. No scope creep -- changes are identical to what Plan 01 produces.

## Issues Encountered
- Pre-existing TypeScript errors in storyStore.ts (lines 163 and 237) related to noUncheckedIndexedAccess and spread type narrowing. Confirmed these exist before any Plan 10 changes. Out of scope for this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three scene control components ready for CinematicRenderer (Plan 03) to consume during playback
- TransitionDropdown values drive AnimatePresence mode selection (crossfade vs fade-to-black)
- PathPresetPicker values are stored as preset IDs that CinematicRenderer resolves to SVG paths via getEntrancePreset/getExitPreset
- NarrationSpeedSelector values control TypewriterNarration timing via NARRATION_TIMING lookup

---
*Phase: 10-cinematic-renderer*
*Completed: 2026-04-06*

## Self-Check: PASSED

All 8 files verified present. Both task commits (64e6524, ba1975d) verified in git history.
