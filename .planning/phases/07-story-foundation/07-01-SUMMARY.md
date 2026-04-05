---
phase: 07-story-foundation
plan: 01
subsystem: data-model
tags: [zustand, undo-redo, json-persistence, story, scene, typescript, vitest]

# Dependency graph
requires: []
provides:
  - "Story and Scene type definitions (types/story.ts)"
  - "storyStore Zustand store with CRUD + manual undo/redo (50-entry cap)"
  - "storyPersistence JSON file I/O (load, save, delete, list)"
  - "'story' as ArticleTemplate variant with template schema, dot color, CSS token"
affects: [07-02-story-ui, 08-scene-editor, 09-entity-picker, 10-cinematic-renderer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Manual undo/redo via structuredClone snapshots (mirrors loreStore pattern)"
    - "Story JSON persistence in project-relative stories/ directory"
    - "StoryId path-traversal validation (/^[a-z0-9_]+$/)"

key-files:
  created:
    - "creator/src/types/story.ts"
    - "creator/src/stores/storyStore.ts"
    - "creator/src/lib/storyPersistence.ts"
    - "creator/src/stores/__tests__/storyStore.test.ts"
    - "creator/src/lib/__tests__/storyPersistence.test.ts"
  modified:
    - "creator/src/types/lore.ts"
    - "creator/src/lib/loreTemplates.ts"
    - "creator/src/index.css"
    - "creator/src/components/lore/ArticleTree.tsx"
    - "creator/src/lib/loreArtPrompts.ts"
    - "creator/src/components/lore/RelationGraphNode.tsx"

key-decisions:
  - "Used structuredClone for undo snapshots (matches loreStore convention)"
  - "Story JSON files stored in project-relative stories/ dir (not inline in lore.yaml)"
  - "StoryId validated against /^[a-z0-9_]+$/ to prevent path traversal (T-07-02)"

patterns-established:
  - "storyStore manual undo/redo: snapshotStory() clones stories Record, caps at MAX_STORY_HISTORY=50"
  - "Story persistence: JSON files at {mudDir}/stories/{storyId}.json (standalone) or {mudDir}/src/main/resources/stories/{storyId}.json (legacy)"

requirements-completed: [STORY-01, STORY-05, STORY-06]

# Metrics
duration: 8min
completed: 2026-04-05
---

# Phase 7 Plan 01: Story Foundation Summary

**Story/Scene types, storyStore with manual undo/redo (50-entry cap), JSON persistence layer, and "story" as new ArticleTemplate variant across all exhaustive Record maps**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-05T22:13:44Z
- **Completed:** 2026-04-05T22:21:54Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Story and Scene type definitions with all required fields (SceneEntity, TransitionConfig, EffectConfig placeholders for future phases)
- storyStore Zustand store with full CRUD, manual undo/redo capped at 50 entries using structuredClone
- storyPersistence with JSON file I/O, path-traversal validation, and malformed-JSON resilience
- "story" integrated as ArticleTemplate variant across 6 exhaustive Record<ArticleTemplate, ...> maps
- 21 new unit tests (all pass alongside 740 existing tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Define Story types and extend lore type system** - `14a6462` (feat)
2. **Task 2: Create storyStore with undo/redo and storyPersistence with tests** - `5ad1f5f` (feat)

## Files Created/Modified
- `creator/src/types/story.ts` - Story, Scene, SceneTemplate, SceneEntity, TransitionConfig, EffectConfig type definitions
- `creator/src/stores/storyStore.ts` - Zustand store with CRUD, manual undo/redo, dirty tracking
- `creator/src/lib/storyPersistence.ts` - JSON file I/O for story persistence (load, save, delete, list, saveAllDirty)
- `creator/src/stores/__tests__/storyStore.test.ts` - 12 unit tests for store CRUD and undo/redo
- `creator/src/lib/__tests__/storyPersistence.test.ts` - 9 unit tests for path resolution, JSON round-trip, ID validation
- `creator/src/types/lore.ts` - Added `| "story"` to ArticleTemplate union
- `creator/src/lib/loreTemplates.ts` - Added story entry to TEMPLATE_SCHEMAS
- `creator/src/index.css` - Added `--color-template-story: #c98fb8` CSS variable
- `creator/src/components/lore/ArticleTree.tsx` - Added story entry to TEMPLATE_DOT_COLORS
- `creator/src/lib/loreArtPrompts.ts` - Added story entries to TEMPLATE_ASSET_TYPE and FORMAT
- `creator/src/components/lore/RelationGraphNode.tsx` - Added story entries to TEMPLATE_COLORS and TEMPLATE_LABELS

## Decisions Made
- Used structuredClone for undo snapshots (matches existing loreStore convention, ensures deep immutable copies)
- Story JSON stored in project-relative stories/ directory, not inline in lore.yaml (per v1.1 architectural decision in STATE.md)
- StoryId validated against `/^[a-z0-9_]+$/` before constructing file paths (T-07-02 mitigation)
- JSON.parse wrapped in try/catch returning null for malformed files (T-07-01 mitigation)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added story entries to loreArtPrompts.ts and RelationGraphNode.tsx**
- **Found during:** Task 1 (type system extension)
- **Issue:** Plan only specified updating TEMPLATE_SCHEMAS, TEMPLATE_DOT_COLORS, and index.css. However, `loreArtPrompts.ts` has two `Record<ArticleTemplate, ...>` maps (TEMPLATE_ASSET_TYPE, FORMAT) and `RelationGraphNode.tsx` has two more (TEMPLATE_COLORS, TEMPLATE_LABELS). TypeScript would fail without these entries.
- **Fix:** Added story entries to all four additional exhaustive Record maps
- **Files modified:** creator/src/lib/loreArtPrompts.ts, creator/src/components/lore/RelationGraphNode.tsx
- **Verification:** `bunx tsc --noEmit` shows zero errors in modified files
- **Committed in:** 14a6462 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was necessary for TypeScript compilation. No scope creep.

## Issues Encountered
- `bun install` failed for esbuild on Windows (ENOENT lifecycle script error). Resolved by running `npm install` instead. Pre-existing environment issue, not related to plan changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Story data model and store are ready for Plan 02 (UI components + lore integration)
- storyStore exports useStoryStore for component integration
- storyPersistence exports all file I/O functions needed for project-open story loading
- ArticleTemplate "story" variant is fully integrated -- Plan 02 can wire ArticleTree, NewStoryDialog, and StoryEditorPanel

---
*Phase: 07-story-foundation*
*Completed: 2026-04-05*

## Self-Check: PASSED

All 5 created files verified on disk. Both task commits (14a6462, 5ad1f5f) verified in git log.
