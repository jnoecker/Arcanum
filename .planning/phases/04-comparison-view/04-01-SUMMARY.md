---
phase: 04-comparison-view
plan: 01
subsystem: tuning-wizard
tags: [delta-utils, tooltip, tdd, pure-functions]
dependency_graph:
  requires: [creator/src/lib/tuning/types.ts]
  provides: [pctDelta, deltaDirection, deltaColor, buildTooltipContent]
  affects: [MetricCard, ParameterRow, comparison-view-components]
tech_stack:
  added: []
  patterns: [pure-utility-functions, html-string-builder, tdd-red-green]
key_files:
  created:
    - creator/src/lib/tuning/deltaUtils.ts
    - creator/src/lib/tuning/__tests__/metricDelta.test.ts
    - creator/src/lib/tuning/__tests__/tooltipContent.test.ts
  modified: []
decisions:
  - "Impact badge colors use raw hex values (#dbb8b8, #bea873, #95a0bf) matching CSS custom properties for inline HTML tooltip styling"
  - "buildTooltipContent uses inline styles (not Tailwind classes) since Tippy tooltips render outside the Tailwind scope"
metrics:
  duration: 6m
  completed: "2026-04-05T05:33:09Z"
  tasks_completed: 2
  tasks_total: 2
  test_count: 22
  files_created: 3
  files_modified: 0
---

# Phase 4 Plan 1: Delta Utilities and Tooltip Content Summary

Pure delta calculation and tooltip HTML builder functions for the comparison view, fully TDD with 22 test cases covering all edge cases including zero-denominator guards and three impact badge levels.

## What Was Built

### deltaUtils.ts -- Pure utility module (no React dependencies)

**Exports:**
- `pctDelta(oldVal, newVal)` -- Formats percentage delta with directional arrows. Handles zero-denominator ("+new"/"-new"), identical values (em-dash), and decimal precision (1 digit).
- `deltaDirection(oldVal, newVal)` -- Returns "up", "down", or "same" classification.
- `deltaColor(direction)` -- Maps delta direction to Tailwind color classes (text-status-success, text-status-error, text-text-muted).
- `buildTooltipContent(meta)` -- Builds HTML string for Tippy tooltips from FieldMeta. Includes description, optional interaction note, and colored impact badge (HIGH/MEDIUM/LOW).
- `DeltaDirection` type -- Exported union type "up" | "down" | "same".

### Test Coverage

- **metricDelta.test.ts**: 15 tests -- pctDelta (8), deltaDirection (4), deltaColor (3)
- **tooltipContent.test.ts**: 7 tests -- description, all 3 impact levels with colors, interaction note present/absent, HTML output validation

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | TDD pctDelta and deltaDirection utilities | 5da5d48 | deltaUtils.ts, metricDelta.test.ts |
| 2 | TDD buildTooltipContent utility | 332a936 | deltaUtils.ts, tooltipContent.test.ts |

## Verification Results

- `vitest run src/lib/tuning/__tests__/metricDelta.test.ts` -- 15/15 passed
- `vitest run src/lib/tuning/__tests__/tooltipContent.test.ts` -- 7/7 passed
- `vitest run` (full suite) -- 707/707 passed, 19 test files
- `tsc --noEmit` -- no errors in new files (pre-existing type definition warnings from symlinked node_modules only)

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **Inline styles for tooltip HTML**: `buildTooltipContent` uses inline CSS styles rather than Tailwind classes because Tippy tooltips render in a portal outside the Tailwind-processed DOM tree. The hex color values (#dbb8b8, #bea873, #95a0bf) match the CSS custom property values from index.css.

2. **FieldMeta import is type-only**: The `import type { FieldMeta }` ensures no runtime dependency on the types module, keeping the utility pure and tree-shakeable.

## Self-Check: PASSED

- All 3 created files verified on disk
- Both commit hashes (5da5d48, 332a936) verified in git log
