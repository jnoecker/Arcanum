# Phase 10: Cinematic Renderer - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Portable rendering engine that plays scenes with crossfade transitions, entity movement paths, and animated typewriter narration. The renderer works identically in the editor preview, presentation mode (Phase 11), and showcase player (Phase 12) — a single component with no Tauri dependencies. Scene composition (entity picking, room backgrounds, positioning) was Phase 9; this phase adds animation and playback.

</domain>

<decisions>
## Implementation Decisions

### Movement Path Authoring
- **D-01:** Preset path library — builders choose from named movement presets (e.g., "Enter from left", "Enter from right", "Enter from bottom", "Rise from shadows", "Exit stage left", "Exit stage right", "Fade in place"). Each preset is a pre-built SVG path string stored in the `movementPath` field.
- **D-02:** Separate entrance and exit paths per entity. Each `SceneEntity` gets an optional `entrancePath` and optional `exitPath`. Entrance plays when the scene starts, exit plays before transitioning to the next scene.
- **D-03:** No custom waypoint editor in this phase — presets only. Custom path authoring can be added later if builders need more control.

### Narration Reveal Style
- **D-04:** Word-by-word reveal animation — each word fades in sequentially (~150ms per word, ~80ms gap). Think subtitle reveal in a film trailer, not classic character-by-character typewriter.
- **D-05:** Narration speed is configurable: story-level default speed (normal), with per-scene override to slow or fast for dramatic pacing.
- **D-06:** Narration renders in the existing bottom gradient overlay (from Phase 9's ScenePreview), but words animate in during playback mode instead of appearing statically.

### Scene Transitions
- **D-07:** Two transition types available: crossfade (scene A blends into scene B, ~500ms overlap) and fade-to-black (A fades out ~300ms, black hold ~200ms, B fades in ~300ms).
- **D-08:** Default transition is crossfade. Builder can change per-scene via dropdown in the scene detail editor, next to the template picker.
- **D-09:** Transition duration uses sensible defaults (not user-configurable in this phase). Can add duration control later.

### Renderer Architecture
- **D-10:** CinematicRenderer wraps ScenePreview — ScenePreview remains the static scene layout engine (layers, entities, narration, drag interaction). CinematicRenderer adds animation orchestration on top: scene transitions, movement path playback, typewriter narration.
- **D-11:** Editor uses ScenePreview directly (static + drag for entity positioning). Presentation mode and showcase player use CinematicRenderer. Props: `scenes[]`, `playing`, `onComplete`, `onSceneChange`.
- **D-12:** Editor includes a "Preview playback" button that plays the current scene's animations (entity entrance, narration reveal) inline without advancing to the next scene. Lets builders iterate on timing without entering full presentation mode.

### Claude's Discretion
- Exact preset path SVG coordinates and naming
- Movement path animation duration and easing curves
- How CinematicRenderer manages scene sequencing state internally
- Motion `LazyMotion` / `domAnimation` setup and tree-shaking
- Preview playback button placement and design in the scene detail editor
- TypeWriter component implementation details (Motion `variants` + `staggerChildren` vs `useAnimate`)
- Entity exit animation timing relative to scene transition start

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Story data model (Phase 7 outputs)
- `creator/src/types/story.ts` — SceneEntity (movementPath field), TransitionConfig, EffectConfig placeholders to be filled out, Scene interface
- `creator/src/stores/storyStore.ts` — updateScene operation for setting transition, entity paths

### Scene preview (Phase 9 outputs)
- `creator/src/components/lore/ScenePreview.tsx` — Current static renderer with layered rendering (bg → entities → narration). CinematicRenderer wraps this.
- `creator/src/components/lore/EntityOverlay.tsx` — Entity rendering with drag repositioning. Movement paths animate these overlays.
- `creator/src/lib/sceneLayout.ts` — Layout utilities (isBackRow, extractPlainText, slot positions)

### Scene editor (Phase 8 outputs)
- `creator/src/components/lore/SceneDetailEditor.tsx` — Scene detail panel where transition dropdown and preview playback button will be added

### Animation library (decided in CLAUDE.md)
- `CLAUDE.md` §Technology Stack — Motion v12.37 configuration, LazyMotion/domAnimation, useAnimate, AnimatePresence, offset-path animation, useAnimationFrame

### Requirements
- `.planning/REQUIREMENTS.md` — SCENE-06 (entrance/exit movement paths), SCENE-07 (typewriter narration), PRES-03 (crossfade transitions)

### Prior phase context
- `.planning/phases/07-story-foundation/07-CONTEXT.md` — Foundation decisions, data model shape
- `.planning/phases/08-story-editor/08-CONTEXT.md` — Editor layout, scene detail structure
- `.planning/phases/09-scene-composition/09-CONTEXT.md` — Entity positioning, 16:9 aspect ratio, layer ordering

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ScenePreview.tsx` — Full layered scene renderer (bg, back-row entities, front-row entities, narration overlay). CinematicRenderer wraps this for playback.
- `EntityOverlay.tsx` — Entity sprite rendering with drag support. Movement paths animate entity positions.
- `useImageSrc.ts` — Image loading hook for room backgrounds and entity sprites.
- `sceneLayout.ts` — Slot position mapping, back-row detection, plain text extraction from TipTap JSON.

### Established Patterns
- 16:9 aspect ratio container (`aspect-video`) for all scene rendering — established in Phase 9.
- Layered z-index rendering: bg (base) → back-row (z-10) → front-row (z-20) → narration (z-30).
- Entity positioning via percentage coordinates (0-100 x/y) or preset slots.
- Bottom gradient narration overlay: `bg-gradient-to-t from-black/60 to-transparent` with Crimson Pro white text.

### Integration Points
- `SceneDetailEditor.tsx` — Transition dropdown and preview playback button integrate here.
- `StoryEditorPanel.tsx` — Parent layout; CinematicRenderer used when entering playback from editor.
- `story.ts` types — `TransitionConfig` and `EffectConfig` need to be updated from placeholders to full interfaces. `SceneEntity` needs `entrancePath`/`exitPath` fields (replacing single `movementPath`).
- Motion library — Not yet installed. Phase 10 will add `motion` as a dependency per CLAUDE.md tech stack decision.

</code_context>

<specifics>
## Specific Ideas

- Movement paths should feel like stage directions — "Enter from left", "Exit stage right" — not technical SVG editing.
- Narration word reveal should feel like a film trailer subtitle, not a terminal cursor.
- The preview playback button lets builders iterate on animation timing without the ceremony of entering presentation mode.

</specifics>

<deferred>
## Deferred Ideas

- Custom waypoint path editor (click-to-draw paths on preview) — future enhancement if presets aren't expressive enough.
- Configurable transition duration per scene — keep defaults for now, add sliders later if needed.
- Particle effects (sparks, mist, embers) — listed in FX-02 future requirements, not in Phase 10 scope.
- Parallax background layers — listed in FX-01 future requirements, not in Phase 10 scope.
- Audio cues per scene — listed in FX-03 future requirements, not in Phase 10 scope.

</deferred>

---

*Phase: 10-cinematic-renderer*
*Context gathered: 2026-04-05*
