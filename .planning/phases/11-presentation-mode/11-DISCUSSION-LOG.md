# Phase 11: Presentation Mode - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 11-presentation-mode
**Areas discussed:** Entry & exit flow, DM notes in presentation, HUD & on-screen controls, Scene replay behavior

---

## Entry & Exit Flow

### How should builders enter presentation mode?

| Option | Description | Selected |
|--------|-------------|----------|
| F5 shortcut + toolbar button | F5 toggles presentation (like PowerPoint). Also add a "Present" button in StoryEditorPanel header next to undo/redo. Familiar and discoverable. | ✓ |
| Toolbar button only | Dedicated "Present" button, no keyboard shortcut to enter. | |
| F5 shortcut only | No visible button — power-user shortcut only. | |

**User's choice:** F5 shortcut + toolbar button
**Notes:** None

### When exiting presentation, where should the builder land?

| Option | Description | Selected |
|--------|-------------|----------|
| Return to the scene that was playing | Editor opens with the scene you were on when you exited. Quick edit and re-present from same spot. | ✓ |
| Return to original scene | Editor opens on whichever scene was selected before entering. | |
| Return to first scene | Always reset to scene 1. | |

**User's choice:** Return to the scene that was playing
**Notes:** None

### Should presentation start from current scene or beginning?

| Option | Description | Selected |
|--------|-------------|----------|
| Current scene | Starts from whichever scene is active in the editor. | ✓ |
| Always from scene 1 | Always starts from the beginning. | |

**User's choice:** Current scene
**Notes:** None

---

## DM Notes in Presentation

### How should DM speaker notes appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle overlay at bottom | Press D or N to toggle a semi-transparent notes panel at the bottom. Hidden by default. | ✓ |
| Always visible in a small strip | Persistent narrow strip at the bottom showing DM notes. | |
| Hidden until Phase FX-04 | No DM notes in presentation at all. | |

**User's choice:** Toggle overlay at bottom
**Notes:** None

### Visual treatment for notes?

| Option | Description | Selected |
|--------|-------------|----------|
| Dark translucent bar | Semi-transparent dark bar at very bottom, below narration area. Smaller text, distinct from narration. | ✓ |
| Side panel overlay | Narrow panel on the right edge of the screen. | |
| You decide | Let Claude pick. | |

**User's choice:** Dark translucent bar
**Notes:** None

---

## HUD & On-Screen Controls

### What should be visible during presentation?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal auto-hiding HUD | Scene counter ("3 / 8") in corner. Fades out after 2-3s of no input, reappears on keypress/mouse move. No progress bar, no buttons. | ✓ |
| Always-visible scene counter | Persistent small scene counter in top-right. Never hides. | |
| Completely clean | Nothing on screen except cinematic content. | |

**User's choice:** Minimal auto-hiding HUD
**Notes:** None

### Should mouse clicks advance scenes?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, click to advance | Left click advances, right click goes back. Like PowerPoint/Keynote. Works with presentation clickers. | ✓ |
| No, keyboard only | Mouse does nothing during presentation. | |

**User's choice:** Yes, click to advance
**Notes:** None

---

## Scene Replay Behavior

### When navigating back to a previous scene?

| Option | Description | Selected |
|--------|-------------|----------|
| Show final state, no replay | Going back shows scene with all entities in final positions and narration fully revealed. Fast scrubbing. | ✓ |
| Replay entrance animations | Going back replays from the start — entity entrances, typewriter narration. | |
| You decide | Let Claude pick. | |

**User's choice:** Show final state, no replay
**Notes:** None

### When advancing forward to an already-visited scene?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, always replay animations | Moving forward always plays entrance animations and typewriter narration. Consistent cinematic experience. | ✓ |
| Skip animations for visited scenes | Already-seen scenes show final state instantly. | |

**User's choice:** Yes, always replay animations
**Notes:** None

---

## Claude's Discretion

- HUD fade animation timing and easing
- DM notes bar height, opacity, font size
- "Present" button icon and styling
- Edge case handling (past last scene, before first scene)
- Scene counter format
- Cursor hiding during presentation
- Fullscreen transition effect

## Deferred Ideas

- DM speaker notes on separate monitor/window — FX-04 future requirement
