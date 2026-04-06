---
phase: 09-scene-composition
plan: 02
subsystem: scene-preview
tags: [scene-preview, entity-overlay, drag-reposition, narration-overlay, ui-composition]
dependency_graph:
  requires: [09-01]
  provides: [ScenePreview, EntityOverlay]
  affects: [SceneDetailEditor (Plan 03)]
tech_stack:
  added: []
  patterns: [pointer-capture-drag, layered-z-index-composition, local-drag-state]
key_files:
  created:
    - creator/src/components/lore/EntityOverlay.tsx
    - creator/src/components/lore/ScenePreview.tsx
  modified: []
decisions:
  - "Pointer capture drag with local state during drag, commit on pointerup (avoids undo spam per D-08)"
  - "Entity layers separated by z-index: back-row at z-10, front-row at z-20, narration at z-30"
  - "Entity info resolution local to ScenePreview (not extracted to shared util -- single consumer)"
metrics:
  duration: 5m
  completed: "2026-04-06T01:49:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
  test_count: 835
  test_status: all_passing
---

# Phase 09 Plan 02: Scene Preview & Entity Overlay Summary

ScenePreview and EntityOverlay components deliver the visual scene composition renderer -- 16:9 cinematic preview with room background, entity sprites at depth-scaled positions, and narration gradient overlay.

## What Was Built

### EntityOverlay (223 lines)
- Draggable entity sprite using native pointer capture API
- Position resolved from sceneLayout.ts (`resolveEntityPosition` -> slot preset or custom coordinates)
- Back-row entities scale to 0.78x width (56px vs 72px front-row) with 90% opacity
- Selection ring (`ring-2 ring-accent/45`) with 180ms hover transition (`ring-accent/30`)
- Hover X button for entity removal (16px circle, `bg-black/60`)
- Placeholder icons for entities without images: skull (mob), gem (item), user (npc)
- Name label below sprite with `text-shadow` for readability over any background
- Drag uses local `useState` during pointer move, commits to store only on `pointerup`
- Accessible: `role="button"`, `aria-label`, `aria-pressed`, `aria-roledescription="draggable entity"`

### ScenePreview (233 lines)
- 16:9 `aspect-video` container with `bg-black` cinematic void
- Room background auto-populates when `roomId` is set, via `useImageSrc(room?.image)`
- Loading skeleton (pulsing `bg-bg-tertiary/30`) while image loads from IPC
- Entity layers separated into back-row (z-10) and front-row (z-20) using `isBackRow()`
- Entity info resolved from `zoneStore`: mob `.name`/`.image`, item `.displayName`/`.image`
- Narration overlay at z-30: gradient `from-black/60 to-transparent` with `line-clamp-3`
- Empty state: dashed border with "Select a room to set the background" prompt
- Entity selection via click (deselect on background click)
- Delete/Backspace key removes selected entity from scene
- Drag-to-reposition clears entity `slot` and sets custom `position`

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | EntityOverlay component | 1abb227 | `creator/src/components/lore/EntityOverlay.tsx` |
| 2 | ScenePreview component | 59eab9a | `creator/src/components/lore/ScenePreview.tsx` |

## Verification

- TypeScript: 0 new errors (2 pre-existing in storyStore.ts from Plan 01)
- Tests: 835 passing (26 test files)
- All acceptance criteria grep patterns matched for both files
- Both files exceed min_lines requirements (EntityOverlay: 223 >= 60, ScenePreview: 233 >= 80)

## Deviations from Plan

None -- plan executed exactly as written.

## Self-Check: PASSED

- FOUND: creator/src/components/lore/EntityOverlay.tsx
- FOUND: creator/src/components/lore/ScenePreview.tsx
- FOUND: .planning/phases/09-scene-composition/09-02-SUMMARY.md
- FOUND: commit 1abb227
- FOUND: commit 59eab9a
