# Architecture Patterns

**Domain:** Cinematic zone story authoring for Tauri 2 desktop app + web showcase
**Researched:** 2026-04-05

## Recommended Architecture

The cinematic story system integrates as a new vertical slice through the existing architecture: new types in `types/`, new data in `loreStore`, new components in `components/story/`, new export logic in `exportShowcase.ts`, and a new player component in the showcase app. It does NOT need a new Zustand store -- stories are lore data and belong in `loreStore`.

### High-Level Data Flow

```
Zone YAML data (zoneStore)
        |
        v
Entity Picker (reads zoneStore.zones)
        |
        v
Story Editor (scene cards referencing zone entities)
        |
        v
Story data model (stored in loreStore as part of WorldLore)
        |
        v
lorePersistence.ts (auto-saves to lore.yaml)
        |
        v
exportShowcase.ts (converts Story -> ShowcaseStory with resolved image URLs)
        |
        v
deploy_showcase_to_r2 (uploads showcase.json)
        |
        v
Showcase StoryPlayer component (reads stories from ShowcaseData, renders cinematic playback)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `StoryEditor` | Top-level story authoring surface with timeline, scene list, and preview | `loreStore`, `zoneStore` (read), `assetStore` (read) |
| `SceneCard` | Individual scene editing: background, entities, narration, effects | `StoryEditor` (parent), `EntityPicker` |
| `EntityPicker` | Browsable/searchable picker for zone rooms, mobs, items, NPCs | `zoneStore` (read), returns selection to `SceneCard` |
| `StoryTimeline` | Horizontal draggable timeline of scene cards with reorder support | `StoryEditor` (parent), `@dnd-kit/sortable` |
| `CinematicRenderer` | Canvas/DOM renderer for parallax layers, particles, sprite animations | Scene data (props), `assetStore` (image loading) |
| `StoryPreview` | In-editor preview pane showing `CinematicRenderer` for current scene | `StoryEditor` (parent) |
| `PresentationMode` | Fullscreen DM presentation with keyboard navigation | `loreStore` (story data), `CinematicRenderer` |
| `StoryPlayer` (showcase) | Embedded click-through/auto-play story player | `ShowcaseData.stories`, standalone in showcase app |
| `StoryExporter` (lib) | Converts Story model to ShowcaseStory for export | `exportShowcase.ts` extension |

---

## Data Model Design

### Story as Lore Extension (NOT a New Store)

Stories belong in the lore system because they:
1. Need undo/redo (lore store already has 50-entry history via `snapshotLore`)
2. Need auto-save (LorePanelHost already handles dirty flag -> `saveLore()`)
3. Need showcase export (export pipeline already converts WorldLore -> ShowcaseData)
4. Are world-building artifacts conceptually (narrative about zones/entities)

**Integration point:** Add `stories?: Story[]` to the `WorldLore` interface in `types/lore.ts`. This persists them in `lore.yaml` alongside articles, maps, and timeline events.

### Core Types (new in `types/story.ts`)

```typescript
export interface Story {
  id: string;
  title: string;
  description?: string;
  zoneId: string;                    // Single-zone scope for v1.1
  scenes: StoryScene[];
  image?: string;                    // Cover/thumbnail asset
  draft?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoryScene {
  id: string;
  title?: string;
  backgroundRoomId?: string;         // Room whose image becomes the background
  backgroundOverride?: string;       // Or a direct asset filename
  narration: string;                 // Rich text (TipTap JSON or plain text)
  entities: SceneEntity[];           // Spotlighted entities
  effects: SceneEffect[];            // Parallax, particles, animations
  duration?: number;                 // Auto-play duration in ms (default: manual advance)
  transition?: SceneTransition;      // How to transition FROM this scene
}

export interface SceneEntity {
  id: string;
  entityType: "mob" | "item" | "npc" | "room";
  entityId: string;                  // Key in the zone's mobs/items/etc record
  zoneId: string;                    // Redundant with Story.zoneId in v1.1, but future-proofs multi-zone
  position: { x: number; y: number }; // Normalized 0-1 coordinates on the scene canvas
  scale?: number;                    // Default 1.0
  animationPath?: AnimationPath;     // Optional movement path
  label?: string;                    // Display name override
}

export interface AnimationPath {
  keyframes: { x: number; y: number; time: number }[]; // time: 0-1 normalized
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  loop?: boolean;
}

export type SceneTransition =
  | { type: "fade"; durationMs: number }
  | { type: "slide"; direction: "left" | "right" | "up" | "down"; durationMs: number }
  | { type: "cut" };

export interface SceneEffect {
  type: "parallax" | "particles" | "overlay";
  config: ParallaxConfig | ParticleConfig | OverlayConfig;
}

export interface ParallaxConfig {
  layers: ParallaxLayer[];
}

export interface ParallaxLayer {
  asset: string;                     // Asset filename
  depth: number;                     // 0 = background, 1 = foreground
  offsetX?: number;
  offsetY?: number;
}

export interface ParticleConfig {
  preset: "sparks" | "mist" | "rain" | "snow" | "embers" | "dust";
  intensity?: number;                // 0-1, default 0.5
  color?: string;                    // Override color
}

export interface OverlayConfig {
  asset: string;                     // Overlay image filename
  opacity: number;                   // 0-1
  blendMode?: string;                // CSS mix-blend-mode value
}
```

### Why This Shape

- **`zoneId` on Story, not Scene:** v1.1 is single-zone scope. Multi-zone expansion later adds `zoneId` per scene, with Story.zoneId becoming a "primary zone" or deprecated.
- **Normalized positions (0-1):** The renderer can scale to any viewport size (editor preview, fullscreen, showcase player) without coordinate math.
- **Particle presets, not raw config:** Builders are MUD authors, not VFX artists. Named presets (sparks, mist, rain) are friendlier than particle count/velocity/lifetime sliders. Advanced users can still be supported later.
- **`backgroundRoomId` reference:** Rooms already have `image` fields in the zone data. The renderer resolves `roomId` -> room.image -> asset file at render time. This stays fresh if the room image changes.
- **TipTap JSON for narration:** Reuses the same rich-text editor already used for lore articles. No new editor dependency needed.

---

## Integration Points with Existing Stores

### loreStore (primary home)

**New mutations needed:**
```
createStory(story: Story)
updateStory(id: string, patch: Partial<Story>)
deleteStory(id: string)
reorderScenes(storyId: string, sceneIds: string[])
updateScene(storyId: string, sceneId: string, patch: Partial<StoryScene>)
addScene(storyId: string, scene: StoryScene)
removeScene(storyId: string, sceneId: string)
```

All mutations MUST call `snapshotLore(s)` for undo/redo compatibility. This is the existing pattern -- every lore mutation snapshots before mutating.

**No new store state needed.** Stories live inside `WorldLore.stories`. Selected story tracking can use existing `selectedArticleId` pattern or a new `selectedStoryId: string | null` field in loreStore state.

### zoneStore (read-only)

The story editor reads zone data but never writes to it. Access pattern:
```typescript
const zones = useZoneStore((s) => s.zones);
const zone = zones.get(story.zoneId);
const rooms = zone?.data.rooms ?? {};
const mobs = zone?.data.mobs ?? {};
```

**Critical dependency:** The zone must be loaded (in `zoneStore.zones`) for the entity picker to work. The story editor should show a "Load zone first" prompt if `zones.get(story.zoneId)` is undefined, and offer a button to open the zone tab.

### assetStore (read-only)

Used to resolve asset filenames to displayable images:
```typescript
const assetsDir = useAssetStore((s) => s.assetsDir);
// Then use read_image_data_url IPC to load: `${assetsDir}/images/${filename}`
```

The `useImageSrc` hook already handles this pattern -- reuse it in the renderer.

### projectStore (navigation)

Story panels register in the panel registry and open as tabs:
```typescript
// New panel definitions in panelRegistry.ts
{ id: "stories", label: "Stories", group: "lore", host: "lore",
  kicker: "Narrative", title: "Zone stories",
  description: "Cinematic story sequences built from zone data.",
  maxWidth: "max-w-7xl" }
```

Individual story editing opens as a lore-hosted panel. The `LorePanelHost` gains a new `case "stories"` in its `renderPanel` switch.

---

## New Component Architecture

### Creator-Side Components (`creator/src/components/story/`)

```
story/
  StoryBrowser.tsx          -- List of all stories with create/delete (like ArticleBrowser)
  StoryEditor.tsx           -- Main editing surface for a single story
  StoryTimeline.tsx         -- Horizontal scene card strip with drag reorder
  SceneCard.tsx             -- Individual scene card in the timeline
  SceneDetailEditor.tsx     -- Right panel: edit selected scene's properties
  EntityPicker.tsx          -- Modal/panel for picking zone entities
  EntityPickerGrid.tsx      -- Grid of entity cards within the picker
  NarrationEditor.tsx       -- TipTap editor scoped to scene narration
  EffectConfigurator.tsx    -- UI for adding/editing scene effects
  CinematicRenderer.tsx     -- The core renderer (parallax + particles + sprites)
  ParticleCanvas.tsx        -- Canvas element for particle effects
  PresentationMode.tsx      -- Fullscreen overlay with keyboard controls
  StoryPreview.tsx          -- Inline preview pane showing current scene
```

### Showcase-Side Components (`showcase/src/components/`)

```
StoryPlayer.tsx             -- Embedded story player (click-through + auto-play)
StoryCard.tsx               -- Story card for listing on Stories page
```

### Showcase Pages (`showcase/src/pages/`)

```
StoriesPage.tsx             -- Grid of available stories
StoryPage.tsx               -- Single story playback page
```

### Layout Pattern: StoryEditor

The `StoryEditor` follows the existing `DefinitionWorkbench` pattern (left list + right detail) but rotated:

```
+----------------------------------------------------------+
| Story Header: Title, Zone, Cover Image                   |
+----------------------------------------------------------+
|                                                          |
|  [Scene Preview Area]         [Scene Detail Editor]      |
|  CinematicRenderer            - Background picker        |
|  showing current scene        - Entity list + picker     |
|                               - Narration editor         |
|                               - Effects configurator     |
|                               - Transition settings      |
+----------------------------------------------------------+
| [Timeline Strip]                                         |
| [Scene 1] [Scene 2] [Scene 3] [+Add]  <- draggable     |
+----------------------------------------------------------+
```

This is similar to video editors (timeline at bottom, preview top-left, properties top-right) but simplified for MUD builders.

---

## CinematicRenderer Architecture

The renderer is the most complex new component. It must work in three contexts with different constraints:

| Context | Size | Interaction | Performance Target |
|---------|------|-------------|-------------------|
| Editor preview | ~600x400px | None (display only) | 30fps sufficient |
| Presentation mode | Fullscreen | Keyboard navigation | 60fps, no jank |
| Showcase player | ~800x500px embedded | Click/auto-play | 60fps, no jank |

### Rendering Strategy: DOM + Canvas Hybrid

Use CSS transforms for parallax layers and entity positioning (GPU-accelerated, declarative) and a single HTML5 Canvas overlay for particle effects (lightweight, no library needed).

```
[Container div - relative, overflow hidden]
  [Parallax background layers - absolute, CSS transform: translateZ]
  [Room background image - absolute, object-fit: cover]
  [Entity sprites - absolute, positioned via CSS transform]
  [Canvas overlay - absolute, pointer-events-none - particles only]
  [Narration text overlay - absolute, bottom, semi-transparent bg]
```

**Why not full Canvas:** DOM rendering handles images, text, and transitions natively. Canvas-only would require reimplementing text layout, image loading, and accessibility. The hybrid approach gets GPU-accelerated parallax via CSS `will-change: transform` while using Canvas only where it excels (particles).

**Why not tsParticles:** tsParticles is 40KB+ gzipped even with slim bundle. The particle presets needed (sparks, mist, rain, snow, embers, dust) are achievable with ~200 lines of custom Canvas code. Keep the bundle small.

### Particle System (Custom, ~200 LOC)

```typescript
// lib/particles.ts
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number; color: string;
  opacity: number;
}

interface ParticlePreset {
  spawnRate: number;
  gravity: number;
  initialVelocity: { x: [number, number]; y: [number, number] };
  size: [number, number];
  life: [number, number];
  color: string | string[];
  shape: "circle" | "square" | "line";
}

const PRESETS: Record<string, ParticlePreset> = {
  sparks: { /* orange/yellow upward bursts */ },
  mist: { /* white/grey slow horizontal drift */ },
  rain: { /* blue/grey fast downward streaks */ },
  // ...
};
```

This renders in a `requestAnimationFrame` loop on a single canvas. The `ParticleCanvas` component accepts `preset` and `intensity` props and manages its own animation loop, cleaned up on unmount.

### Parallax Implementation

Use CSS transforms with depth-based translation, not a parallax library. Each layer has a `depth` value (0 = far background, 1 = foreground). On presentation mode, slight mouse movement or auto-drift applies transform:

```css
.parallax-layer {
  position: absolute;
  inset: 0;
  will-change: transform;
  transition: transform 0.1s ease-out;
}
```

```typescript
// In CinematicRenderer, on mouse move or auto-drift timer:
const offsetX = (mouseX - centerX) * layer.depth * parallaxStrength;
const offsetY = (mouseY - centerY) * layer.depth * parallaxStrength;
element.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${1 + layer.depth * 0.05})`;
```

No library needed. This is ~30 lines of code.

---

## Presentation Mode Architecture

Fullscreen DM presentation is a portal-based overlay that takes over the viewport.

### Implementation

```typescript
// PresentationMode.tsx
function PresentationMode({ story, onExit }: { story: Story; onExit: () => void }) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const scene = story.scenes[sceneIndex];

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight": case " ": case "Enter":
          setSceneIndex((i) => Math.min(i + 1, story.scenes.length - 1));
          break;
        case "ArrowLeft": case "Backspace":
          setSceneIndex((i) => Math.max(i - 1, 0));
          break;
        case "Escape":
          onExit();
          break;
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [story, onExit]);

  // Request fullscreen via Fullscreen API
  useEffect(() => {
    document.documentElement.requestFullscreen?.();
    return () => { document.exitFullscreen?.(); };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black">
      <CinematicRenderer scene={scene} fullscreen />
      {/* Scene counter: 3/12 */}
      <div className="absolute bottom-4 right-4 text-white/40 text-xs">
        {sceneIndex + 1} / {story.scenes.length}
      </div>
    </div>,
    document.body
  );
}
```

**Tauri consideration:** Tauri's webview supports the Fullscreen API on Windows via WebView2. No Rust-side changes needed -- `document.documentElement.requestFullscreen()` works.

---

## Showcase Export Extension

### Changes to `exportShowcase.ts`

The `ShowcaseData` interface gains a `stories` array:

```typescript
export interface ShowcaseData {
  meta: { /* existing */ };
  articles: ShowcaseArticle[];
  maps: ShowcaseMap[];
  calendarSystems: /* existing */;
  timelineEvents: /* existing */;
  colorLabels: /* existing */;
  stories?: ShowcaseStory[];          // NEW
}

export interface ShowcaseStory {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  scenes: ShowcaseScene[];
}

export interface ShowcaseScene {
  id: string;
  title?: string;
  backgroundImageUrl?: string;
  narrationHtml: string;              // TipTap JSON -> HTML via tiptapToHtml()
  entities: ShowcaseSceneEntity[];
  effects: SceneEffect[];             // Passed through as-is
  duration?: number;
  transition?: SceneTransition;
}

export interface ShowcaseSceneEntity {
  id: string;
  entityType: string;
  name: string;                       // Resolved from zone data at export time
  imageUrl?: string;                  // Resolved from zone entity image at export time
  position: { x: number; y: number };
  scale?: number;
  animationPath?: AnimationPath;
}
```

### Export Logic

The key transformation at export time:
1. Resolve `backgroundRoomId` -> room.image -> R2 URL
2. Resolve entity references -> entity name + entity image -> R2 URL
3. Convert narration TipTap JSON to HTML via existing `tiptapToHtml()`
4. Filter out draft stories (same pattern as draft articles)
5. Resolve parallax/overlay asset filenames to R2 URLs

This happens in `exportShowcaseData()`, which already iterates articles and maps. Adding a story export loop is straightforward.

**Critical:** Entity images must be synced to R2 before stories referencing them will display correctly on the showcase. The existing "Publish Lore" flow already calls `syncToR2("all")` before deploying -- this covers it.

### Showcase Types Mirror

`showcase/src/types/showcase.ts` gains matching `ShowcaseStory`, `ShowcaseScene`, `ShowcaseSceneEntity` interfaces.

---

## Showcase StoryPlayer Architecture

The `StoryPlayer` in the showcase app is a simplified version of the creator's `CinematicRenderer` -- same visual output but different input format (pre-resolved URLs, HTML narration instead of TipTap JSON).

### Shared Rendering Code

The particle system and parallax CSS approach can be shared between creator and showcase. Extract to a shared package or duplicate the ~200 LOC particle system in both apps.

**Recommendation:** Duplicate the particle code rather than creating a shared package. The showcase and creator have different build systems (showcase: npm + Vite, creator: bun + Vite + Tauri). A shared package adds monorepo complexity for minimal code savings. The particle system is small and stable.

### StoryPlayer Modes

```typescript
interface StoryPlayerProps {
  story: ShowcaseStory;
  mode: "click-through" | "auto-play";
  onComplete?: () => void;
}
```

- **Click-through:** User clicks/taps to advance. Arrow keys also work. Progress bar at bottom.
- **Auto-play:** Each scene displays for its `duration` ms, then transitions. Pause button visible. Falls back to 5000ms if no duration set.

### Showcase Routing

```
/stories              -> StoriesPage (grid of story cards)
/stories/:id          -> StoryPage (full-page player)
```

---

## Panel Registry Integration

New panel registration in `panelRegistry.ts`:

```typescript
// Add to LORE_PANELS array
{ id: "stories", label: "Stories", group: "lore", host: "lore",
  kicker: "Narrative", title: "Zone stories",
  description: "Cinematic story sequences built from zone data.",
  maxWidth: "max-w-7xl" },
```

The `LorePanelHost.tsx` gains:
```typescript
case "stories":
  return <StoryBrowser />;
```

Individual story editing can either:
- **Option A:** Open inline in the StoryBrowser (like ArticleBrowser selecting an article)
- **Option B:** Open as a new tab (like zone tabs: `{ id: "story:{storyId}", kind: "panel", panelId: "storyEditor" }`)

**Recommendation:** Option A (inline) for v1.1. The story browser shows the list on the left and the full story editor on the right, like ArticleBrowser. This avoids new tab types and keeps the workflow in the lore workspace. Fullscreen presentation mode is a separate overlay triggered by a button in the editor.

---

## Build Order (Dependency Chain)

The components have clear dependencies that dictate build order:

### Phase 1: Data Foundation
1. `types/story.ts` -- Story, StoryScene, SceneEntity, SceneEffect types
2. `WorldLore.stories` addition to `types/lore.ts`
3. `loreStore` mutations: createStory, updateStory, deleteStory, scene CRUD
4. Persistence: stories serialize/deserialize in `lore.yaml` (already handled by `saveLore` since it stringifies the entire WorldLore object)
5. Panel registry entry for "stories"

**No external dependencies. Pure TypeScript types and store mutations.**

### Phase 2: Story Editor Core
1. `StoryBrowser.tsx` -- List stories, create new, delete (similar to ArticleBrowser)
2. `StoryEditor.tsx` -- Layout shell with scene list and detail panel
3. `SceneCard.tsx` -- Scene card in the timeline (static first, drag later)
4. `SceneDetailEditor.tsx` -- Edit scene properties (background, narration, transition)
5. `NarrationEditor.tsx` -- TipTap for scene narration text

**Depends on:** Phase 1 types and store. Reuses TipTap (already in the project).

### Phase 3: Entity Integration
1. `EntityPicker.tsx` -- Modal/panel for browsing zone entities
2. `EntityPickerGrid.tsx` -- Visual grid of rooms/mobs/items from loaded zone
3. Scene entity positioning UI in `SceneDetailEditor`
4. Zone-to-story reference resolution

**Depends on:** Phase 2 editor shell. Reads from `zoneStore` (existing).

### Phase 4: Cinematic Renderer
1. `lib/particles.ts` -- Custom particle system with presets
2. `ParticleCanvas.tsx` -- Canvas component wrapping particle system
3. `CinematicRenderer.tsx` -- Composites background + entities + particles + narration
4. `StoryPreview.tsx` -- Inline preview pane in the editor
5. `EffectConfigurator.tsx` -- UI for adding/editing effects per scene

**Depends on:** Phase 2/3 for scene data to render. This is the most complex phase.

### Phase 5: Timeline + Polish
1. `StoryTimeline.tsx` -- Horizontal draggable timeline with `@dnd-kit/sortable`
2. Scene transitions (CSS animations between scenes)
3. Drag-to-reorder scene cards
4. Keyboard shortcuts in editor

**Depends on:** Phase 2 scene cards. Adds `@dnd-kit/core` + `@dnd-kit/sortable` dependencies.

### Phase 6: Presentation Mode
1. `PresentationMode.tsx` -- Fullscreen portal with keyboard navigation
2. Fullscreen API integration
3. Scene counter, progress indicator
4. Auto-advance timer

**Depends on:** Phase 4 renderer. Wraps it in a fullscreen container.

### Phase 7: Showcase Export + Player
1. `ShowcaseStory`/`ShowcaseScene` types in both creator and showcase
2. Export logic in `exportShowcaseData()` -- resolve entity refs to URLs
3. `StoryPlayer.tsx` in showcase -- click-through and auto-play modes
4. `StoriesPage.tsx` + `StoryPage.tsx` in showcase
5. Showcase routing updates in `App.tsx`
6. Particle system duplication for showcase

**Depends on:** Phase 4 renderer concept (showcase duplicates rendering approach). Phase 1 data model for export shapes.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Separate Story Store
**What:** Creating a new `storyStore.ts` alongside `loreStore.ts`
**Why bad:** Stories need undo/redo, auto-save, dirty tracking, and showcase export. Duplicating all of this in a new store is wasteful and creates synchronization problems. The lore store already handles all of this.
**Instead:** Add story mutations to `loreStore` and story data to `WorldLore`.

### Anti-Pattern 2: Full Canvas Rendering
**What:** Rendering everything (backgrounds, entities, text, particles) on a Canvas
**Why bad:** Loses DOM accessibility, text selection, CSS styling, image loading convenience, and responsive layout. Canvas text rendering is painful. The narration overlay needs rich formatting.
**Instead:** DOM + Canvas hybrid. DOM for images/text/layout, Canvas overlay only for particles.

### Anti-Pattern 3: Heavy Particle Library
**What:** Adding tsParticles (40KB+ gzipped) for 6 particle presets
**Why bad:** Disproportionate bundle impact for simple effects. tsParticles has hundreds of features we would not use.
**Instead:** Custom ~200 LOC particle system with preset configs. Sparks, mist, rain, snow, embers, and dust are all simple spawn-move-fade loops on Canvas.

### Anti-Pattern 4: Zone Data Duplication in Stories
**What:** Copying room descriptions, mob stats, or entity images into the story data model
**Why bad:** Data goes stale when the zone is edited. Increases lore.yaml size. Creates reconciliation problems.
**Instead:** Store references (roomId, entityId, zoneId) and resolve at render time from zoneStore, or at export time for showcase.

### Anti-Pattern 5: Story Editing as a New Workspace
**What:** Adding a third workspace (worldmaker, lore, stories) with its own sidebar groups
**Why bad:** Stories are lore. Fragmenting them into a separate workspace breaks the mental model and requires UI/UX changes to workspace switching. The lore workspace already has articles, maps, timeline, and documents.
**Instead:** Stories are a new panel in the "Lore" sidebar group, hosted by `LorePanelHost`.

### Anti-Pattern 6: Trying to Share Code Between Creator and Showcase via Package
**What:** Extracting the renderer into a shared npm package used by both apps
**Why bad:** Creator uses bun, showcase uses npm. Different Vite configs. The shared code is ~200-300 lines. Monorepo tooling overhead (workspace config, build coordination) vastly exceeds the duplication cost.
**Instead:** Duplicate the particle system and rendering approach. The CinematicRenderer in the creator and the StoryPlayer in the showcase will have similar logic but different input types (creator: raw data + asset resolution; showcase: pre-resolved URLs + HTML).

---

## Scalability Considerations

| Concern | v1.1 (single-zone) | Future (multi-zone) | At scale |
|---------|---------------------|---------------------|----------|
| Story count | 1-10 stories, no perf issue | 10-50 stories, still fine | 100+ may need lazy loading of scene data |
| Scene count per story | 5-30 scenes in memory | Same | 100+ scenes may need virtualized timeline |
| Entity resolution | All from one loaded zone | Need zone loading on demand | Entity cache/index across zones |
| Asset loading | Images loaded via IPC one at a time | Same | Batch loading, thumbnail cache |
| Export size | Small JSON (~50KB) | Medium (~200KB) | May need story-level JSON splitting |
| Showcase bundle | +~5KB for StoryPlayer | Same | Story data could be lazy-loaded per story |

### Multi-Zone Expansion Path

When multi-zone stories are needed later:
1. `SceneEntity.zoneId` already exists in the type (set to `story.zoneId` in v1.1)
2. `StoryScene` gains optional `zoneId` override
3. EntityPicker gains zone selector dropdown
4. Export logic iterates all referenced zones instead of just one
5. Zone loading: either require all referenced zones to be loaded, or load on demand

---

## Sources

- [dnd-kit sortable documentation](https://docs.dndkit.com/presets/sortable) - Drag-and-drop reorder library (HIGH confidence)
- [Sparticles lightweight particle library](https://github.com/simeydotme/sparticles) - Inspiration for custom particle approach (MEDIUM confidence)
- [React fullscreen slideshow patterns](https://dev.to/andrewheinke/react-slideshow-component-with-autoplay-fullscreen-mode-and-expand-all-4o9b) - Presentation mode reference (MEDIUM confidence)
- Existing codebase analysis: `loreStore.ts`, `exportShowcase.ts`, `LorePanelHost.tsx`, `panelRegistry.ts`, `types/lore.ts`, `types/world.ts`, `zoneStore.ts`, `assetStore.ts`, `MainArea.tsx`, showcase `App.tsx` + `DataContext.tsx` + `showcase.ts` (HIGH confidence - direct source code review)
