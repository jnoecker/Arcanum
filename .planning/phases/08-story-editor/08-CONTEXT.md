# Phase 8: Story Editor - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Builders can author multi-scene stories with narration, notes, and templates using a timeline editor. This phase delivers the timeline UI with draggable scene cards, scene detail editing (narration + DM notes), scene template application, and the storyStore scene-level operations. Entity picking, room backgrounds, cinematic effects, and presentation mode are separate phases (9-12).

</domain>

<decisions>
## Implementation Decisions

### Editor Layout
- **D-01:** Top-bottom split layout — horizontal timeline strip across the top, selected scene's detail editor below. Replaces the current "No scenes yet" placeholder in `StoryEditorPanel.tsx`.
- **D-02:** Timeline strip scrolls horizontally with overflow when many scenes exist. Single row, fixed height. Arrow indicators or scroll affordance at edges.
- **D-03:** Auto-select first scene — a scene is always selected when the story has scenes. Opening a story selects scene 1 automatically. Adding the first scene also selects it. Detail area never shows an empty state (unless zero scenes).
- **D-04:** Cover image section placement is Claude's discretion — may move to a collapsible metadata/settings section or stay above the timeline, whichever produces the best vertical space usage.

### Scene Card Design
- **D-05:** Each scene card shows: scene index number, editable title, and a small colored badge for the template type (if set). No room thumbnails in Phase 8 — those come in Phase 9 with scene composition.
- **D-06:** Selected card gets an aurum-gold border (`border-accent`) and elevated background (`bg-elevated`). Matches existing Arcanum selected-state patterns.
- **D-07:** Scene deletion, duplication, and template application available via right-click context menu on cards. No visible delete button on the card itself — keeps cards clean for dragging.

### Narration & DM Notes
- **D-08:** Scene narration reuses the existing `LoreEditor` component (full TipTap 3 with bold, italic, headings, @mentions, links, AI enhance/generate). Provides a consistent rich text experience across lore and stories.
- **D-09:** DM notes appear in a collapsible section below narration with a warm-tinted background (amber/parchment tone). Eye icon or "DM Only" badge. Collapsed by default if empty, expanded if has content.
- **D-10:** DM notes use a plain textarea — no rich text needed. These are private jottings for DM prep, not displayed in presentation.

### Template Behavior
- **D-11:** Three templates (Establishing Shot, Encounter, Discovery) pre-populate a default scene title and starter narration text. Builder can edit both freely after applying.
- **D-12:** Template picker available in the scene detail editor (dropdown or button group). Can also be applied via right-click context menu on the scene card. Template can be changed or cleared anytime.
- **D-13:** Applying a template to a scene that already has content shows a confirmation prompt ("Replace existing content with template defaults?"). Empty scenes apply silently. User can undo regardless.

### Claude's Discretion
- Cover image section placement (above timeline or in collapsible settings)
- Exact card dimensions and spacing in the timeline strip
- "Add scene" button design (inline at end of timeline strip or separate button)
- Scene detail editor section ordering (narration → DM notes → template picker, or other)
- dnd-kit installation and sortable configuration details
- Scene ID generation scheme for new scenes
- Scroll indicator/arrow design for timeline overflow
- Starter narration text content for each template

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Story data model & store (Phase 7 outputs)
- `creator/src/types/story.ts` — Scene, Story, SceneTemplate, SceneEntity types — all fields already defined
- `creator/src/stores/storyStore.ts` — Story-level CRUD + undo/redo — needs scene-level operations (addScene, removeScene, reorderScenes, updateScene)
- `creator/src/lib/storyPersistence.ts` — Story JSON load/save — no changes needed for Phase 8

### Components to modify
- `creator/src/components/lore/StoryEditorPanel.tsx` — Current minimal editor with "No scenes yet" placeholder — primary target for Phase 8 rewrite
- `creator/src/components/lore/LoreEditor.tsx` — TipTap 3 rich text editor — reuse for scene narration

### Design system
- `ARCANUM_STYLE_GUIDE.md` — Colors, typography, component patterns
- `.planning/phases/07-story-foundation/07-UI-SPEC.md` — Phase 7 UI contract with spacing scale, typography, existing component catalog

### Requirements
- `.planning/REQUIREMENTS.md` — STORY-02 (add/remove/reorder scenes), STORY-03 (narration), STORY-04 (DM notes), STORY-07 (scene templates)

### Prior phase context
- `.planning/phases/07-story-foundation/07-CONTEXT.md` — Foundation decisions: story-lore bridge pattern, undo pattern, persistence format

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `LoreEditor.tsx`: Full TipTap 3 editor with toolbar, @mentions, links, AI enhance/generate — reuse directly for scene narration
- `FormWidgets.tsx`: `ActionButton`, `EditableField`, `Spinner`, `DialogShell` — reuse for scene card interactions and confirmations
- `AssetPickerModal`: Already used in StoryEditorPanel for cover image — available for future scene entity picking
- `storyStore.ts` `snapshotStory()` pattern: Extend with scene-level operations that call snapshot before mutating

### Established Patterns
- Zustand stores with manual undo (`snapshotStory` before each mutation) — scene operations follow same pattern
- TipTap content stored as JSON strings in data model — `narration` field is already typed as `string` (TipTap JSON)
- Panel host routing via `LorePanelHost.tsx` — StoryEditorPanel already registered and routed
- Auto-save with 3-second debounce + flush-on-unmount — already in StoryEditorPanel, will handle scene changes automatically

### Integration Points
- `storyStore.ts` — Add `addScene`, `removeScene`, `reorderScenes`, `updateScene`, `setActiveScene` operations
- `StoryEditorPanel.tsx` — Replace placeholder with timeline + scene detail editor
- `package.json` — Install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` for drag-and-drop
- Right-click context menu — new component or pattern (no existing context menu in the app)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches that follow the established patterns captured in decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-story-editor*
*Context gathered: 2026-04-05*
