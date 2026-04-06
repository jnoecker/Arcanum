# Phase 9: Scene Composition - Research

**Researched:** 2026-04-06
**Domain:** React component composition, drag-and-drop entity positioning, image rendering via IPC, Zustand store integration
**Confidence:** HIGH

## Summary

Phase 9 adds the visual scene composition layer to the story editor: an entity picker sidebar to browse zone rooms/mobs/items, a 16:9 cinematic preview renderer with layered room backgrounds + entity sprites + narration overlay, and drag-to-position entity placement with preset slot defaults.

All required building blocks already exist in the codebase. The `useImageSrc` hook handles all image loading via IPC (no new Rust backend needed). The `zoneStore` provides room/mob/item data with image fields. The `storyStore.updateScene()` already supports partial scene patches including `roomId` and `entities[]`. The `SceneEntity` type is pre-defined with `position?: { x: number; y: number }`. This phase is purely frontend component work -- no new dependencies, no backend changes, no data migrations.

**Primary recommendation:** Build three new components (`EntityPicker`, `ScenePreview`, `EntityOverlay`) and integrate them into the existing `SceneDetailEditor`. Add a `slot` field to `SceneEntity` for preset position tracking. Use percentage-based coordinates (0-100) throughout for resolution independence. Implement drag-to-reposition with native `onPointerDown`/`onPointerMove`/`onPointerUp` handlers (no library needed for single-element drag within a bounded container).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Collapsible sidebar panel in the scene detail area with three tabs: Rooms, Mobs, Items. Each tab lists entities from the linked zone. Searchable filter input within each tab.
- **D-02:** Each entity row shows a 32px thumbnail (from existing zone art via `useImageSrc`) and the entity name. Entities without images show a placeholder icon with entity type badge.
- **D-03:** Click interaction: clicking a room in the Rooms tab sets it as the scene's `roomId` (background). Clicking a mob/item in the Mobs/Items tabs adds a `SceneEntity` to the scene's entity list. Entities appear in the preview immediately.
- **D-04:** Removing entities from a scene happens via the preview (click-to-select entity, then delete) or an entity list below the preview.
- **D-05:** Preview renders inline in the scene detail editor, between the template picker and narration section. Fixed 16:9 aspect ratio container at container width. Always visible while editing, scrolls with the detail area.
- **D-06:** When no room is selected, the preview shows a dark placeholder with dashed border and prompt: "Select a room from the Entity Picker to set the background" with a subtle arrow pointing toward the picker sidebar. Entities can still be added and appear on the dark placeholder.
- **D-07:** Entities are placed in preset positions by default -- front row (left, center, right) and back row (back-left, back-center, back-right). When entities are added without explicit position, they auto-distribute across front-row slots first, then back-row.
- **D-08:** Builder can drag an entity to any custom position within the preview. Custom positions stored as `{ x: number, y: number }` in percentage coordinates (0-100). Dragging overrides the preset slot.
- **D-09:** Entity sprites render at a fixed size (64-80px) with entity name label below. Back-row entities render slightly smaller for depth illusion. Entities without images show a placeholder icon with type badge.
- **D-10:** Scene preview uses 16:9 cinematic aspect ratio. This matches what fullscreen presentation (Phase 11) and showcase player (Phase 12) will display. Consistent from editor to presentation.
- **D-11:** Room background fills the 16:9 frame using `object-fit: cover`. May crop edges of non-16:9 source images. No empty space.
- **D-12:** Narration text renders as a semi-transparent overlay at the bottom of the preview -- dark gradient (transparent to 60% black) with white Crimson Pro text. Shows first 2-3 lines, truncated if longer. Full text remains in the TipTap editor below.
- **D-13:** Layer order (back to front): room background -> back-row entities -> front-row entities -> narration overlay. Entities have `pointer-events` for drag interaction.

### Claude's Discretion
- Entity picker sidebar width and collapse behavior
- Exact preset slot pixel positions within the 16:9 frame
- Entity drag handle affordance (grab cursor, outline on hover)
- How entity removal works (X button on hover, delete key, or both)
- Depth illusion scaling factor for back-row entities
- Preview container height (300-400px range)
- Entity name label typography and positioning
- Search/filter implementation details in the picker tabs

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCENE-01 | Builder can pick rooms, mobs, and items from the linked zone's data | EntityPicker sidebar component reads from zoneStore via story.zoneId; useImageSrc for thumbnails; click-to-add pattern via storyStore.updateScene |
| SCENE-02 | Scene displays room background with entity overlays and narration text | ScenePreview component with layered rendering: room bg (useImageSrc + object-fit:cover), EntityOverlay sprites at percentage positions, narration gradient overlay |
| SCENE-03 | Room background auto-populates from zone art when a room is selected | Room selection in EntityPicker sets scene.roomId; ScenePreview reads roomId -> resolves room.image from zoneStore -> renders via useImageSrc |
| SCENE-04 | Builder can preview the composed scene in the editor | ScenePreview renders inline in SceneDetailEditor between TemplatePicker and narration; always visible, 16:9 aspect ratio |
| SCENE-05 | Builder can position entities at predefined spots or custom coordinates | Preset slot system (6 positions) with auto-distribution; pointer-event-based drag override stores { x, y } percentages on SceneEntity.position |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.0.0 | UI components | Already installed, project standard [VERIFIED: package.json] |
| Zustand | ^5.0.0 | State management (storyStore, zoneStore) | Already installed, project standard [VERIFIED: package.json] |
| Tailwind CSS | ^4.0.0 | All styling including aspect-ratio, positioning | Already installed, project standard [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/api | ^2 | IPC for image loading (via useImageSrc) | Already installed, used implicitly through useImageSrc hook [VERIFIED: package.json] |

### No New Dependencies Required
This phase requires zero new npm packages. All functionality is built with existing React + Zustand + Tailwind + IPC primitives:
- **Entity drag**: Native pointer events (onPointerDown/Move/Up) -- single-element bounded drag does not warrant dnd-kit overhead [VERIFIED: codebase pattern in SceneContextMenu uses native events]
- **Image loading**: Existing `useImageSrc` hook handles all image resolution [VERIFIED: creator/src/lib/useImageSrc.ts]
- **Aspect ratio**: Tailwind `aspect-video` class (16:9) [VERIFIED: Tailwind v4 ships this utility]
- **Tabs**: Custom tab component with Tailwind (no headless UI library needed for 3 simple tabs)

## Architecture Patterns

### Recommended Component Structure
```
creator/src/components/lore/
  SceneDetailEditor.tsx        # MODIFY: integrate ScenePreview + EntityPicker
  ScenePreview.tsx             # NEW: 16:9 preview renderer with layered composition
  EntityOverlay.tsx            # NEW: single entity sprite with drag + selection
  EntityPicker.tsx             # NEW: collapsible sidebar with Rooms/Mobs/Items tabs
  EntityPickerTab.tsx          # NEW: single tab content with search filter + entity rows

creator/src/lib/
  sceneLayout.ts               # NEW: preset slot definitions, auto-distribution logic, coordinate helpers

creator/src/types/
  story.ts                     # MODIFY: add slot field to SceneEntity, add EntitySlot type
```

### Pattern 1: SceneDetailEditor Layout Restructure
**What:** The current `SceneDetailEditor` is a vertical stack (title -> template -> narration -> DM notes). Phase 9 restructures it into a horizontal split: main content area (left) with entity picker sidebar (right), and inserts the ScenePreview between template picker and narration.
**When to use:** Always -- this is the core integration point.
**Example:**
```typescript
// Source: derived from existing SceneDetailEditor.tsx + CONTEXT.md D-05
// New layout structure for SceneDetailEditor:
<div className="flex gap-4 flex-1 min-h-0">
  {/* Main content area */}
  <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
    <EditableField ... /> {/* Scene title */}
    <TemplatePicker ... />
    <ScenePreview scene={scene} storyId={storyId} />  {/* NEW */}
    <LoreEditor ... /> {/* Narration */}
    <DmNotesSection ... />
  </div>
  {/* Entity picker sidebar */}
  <EntityPicker
    zoneId={story.zoneId}
    scene={scene}
    storyId={storyId}
    onCollapse / onExpand
  />
</div>
```

### Pattern 2: Preset Slot System
**What:** Six named positions within the 16:9 frame, expressed as percentage coordinates. Front-row slots are in the lower 60-70% of the frame; back-row slots in the upper 40-50%. Auto-distribution fills front-row first (left -> center -> right), then back-row.
**When to use:** Default entity placement when no custom position is set.
**Example:**
```typescript
// Source: CONTEXT.md D-07, D-08, D-09
export type EntitySlot =
  | "front-left" | "front-center" | "front-right"
  | "back-left" | "back-center" | "back-right";

export const PRESET_SLOTS: Record<EntitySlot, { x: number; y: number }> = {
  "front-left":    { x: 20, y: 72 },
  "front-center":  { x: 50, y: 72 },
  "front-right":   { x: 80, y: 72 },
  "back-left":     { x: 25, y: 48 },
  "back-center":   { x: 50, y: 48 },
  "back-right":    { x: 75, y: 48 },
};

// Auto-distribution priority order
const SLOT_ORDER: EntitySlot[] = [
  "front-center", "front-left", "front-right",
  "back-center", "back-left", "back-right",
];

/** Returns the next available slot, or center fallback if all occupied. */
export function getNextSlot(occupiedSlots: EntitySlot[]): EntitySlot {
  return SLOT_ORDER.find(s => !occupiedSlots.includes(s)) ?? "front-center";
}

/** Returns resolved {x, y} for an entity -- custom position takes precedence over slot. */
export function resolveEntityPosition(
  entity: SceneEntity
): { x: number; y: number } {
  if (entity.position) return entity.position;
  if (entity.slot) return PRESET_SLOTS[entity.slot];
  return PRESET_SLOTS["front-center"]; // fallback
}
```

### Pattern 3: Pointer-Based Drag Within Bounded Container
**What:** Entity sprites are draggable within the ScenePreview using native pointer events. On pointer down, capture; on pointer move, compute new percentage position relative to container bounds; on pointer up, persist to storyStore.
**When to use:** For the entity drag-to-reposition interaction (D-08).
**Example:**
```typescript
// Source: standard React pointer event pattern
function EntityOverlay({ entity, containerRef, onReposition }) {
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    // track initial offset for smooth drag
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    // clamp to 0-100 and update local state for smooth rendering
  }, [containerRef]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // persist final position to store
    onReposition({ x: clampedX, y: clampedY });
  }, [onReposition]);

  return (
    <div
      style={{
        position: "absolute",
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: "translate(-50%, -100%)", // anchor at bottom-center of sprite
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="cursor-grab active:cursor-grabbing"
    >
      {/* sprite image + label */}
    </div>
  );
}
```

### Pattern 4: Zone Data Access Through Story's zoneId
**What:** The entity picker reads zone data from `zoneStore` using the story's `zoneId`. The zone must already be loaded in the store (it is, because stories are opened from within a project where zones are loaded).
**When to use:** EntityPicker reads rooms, mobs, items from zoneStore.
**Example:**
```typescript
// Source: derived from existing zoneStore.ts + StoryEditorPanel.tsx patterns
const zoneState = useZoneStore((s) => s.zones.get(story.zoneId));
const rooms = zoneState ? Object.entries(zoneState.data.rooms) : [];
const mobs = zoneState?.data.mobs ? Object.entries(zoneState.data.mobs) : [];
const items = zoneState?.data.items ? Object.entries(zoneState.data.items) : [];
```

### Anti-Patterns to Avoid
- **Don't use dnd-kit for entity drag**: dnd-kit is designed for sortable lists and drag-between-containers. Entity repositioning within a 2D preview is free-form pointer tracking, which is simpler with native pointer events. dnd-kit would add unnecessary complexity for a single-item bounded drag. [VERIFIED: dnd-kit docs describe sortable/droppable patterns, not free-form 2D positioning]
- **Don't load images outside useImageSrc**: All image loading MUST go through the `useImageSrc` hook or the `read_image_data_url` IPC command. Direct asset protocol (`convertFileSrc`) does not work on Windows. [VERIFIED: CLAUDE.md Common Pitfalls]
- **Don't store pixel positions**: Always store positions as percentages (0-100). The preview container size varies with window size; pixel positions would break on resize. [VERIFIED: CONTEXT.md D-08]
- **Don't create a separate store**: Scene entity state belongs in `storyStore` via `updateScene`. No new Zustand store needed -- scene composition data is part of the Scene model already. [VERIFIED: storyStore.updateScene already supports entities patch]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image loading | Custom fetch/asset protocol | `useImageSrc` hook | Handles R2 hashes, legacy paths, Windows IPC; already battle-tested [VERIFIED: useImageSrc.ts] |
| Aspect ratio container | Manual padding-bottom trick | Tailwind `aspect-video` | Built-in 16:9 aspect ratio in Tailwind v4 [VERIFIED: Tailwind CSS docs] |
| Entity type resolution | Inline room/mob/item checks | Helper functions in `sceneLayout.ts` | Centralizes slot logic, entity resolution, position clamping |
| Rich text narration preview | Custom text truncation | TipTap `generateText` or simple DOM extraction | Narration is stored as TipTap JSON; need plain text for preview overlay |

## Common Pitfalls

### Pitfall 1: useImageSrc Returns Null During Load
**What goes wrong:** Entity thumbnails and room backgrounds flash as empty/broken during initial load because `useImageSrc` returns `null` while the IPC call resolves.
**Why it happens:** Each `useImageSrc` call triggers an async IPC `read_image_data_url` invocation. Multiple entities in the picker or preview means many concurrent IPC calls.
**How to avoid:** Always show a loading placeholder (spinner or skeleton) when `src === null`. The `RoomNode.tsx` and `SpriteThumb` components already demonstrate this pattern. For the preview, show the room background skeleton while loading; for entity thumbnails in the picker, show a small placeholder icon.
**Warning signs:** Blank squares flickering in the entity picker or preview.

### Pitfall 2: Stale Zone Data in Entity Picker
**What goes wrong:** The entity picker shows outdated room/mob/item lists if the zone was edited after the story was opened.
**Why it happens:** `zoneStore` updates on zone edits, but if the story tab was opened before the zone edit, the picker might cache old data.
**How to avoid:** Read from `zoneStore` directly via Zustand selectors -- the store is reactive. Don't cache zone data locally in the EntityPicker component state. Use `useZoneStore((s) => s.zones.get(zoneId))` directly.
**Warning signs:** Entity picker showing rooms that were deleted or missing newly added rooms.

### Pitfall 3: Entity Position Drift on Container Resize
**What goes wrong:** Entities appear to jump when the window is resized because percentage-to-pixel conversion changes.
**Why it happens:** If positions were stored as pixels or if the transform calculation doesn't account for container size changes.
**How to avoid:** Store positions as percentages (0-100) as specified in D-08. Use CSS `left: X%` and `top: Y%` for positioning. The browser handles resize automatically with percentage-based CSS.
**Warning signs:** Entities moving to different visual positions when the editor panel resizes.

### Pitfall 4: Pointer Capture Loss During Drag
**What goes wrong:** Entity drag stops working mid-drag if the pointer leaves the element boundary.
**Why it happens:** Without pointer capture, `pointermove` events stop firing when the pointer exits the element.
**How to avoid:** Call `setPointerCapture(pointerId)` on `pointerdown`. This ensures all subsequent pointer events are delivered to the capturing element regardless of pointer position. Release on `pointerup`.
**Warning signs:** Drag "dropping" the entity in the wrong place when moving quickly.

### Pitfall 5: Excessive Store Updates During Drag
**What goes wrong:** Calling `updateScene` on every pointermove frame (60fps) triggers 60 Zustand snapshots per second, filling the undo stack and causing jank.
**Why it happens:** Each `updateScene` call includes `snapshotStory()` which deep-clones the entire stories state.
**How to avoid:** Use local React state (`useState`) for the drag position during the active drag. Only commit to the store on `pointerup` (drag end). This means one undo snapshot per drag operation, not per frame.
**Warning signs:** Undo stack filling up with dozens of entries for a single drag, UI lag during entity dragging.

### Pitfall 6: TipTap JSON in Narration Preview
**What goes wrong:** The narration overlay in the preview shows raw TipTap JSON instead of readable text.
**Why it happens:** `scene.narration` is stored as a TipTap JSON string, not plain text.
**How to avoid:** Extract plain text from TipTap JSON for the preview overlay. Use a lightweight extraction function: parse JSON, walk the `content` nodes, concatenate text nodes. Don't instantiate a full TipTap editor for the preview -- that would be expensive. A utility function like `extractPlainText(narration: string): string` that walks the JSON tree is sufficient.
**Warning signs:** Seeing `{"type":"doc","content":[...]}` in the narration overlay.

### Pitfall 7: Flex Scrolling in Restructured Layout
**What goes wrong:** The scene detail area stops scrolling after adding the horizontal split layout for the entity picker sidebar.
**Why it happens:** Parent containers need `min-h-0` and `flex-1` for `overflow-y-auto` to work in flexbox. The layout restructure may break the existing scroll chain.
**How to avoid:** Ensure the outer `SceneDetailEditor` container has `min-h-0 flex-1` and the inner scroll area has `overflow-y-auto`. This is documented in CLAUDE.md Common Pitfalls. Test scrolling after the layout change.
**Warning signs:** Content overflow without scrollbar appearing.

## Code Examples

### Example 1: SceneEntity Type Extension
```typescript
// Source: derived from creator/src/types/story.ts + CONTEXT.md D-07/D-08
export type EntitySlot =
  | "front-left" | "front-center" | "front-right"
  | "back-left" | "back-center" | "back-right";

export interface SceneEntity {
  id: string;
  entityType: "mob" | "item" | "npc";
  entityId: string;
  slot?: EntitySlot;                  // NEW: preset slot assignment
  position?: { x: number; y: number }; // existing: custom override (0-100 percentages)
  movementPath?: string;               // existing: SVG d attribute (Phase 10)
}
```
The `slot` field is optional. When set without `position`, the entity renders at the preset slot coordinates. When `position` is set, it overrides `slot`. When an entity is dragged, `position` is set and `slot` is cleared (or left as-is for reference). [ASSUMED]

### Example 2: Room Data Access from Zone
```typescript
// Source: creator/src/types/world.ts, creator/src/stores/zoneStore.ts
// Rooms are Record<string, RoomFile> where key is room ID
// RoomFile has: title, description, image?, exits?, etc.
// Mobs are Record<string, MobFile> where key is mob ID
// MobFile has: name, image?, room, tier?, level?, etc.
// Items are Record<string, ItemFile> where key is item ID
// ItemFile has: displayName, image?, slot?, etc.
```

### Example 3: 16:9 Preview Container with Layer Stack
```typescript
// Source: CONTEXT.md D-10, D-11, D-12, D-13
<div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border-default bg-black">
  {/* Layer 1: Room background */}
  {roomImageSrc && (
    <img src={roomImageSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
  )}

  {/* Layer 2: Back-row entities (smaller for depth) */}
  {backRowEntities.map(entity => (
    <EntityOverlay key={entity.id} entity={entity} scale={0.75} ... />
  ))}

  {/* Layer 3: Front-row entities */}
  {frontRowEntities.map(entity => (
    <EntityOverlay key={entity.id} entity={entity} scale={1.0} ... />
  ))}

  {/* Layer 4: Narration overlay */}
  {narrationText && (
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-6 py-4 pointer-events-none">
      <p className="font-body text-sm text-white leading-relaxed line-clamp-3">
        {narrationText}
      </p>
    </div>
  )}

  {/* Empty state */}
  {!scene.roomId && (
    <div className="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-border-default">
      <p className="text-sm text-text-muted">Select a room from the Entity Picker to set the background</p>
    </div>
  )}
</div>
```

### Example 4: Plain Text Extraction from TipTap JSON
```typescript
// Source: TipTap JSON format standard
interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
}

export function extractPlainText(narrationJson: string): string {
  if (!narrationJson) return "";
  try {
    const doc: TipTapNode = JSON.parse(narrationJson);
    return walkNodes(doc).trim();
  } catch {
    return ""; // invalid JSON -- show nothing
  }
}

function walkNodes(node: TipTapNode): string {
  if (node.text) return node.text;
  if (!node.content) return "";
  return node.content
    .map(child => walkNodes(child))
    .join(node.type === "paragraph" ? "\n" : "");
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS padding-bottom trick for aspect ratio | `aspect-ratio` CSS property / Tailwind `aspect-video` | 2022+ (widely supported) | Simpler, more readable code [VERIFIED: Tailwind v4 includes aspect-video] |
| onMouseDown/onMouseMove/onMouseUp for drag | onPointerDown/onPointerMove/onPointerUp with setPointerCapture | 2020+ (Pointer Events API) | Unified touch + mouse handling, pointer capture prevents event loss [VERIFIED: MDN Pointer Events] |
| Separate drag library for any drag | Native pointer events for bounded free-form drag | Current best practice | Libraries like dnd-kit/react-dnd are for list sorting and complex multi-container scenarios, not simple 2D repositioning |

## Assumptions Log

> List all claims tagged [ASSUMED] in this research. The planner and discuss-phase use this
> section to identify decisions that need user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Adding a `slot` field to SceneEntity is the right way to track preset position assignment | Code Examples | If wrong, would need alternative approach to distinguish preset vs. custom positioning -- low risk, can fall back to deriving slot from position coordinates |
| A2 | `line-clamp-3` Tailwind utility is available in Tailwind v4 for narration truncation | Code Examples | If unavailable, use `-webkit-line-clamp` directly or a max-height + overflow approach -- trivial fallback |

**If this table is empty:** All claims in this research were verified or cited -- no user confirmation needed.

## Open Questions

1. **Zone not loaded when story opens**
   - What we know: StoryEditorPanel already reads from zoneStore to get zone name. The zone must be loaded for the entity picker to show data.
   - What's unclear: Is the zone always guaranteed to be loaded when a story is opened? If the user opens a story without having the zone's tab open, is the zone data in zoneStore?
   - Recommendation: Add a guard in EntityPicker -- if zone is not loaded, show a message like "Load zone [name] to browse entities" with a button/link to open the zone tab. Check existing zone loading flow in StoryEditorPanel.

2. **Entity deduplication in scenes**
   - What we know: A builder clicks a mob in the picker to add it as a SceneEntity. What if they click the same mob twice?
   - What's unclear: Should duplicate entities be allowed (same mob appearing twice in a scene)?
   - Recommendation: Allow duplicates -- a scene might have "two guards" from the same mob template. Each SceneEntity gets a unique `id` regardless.

3. **SceneEntity `entityType: "npc"` vs zone data**
   - What we know: SceneEntity has `entityType: "mob" | "item" | "npc"` but zone data has mobs and items, no separate "npc" type.
   - What's unclear: When would "npc" be used if entities come from the zone picker?
   - Recommendation: For Phase 9, the entity picker adds mobs as "mob" and items as "item". The "npc" type can be used in future phases for non-zone entities. No change needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.0 |
| Config file | `creator/vitest.config.ts` |
| Quick run command | `cd creator && bunx vitest run --reporter=verbose` |
| Full suite command | `cd creator && bunx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCENE-01 | Entity picker reads zone rooms/mobs/items | unit | `cd creator && bunx vitest run src/lib/__tests__/sceneLayout.test.ts -x` | Wave 0 |
| SCENE-02 | Scene layering (background + entities + narration) | manual-only | Visual verification -- DOM layer order | N/A |
| SCENE-03 | Room background auto-populates from zone art | manual-only | Click room in picker -> verify bg image appears | N/A |
| SCENE-04 | Live preview renders in editor | manual-only | Visual verification -- preview visible while editing | N/A |
| SCENE-05 | Preset slot distribution + custom drag positioning | unit | `cd creator && bunx vitest run src/lib/__tests__/sceneLayout.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd creator && bunx vitest run --reporter=verbose`
- **Per wave merge:** `cd creator && bunx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `creator/src/lib/__tests__/sceneLayout.test.ts` -- covers SCENE-01 (entity data extraction), SCENE-05 (slot distribution, position resolution, clamping)
- [ ] Plain text extraction from TipTap JSON test cases (can be added to sceneLayout tests or separate file)

Note: Most Phase 9 requirements are visual/UI and can only be validated manually. The testable logic is the slot distribution algorithm and position resolution -- those should have unit tests.

## Security Domain

Security is not applicable to this phase. Phase 9 is purely frontend component work within the existing Tauri sandboxed webview:
- No new API endpoints or network calls
- No user input that reaches a backend (positions are local state)
- No file system access beyond existing `useImageSrc` IPC pattern
- No new dependencies to audit

## Sources

### Primary (HIGH confidence)
- `creator/src/types/story.ts` -- SceneEntity type, Scene interface (verified via Read)
- `creator/src/stores/storyStore.ts` -- updateScene, addScene operations (verified via Read)
- `creator/src/lib/useImageSrc.ts` -- Image loading hook (verified via Read)
- `creator/src/stores/zoneStore.ts` -- Zone data structure, rooms/mobs/items (verified via Read)
- `creator/src/types/world.ts` -- RoomFile, MobFile, ItemFile interfaces (verified via Read)
- `creator/src/components/lore/SceneDetailEditor.tsx` -- Current editor layout (verified via Read)
- `creator/src/components/lore/StoryEditorPanel.tsx` -- Parent panel layout (verified via Read)
- `creator/src/components/lore/SceneTimeline.tsx` -- dnd-kit usage pattern (verified via Read)
- `creator/src/components/zone/RoomNode.tsx` -- Room/entity rendering patterns (verified via Read)
- `creator/src/components/lore/ArticleBrowser.tsx` -- Story routing pattern (verified via Read)
- `creator/package.json` -- Dependency versions verified (React ^19, Zustand ^5, Tailwind ^4, dnd-kit ^6.3)

### Secondary (MEDIUM confidence)
- Tailwind CSS v4 `aspect-video` utility [CITED: Tailwind CSS aspect ratio documentation]
- Pointer Events API with `setPointerCapture` [CITED: MDN Pointer Events specification]

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all dependencies already installed and verified in package.json; no new packages needed
- Architecture: HIGH -- component structure follows established codebase patterns (SceneDetailEditor, RoomNode, EntityPicker)
- Pitfalls: HIGH -- identified from direct codebase analysis (IPC loading, undo snapshots, flex scrolling)

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable -- no external API or library version concerns)
