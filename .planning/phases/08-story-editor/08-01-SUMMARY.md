---
phase: 08-story-editor
plan: 01
subsystem: story-data-layer
tags: [zustand, store, scenes, templates, dnd-kit, tdd]
dependency_graph:
  requires: [07-01]
  provides: [storyStore-scene-ops, scene-templates, dnd-kit-packages]
  affects: [08-02]
tech_stack:
  added: ["@dnd-kit/core ^6.3.1", "@dnd-kit/sortable ^10.0.0", "@dnd-kit/utilities ^3.2.2"]
  patterns: [scene-crud-with-undo, template-presets, auto-scene-selection]
key_files:
  created:
    - creator/src/lib/sceneTemplates.ts
    - creator/src/lib/__tests__/sceneTemplates.test.ts
  modified:
    - creator/src/stores/storyStore.ts
    - creator/src/stores/__tests__/storyStore.test.ts
    - creator/package.json
    - creator/bun.lock
decisions:
  - "generateSceneId exported as const arrow function for reuse in UI components"
  - "isSceneEmpty uses a Set of default template titles for O(1) lookup"
  - "TipTap narration stored as JSON.stringify'd objects for type safety at definition time"
metrics:
  duration: 9m 22s
  completed: "2026-04-05T23:59:00Z"
  tasks: 2/2
  tests_added: 54
  tests_total: 67
---

# Phase 8 Plan 1: Scene Operations & Template Presets Summary

Extended storyStore with 6 scene-level CRUD operations (add, remove, reorder, update, duplicate, active tracking), created 3 scene template presets with TipTap JSON narration, installed dnd-kit packages, and wrote 54 new tests -- all following TDD red-green workflow.

## Task Completion

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Install dnd-kit and extend storyStore with scene operations | 4f5acd4 | storyStore.ts, storyStore.test.ts, package.json |
| 2 | Create scene template presets with tests | 7ba794c | sceneTemplates.ts, sceneTemplates.test.ts |

## What Was Built

### Task 1: Scene CRUD Operations

Extended `storyStore.ts` with 6 new operations, all following the `snapshotStory` undo pattern:

- **addScene**: Appends scene with auto-sortOrder, auto-selects first scene added
- **removeScene**: Removes by ID, normalizes sortOrder to sequential integers, auto-selects adjacent scene
- **reorderScenes**: Accepts ID array, rebuilds scene order via Map lookup, ignores unknown IDs (T-08-02 mitigation)
- **updateScene**: Merges `Partial<Scene>` patch, updates story `updatedAt`
- **duplicateScene**: Clones with new `generateSceneId()`, inserts after original, auto-selects clone
- **setActiveScene**: Sets/clears `activeSceneId` (separate from `activeStoryId`)

Added `selectActiveScene` selector and exported `generateSceneId` (T-08-01 mitigation: IDs generated internally with `scene_` prefix).

Installed `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` for upcoming scene reorder UI.

### Task 2: Scene Template Presets

Created `sceneTemplates.ts` with:

- **SCENE_TEMPLATE_PRESETS**: Record mapping 3 `SceneTemplate` types to presets with label, badge color, default title, and TipTap JSON narration
- **applyTemplate**: Returns `Partial<Scene>` patch for a given template type
- **isSceneEmpty**: Checks if a scene has no meaningful custom content (for template application confirmation UX per D-13)

Template presets:
| Template | Label | Badge Color | Default Title |
|----------|-------|-------------|---------------|
| establishing_shot | Establishing Shot | #8caec9 (Stellar Blue) | The Scene Opens |
| encounter | Encounter | #c4956a (Warm Amber) | A Confrontation |
| discovery | Discovery | #a3c48e (Green) | What Lies Hidden |

## Test Results

- **storyStore.test.ts**: 49 tests (13 existing + 36 new) -- all passing
- **sceneTemplates.test.ts**: 18 tests -- all passing
- **Total**: 67 tests, 0 failures

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all operations are fully implemented with complete data flow.

## Self-Check: PASSED

All files exist, all commits verified, 67/67 tests passing.
