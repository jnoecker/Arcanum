# Roadmap: Arcanum

## Milestones

- ✅ **v1.0 Tuning Wizard** -- Phases 1-6 (shipped 2026-04-05)
- 🚧 **v1.1 Zone Stories** -- Phases 7-12 (in progress)

## Phases

<details>
<summary>✅ v1.0 Tuning Wizard (Phases 1-6) -- SHIPPED 2026-04-05</summary>

- [x] Phase 1: Foundation (2/2 plans) -- completed 2026-04-05
- [x] Phase 2: Presets (2/2 plans) -- completed 2026-04-05
- [x] Phase 3: Wizard Workspace (2/2 plans) -- completed 2026-04-05
- [x] Phase 4: Comparison View (3/3 plans) -- completed 2026-04-05
- [x] Phase 5: Apply Flow (2/2 plans) -- completed 2026-04-05
- [x] Phase 6: Visualizations (2/2 plans) -- completed 2026-04-05

</details>

### 🚧 v1.1 Zone Stories (In Progress)

**Milestone Goal:** Turn zone worldbuilding into cinematic lore narratives with a timeline editor, fullscreen DM presentation mode, and an embedded story player for the showcase.

- [ ] **Phase 7: Story Foundation** - Data model, story store with undo/redo, persistence, and lore system integration
- [ ] **Phase 8: Story Editor** - Timeline with draggable scene cards, narration editor, DM notes, and scene templates
- [ ] **Phase 9: Scene Composition** - Entity picker, room backgrounds, entity positioning, and live scene preview
- [ ] **Phase 10: Cinematic Renderer** - Portable rendering engine with crossfade transitions, movement paths, and typewriter narration
- [ ] **Phase 11: Presentation Mode** - Fullscreen DM presentation with keyboard navigation
- [ ] **Phase 12: Showcase Player** - Embedded story player with click-through, auto-play, and scroll-driven modes

## Phase Details

### Phase 7: Story Foundation
**Goal**: Builders can create, persist, and manage stories as a new lore type linked to zones
**Depends on**: Phase 6 (v1.0 complete)
**Requirements**: STORY-01, STORY-05, STORY-06
**Success Criteria** (what must be TRUE):
  1. Builder can create a new story linked to a specific zone and see it in the lore browser
  2. Builder can set a cover image for the story
  3. Story data persists across app restarts (separate JSON files, not inline in lore.yaml)
  4. Builder can undo and redo story mutations without affecting lore undo history
  5. Story appears as a lore article type with proper panel registry routing
**Plans:** 2 plans
Plans:
- [x] 07-01-PLAN.md -- Story types, lore type extensions, storyStore with undo/redo, storyPersistence, and unit tests
- [x] 07-02-PLAN.md -- Panel registry, ArticleTree/Browser integration, NewStoryDialog, StoryEditorPanel, project-open loading
**UI hint**: yes

### Phase 8: Story Editor
**Goal**: Builders can author multi-scene stories with narration, notes, and templates using a timeline editor
**Depends on**: Phase 7
**Requirements**: STORY-02, STORY-03, STORY-04, STORY-07
**Success Criteria** (what must be TRUE):
  1. Builder can add, remove, and reorder scenes by dragging scene cards on a horizontal timeline
  2. Builder can write and edit narration text for each scene using a rich text editor
  3. Builder can add private DM speaker notes per scene that are visually distinct from narration
  4. Builder can apply a scene template (Establishing Shot, Encounter, Discovery) that pre-populates scene settings
**Plans:** 2 plans
Plans:
- [x] 08-01-PLAN.md -- storyStore scene operations (add/remove/reorder/update/duplicate), scene template presets, dnd-kit install, unit tests
- [x] 08-02-PLAN.md -- SceneTimeline, SceneCard, SceneContextMenu, SceneDetailEditor, DmNotesSection, TemplatePicker, StoryEditorPanel rewrite
**UI hint**: yes

### Phase 9: Scene Composition
**Goal**: Builders can compose visual scenes from zone data with room backgrounds, entity spotlights, and live preview
**Depends on**: Phase 8
**Requirements**: SCENE-01, SCENE-02, SCENE-03, SCENE-04, SCENE-05
**Success Criteria** (what must be TRUE):
  1. Builder can browse and pick rooms, mobs, and items from the linked zone's data via an entity picker
  2. Scene displays the selected room's background image with entity overlays and narration text layered on top
  3. When a room is selected, its background image auto-populates from existing zone art
  4. Builder can preview the fully composed scene (background + entities + narration) live in the editor
  5. Builder can position entities at predefined spots (left, center, right) or drag to custom coordinates
**Plans:** 3 plans
Plans:
- [x] 09-01-PLAN.md -- SceneEntity type extension (slot field), sceneLayout utility (preset slots, auto-distribution, position resolution, TipTap text extraction), unit tests
- [ ] 09-02-PLAN.md -- ScenePreview (16:9 renderer with room bg, entity layers, narration overlay, empty state) and EntityOverlay (draggable sprite with selection and removal)
- [ ] 09-03-PLAN.md -- EntityPicker sidebar (tabbed zone browser with search), EntityPickerTab, SceneDetailEditor restructure (horizontal split with preview and picker integration)
**UI hint**: yes

### Phase 10: Cinematic Renderer
**Goal**: Scenes play back with cinematic effects -- crossfade transitions, entity movement paths, and animated narration text
**Depends on**: Phase 9
**Requirements**: SCENE-06, SCENE-07, PRES-03
**Success Criteria** (what must be TRUE):
  1. Builder can set entrance and exit movement paths for entities that animate during scene playback
  2. Narration text reveals with a typewriter animation during playback
  3. Scenes transition with a crossfade effect when advancing through the story
  4. The renderer works identically in the editor preview, presentation mode, and showcase player (single portable component, no Tauri dependencies)
**Plans**: TBD
**UI hint**: yes

### Phase 11: Presentation Mode
**Goal**: Builders can present stories fullscreen as a DM tool with keyboard-driven navigation
**Depends on**: Phase 10
**Requirements**: PRES-01, PRES-02
**Success Criteria** (what must be TRUE):
  1. Builder can enter fullscreen presentation mode from the story editor
  2. Builder can advance, go back, and exit the presentation using keyboard controls (arrows, space, escape/F5)
  3. Presentation fills the entire screen with the cinematic renderer output (no editor chrome visible)
**Plans**: TBD
**UI hint**: yes

### Phase 12: Showcase Player
**Goal**: Stories are playable on the public showcase website with multiple navigation modes
**Depends on**: Phase 10
**Requirements**: SHOW-01, SHOW-02, SHOW-03, SHOW-04
**Success Criteria** (what must be TRUE):
  1. Stories export to the showcase and appear as playable entries in the showcase listing
  2. Showcase visitors can navigate through story scenes with click and keyboard controls
  3. Showcase player supports auto-play mode that advances scenes on a configurable timer
  4. Showcase player supports scroll-driven scene advancement with snap-to-scene behavior
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 7 -> 8 -> 9 -> 10 -> 11 -> 12
Note: Phases 11 and 12 both depend on Phase 10 and could execute in parallel.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-04-05 |
| 2. Presets | v1.0 | 2/2 | Complete | 2026-04-05 |
| 3. Wizard Workspace | v1.0 | 2/2 | Complete | 2026-04-05 |
| 4. Comparison View | v1.0 | 3/3 | Complete | 2026-04-05 |
| 5. Apply Flow | v1.0 | 2/2 | Complete | 2026-04-05 |
| 6. Visualizations | v1.0 | 2/2 | Complete | 2026-04-05 |
| 7. Story Foundation | v1.1 | 0/2 | Planning | - |
| 8. Story Editor | v1.1 | 0/2 | Planning | - |
| 9. Scene Composition | v1.1 | 0/3 | Planning | - |
| 10. Cinematic Renderer | v1.1 | 0/0 | Not started | - |
| 11. Presentation Mode | v1.1 | 0/0 | Not started | - |
| 12. Showcase Player | v1.1 | 0/0 | Not started | - |
