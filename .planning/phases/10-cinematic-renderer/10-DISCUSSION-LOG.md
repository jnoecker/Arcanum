# Phase 10: Cinematic Renderer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 10-Cinematic Renderer
**Areas discussed:** Movement path authoring, Narration reveal style, Scene transitions, Renderer architecture

---

## Movement Path Authoring

| Option | Description | Selected |
|--------|-------------|----------|
| Preset path library | Choose from named presets (Enter from left, Exit stage right, etc.). Each preset is a pre-built SVG path. Simple, fast, consistent. | ✓ |
| Click waypoints on preview | Builder clicks 3-5 points on preview to define a bezier path. More expressive but significantly more complex. | |
| Both: presets + custom | Preset library with 'Custom...' option opening a waypoint editor. | |

**User's choice:** Preset path library
**Notes:** None — clean selection.

### Follow-up: Path model

| Option | Description | Selected |
|--------|-------------|----------|
| Separate entrance + exit | Each entity gets optional entrance path and optional exit path. Entrance plays on scene start, exit plays before transition. | ✓ |
| Single path per entity | One movement path that plays start-to-finish. Simpler but less cinematic. | |

**User's choice:** Separate entrance + exit
**Notes:** Maps naturally to "enter from left, exit stage right" mental model.

---

## Narration Reveal Style

| Option | Description | Selected |
|--------|-------------|----------|
| Word-by-word reveal | Text appears one word at a time with fade-in. ~150ms per word, ~80ms gap. Like subtitle reveal in a film trailer. | ✓ |
| Character-by-character | Classic typewriter — each letter appears one at a time. More dramatic but slower and can feel dated. | |
| Line-by-line reveal | Entire lines fade in sequentially. Fastest to read, less dramatic. | |

**User's choice:** Word-by-word reveal
**Notes:** None — clean selection.

### Follow-up: Speed configurability

| Option | Description | Selected |
|--------|-------------|----------|
| Global default, per-scene override | Story-level default speed with individual scene overrides to slow/fast. | ✓ |
| Fixed speed | Single well-tuned speed for all narration. | |
| You decide | Claude picks during implementation. | |

**User's choice:** Global default, per-scene override
**Notes:** None.

---

## Scene Transitions

| Option | Description | Selected |
|--------|-------------|----------|
| Crossfade + fade-to-black | Two options: smooth crossfade (overlap ~500ms) and fade-to-black (out ~300ms, hold ~200ms, in ~300ms). | ✓ |
| Crossfade only | One transition type, one duration. Minimal. | |
| Full set (crossfade, fade-black, slide, cut) | Four options. More expressive but more UI and edge cases. | |

**User's choice:** Crossfade + fade-to-black
**Notes:** None — clean selection.

### Follow-up: Transition UI placement

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown in scene detail editor | Small 'Transition' dropdown next to template picker. Default crossfade. | ✓ |
| On the scene card in timeline | Transition indicator between cards. Clicking opens mini picker. | |
| You decide | Claude picks during implementation. | |

**User's choice:** Dropdown in scene detail editor
**Notes:** None.

---

## Renderer Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| CinematicRenderer wraps ScenePreview | ScenePreview stays as static layout engine. CinematicRenderer adds animation orchestration on top. Editor uses ScenePreview, playback uses CinematicRenderer. | ✓ |
| Replace ScenePreview entirely | Single component with 'mode' prop (edit vs playback). Fewer components but larger file. | |
| Parallel components | Keep ScenePreview for editing, build CinematicRenderer from scratch. No shared code, risks visual drift. | |

**User's choice:** CinematicRenderer wraps ScenePreview
**Notes:** None — clean selection.

### Follow-up: Editor preview playback

| Option | Description | Selected |
|--------|-------------|----------|
| Preview button in editor | Play button in scene detail editor that plays current scene's animations inline. Lets builders iterate on timing. | ✓ |
| Playback only in presentation | Editor stays static. Must enter presentation mode to see animations. | |
| Full story preview in editor | Play through entire story with transitions from editor. Most feature-rich but blurs editor/presentation boundary. | |

**User's choice:** Preview button in editor
**Notes:** None.

---

## Claude's Discretion

- Exact preset path SVG coordinates and naming
- Movement path animation duration and easing curves
- Motion LazyMotion / domAnimation setup and tree-shaking
- Preview playback button placement and design
- TypeWriter component implementation approach
- Entity exit animation timing relative to scene transition start
- CinematicRenderer internal scene sequencing state management

## Deferred Ideas

- Custom waypoint path editor — future enhancement
- Configurable transition duration per scene — future enhancement
- Particle effects (FX-02) — future requirement, not Phase 10
- Parallax layers (FX-01) — future requirement, not Phase 10
- Audio cues (FX-03) — future requirement, not Phase 10
