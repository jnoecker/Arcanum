# Phase 8: Story Editor - Research

**Researched:** 2026-04-05
**Domain:** Timeline editor UI, drag-and-drop scene reordering, rich text narration, scene templates
**Confidence:** HIGH

## Summary

Phase 8 transforms the `StoryEditorPanel` from a minimal metadata viewer (Phase 7 output) into a full timeline-based scene editor. The work divides into four distinct areas: (1) scene CRUD operations in `storyStore`, (2) a horizontal draggable timeline strip using `@dnd-kit/sortable`, (3) a scene detail editor with TipTap narration and plain-text DM notes, and (4) a scene template system with three presets. All four areas build on established codebase patterns with minimal new concepts.

The primary technical novelty is introducing `@dnd-kit` as the project's first drag-and-drop library. The API is well-documented, the horizontal sortable list pattern is straightforward, and the library is compatible with React 19. The remaining work (store operations, rich text editing, template application) reuses existing patterns directly.

**Primary recommendation:** Install `@dnd-kit/core@^6.3`, `@dnd-kit/sortable@^10.0`, and `@dnd-kit/utilities@^3.2`. Build the timeline as a `DndContext` + `SortableContext` with `horizontalListSortingStrategy`. Extend `storyStore` with scene-level operations following the existing `snapshotStory` undo pattern. Reuse `LoreEditor` for narration. Build a custom right-click context menu component (first in the codebase).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Top-bottom split layout -- horizontal timeline strip across the top, selected scene's detail editor below. Replaces the current "No scenes yet" placeholder in `StoryEditorPanel.tsx`.
- **D-02:** Timeline strip scrolls horizontally with overflow when many scenes exist. Single row, fixed height. Arrow indicators or scroll affordance at edges.
- **D-03:** Auto-select first scene -- a scene is always selected when the story has scenes. Opening a story selects scene 1 automatically. Adding the first scene also selects it. Detail area never shows an empty state (unless zero scenes).
- **D-04:** Cover image section placement is Claude's discretion -- may move to a collapsible metadata/settings section or stay above the timeline, whichever produces the best vertical space usage.
- **D-05:** Each scene card shows: scene index number, editable title, and a small colored badge for the template type (if set). No room thumbnails in Phase 8.
- **D-06:** Selected card gets an aurum-gold border (`border-accent`) and elevated background (`bg-elevated`). Matches existing Arcanum selected-state patterns.
- **D-07:** Scene deletion, duplication, and template application available via right-click context menu on cards. No visible delete button on the card itself.
- **D-08:** Scene narration reuses the existing `LoreEditor` component (full TipTap 3 with bold, italic, headings, @mentions, links, AI enhance/generate).
- **D-09:** DM notes appear in a collapsible section below narration with a warm-tinted background (amber/parchment tone). Eye icon or "DM Only" badge. Collapsed by default if empty, expanded if has content.
- **D-10:** DM notes use a plain textarea -- no rich text needed.
- **D-11:** Three templates (Establishing Shot, Encounter, Discovery) pre-populate a default scene title and starter narration text. Builder can edit both freely after applying.
- **D-12:** Template picker available in the scene detail editor (dropdown or button group). Can also be applied via right-click context menu on the scene card. Template can be changed or cleared anytime.
- **D-13:** Applying a template to a scene that already has content shows a confirmation prompt ("Replace existing content with template defaults?"). Empty scenes apply silently. User can undo regardless.

### Claude's Discretion

- Cover image section placement (above timeline or in collapsible settings)
- Exact card dimensions and spacing in the timeline strip
- "Add scene" button design (inline at end of timeline strip or separate button)
- Scene detail editor section ordering (narration -> DM notes -> template picker, or other)
- dnd-kit installation and sortable configuration details
- Scene ID generation scheme for new scenes
- Scroll indicator/arrow design for timeline overflow
- Starter narration text content for each template

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STORY-02 | Builder can add, remove, and reorder scenes via draggable scene cards on a timeline | dnd-kit sortable horizontal list pattern; storyStore scene CRUD operations; scene ID generation |
| STORY-03 | Builder can write narration text per scene | LoreEditor component reuse; TipTap JSON storage in `scene.narration` field |
| STORY-04 | Builder can add private DM speaker notes per scene | Plain textarea; collapsible section; `scene.dmNotes` string field |
| STORY-07 | Builder can apply scene templates (Establishing Shot, Encounter, Discovery) | Template preset definitions; confirmation dialog for content replacement; SceneTemplate type already defined |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | 6.3.1 | Drag-and-drop primitives: DndContext, sensors, collision detection | Modular DnD engine, ~10kb, accessibility built-in (keyboard + screen reader), React 19 compatible [VERIFIED: npm registry] |
| @dnd-kit/sortable | 10.0.0 | Sortable preset: SortableContext, useSortable, arrayMove, horizontalListSortingStrategy | Thin layer on core optimized for sortable lists, ~3kb [VERIFIED: npm registry] |
| @dnd-kit/utilities | 3.2.2 | CSS transform utilities for drag visuals | CSS.Transform.toString() for smooth drag rendering, ~1kb [VERIFIED: npm registry] |

### Already Installed (Reuse)

| Library | Version | Purpose | How Used in Phase 8 |
|---------|---------|---------|---------------------|
| @tiptap/react | ^3.21.0 (latest 3.22.2) | Rich text editor | Scene narration via `LoreEditor` component reuse [VERIFIED: npm registry] |
| zustand | ^5.0.0 | State management | storyStore scene-level operations [VERIFIED: codebase] |
| react | ^19.0.0 | UI framework | All components [VERIFIED: codebase] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit/core | @hello-pangea/dnd | Heavier, more opinionated, unnecessary abstraction for flat list [ASSUMED] |
| @dnd-kit/core | HTML5 drag-and-drop | No animation support, poor accessibility, inconsistent cross-browser [ASSUMED] |
| @dnd-kit/core | pragmatic-drag-and-drop | Framework-agnostic = more React boilerplate [ASSUMED] |
| @dnd-kit/modifiers (restrictToHorizontalAxis) | No modifiers | Horizontal constraint is naturally enforced by the list layout. Saves an extra package. [ASSUMED] |

**Installation:**
```bash
cd creator && bun add @dnd-kit/core@^6.3 @dnd-kit/sortable@^10.0 @dnd-kit/utilities@^3.2
```

**Peer dependency verification:** `@dnd-kit/core@6.3.1` requires `react >=16.8.0` and `react-dom >=16.8.0`. `@dnd-kit/sortable@10.0.0` requires `react >=16.8.0` and `@dnd-kit/core ^6.3.0`. All satisfied by the project's React 19 + dnd-kit 6.3. [VERIFIED: npm registry]

## Architecture Patterns

### Recommended Project Structure (new/modified files)

```
creator/src/
  stores/
    storyStore.ts            # MODIFY: add scene-level operations
  components/
    lore/
      StoryEditorPanel.tsx   # REWRITE: timeline + scene detail layout
      LoreEditor.tsx         # REUSE: no changes needed
      SceneCard.tsx           # NEW: draggable scene card component
      SceneTimeline.tsx       # NEW: horizontal timeline strip with DndContext
      SceneDetailEditor.tsx   # NEW: narration + DM notes + template picker
      SceneContextMenu.tsx    # NEW: right-click context menu
  lib/
    sceneTemplates.ts        # NEW: template preset definitions
```

### Pattern 1: Store Extension -- Scene-Level Operations

**What:** Add scene CRUD methods to the existing `storyStore` that follow the `snapshotStory` undo pattern.
**When to use:** Every scene mutation (add, remove, reorder, update).

```typescript
// Source: Existing storyStore.ts snapshotStory pattern
// New operations to add:

interface StoryStore extends StoryState {
  // ... existing operations ...
  addScene: (storyId: string, scene: Scene) => void;
  removeScene: (storyId: string, sceneId: string) => void;
  reorderScenes: (storyId: string, sceneIds: string[]) => void;
  updateScene: (storyId: string, sceneId: string, patch: Partial<Scene>) => void;
  activeSceneId: string | null;
  setActiveScene: (id: string | null) => void;
}
```

Each operation calls `snapshotStory(s)` before mutating, ensuring undo/redo captures every scene change. [VERIFIED: existing storyStore pattern in codebase]

### Pattern 2: dnd-kit Horizontal Sortable List

**What:** `DndContext` wrapping a `SortableContext` with `horizontalListSortingStrategy` for the timeline strip.
**When to use:** The scene timeline component.

```typescript
// Source: https://dndkit.com/presets/sortable
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// In SceneTimeline.tsx:
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  useSensor(KeyboardSensor),
);

function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over || active.id === over.id) return;
  const oldIndex = sceneIds.indexOf(active.id as string);
  const newIndex = sceneIds.indexOf(over.id as string);
  const newOrder = arrayMove(sceneIds, oldIndex, newIndex);
  reorderScenes(storyId, newOrder);
}

<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={sceneIds} strategy={horizontalListSortingStrategy}>
    {scenes.map((scene, idx) => (
      <SceneCard key={scene.id} scene={scene} index={idx} isSelected={scene.id === activeSceneId} />
    ))}
  </SortableContext>
  <DragOverlay>{activeId ? <SceneCardOverlay ... /> : null}</DragOverlay>
</DndContext>
```

[VERIFIED: dndkit.com official docs]

### Pattern 3: Scene ID Generation

**What:** Generate unique scene IDs using the same slug + random suffix pattern used for story IDs.
**When to use:** `addScene` operation.

```typescript
// Source: Existing NewStoryDialog.tsx pattern
function generateSceneId(): string {
  const suffix = Math.random().toString(36).substring(2, 8);
  return `scene_${suffix}`;
}
```

Scene IDs don't need title slugs since they're internal identifiers within a story. A simple `scene_` prefix + 6-char random suffix is sufficient for uniqueness within a single story. [VERIFIED: NewStoryDialog.tsx uses similar pattern for story IDs]

### Pattern 4: Right-Click Context Menu (New Pattern)

**What:** A custom context menu component positioned at the mouse cursor on right-click. First context menu in the codebase.
**When to use:** Scene card right-click for delete, duplicate, and template application.

```typescript
// No existing pattern in codebase -- new component needed.
// The only existing onContextMenu handler is SketchCanvas.tsx which just does e.preventDefault().

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  sceneId: string | null;
}

// Position at cursor, dismiss on click-outside or Escape
// Use a portal to render at document root (avoids overflow:hidden clipping)
```

The context menu should be a reusable component since Phase 9+ may need it for entity manipulation. [ASSUMED]

### Pattern 5: LoreEditor Reuse for Narration

**What:** Direct reuse of `LoreEditor` component for scene narration editing.
**When to use:** Scene detail editor narration section.

```typescript
// Source: Existing LoreEditor.tsx component
<LoreEditor
  value={scene.narration ?? ""}
  onCommit={(json) => updateScene(storyId, scene.id, { narration: json })}
  placeholder="Write narration for this scene..."
  generateSystemPrompt="You are a world-building narrator..."
  generateUserPrompt={`Write cinematic narration for a scene titled "${scene.title}"`}
/>
```

`LoreEditor` accepts `value` (TipTap JSON string), `onCommit` callback, placeholder, and optional LLM generation prompts. It handles TipTap initialization, external value sync, and AI enhance/generate/continue actions internally. [VERIFIED: LoreEditor.tsx source code]

### Anti-Patterns to Avoid

- **Scene data outside storyStore:** All scene state lives in `storyStore.stories[id].scenes[]`. No separate scene store or local component state for scene data -- this breaks undo/redo.
- **Direct array mutation for reorder:** Always use `arrayMove` from dnd-kit then update the `sortOrder` field. Never splice/push directly on the scenes array without snapshotting first.
- **Rich text for DM notes:** Decision D-10 locks DM notes to plain textarea. Do not use TipTap -- it adds unnecessary complexity for private jottings.
- **Nested DndContext:** Only one `DndContext` in the StoryEditorPanel. Do not nest contexts (e.g., for timeline + future entity dragging) -- that's a Phase 9 concern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sortable drag-and-drop | Custom drag handlers with mouse events | @dnd-kit/sortable | Accessibility (keyboard navigation, screen reader announcements), animation, edge cases (scroll during drag, touch devices) |
| Array reorder logic | Manual splice/index arithmetic | `arrayMove` from @dnd-kit/sortable | Off-by-one errors, handles edge cases |
| Rich text editing | Custom contentEditable handler | `LoreEditor` (TipTap wrapper) | Already built, tested, includes @mentions, links, AI actions |
| Confirmation dialog | Custom modal for template replacement | `ConfirmDialog` component | Already exists with focus trap, escape handling, consistent styling |
| ID generation | UUID library or custom crypto | `Math.random().toString(36)` slug pattern | Matches existing codebase convention, no new dependency needed |

**Key insight:** Phase 8 is an assembly phase -- most building blocks (store patterns, rich text editor, dialog components, design tokens) already exist. The only truly new code is the dnd-kit integration and the context menu component.

## Common Pitfalls

### Pitfall 1: Undo/Redo Not Capturing Scene Changes

**What goes wrong:** Scene mutations bypass `snapshotStory()`, making them non-undoable.
**Why it happens:** Developer adds a scene operation that directly mutates `stories[id].scenes` without calling `snapshotStory(s)` first.
**How to avoid:** Every new store method that changes scene data MUST follow the pattern: `set((s) => ({ ...snapshotStory(s), stories: { ...s.stories, [id]: updatedStory }, dirty: { ...s.dirty, [id]: true } }))`.
**Warning signs:** Pressing Ctrl+Z doesn't revert a scene add/remove/reorder.

### Pitfall 2: DndContext Missing Sensors

**What goes wrong:** Drag doesn't activate, or activates on every click (no distance threshold), or keyboard drag doesn't work.
**Why it happens:** Forgot to configure `PointerSensor` with `activationConstraint: { distance: 5 }` or omitted `KeyboardSensor`.
**How to avoid:** Always configure both PointerSensor (with distance constraint to distinguish click from drag) and KeyboardSensor. The distance constraint (5px) prevents scene card clicks from triggering drag.
**Warning signs:** Clicking a scene card to select it accidentally starts a drag operation.

### Pitfall 3: Scene Selection Lost After Reorder

**What goes wrong:** After dragging a scene card to a new position, the selected scene deselects or the wrong scene is selected.
**Why it happens:** `activeSceneId` references an ID that still exists but the component re-renders before the selection state updates.
**How to avoid:** `reorderScenes` only changes `sortOrder` values -- it does not change scene IDs. The `activeSceneId` remains valid after reorder. Ensure the selection is keyed on `scene.id`, not array index.
**Warning signs:** Selected scene jumps to a different scene after drag-and-drop reorder.

### Pitfall 4: TipTap JSON Sync with Store

**What goes wrong:** Narration edits create an infinite update loop or lose keystrokes.
**Why it happens:** `LoreEditor` fires `onCommit` on every keystroke (via TipTap's `onUpdate`). If the parent component re-renders and passes the new value back to `LoreEditor`, TipTap may re-parse and reset cursor position.
**How to avoid:** `LoreEditor` already handles this internally with `lastExternalValue` ref tracking. The parent should update the store on `onCommit`, and LoreEditor will detect its own changes and skip re-setting content. Do NOT add additional debouncing or memoization around the narration value.
**Warning signs:** Cursor jumps to the start while typing, or typing is laggy.

### Pitfall 5: Context Menu Clipped by overflow:hidden

**What goes wrong:** Right-click context menu is partially hidden because the timeline strip has `overflow-x: auto` or `overflow: hidden`.
**Why it happens:** The context menu is rendered as a child of the timeline container which clips its overflow.
**How to avoid:** Render the context menu via a React portal (`createPortal`) at the document body level. Position it absolutely using the mouse event's `clientX`/`clientY`.
**Warning signs:** Context menu appears cut off at container edges.

### Pitfall 6: sortOrder Drift After Multiple Operations

**What goes wrong:** Scene `sortOrder` values become inconsistent (e.g., [0, 2, 3] after removing scene at index 1), causing rendering issues.
**Why it happens:** `removeScene` doesn't renumber remaining scenes, or `reorderScenes` doesn't update all `sortOrder` values.
**How to avoid:** After any structural change (add, remove, reorder), normalize `sortOrder` to sequential integers (0, 1, 2, ...) based on array position. This is cheap and prevents drift.
**Warning signs:** Scenes appear in wrong order, or new scenes insert at unexpected positions.

### Pitfall 7: Template Application Without Undo Awareness

**What goes wrong:** User applies a template to a scene with existing content, confirms the replacement, but cannot undo to restore the original content.
**Why it happens:** Template application calls `updateScene` which snapshots correctly, but the confirmation dialog adds a second state change without snapshot.
**How to avoid:** Template application is a single `updateScene` call that replaces `title`, `narration`, and `template` fields in one atomic operation. The confirmation dialog is UI-only -- it gates the single store call.
**Warning signs:** Undo after template application doesn't restore original narration text.

## Code Examples

Verified patterns from official sources and existing codebase:

### Scene Store Operations (Extension Pattern)

```typescript
// Source: Existing storyStore.ts pattern + Phase 8 requirements
addScene: (storyId, scene) =>
  set((s) => {
    const existing = s.stories[storyId];
    if (!existing) return s;
    const updatedScenes = [...existing.scenes, scene];
    return {
      ...snapshotStory(s),
      stories: {
        ...s.stories,
        [storyId]: { ...existing, scenes: updatedScenes, updatedAt: new Date().toISOString() },
      },
      dirty: { ...s.dirty, [storyId]: true },
    };
  }),

removeScene: (storyId, sceneId) =>
  set((s) => {
    const existing = s.stories[storyId];
    if (!existing) return s;
    const updatedScenes = existing.scenes
      .filter((sc) => sc.id !== sceneId)
      .map((sc, i) => ({ ...sc, sortOrder: i })); // Normalize sortOrder
    return {
      ...snapshotStory(s),
      stories: {
        ...s.stories,
        [storyId]: { ...existing, scenes: updatedScenes, updatedAt: new Date().toISOString() },
      },
      dirty: { ...s.dirty, [storyId]: true },
    };
  }),

reorderScenes: (storyId, sceneIds) =>
  set((s) => {
    const existing = s.stories[storyId];
    if (!existing) return s;
    const sceneMap = new Map(existing.scenes.map((sc) => [sc.id, sc]));
    const reordered = sceneIds
      .map((id) => sceneMap.get(id))
      .filter(Boolean)
      .map((sc, i) => ({ ...sc!, sortOrder: i }));
    return {
      ...snapshotStory(s),
      stories: {
        ...s.stories,
        [storyId]: { ...existing, scenes: reordered, updatedAt: new Date().toISOString() },
      },
      dirty: { ...s.dirty, [storyId]: true },
    };
  }),
```

### useSortable Hook in SceneCard

```typescript
// Source: https://dndkit.com/presets/sortable + project patterns
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SceneCard({ scene, index, isSelected, onSelect, onContextMenu }: SceneCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: scene.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(scene.id)}
      onContextMenu={(e) => onContextMenu(e, scene.id)}
      className={`flex-shrink-0 cursor-grab rounded-xl border px-3 py-2 ${
        isSelected
          ? "border-accent bg-bg-elevated"
          : "border-border-default bg-bg-primary hover:bg-bg-tertiary"
      }`}
    >
      <span className="text-2xs text-text-muted">{index + 1}</span>
      <p className="text-sm text-text-primary truncate">{scene.title}</p>
      {scene.template && <TemplateBadge template={scene.template} />}
    </div>
  );
}
```

### Scene Template Presets

```typescript
// Source: Requirements STORY-07 + Decisions D-11, D-12
import type { SceneTemplate } from "@/types/story";

export interface SceneTemplatePreset {
  id: SceneTemplate;
  label: string;
  badgeColor: string;
  defaultTitle: string;
  defaultNarration: string; // TipTap JSON string
}

export const SCENE_TEMPLATE_PRESETS: Record<SceneTemplate, SceneTemplatePreset> = {
  establishing_shot: {
    id: "establishing_shot",
    label: "Establishing Shot",
    badgeColor: "#8caec9", // Cool blue -- scenic/atmospheric
    defaultTitle: "The Scene Opens",
    defaultNarration: /* TipTap JSON with starter text describing location and atmosphere */,
  },
  encounter: {
    id: "encounter",
    label: "Encounter",
    badgeColor: "#c4956a", // Warm amber -- tension/action
    defaultTitle: "A Confrontation",
    defaultNarration: /* TipTap JSON with starter text about tension and NPCs */,
  },
  discovery: {
    id: "discovery",
    label: "Discovery",
    badgeColor: "#a3c48e", // Green -- revelation/knowledge
    defaultTitle: "What Lies Hidden",
    defaultNarration: /* TipTap JSON with starter text about finding something */,
  },
};
```

### DM Notes Collapsible Section

```typescript
// Source: Decision D-09, D-10
function DmNotesSection({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [expanded, setExpanded] = useState(!!value);

  return (
    <div className="rounded-lg border border-amber-900/30 bg-amber-950/20">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-amber-200/80"
      >
        {/* Eye icon SVG */}
        <span className="font-display text-xs uppercase tracking-wide">DM Only</span>
        <span className="ml-auto text-2xs">{expanded ? "Collapse" : "Expand"}</span>
      </button>
      {expanded && (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Private notes for the DM..."
          className="w-full border-t border-amber-900/30 bg-transparent px-3 py-2 text-sm text-text-secondary placeholder:text-text-muted/40 focus:outline-none"
          rows={3}
        />
      )}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-beautiful-dnd | @dnd-kit (modular) | 2023 | react-beautiful-dnd deprecated by Atlassian; dnd-kit is the community standard [ASSUMED] |
| TipTap 2.x | TipTap 3.x | 2025 | Project already uses TipTap 3.21+ with new extension architecture [VERIFIED: package.json] |
| @dnd-kit/react (v0.x) | @dnd-kit/core + sortable (v6/v10) | 2024 | Experimental rewrite exists at v0.3 but too early for production; stable v6 core is correct choice [ASSUMED] |

**Deprecated/outdated:**
- `react-beautiful-dnd`: Deprecated by Atlassian. Fork `@hello-pangea/dnd` is maintained but dnd-kit is preferred for new projects. [ASSUMED]
- `react-sortable-hoc`: Deprecated, superseded by dnd-kit. [ASSUMED]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | @hello-pangea/dnd is heavier and more opinionated than dnd-kit for flat lists | Alternatives Considered | Low -- decision to use dnd-kit is locked in CLAUDE.md Technology Stack |
| A2 | Horizontal constraint is naturally enforced by the list layout without needing @dnd-kit/modifiers | Alternatives Considered | Low -- if drag moves vertically, add `restrictToHorizontalAxis` modifier from @dnd-kit/modifiers@9.0.0 |
| A3 | Context menu should be reusable for future phases | Architecture Patterns | Low -- worst case it's refactored later, but Phase 9 will likely need entity context menus |
| A4 | react-beautiful-dnd is deprecated | State of the Art | Low -- even if maintained, project already committed to dnd-kit |

## Open Questions

1. **Template badge colors**
   - What we know: Three templates need colored badges. Existing template colors are defined in `index.css` for lore article types.
   - What's unclear: Whether to reuse existing template colors (e.g., `--color-template-location` for Establishing Shot) or define new ones.
   - Recommendation: Define distinct badge colors in the `sceneTemplates.ts` preset file (not CSS custom properties). Scene template badges are small inline elements, not tree view dots.

2. **Cover image placement (Claude's discretion)**
   - What we know: D-04 leaves this to Claude's discretion. Current implementation puts it as a full section between header and scene list.
   - What's unclear: Whether it consumes too much vertical space for the timeline-focused layout.
   - Recommendation: Move cover image to a collapsible "Story Settings" section above the timeline. Collapsed by default when a cover image exists (thumbnail shown inline in the header). This maximizes vertical space for the timeline + scene detail editor.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| bun | Package installation | Needs check | -- | npm install works as fallback |
| Node.js | Build tooling | Available | (Tauri dev environment) | -- |
| @dnd-kit/core | Timeline drag-and-drop | Not yet installed | -- | Install with bun/npm |
| @dnd-kit/sortable | Sortable scene list | Not yet installed | -- | Install with bun/npm |
| @dnd-kit/utilities | CSS transform helper | Not yet installed | -- | Install with bun/npm |

**Missing dependencies with no fallback:**
- @dnd-kit packages must be installed (Wave 0 task)

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `creator/vitest.config.ts` |
| Quick run command | `cd creator && bun run test` |
| Full suite command | `cd creator && bun run test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STORY-02 | addScene creates scene in store with undo | unit | `cd creator && bunx vitest run src/stores/__tests__/storyStore.test.ts -t "addScene"` | Partial (store file exists, needs new tests) |
| STORY-02 | removeScene removes and renumbers sortOrder | unit | `cd creator && bunx vitest run src/stores/__tests__/storyStore.test.ts -t "removeScene"` | Partial |
| STORY-02 | reorderScenes updates sortOrder correctly | unit | `cd creator && bunx vitest run src/stores/__tests__/storyStore.test.ts -t "reorderScenes"` | Partial |
| STORY-02 | arrayMove integration with dnd-kit | unit | `cd creator && bunx vitest run src/stores/__tests__/storyStore.test.ts -t "reorder"` | No |
| STORY-03 | updateScene with narration field persists TipTap JSON | unit | `cd creator && bunx vitest run src/stores/__tests__/storyStore.test.ts -t "updateScene"` | Partial |
| STORY-04 | updateScene with dmNotes field | unit | `cd creator && bunx vitest run src/stores/__tests__/storyStore.test.ts -t "dmNotes"` | No |
| STORY-07 | Template preset definitions are complete | unit | `cd creator && bunx vitest run src/lib/__tests__/sceneTemplates.test.ts` | No |
| STORY-07 | Template application updates title + narration + template field | unit | `cd creator && bunx vitest run src/stores/__tests__/storyStore.test.ts -t "template"` | No |

### Sampling Rate

- **Per task commit:** `cd creator && bun run test`
- **Per wave merge:** `cd creator && bun run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `creator/src/stores/__tests__/storyStore.test.ts` -- extend existing file with addScene, removeScene, reorderScenes, updateScene, activeSceneId tests
- [ ] `creator/src/lib/__tests__/sceneTemplates.test.ts` -- covers STORY-07 (template preset definitions, content validation)
- [ ] Install @dnd-kit packages: `cd creator && bun add @dnd-kit/core@^6.3 @dnd-kit/sortable@^10.0 @dnd-kit/utilities@^3.2`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A -- local desktop app |
| V3 Session Management | No | N/A -- local desktop app |
| V4 Access Control | No | N/A -- single user |
| V5 Input Validation | Yes | Scene IDs validated against `STORY_ID_PATTERN` regex (existing). Scene titles and narration are user content stored locally. Template names are enum values. |
| V6 Cryptography | No | N/A -- no encryption needed |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via TipTap content | Tampering | TipTap sanitizes HTML internally; content stored as JSON, not raw HTML. LoreEditor already handles this. [VERIFIED: LoreEditor.tsx] |
| Path traversal via scene ID | Tampering | Scene IDs are generated internally (not user-input), and stories are saved as a single JSON file per story (not per scene). The `STORY_ID_PATTERN` regex (`/^[a-z0-9_]+$/`) prevents path traversal. [VERIFIED: storyPersistence.ts] |

## Sources

### Primary (HIGH confidence)
- `creator/src/stores/storyStore.ts` -- existing store pattern, snapshotStory undo, 110 lines
- `creator/src/types/story.ts` -- Scene, Story, SceneTemplate types already defined
- `creator/src/components/lore/StoryEditorPanel.tsx` -- current Phase 7 output, 264 lines to modify
- `creator/src/components/lore/LoreEditor.tsx` -- TipTap wrapper for narration reuse, 387 lines
- `creator/src/lib/storyPersistence.ts` -- story load/save, no changes needed
- `creator/src/components/ConfirmDialog.tsx` -- template replacement confirmation dialog
- npm registry -- @dnd-kit/core@6.3.1, @dnd-kit/sortable@10.0.0, @dnd-kit/utilities@3.2.2 versions verified
- [dndkit.com/presets/sortable](https://dndkit.com/presets/sortable) -- SortableContext, useSortable, horizontalListSortingStrategy API docs
- [dndkit.com/presets/sortable/sortable-context](https://dndkit.com/presets/sortable/sortable-context) -- SortableContext props and strategy options

### Secondary (MEDIUM confidence)
- `.planning/phases/07-story-foundation/07-UI-SPEC.md` -- Phase 7 UI contract (spacing scale, typography, component patterns)
- `ARCANUM_STYLE_GUIDE.md` -- design system tokens and philosophy
- `creator/src/index.css` -- CSS custom properties, template colors, component styles

### Tertiary (LOW confidence)
- None -- all claims verified against codebase or npm registry

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- dnd-kit versions verified on npm, peer deps compatible, project CLAUDE.md already recommends this exact stack
- Architecture: HIGH -- all patterns derive from existing codebase conventions (storyStore, LoreEditor, ConfirmDialog)
- Pitfalls: HIGH -- identified from code review of actual component implementations and known dnd-kit interaction patterns

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable -- no fast-moving dependencies)
