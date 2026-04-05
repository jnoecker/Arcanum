# Phase 8: Story Editor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 08-story-editor
**Areas discussed:** Editor Layout, Scene Card Design, Narration & DM Notes, Template Behavior

---

## Editor Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Top-bottom split | Horizontal timeline strip across top, scene detail editor below. Video editor style. | ✓ |
| Side-by-side split | Vertical timeline on left, scene detail on right. Slide deck editor style. | |
| Collapsible timeline | Thin bar with scene dots, expands on hover. Maximizes edit space. | |

**User's choice:** Top-bottom split
**Notes:** Natural reading order — overview on top, detail below.

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal scroll | Single row with overflow-x scroll. Arrow indicators at edges. | ✓ |
| Wrap to rows | Cards flow to new rows. Timeline height grows with scene count. | |
| You decide | Claude picks. | |

**User's choice:** Horizontal scroll

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-select first scene | Always have a scene selected. Opening selects scene 1. | ✓ |
| Empty state prompt | Show "Select a scene to edit" when nothing selected. | |
| You decide | Claude picks. | |

**User's choice:** Auto-select first scene

| Option | Description | Selected |
|--------|-------------|----------|
| Move to metadata section | Cover image/timestamps in collapsible settings. Lean header. | |
| Keep above timeline | Current layout preserved. Cover always visible. | |
| You decide | Claude picks. | ✓ |

**User's choice:** You decide

---

## Scene Card Design

| Option | Description | Selected |
|--------|-------------|----------|
| Index + Title + Template badge | Scene number, title, colored template badge. Compact, informative. | ✓ |
| Thumbnail + Title | Room background as thumbnail + title below. Visual but mostly placeholders now. | |
| Minimal index only | Just scene number. Extremely compact. | |

**User's choice:** Index + Title + Template badge

| Option | Description | Selected |
|--------|-------------|----------|
| Accent border + elevated bg | Gold border and lighter background on selected card. Matches existing patterns. | ✓ |
| Glow effect | Subtle gold glow/shadow. More dramatic. | |
| You decide | Claude picks. | |

**User's choice:** Accent border + elevated bg

| Option | Description | Selected |
|--------|-------------|----------|
| Right-click context menu | Delete, Duplicate, Apply Template in context menu. Clean cards. | ✓ |
| Hover X button | Small X appears on hover. More discoverable but visual noise. | |
| You decide | Claude picks. | |

**User's choice:** Right-click context menu

---

## Narration & DM Notes

| Option | Description | Selected |
|--------|-------------|----------|
| Lighter TipTap | Basic formatting only. No mentions, no AI. Simpler. | |
| Reuse full LoreEditor | All features: mentions, links, AI enhance/generate. Consistent experience. | ✓ |
| Plain textarea | No rich text. Simplest but loses formatting. | |

**User's choice:** Reuse full LoreEditor

| Option | Description | Selected |
|--------|-------------|----------|
| Collapsible section with distinct bg | Warm amber/parchment tint. Eye icon. Collapsed if empty. | ✓ |
| Side-by-side tabs | Switch between Narration and DM Notes tabs. | |
| Inline with visual divider | Both always visible with dashed border. | |

**User's choice:** Collapsible section with distinct bg

| Option | Description | Selected |
|--------|-------------|----------|
| Plain textarea | Quick jottings. No formatting needed. | ✓ |
| TipTap rich text | Same editor as narration. Consistent but overkill. | |
| You decide | Claude picks. | |

**User's choice:** Plain textarea

---

## Template Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Title + starter narration | Default title and placeholder narration text per template. | ✓ |
| Template tag only | Just sets the template field. No content pre-populated. | |
| Full preset with effects hints | Title, narration, AND suggested transition/effect values. | |

**User's choice:** Title + starter narration

| Option | Description | Selected |
|--------|-------------|----------|
| Template picker in scene detail | Dropdown or button group. Available via context menu too. Can change anytime. | ✓ |
| Choose during scene creation only | Dialog asks for template at creation. Can't change after. | |
| You decide | Claude picks. | |

**User's choice:** Template picker in scene detail

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm before overwrite | Prompt if scene has content. Empty scenes apply silently. | ✓ |
| Always overwrite silently | Replace immediately. User can undo. | |
| You decide | Claude picks. | |

**User's choice:** Confirm before overwrite

---

## Claude's Discretion

- Cover image section placement (above timeline or in collapsible settings)
- Exact card dimensions and spacing
- "Add scene" button design
- Scene detail editor section ordering
- dnd-kit configuration details
- Scene ID generation scheme
- Scroll indicators for timeline overflow
- Starter narration text content for templates

## Deferred Ideas

None — discussion stayed within phase scope.
