---
phase: 08-story-editor
plan: 02
subsystem: story-editor-ui
tags: [react, components, dnd-kit, tiptap, scene-editor, timeline, context-menu]
dependency_graph:
  requires: [08-01]
  provides: [scene-timeline-ui, scene-detail-editor, story-editor-panel-v2]
  affects: [09, 10, 11]
tech_stack:
  added: []
  patterns: [horizontal-sortable-timeline, portal-context-menu, collapsible-sections, template-picker-segmented-buttons]
key_files:
  created:
    - creator/src/components/lore/SceneTimeline.tsx
    - creator/src/components/lore/SceneCard.tsx
    - creator/src/components/lore/SceneContextMenu.tsx
    - creator/src/components/lore/TemplateBadge.tsx
    - creator/src/components/lore/SceneDetailEditor.tsx
    - creator/src/components/lore/DmNotesSection.tsx
    - creator/src/components/lore/TemplatePicker.tsx
  modified:
    - creator/src/components/lore/StoryEditorPanel.tsx
key_decisions:
  - "SceneCard uses button element for keyboard accessibility with useSortable for drag"
  - "SceneContextMenu renders via createPortal to document.body to avoid overflow clipping"
  - "DmNotesSection auto-expands when value is non-empty on scene switch"
  - "StoryEditorPanel cover image moved into collapsible Story Settings section"
  - "SceneDetailEditor uses key={scene.id} to force LoreEditor remount on scene switch"
patterns_established:
  - "Portal context menu: render menus via createPortal at fixed position with outside-click dismiss"
  - "Collapsible section with max-height transition and ease-unfurl timing"
  - "Segmented button template picker using data-active attribute for CSS styling"
requirements_completed: [STORY-02, STORY-03, STORY-04, STORY-07]
duration: 8m 26s
completed: "2026-04-06T00:13:00Z"
tasks: 3/3
---

# Phase 8 Plan 2: Story Editor UI Components Summary

Complete story editor UI with horizontal draggable scene timeline (dnd-kit), scene detail editor (title, narration via LoreEditor, DM notes, template picker), portal context menu (duplicate/delete/template actions with confirmation dialogs), and rewritten StoryEditorPanel with collapsible settings and auto-scene-selection.

## Performance

- **Duration:** 8m 26s
- **Started:** 2026-04-06T00:04:25Z
- **Completed:** 2026-04-06T00:13:00Z
- **Tasks:** 3/3 (2 auto + 1 human-verify auto-approved)
- **Files created:** 7
- **Files modified:** 1

## Task Completion

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create SceneTimeline, SceneCard, SceneContextMenu, TemplateBadge | 8599589 | SceneTimeline.tsx, SceneCard.tsx, SceneContextMenu.tsx, TemplateBadge.tsx |
| 2 | Create SceneDetailEditor, DmNotesSection, TemplatePicker, rewrite StoryEditorPanel | ba20cea | SceneDetailEditor.tsx, DmNotesSection.tsx, TemplatePicker.tsx, StoryEditorPanel.tsx |
| 3 | Verify complete story editor workflow (auto-approved) | -- | -- |

## What Was Built

### Task 1: Timeline Strip and Scene Cards

**SceneTimeline.tsx** -- Horizontal draggable timeline strip wrapping DndContext + SortableContext with `horizontalListSortingStrategy`. Features:
- PointerSensor with 5px distance constraint (prevents click conflicts with drag)
- KeyboardSensor for accessibility
- DragOverlay with visual clone of active card
- Scroll fade gradient indicators (left/right) with ResizeObserver tracking
- "Add Scene" button at end of row with auto-scroll to new scene
- Zero-scenes empty state with centered CTA
- Context menu state management with ConfirmDialog for delete and template replacement

**SceneCard.tsx** -- Draggable card (140x88px) using `useSortable` hook with:
- CSS.Transform.toString for smooth drag transforms
- Index number, truncated title, template badge
- Selected state: accent border + elevated background + glow shadow
- Dragging state: reduced opacity
- `aria-selected` for accessibility

**SceneContextMenu.tsx** -- Portal-rendered context menu (createPortal to document.body) with:
- Duplicate Scene, Apply Template (submenu with 3 templates + Clear), Delete Scene
- Outside click and Escape key dismiss
- Template submenu on hover with colored dots
- Inline SVG icons (copy, sparkle, trash)
- `animate-unfurl-in` entrance animation

**TemplateBadge.tsx** -- Colored pill badge showing template label with hex-to-rgba background at 18% opacity.

### Task 2: Detail Editor and StoryEditorPanel Rewrite

**SceneDetailEditor.tsx** -- Scene editing panel with:
- EditableField for scene title with key={scene.id} for LoreEditor remount
- TemplatePicker with segmented buttons
- LoreEditor for rich narration editing with AI generation prompts
- DmNotesSection for private DM notes
- ConfirmDialog for template replacement on non-empty scenes (D-13)

**DmNotesSection.tsx** -- Collapsible warm-tinted section with:
- Amber border/background styling (amber-900/30, amber-950/20)
- "DM Only" badge with eye icon
- Auto-expand when value present on scene switch
- Max-height transition animation with ease-unfurl timing
- Plain textarea for DM notes

**TemplatePicker.tsx** -- Button group with segmented-button CSS class, colored dots per template, data-active attribute, aria-pressed, and "Clear Template" option.

**StoryEditorPanel.tsx (rewritten)** -- Top-bottom split layout:
- Section 0: Header bar (unchanged from Phase 7)
- Section 1: Collapsible "Story Settings" with cover image (collapsed by default)
- Section 2: SceneTimeline with sorted scenes
- Section 3: SceneDetailEditor (when active scene exists)
- Section 4: Metadata footer (unchanged)
- Auto-select first scene on story load via useEffect

## Verification

- TypeScript: 0 errors in all 8 new/modified files (106 pre-existing errors in unrelated files)
- Vitest: 815 tests passing across 25 test files (verified in main repo)

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all components are fully implemented with complete data flow to storyStore.

## Self-Check: PASSED
