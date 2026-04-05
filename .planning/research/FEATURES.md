# Feature Landscape

**Domain:** Cinematic zone story authoring for MUD world builder -- timeline editor, DM presentation mode, embedded showcase player
**Researched:** 2026-04-05
**Confidence:** MEDIUM-HIGH (domain patterns drawn from visual novel engines, presentation frameworks, narrative authoring tools, and RPG DM tools -- the specific combination is novel but each pillar is well-understood)

## Table Stakes

Features users expect. Missing = the story feature feels like a toy instead of a tool.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Scene card timeline | Core authoring surface. Every story tool (Plottr, Aeon Timeline, Scrivener) organizes narrative as ordered cards on a timeline. Without it, "story authoring" is just writing text in an article. | Medium | Horizontal lane of draggable scene cards. Each card = one "slide" of the story. Drag to reorder. Visual grid similar to Plottr's timeline view. |
| Drag-and-drop scene reordering | Table stakes for any card-based editor. Plottr, Trello, and every storyboard tool supports this. Manual index editing feels broken. | Medium | Use dnd-kit (already lightweight, good React integration). Ghost card + insertion indicator during drag. |
| Scene composition: background + entities + text | The minimum viable scene is "show a room, highlight a character, display narration." Without all three layers, you cannot tell a zone story. Visual novels (Ren'Py, Narrat) define scenes as exactly this: background + sprites + dialogue. | Medium | Background = room image from zone data. Entities = mob/item/NPC sprites overlaid. Text = narration/dialogue in a styled overlay. |
| Entity picker from zone data | Stories are built FROM zone content. If builders have to manually type entity IDs or paste image URLs, the tool fails. The whole point is leveraging existing zone data. | Medium | Browse rooms, mobs, items from the selected zone. Click to insert entity into current scene. Shows thumbnail + name. Reuse zone store data. |
| Narration text editor per scene | Every presentation tool, visual novel engine, and story authoring tool has per-slide/per-scene text. This is the "what the DM reads aloud" content. | Low | Styled text input per scene card. Support bold/italic at minimum. Consider TipTap for consistency with lore editor, but a simpler textarea may suffice for short narration blocks. |
| Fullscreen presentation mode | DMs need to present stories to players in person or over screenshare. Without fullscreen, "presentation mode" is just reading the editor. Every presentation tool (PowerPoint, Reveal.js, Keynote, Genially) has this. | Medium | F11 or dedicated button enters fullscreen. Renders current scene as a cinematic slide. Dark letterboxed layout. Keyboard advance (arrow keys, space). ESC to exit. |
| Keystroke navigation in presentation | Arrow keys and spacebar to advance slides is the universal presentation convention. Reveal.js, PowerPoint, Keynote -- all use this pattern. DMs need hands-free advancement. | Low | Left/Right arrows, Space = next, Backspace = previous. Page Up/Down for jump. Escape = exit. Must work without mouse. |
| Scene transition effects | Without transitions, advancing slides feels like a broken slideshow. Even a simple crossfade is expected. Reveal.js, Keynote, and visual novels all have at minimum fade/dissolve transitions. | Low-Medium | Start with crossfade (CSS opacity transition). This single transition covers 90% of needs. Add slide-left/right later. |
| Story persistence (save/load) | Users will rage-quit if stories vanish. Must save alongside other lore data. | Medium | Stories as a new data type in WorldLore (serialized to lore.yaml). Full undo/redo integration using existing lore store patterns (snapshotLore). |
| Story as lore article type | Stories must live in the lore ecosystem, not a separate silo. Users already organize content as lore articles. A story IS a type of lore article that has additional scene data. | Low-Medium | New article template "story" with additional `scenes` field. Inherits tags, relations, @mentions, showcase export, undo/redo, search. |
| Showcase story player (click-through) | Stories must appear on the public showcase website. Without this, stories are trapped in the desktop app. The showcase already shows articles, maps, timelines -- stories are the next content type. | Medium | New page/component in showcase app. Click or arrow-key to advance. Renders background image + entity overlays + narration text. Crossfade transitions between scenes. |
| Single-zone scope with clean boundaries | Each story draws from one zone's data. This is a natural scope boundary that simplifies the entity picker, avoids cross-zone reference resolution, and matches how MUD builders think (one zone = one area). | Low | Story data includes a `zoneId` field. Entity picker filters to that zone. Architecture supports multi-zone expansion later (array of zoneIds, cross-zone entity resolution). |

## Differentiators

Features that set this apart from "just make a PowerPoint." Competitive advantage over generic presentation tools or writing stories in Google Docs.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Zone-data-aware entity picker | Unlike generic tools, entities are pulled from actual zone data -- rooms, mobs, items with their images, descriptions, and metadata. Builders don't recreate content; they compose from what they've already built. No other tool can do this because no other tool has zone data. | Medium | Tree or list browser showing zone entities grouped by type (rooms, mobs, items). Click to add to scene. Drag entity onto scene canvas. Shows generated art thumbnails if available. |
| Room background auto-population | When a scene references a room, its background image (if generated) fills the scene automatically. Builders see their own world instantly, not placeholder art. | Low | Read room.image from zone data, resolve via asset store. If no image, show stylized placeholder with room title. |
| Entity spotlight positioning | Place entity sprites at specific positions on the scene canvas (left, center, right, or custom coordinates). Visual novel engines (Ren'Py) call these "show positions." Makes scenes feel composed rather than templated. | Medium | Predefined positions (left/center/right) plus drag-to-position on preview canvas. Store as normalized coordinates (0-1 range) in scene data. |
| Parallax background layers | Layered backgrounds that shift at different speeds during transitions create depth and cinematic feel. A technique used in every modern web storytelling experience (Webflow parallax, Focusky, scroll-driven narratives). | Medium-High | 2-3 layers per scene: deep background (sky/distant), mid (room), foreground (particles/vignette). CSS transform with different multipliers on transition. Most impactful with room images that have clear depth. |
| Particle effects overlay | Ambient particles (sparks, mist, dust, embers, snow) add atmosphere without requiring custom art. Used in every modern game UI and cinematic web experience. | Medium | Canvas-based particle system using lightweight library (tsParticles has React support, or custom minimal system). Preset particle types: sparks, mist, dust, embers, fireflies, snow. Per-scene particle selection. |
| Sprite movement paths | Entities that enter, exit, or move during a scene create dynamic storytelling moments. "The goblin creeps from the shadows" vs a static sprite appearing. Visual novel standard feature. | Medium-High | Define entry/exit animations per entity: fade-in, slide-from-left, slide-from-right, scale-up. Simple keyframe paths (start position -> end position over duration). Not a full animation editor -- just entrance/exit choreography. |
| Scene preview in editor | Live preview of the composed scene (background + entities + text + effects) directly in the editor. Builders see what the audience will see without entering presentation mode. | Medium | Miniature render of the scene canvas in the editor panel. Updates as entities are added/positioned. Aspect ratio matches presentation ratio (16:9). |
| Auto-play mode for showcase | Stories play automatically with timed transitions (configurable seconds-per-scene). Creates a "cinematic trailer" experience on the showcase site. No other worldbuilding tool offers auto-playing zone narratives. | Low-Medium | Timer-based scene advancement. Play/pause button. Progress bar. Configurable pace (e.g., 5s, 8s, 12s per scene). Falls back to click-through if user interacts. |
| DM speaker notes | Hidden notes visible only to the presenter (not on the player-facing display). Standard in Reveal.js, PowerPoint, Keynote. DMs need reminders, stat blocks, improvisation hooks. | Low | Text field per scene visible only in the editor and in a separate speaker-notes panel during presentation. Not shown on the main projection. |
| Scene-level audio cues | Reference the room's music/ambient audio per scene. When presenting, audio changes reinforce the mood. MasterScreen and Owlbear Rodeo scenes support per-scene audio. | Medium | Optional audio field per scene referencing zone audio assets. Play/crossfade audio on scene transitions. Desktop-only (Tauri audio APIs). Showcase can show "now playing" indicator. |
| Narration text reveal animation | Text that types out character-by-character (typewriter effect) or fades in phrase-by-phrase. Standard in visual novels (Ren'Py), adds dramatic pacing. Generic presentation tools don't have this. | Low-Medium | CSS animation: reveal text word-by-word or character-by-character. Configurable speed. Skip-to-end on click/keypress (essential for impatient readers). |
| Scene templates/presets | "Establishing shot" (wide room, no entities, narration at bottom), "Encounter" (room + mob front-center, narration in dialogue box), "Discovery" (room + item spotlight, narration as thought). Accelerates scene creation. | Low | 3-5 preset layouts that pre-configure entity positions, text placement, and transition style. Builder selects template, then customizes. |
| Story cover/thumbnail | Generated or selected image that represents the story in the lore browser and showcase. Articles already have images; stories should too. | Low | Reuse existing article image field. Auto-suggest the first scene's background as cover. |

## Anti-Features

Features to explicitly NOT build. Each would pull scope toward a different product.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full video editing / rendering | Arcanum is a story authoring tool, not After Effects. Video rendering requires FFmpeg, massive compute, codec complexity. The output format is interactive web presentation, not MP4. | Scenes are live-rendered in the browser using CSS/Canvas. Export is the showcase player, not a video file. |
| Branching narrative / choose-your-own-adventure | Branching stories (Arcweave, Twine, ink) are a fundamentally different product. Zone stories are linear cinematic presentations, not interactive fiction. Adding branching multiplies complexity (state tracking, path testing, conditional logic). | Linear scene sequence. Builders who want branching narratives should use the existing lore article system with links between articles. |
| Voice-over recording/synthesis | Recording or TTS integration adds audio engineering complexity (waveform editing, sync, file management). Way out of scope for a scene composer. | Text narration only. DMs read narration aloud during presentation. Showcase displays text. |
| Real-time collaboration | Arcanum is single-user desktop software. Multi-user story editing requires CRDT/OT, conflict resolution, and server infrastructure. | Single-author workflow. Share via git (existing integration) or export. |
| Complex sprite animation editor | Spine, DragonBones, or frame-by-frame animation editing is a separate tool domain. We need entrance/exit choreography, not a character animation studio. | Simple movement paths (enter from left, exit to right) and pre-built entrance effects (fade, slide, scale). 5-10 presets, not a keyframe editor. |
| 3D scene composition | 3D rendering (Three.js, Babylon) adds massive complexity for marginal benefit in a 2D MUD world builder. The existing art pipeline generates 2D images. | 2D layered composition with parallax for depth illusion. More than sufficient for MUD zone storytelling. |
| Custom font/typography per scene | Per-scene font selection adds design system complexity and breaks visual consistency. The Arcanum style guide already defines Cinzel (display) and Crimson Pro (body). | Use Arcanum design system fonts consistently. Narration = Crimson Pro. Titles = Cinzel. No per-scene font override. |
| Scene scripting language | A DSL for scene logic (conditionals, variables, loops) turns the story editor into a programming environment. Narrat, Ren'Py, and ink exist for that. | Declarative scene data (JSON/YAML). No scripting. Scenes are data, not programs. |
| Multi-zone story support (v1.1) | Cross-zone entity resolution, zone-switching in presentation, and multi-zone entity pickers add significant complexity. Single-zone is the natural first scope. | Single-zone per story in v1.1. Data model uses `zoneId` (singular) that can evolve to `zoneIds` (array) in a future version. |
| Embedded video playback in scenes | Video files are large, require encoding, and the showcase would need a video player. Images + CSS animations achieve the cinematic effect without video infrastructure. | Static images with parallax, particles, and transitions. These create cinematic feel without video overhead. |

## Feature Dependencies

```
Story as Lore Article Type (data model foundation)
  -> Scene Card Timeline (authoring UI for scenes within a story)
    -> Drag-and-Drop Reordering (operates on scene cards)
    -> Narration Text Editor (per-scene text editing)
    -> DM Speaker Notes (per-scene hidden notes)
  -> Story Persistence (save/load within lore system)
  -> Story Cover/Thumbnail (article image reuse)

Entity Picker from Zone Data (requires zone store integration)
  -> Scene Composition: Background + Entities + Text (uses picked entities)
    -> Room Background Auto-Population (room image lookup)
    -> Entity Spotlight Positioning (entity placement on canvas)
      -> Sprite Movement Paths (extends positioning with animation)
    -> Scene Preview in Editor (renders composed scene)

Scene Composition (visual foundation)
  -> Parallax Background Layers (extends background rendering)
  -> Particle Effects Overlay (adds atmospheric layer)
  -> Narration Text Reveal Animation (extends text display)
  -> Scene Transition Effects (between composed scenes)

Fullscreen Presentation Mode (playback foundation)
  -> Keystroke Navigation (input handling for presentation)
  -> Scene Transition Effects (visual transitions between slides)
  -> Scene-Level Audio Cues (audio during presentation)
  -> DM Speaker Notes Display (separate panel in presentation)

Showcase Story Player (separate deployment)
  -> Auto-Play Mode (timed advancement)
  -> Click-Through Navigation (manual advancement)
  -> Scene Transition Effects (shared with presentation mode)
  -> Narration Text Reveal Animation (shared with presentation mode)

Scene Templates/Presets (independent utility, no hard deps)
```

## MVP Recommendation

### Phase 1: Story Data Model + Timeline Editor
Build the authoring foundation before any playback.

1. **Story as lore article type** -- data model with scenes array, zone binding
2. **Scene card timeline** -- horizontal card lane, add/remove scenes
3. **Drag-and-drop reordering** -- dnd-kit sortable for scene cards
4. **Narration text editor per scene** -- text content per card
5. **Story persistence** -- save/load via lore store, undo/redo

### Phase 2: Scene Composition + Entity Integration
Make scenes visual, not just text.

6. **Entity picker from zone data** -- browse zone rooms/mobs/items
7. **Scene composition canvas** -- background + entity overlays + text
8. **Room background auto-population** -- room image fills background
9. **Entity spotlight positioning** -- place entities left/center/right or drag
10. **Scene preview in editor** -- live miniature of composed scene

### Phase 3: Presentation Mode
Let DMs present to players.

11. **Fullscreen presentation mode** -- F11/button enters cinematic fullscreen
12. **Keystroke navigation** -- arrow keys, space, escape
13. **Scene transition effects** -- crossfade between scenes
14. **DM speaker notes** -- hidden notes per scene, separate display panel

### Phase 4: Cinematic Polish
Differentiate from "just a slideshow."

15. **Narration text reveal animation** -- typewriter/fade-in text
16. **Particle effects overlay** -- sparks, mist, embers, dust presets
17. **Parallax background layers** -- multi-depth background movement
18. **Sprite movement paths** -- entity entrance/exit choreography
19. **Scene-level audio cues** -- ambient/music per scene

### Phase 5: Showcase Player
Deploy stories to the public showcase website.

20. **Showcase story player (click-through)** -- new showcase page
21. **Auto-play mode** -- timed scene advancement with play/pause
22. **Story cover/thumbnail** -- display in showcase story listing

### Defer to Future
- **Scene templates/presets**: Nice-to-have after core flow works. Can add once real usage patterns emerge.
- **Preset blending between stories**: Not enough stories will exist initially.
- **Multi-zone stories**: v1.2 or later. Architecture just needs `zoneIds: string[]` when ready.

## Sources

- [Plottr - Story Planning Software](https://plottr.com/features/) -- scene card timeline patterns, drag-and-drop card reordering, color-coded scene management
- [Aeon Timeline - Narrative Storytelling](https://www.aeontimeline.com/features/narrative-storytelling) -- narrative view with index cards, scene-to-chapter organization, character arc tracking
- [Reveal.js - HTML Presentation Framework](https://revealjs.com/) -- auto-animate, parallax backgrounds, speaker notes, fullscreen, keyboard navigation
- [Ren'Py - Visual Novel Engine](https://www.renpy.org/) -- scene composition model (background + sprites + dialogue), sprite positioning, transitions, text display
- [Narrat - Narrative Game Engine](https://narrat.dev/) -- web-based narrative engine patterns, RPG feature integration
- [World Anvil - Timeline Features](https://www.worldanvil.com/features/timelines) -- worldbuilding timeline with era support, interactive event display, Chronicles feature
- [dnd-kit - React DnD Library](https://docs.dndkit.com/presets/sortable) -- sortable drag-and-drop for React, lightweight (10KB), keyboard accessible
- [tsParticles - Particle Effects](https://particles.js.org/) -- React-compatible particle system with fire/spark/mist presets
- [Genially - Cinematic Presentations](https://genially.com/create/presentations/) -- timed animations, cinematic visual effects, no-code animation
- [Owlbear Rodeo - Scene Management](https://docs.owlbear.rodeo/docs/scenes/) -- RPG scene display, per-scene switching, player view patterns
- [MasterScreen - RPG DM Tool](https://masterscreen.app/) -- DM campaign presentation, encounter management
- [CSS Parallax with Scroll-Driven Animations (CSS-Tricks)](https://css-tricks.com/bringing-back-parallax-with-scroll-driven-css-animations/) -- modern CSS parallax techniques
- [Sparticles - Lightweight Canvas Particles](https://github.com/simeydotme/sparticles) -- 120fps+ canvas particle system, minimal bundle
- [LogRocket - Best React Animation Libraries 2026](https://blog.logrocket.com/best-react-animation-libraries/) -- Motion (Framer Motion) vs GSAP comparison for React
- [Drag and Drop UX Patterns (LogRocket)](https://blog.logrocket.com/ux-design/drag-and-drop-ui-examples/) -- card reordering best practices, ghost items, insertion indicators
- [Arcweave - Narrative Design Software](https://arcweave.com/) -- branching narrative patterns (informed anti-feature decision)
