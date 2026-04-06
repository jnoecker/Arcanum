# Phase 9: Scene Composition - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Builders can compose visual scenes from zone data with room backgrounds, entity spotlights, and live preview. This phase delivers the entity picker sidebar, scene preview renderer (16:9 cinematic), entity positioning with preset slots and drag override, and room background integration. Cinematic effects (crossfade, movement paths, typewriter narration) are Phase 10. Presentation mode is Phase 11.

</domain>

<decisions>
## Implementation Decisions

### Entity Picker UX
- **D-01:** Collapsible sidebar panel in the scene detail area with three tabs: Rooms, Mobs, Items. Each tab lists entities from the linked zone. Searchable filter input within each tab.
- **D-02:** Each entity row shows a 32px thumbnail (from existing zone art via `useImageSrc`) and the entity name. Entities without images show a placeholder icon with entity type badge.
- **D-03:** Click interaction: clicking a room in the Rooms tab sets it as the scene's `roomId` (background). Clicking a mob/item in the Mobs/Items tabs adds a `SceneEntity` to the scene's entity list. Entities appear in the preview immediately.
- **D-04:** Removing entities from a scene happens via the preview (click-to-select entity, then delete) or an entity list below the preview.

### Scene Preview Layout
- **D-05:** Preview renders inline in the scene detail editor, between the template picker and narration section. Fixed 16:9 aspect ratio container at container width. Always visible while editing, scrolls with the detail area.
- **D-06:** When no room is selected, the preview shows a dark placeholder with dashed border and prompt: "Select a room from the Entity Picker to set the background" with a subtle arrow pointing toward the picker sidebar. Entities can still be added and appear on the dark placeholder.

### Entity Positioning
- **D-07:** Entities are placed in preset positions by default — front row (left, center, right) and back row (back-left, back-center, back-right). When entities are added without explicit position, they auto-distribute across front-row slots first, then back-row.
- **D-08:** Builder can drag an entity to any custom position within the preview. Custom positions stored as `{ x: number, y: number }` in percentage coordinates (0-100). Dragging overrides the preset slot.
- **D-09:** Entity sprites render at a fixed size (64-80px) with entity name label below. Back-row entities render slightly smaller for depth illusion. Entities without images show a placeholder icon with type badge.

### Visual Layering & Aspect Ratio
- **D-10:** Scene preview uses 16:9 cinematic aspect ratio. This matches what fullscreen presentation (Phase 11) and showcase player (Phase 12) will display. Consistent from editor to presentation.
- **D-11:** Room background fills the 16:9 frame using `object-fit: cover`. May crop edges of non-16:9 source images. No empty space.
- **D-12:** Narration text renders as a semi-transparent overlay at the bottom of the preview — dark gradient (transparent to 60% black) with white Crimson Pro text. Shows first 2-3 lines, truncated if longer. Full text remains in the TipTap editor below.
- **D-13:** Layer order (back to front): room background → back-row entities → front-row entities → narration overlay. Entities have `pointer-events` for drag interaction.

### Claude's Discretion
- Entity picker sidebar width and collapse behavior
- Exact preset slot pixel positions within the 16:9 frame
- Entity drag handle affordance (grab cursor, outline on hover)
- How entity removal works (X button on hover, delete key, or both)
- Depth illusion scaling factor for back-row entities
- Preview container height (300-400px range)
- Entity name label typography and positioning
- Search/filter implementation details in the picker tabs

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Story data model (Phase 7 outputs)
- `creator/src/types/story.ts` — SceneEntity interface (id, entityType, entityId, position?, movementPath?), Scene interface with entities? field
- `creator/src/stores/storyStore.ts` — updateScene operation for adding/removing entities and setting roomId

### Scene editor (Phase 8 outputs)
- `creator/src/components/lore/SceneDetailEditor.tsx` — Current scene detail editor that needs preview and entity picker integration
- `creator/src/components/lore/StoryEditorPanel.tsx` — Parent layout with timeline + detail editor split

### Image loading
- `creator/src/lib/useImageSrc.ts` — Hook for loading images via IPC `read_image_data_url`. Handles R2 hash filenames, legacy paths, and absolute paths.

### Zone data (entity source)
- `creator/src/stores/zoneStore.ts` — Zone data with rooms, mobs, items arrays. Each has id, name/zone, and optional image fields.
- `creator/src/components/zone/RoomNode.tsx` — Existing room rendering with background images and entity sprites — reference for visual patterns

### Asset system
- `creator/src/components/ui/AssetPickerModal.tsx` — Existing asset picker pattern (modal-based) for reference
- `creator/src/lib/assetRefs.ts` — Asset reference resolution utilities

### Requirements
- `.planning/REQUIREMENTS.md` — SCENE-01 (entity picker), SCENE-02 (room bg + entity overlays + narration), SCENE-03 (auto-populate room bg), SCENE-04 (live preview), SCENE-05 (entity positioning)

### Prior phase context
- `.planning/phases/07-story-foundation/07-CONTEXT.md` — Foundation decisions, story-lore bridge pattern
- `.planning/phases/08-story-editor/08-CONTEXT.md` — Editor layout decisions (top-bottom split, scene detail structure)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useImageSrc.ts`: Loads images via IPC — reuse for room background and entity thumbnails in both picker and preview
- `zoneStore.ts`: Zone data with rooms/mobs/items — source for entity picker content
- `storyStore.updateScene()`: Already supports partial scene updates — use for roomId, entities array mutations
- `SceneEntity` type: Already defined with position?, entityType, entityId — ready for Phase 9
- `RoomNode.tsx`: Shows room backgrounds + entity sprites in zone map — reference for rendering patterns

### Established Patterns
- `useImageSrc` hook for all image loading (no direct asset protocol) — matches CLAUDE.md pitfall
- Zustand store selectors for individual fields — picker reads from zoneStore, writes to storyStore
- Tailwind CSS for all styling — 16:9 aspect ratio via `aspect-video` class
- Portal pattern from SceneContextMenu (Phase 8) — may be useful for entity drag overlay

### Integration Points
- `SceneDetailEditor.tsx` — Add preview component and entity picker sidebar integration
- `StoryEditorPanel.tsx` — May need layout adjustment to accommodate entity picker sidebar
- `storyStore.updateScene()` — Used to set roomId and modify entities array
- `zoneStore` — Read rooms/mobs/items for the linked zone (story.zoneId)

</code_context>

<specifics>
## Specific Ideas

- Preview should feel like a "mini presentation" — same visual language that the fullscreen mode will use in Phase 11
- Entity picker should feel like browsing a zone's roster, not a file picker
- Back-row entities slightly smaller creates a simple depth illusion without needing real parallax (that's Phase 10)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 09-scene-composition*
*Context gathered: 2026-04-06*
