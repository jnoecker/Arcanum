---
phase: 09-scene-composition
plan: 01
subsystem: scene-layout
tags: [types, utility, tdd, scene-composition]
dependency_graph:
  requires: [story.ts types from Phase 7]
  provides: [EntitySlot type, sceneLayout utilities for Plans 02 and 03]
  affects: [creator/src/types/story.ts, creator/src/lib/sceneLayout.ts]
tech_stack:
  added: []
  patterns: [TDD red-green, pure utility functions, TipTap JSON walker]
key_files:
  created:
    - creator/src/lib/sceneLayout.ts
    - creator/src/lib/__tests__/sceneLayout.test.ts
  modified:
    - creator/src/types/story.ts
decisions:
  - EntitySlot is a union type with 6 string literals (front/back x left/center/right)
  - Back-row scale factor set to 0.78 for depth perception
  - extractPlainText uses recursive walk (not regex) for TipTap JSON
  - Position coordinates use 0-100 percentage range
metrics:
  duration: 9m 26s
  completed: 2026-04-06T01:37:43Z
  tasks: 1
  files: 3
---

# Phase 9 Plan 01: Scene Layout Data Layer Summary

TDD-driven EntitySlot type extension and sceneLayout utility module with 6 preset slot positions, auto-distribution algorithm, position resolution with custom/slot/fallback precedence, back-row depth scaling (0.78x), coordinate clamping, and TipTap JSON plain text extraction.

## What Was Built

### Type Extensions (story.ts)

- Added `EntitySlot` union type with 6 preset positions: `front-left`, `front-center`, `front-right`, `back-left`, `back-center`, `back-right`
- Added optional `slot?: EntitySlot` field to `SceneEntity` interface
- Updated JSDoc from placeholder comment to describe slot/coordinate positioning

### Scene Layout Utility (sceneLayout.ts)

Exports 2 constants and 6 pure functions:

| Export | Purpose |
|--------|---------|
| `PRESET_SLOTS` | Record mapping each EntitySlot to `{x, y}` percentage coordinates |
| `SLOT_ORDER` | Priority array: front-center first, then flanks, then back row |
| `getNextSlot()` | Auto-distributes entities to next available slot |
| `resolveEntityPosition()` | Position resolution: custom > slot > front-center fallback |
| `isBackRow()` | Returns true for back-* slots |
| `getEntityScale()` | Returns 0.78 for back-row, 1.0 for front-row entities |
| `clampPosition()` | Bounds coordinates to 0-100 range |
| `extractPlainText()` | Recursively walks TipTap JSON to extract plain narration text |

### Test Coverage (sceneLayout.test.ts)

20 tests across 6 describe blocks:
- `getNextSlot` -- 5 tests (slot priority order, full-fallback)
- `resolveEntityPosition` -- 3 tests (custom override, slot lookup, fallback)
- `isBackRow / getEntityScale` -- 6 tests (row detection, scale factors, edge cases)
- `clampPosition` -- 2 tests (boundary clamping, pass-through)
- `extractPlainText` -- 4 tests (empty input, multi-paragraph, invalid JSON, nested marks)

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| `d7545df` | test | Add failing tests for sceneLayout utility (RED phase) |
| `5fd52cc` | feat | Implement sceneLayout utility with all functions (GREEN phase) |

## Verification Results

- All 20 sceneLayout tests pass
- Full suite: 835 tests pass across 26 files (zero regressions)
- TypeScript: no type errors (`tsc --noEmit` clean)
- All 6 acceptance criteria met (EntitySlot count, slot field, export count, describe count)

## Deviations from Plan

None -- plan executed exactly as written.

## Self-Check: PASSED
