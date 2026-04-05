# Requirements: Arcanum v1.1 Zone Stories

**Defined:** 2026-04-05
**Core Value:** Builders can turn their zone worldbuilding into living narratives — stories that work as DM presentation aids at the table and as cinematic experiences on the public showcase.

## v1.1 Requirements

Requirements for Zone Stories milestone. Each maps to roadmap phases.

### Story Authoring

- [ ] **STORY-01**: Builder can create a new story as a lore article type linked to a single zone
- [ ] **STORY-02**: Builder can add, remove, and reorder scenes via draggable scene cards on a timeline
- [ ] **STORY-03**: Builder can write narration text per scene
- [ ] **STORY-04**: Builder can add private DM speaker notes per scene
- [ ] **STORY-05**: Stories persist with full undo/redo support
- [ ] **STORY-06**: Builder can set a cover image for the story
- [ ] **STORY-07**: Builder can apply scene templates (Establishing Shot, Encounter, Discovery)

### Scene Composition

- [ ] **SCENE-01**: Builder can pick rooms, mobs, and items from the linked zone's data
- [ ] **SCENE-02**: Scene displays room background with entity overlays and narration text
- [ ] **SCENE-03**: Room background auto-populates from zone art when a room is selected
- [ ] **SCENE-04**: Builder can preview the composed scene in the editor
- [ ] **SCENE-05**: Builder can position entities at predefined spots or custom coordinates
- [ ] **SCENE-06**: Builder can set entrance/exit movement paths for entities
- [ ] **SCENE-07**: Narration text reveals with typewriter animation during playback

### Presentation Mode

- [ ] **PRES-01**: Builder can enter fullscreen DM presentation mode
- [ ] **PRES-02**: Presentation advances with keyboard (arrows, space, escape to exit)
- [ ] **PRES-03**: Scenes transition with crossfade effects

### Showcase Player

- [ ] **SHOW-01**: Stories export to the showcase as an embedded player component
- [ ] **SHOW-02**: Showcase player supports click-through and keyboard navigation
- [ ] **SHOW-03**: Showcase player supports auto-play with configurable timing
- [ ] **SHOW-04**: Showcase player supports scroll-driven scene advancement with snap

## Future Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Cinematic Polish

- **FX-01**: Parallax background layers (2-3 depth layers per scene)
- **FX-02**: Particle effects overlay (sparks, mist, dust, embers, snow)
- **FX-03**: Scene-level audio cues from zone ambient/music assets
- **FX-04**: DM speaker notes display panel (separate monitor/window during presentation)

### Expanded Scope

- **SCOPE-01**: Multi-zone stories (pull entities from multiple zones)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Branching narratives / choose-your-own-adventure | Linear cinematic presentations, not interactive fiction — use Twine/ink for that |
| Video editing / rendering to MP4 | Scenes are live-rendered in browser, not video files |
| Voice-over recording / TTS | Text narration only — DMs read aloud during presentation |
| Real-time collaboration | Single-user desktop app — share via git or export |
| Complex sprite animation editor | Simple entrance/exit choreography, not Spine/DragonBones |
| 3D scene composition | 2D layered composition with parallax for depth illusion |
| Custom fonts per scene | Arcanum design system fonts (Cinzel/Crimson Pro) used consistently |
| Scene scripting language | Declarative scene data, not a programming environment |
| Embedded video playback in scenes | Images + CSS animations achieve cinematic feel without video infrastructure |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STORY-01 | — | Pending |
| STORY-02 | — | Pending |
| STORY-03 | — | Pending |
| STORY-04 | — | Pending |
| STORY-05 | — | Pending |
| STORY-06 | — | Pending |
| STORY-07 | — | Pending |
| SCENE-01 | — | Pending |
| SCENE-02 | — | Pending |
| SCENE-03 | — | Pending |
| SCENE-04 | — | Pending |
| SCENE-05 | — | Pending |
| SCENE-06 | — | Pending |
| SCENE-07 | — | Pending |
| PRES-01 | — | Pending |
| PRES-02 | — | Pending |
| PRES-03 | — | Pending |
| SHOW-01 | — | Pending |
| SHOW-02 | — | Pending |
| SHOW-03 | — | Pending |
| SHOW-04 | — | Pending |

**Coverage:**
- v1.1 requirements: 18 total
- Mapped to phases: 0
- Unmapped: 18 ⚠️

---
*Requirements defined: 2026-04-05*
*Last updated: 2026-04-05 after initial definition*
