# Phase 9: Scene Composition - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 09-scene-composition
**Areas discussed:** Entity Picker UX, Scene Preview Layout, Entity Positioning, Visual Layering & Aspect Ratio

---

## Entity Picker UX

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar panel with tabs | Collapsible sidebar with Rooms/Mobs/Items tabs, searchable filter, thumbnails | ✓ |
| Modal picker dialog | Full-screen modal with three-column entity browser | |
| Inline dropdowns per section | Room dropdown + entity add button with popover | |

**User's choice:** Sidebar panel with tabs

| Option | Description | Selected |
|--------|-------------|----------|
| Click room = set bg, click entity = add | Direct click interaction, immediate feedback | ✓ |
| Drag from picker to preview | Spatial drag-and-drop between panels | |
| You decide | Claude picks | |

**User's choice:** Click room = set background, click entity = add to scene

| Option | Description | Selected |
|--------|-------------|----------|
| Small thumbnails + name | 32px thumbnail + entity name per row | ✓ |
| Name only (text list) | Just names, no thumbnails | |
| You decide | Claude picks | |

**User's choice:** Small thumbnails + name

---

## Scene Preview Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Inline above narration | Preview inside detail editor between template picker and narration | ✓ |
| Fixed top panel | Non-scrolling fixed preview at top of detail area | |
| Separate preview tab | Edit/Preview tab switcher above detail area | |

**User's choice:** Inline above narration

| Option | Description | Selected |
|--------|-------------|----------|
| Placeholder with room picker prompt | Dark placeholder with dashed border and prompt text | ✓ |
| Hide preview entirely | Don't render until room assigned | |
| You decide | Claude picks | |

**User's choice:** Placeholder with room picker prompt

---

## Entity Positioning

| Option | Description | Selected |
|--------|-------------|----------|
| Preset slots + drag override | 6 preset positions + drag to custom coordinates | ✓ |
| Free drag only | Every entity starts center, must drag manually | |
| Preset slots only | Snap to predefined slots, no custom positioning | |

**User's choice:** Preset slots + drag override

| Option | Description | Selected |
|--------|-------------|----------|
| Scaled thumbnails with label | 64-80px sprites, back-row smaller for depth, name labels | ✓ |
| Full-size images | Original aspect ratio, max-size constraint | |
| You decide | Claude picks | |

**User's choice:** Scaled thumbnails with label

---

## Visual Layering & Aspect Ratio

| Option | Description | Selected |
|--------|-------------|----------|
| 16:9 cinematic | Widescreen, matches presentation and showcase | ✓ |
| Match room image ratio | Adapts to source image ratio | |
| 4:3 classic | Traditional display ratio | |

**User's choice:** 16:9 cinematic

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom overlay with gradient | Dark gradient + white text at bottom, 2-3 lines | ✓ |
| No narration in preview | Visual only, narration stays in editor | |
| You decide | Claude picks | |

**User's choice:** Bottom overlay with gradient

| Option | Description | Selected |
|--------|-------------|----------|
| Cover (fill + crop) | object-fit: cover, no empty space | ✓ |
| Contain (fit + letterbox) | No crop, dark bars on sides | |
| You decide | Claude picks | |

**User's choice:** Cover (fill + crop)

---

## Claude's Discretion

- Entity picker sidebar width and collapse behavior
- Exact preset slot positions within the 16:9 frame
- Entity drag handle affordance
- Entity removal interaction (X button, delete key, or both)
- Depth scaling factor for back-row entities
- Preview container height
- Entity name label styling
- Search/filter implementation

## Deferred Ideas

None — discussion stayed within phase scope.
