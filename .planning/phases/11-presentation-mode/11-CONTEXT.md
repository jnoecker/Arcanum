# Phase 11: Presentation Mode - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Fullscreen DM presentation mode with keyboard-driven navigation for zone stories. Builders can enter presentation from the story editor, advance/retreat through scenes with keyboard and mouse, and exit back to the editor. The CinematicRenderer (Phase 10) provides all animation and transition logic — this phase wraps it in a fullscreen shell with navigation controls, HUD, and DM notes overlay. Showcase player embedding is Phase 12.

</domain>

<decisions>
## Implementation Decisions

### Entry & Exit Flow
- **D-01:** F5 keyboard shortcut toggles presentation mode (like PowerPoint). Also a visible "Present" button in the StoryEditorPanel header bar next to the undo/redo controls.
- **D-02:** Presentation starts from whichever scene is currently active in the editor. Builders can preview from any point in the story.
- **D-03:** Exiting presentation (Escape) returns to the editor with the scene that was playing selected as the active scene. Editor state updates to match where the DM left off.
- **D-04:** Fullscreen via Tauri Rust window API (`set_fullscreen`), not web Fullscreen API — WebView2 on Windows intercepts Escape before it reaches JavaScript in web fullscreen mode.

### DM Notes Visibility
- **D-05:** DM speaker notes are toggled with a keyboard shortcut (D or N key) during presentation. Hidden by default so the audience doesn't see them.
- **D-06:** Notes appear as a dark semi-transparent bar at the very bottom of the screen, below the narration area. Smaller text, visually distinct from narration. Subtle enough not to compete with the cinematic scene.
- **D-07:** If a scene has no DM notes, the toggle does nothing (no empty bar shown).

### HUD & On-Screen Controls
- **D-08:** Minimal auto-hiding HUD — scene counter ("3 / 8") in the top-right corner. Fades out after ~3 seconds of inactivity, reappears on any keypress or mouse movement.
- **D-09:** No progress bar, no visible navigation buttons. Presentation is keyboard and mouse driven.
- **D-10:** Mouse clicks advance scenes — left click advances, right click goes back. Works with presentation clickers.
- **D-11:** Keyboard controls: Right arrow / Space / Enter = advance, Left arrow = go back, Escape = exit presentation, F5 = exit presentation. D or N = toggle DM notes.

### Scene Replay Behavior
- **D-12:** Going back to a previous scene shows it in its final state — entities in final positions, narration fully revealed. No animation replay. Fast scrubbing for the DM.
- **D-13:** Advancing forward always replays entrance animations and typewriter narration, even for previously visited scenes. Consistent cinematic experience for the audience.

### Claude's Discretion
- HUD fade animation timing and easing
- Exact DM notes bar height, opacity level, and font size
- "Present" button icon and styling in StoryEditorPanel header
- How to handle edge cases (advance past last scene, go back before first scene)
- Whether scene counter uses "3 / 8" or "3 of 8" format
- Cursor hiding behavior during presentation (auto-hide after inactivity)
- Transition between non-fullscreen and fullscreen (instant vs fade)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Cinematic renderer (Phase 10 outputs)
- `creator/src/components/lore/CinematicRenderer.tsx` — Portable renderer wrapping ScenePreview with AnimatePresence transitions. Props: scenes[], currentIndex, playing, onComplete, onSceneChange, narrationSpeed, resolvedSceneData.
- `creator/src/components/lore/CinematicScene.tsx` — Individual scene animation (entrance paths, typewriter narration, transition effects)
- `creator/src/components/lore/AnimatedEntity.tsx` — Entity entrance/exit path animation
- `creator/src/components/lore/TypewriterNarration.tsx` — Word-by-word narration reveal

### Scene preview (Phase 9 outputs)
- `creator/src/components/lore/ScenePreview.tsx` — Static scene layout engine (layers, entities, narration, drag). CinematicRenderer wraps this.
- `creator/src/components/lore/PreviewPlayback.tsx` — Existing play/stop toggle button pattern — reference for presentation trigger button design.

### Story editor (integration point)
- `creator/src/components/lore/StoryEditorPanel.tsx` — "Present" button integrates into the header bar. Presentation starts from activeSceneId.
- `creator/src/stores/storyStore.ts` — Story data, activeSceneId, scene operations

### Story data model
- `creator/src/types/story.ts` — Story, Scene, SceneEntity, TransitionConfig, NarrationSpeed interfaces
- `creator/src/lib/narrationSpeed.ts` — Narration speed configuration

### Image loading
- `creator/src/lib/useImageSrc.ts` — Image loading hook for room backgrounds and entity sprites (needed for resolvedSceneData)

### Tauri window API
- Tauri 2 window plugin — `set_fullscreen(true/false)` on the current window. Needs `tauri-plugin-window-state` already in dependencies.

### Requirements
- `.planning/REQUIREMENTS.md` — PRES-01 (enter fullscreen DM presentation mode), PRES-02 (keyboard navigation: arrows, space, escape/F5)

### Prior phase context
- `.planning/phases/10-cinematic-renderer/10-CONTEXT.md` — Renderer architecture, transition types, movement presets, narration speed
- `.planning/phases/09-scene-composition/09-CONTEXT.md` — 16:9 aspect ratio, entity positioning, layer ordering
- `.planning/phases/08-story-editor/08-CONTEXT.md` — Scene detail editor layout, DM notes field

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CinematicRenderer.tsx`: Complete animation orchestration engine — presentation mode wraps this in a fullscreen container and drives `currentIndex` / `playing` props via keyboard navigation.
- `PreviewPlayback.tsx`: Play/stop toggle button pattern — reference for "Present" button design in StoryEditorPanel header.
- `useImageSrc.ts`: Image loading hook for resolving room backgrounds and entity sprites into data URLs for CinematicRenderer's `resolvedSceneData`.
- `storyStore.ts`: Story state with `activeSceneId` — presentation reads initial scene from here, writes back on exit.

### Established Patterns
- 16:9 aspect ratio (`aspect-video`) for all scene rendering — presentation scales this to fill screen.
- LazyMotion + AnimatePresence for scene transitions — already set up in CinematicRenderer.
- Tauri `invoke()` for Rust commands — fullscreen toggle will use this pattern.
- `window.addEventListener("keydown")` for global shortcuts — AppShell and MapViewer both use this pattern.

### Integration Points
- `StoryEditorPanel.tsx` header bar — add "Present" button next to undo/redo.
- `AppShell.tsx` keyboard handler — F5 shortcut needs to be registered at the app level or in a presentation-mode-specific handler.
- `storyStore.activeSceneId` — presentation reads on enter, writes on exit.
- New `PresentationMode.tsx` component — fullscreen wrapper around CinematicRenderer with keyboard navigation, HUD, and DM notes overlay.

</code_context>

<specifics>
## Specific Ideas

- Entry/exit should feel like PowerPoint/Keynote — F5 to present, Escape to exit. Familiar muscle memory for anyone who's done presentations.
- DM notes toggle is for the DM's eyes only — hidden by default, quick peek with a keypress.
- Going back should be instant (final state) so the DM can quickly reference earlier scenes during table talk. Going forward should always be cinematic for the audience.

</specifics>

<deferred>
## Deferred Ideas

- DM speaker notes on a separate monitor/window (FX-04 in future requirements) — Phase 11 handles basic toggle overlay only.
- Presentation clicker/remote device support beyond standard mouse clicks — if clickers send keyboard events, they'll work automatically.
- Cursor auto-hide behavior — listed as Claude's Discretion.

</deferred>

---

*Phase: 11-presentation-mode*
*Context gathered: 2026-04-05*
