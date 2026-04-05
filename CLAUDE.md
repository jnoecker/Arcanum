# CLAUDE.md

Project-level instructions for Claude Code when working on this repository.

## Project Overview

Arcanum is a Tauri 2 desktop app for building MUD game worlds. React 19 + TypeScript frontend, Rust backend. It reads/writes YAML zone files and application.yaml for the AmbonMUD server.

## Repository Layout

- `creator/` -- The Tauri application (frontend + backend)
- `creator/src/` -- React frontend (components, stores, types, lib)
- `creator/src-tauri/src/` -- Rust backend (Tauri commands)
- `showcase/` -- Public lore showcase website (Vite + React SPA, deployed to Cloudflare Pages)
- `reference/` -- Kotlin source files from AmbonMUD server (read-only reference)
- `ARCANUM_STYLE_GUIDE.md` -- Design system (colors, typography, components, both art styles)

## Development Commands

```bash
cd creator

# Dev mode (Vite + Tauri)
bun run tauri dev

# TypeScript type check
bunx tsc --noEmit

# Rust check
cd src-tauri && cargo check

# Run tests
bun run test

# Production build
bun run tauri build
```

### Showcase

```bash
cd showcase

# Dev mode
npm run dev

# TypeScript check
npm run typecheck

# Production build
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=ambon-showcase
```

## Architecture

### Frontend (React + TypeScript)

- **State**: Zustand stores in `src/stores/`. Each store is independent to avoid re-render cascading.
  - `projectStore` -- project metadata, open tabs, pending navigation
  - `zoneStore` -- loaded zone data, dirty flags, undo/redo (via zundo)
  - `configStore` -- parsed application.yaml (data-driven config for all game systems)
  - `serverStore` -- server process state, logs
  - `validationStore` -- computed validation errors
  - `assetStore` -- image generation, asset manifest, R2 sync, user settings + project settings
  - `loreStore` -- world lore: articles, maps, calendars, timeline events, color labels, undo/redo
  - `vibeStore` -- zone vibe/context metadata for art generation
  - `adminStore` -- admin panel state, live server connection, player/zone/mob/quest data
  - `gitStore` -- git repository status, commit history, branch management
  - `spriteDefinitionStore` -- player sprite definitions: tiers, achievements, staff categories, variants
- **Types**: `src/types/` mirrors Kotlin DTOs from `reference/world-yaml-dtos/`
- **YAML I/O**: Uses `yaml` package CST mode for format-preserving round-trip. See `src/lib/loader.ts`, `src/lib/saveZone.ts`, `src/lib/saveConfig.ts`.
- **Validation**: Client-side validation in `src/lib/validateZone.ts` and `src/lib/validateConfig.ts`. Must mirror rules from `reference/world-loader/WorldLoader.kt`.
- **Graph**: Zone maps use XY Flow (React Flow) with dagre layout. Custom `RoomNode` with background images, entity sprites, and visible exit handles. See `src/components/zone/`.
- **Art Generation**: Two art styles -- "arcanum" (baroque cosmic gold-indigo) and "gentle_magic" (soft dreamlike lavender). Templates in `src/lib/arcanumPrompts.ts`. Hardcoded style suffixes appended to every prompt after LLM enhancement for consistency. Generation dimensions capped at 1024px (resized to final target). Supports room, mob, item, portrait, ability icon, and 15+ UI asset types. Class color palettes injected for ability/status icon generation.
- **Global Assets**: Key-value pairs in `application.yaml` under `ambonmud.globalAssets` for app-wide generated art (e.g. `compass_rose: abc123.png`).
- **Decorative Backgrounds**: Config and lore panel hosts use `config-bg.png` at 10% opacity with `mix-blend-soft-light`. Sidebar uses gradient glow only (no background image).
- **Lore System**: Article-based world-building with 11 built-in templates + custom user-defined templates (via `TemplateEditorPanel`), TipTap rich text editor, @mentions, interactive maps (Leaflet CRS.Simple), timeline with eras, relationship graph, and article gallery (multiple images per article). Full undo/redo (50-entry history). AI-powered tools: timeline inference from article content, relationship inference (deterministic + field-based), gap analysis, consistency auditing, @mention suggestions, rewrite-with-instructions (directed AI rewrite of article content + fields). Bulk operations: multi-select, retag, reparent, delete, draft toggle, template change. Full-text search across article content. Obsidian/Markdown import wizard. Lore Bible export to Markdown and PDF. Command palette (Ctrl+K). Types in `src/types/lore.ts`, store in `src/stores/loreStore.ts`, persistence in `src/lib/lorePersistence.ts`.
- **Showcase Export**: `src/lib/exportShowcase.ts` converts `WorldLore` → `ShowcaseData` (TipTap JSON → HTML, relation merging, image URL resolution). Toolbar "Publish Lore" button deploys JSON to R2 via `deploy_showcase_to_r2`.

### Backend (Rust)

- `lib.rs` -- Registers all Tauri commands
- `project.rs` -- File I/O for project/zone/config files
- `settings.rs` -- User-level settings persistence (API keys), merged settings command
- `project_settings.rs` -- Project-level settings (art pipeline, R2 config) stored in `<project>/.arcanum/settings.json`
- `deepinfra.rs` -- DeepInfra API client for AI image generation
- `runware.rs` -- Runware API client (alternative image provider)
- `openai_images.rs` -- OpenAI image generation provider (GPT Image)
- `generation.rs` -- Image generation utilities (dimension capping to 1024px, format inference, resize pipeline)
- `assets.rs` -- Asset manifest (JSON) management, content-addressed storage (SHA256 hash filenames)
- `r2.rs` -- Cloudflare R2 sync with AWS Signature V4 signing (no SDK dependency), showcase deploy
- `vibes.rs` -- Zone vibe/context metadata for LLM-informed art generation
- `llm.rs` -- LLM integration for prompt enhancement and vision analysis dispatch (Anthropic, OpenRouter, DeepInfra)
- `anthropic.rs` -- Anthropic Claude API client (text completion + vision)
- `openrouter.rs` -- OpenRouter API client for LLM completion
- `admin.rs` -- HTTP client for remote AmbonMUD admin API (players, zones, mobs, quests, achievements)
- `git.rs` -- Git repository operations (init, status, commit, push, pull, branch management, PR creation)
- `sketch.rs` -- Sketch-to-image analysis via LLM for art enhancement

### Showcase (showcase/)

- Standalone Vite + React 19 + Tailwind 4 SPA deployed to Cloudflare Pages
- Reads `showcase.json` from R2 at runtime (`VITE_SHOWCASE_URL` env var in production, `/data/showcase.json` locally)
- Types in `src/types/showcase.ts` mirror `ShowcaseData` from `creator/src/lib/exportShowcase.ts`
- Pages: Home, Codex (ArticlesPage), Article detail (ArticlePage), Maps, Timeline, Connections (GraphPage), 404
- Article detail includes image gallery (crossfade + thumbnail selector) and grouped bidirectional relationship sidebar
- Map pins use Leaflet CRS.Simple coordinates: `position[0]` = lat (Y from bottom), `position[1]` = lng (X). Showcase converts to pixels: `px_x = lng * scale`, `px_y = (height - lat) * scale`
- `wrangler.toml` for Cloudflare Pages deployment; `_redirects` for SPA routing

### IPC Pattern

Images are served to the frontend as base64 data URLs via the `read_image_data_url` Tauri command. This bypasses the Tauri asset protocol which has issues on Windows.

## Coding Conventions

### TypeScript
- Path alias: `@/` maps to `src/`
- Tailwind CSS for all styling -- no CSS modules or styled-components
- Component files use PascalCase: `AssetGallery.tsx`
- Hook files use camelCase with `use` prefix: `useImageSrc.ts`
- Prefer `interface` over `type` for object shapes
- Zustand selectors: `useStore((s) => s.field)` -- select individual fields, not the whole store

### Rust
- All public functions exposed to the frontend are `#[tauri::command]`
- Error handling: return `Result<T, String>` from commands (Tauri serializes the error)
- Use `tokio::fs` for async file operations

### Styling
- Follow the Arcanum design system in `ARCANUM_STYLE_GUIDE.md`
- Dark theme only -- deep indigo backgrounds, aurum-gold accents
- Fonts: Cinzel (display), Crimson Pro (body), JetBrains Mono (code)
- CSS custom properties defined in `src/index.css` -- use semantic tokens like `bg-bg-primary`, `text-text-primary`, `border-border-default`
- No sans-serif fonts in the UI
- Decorative background images use low opacity (10-18%) and `pointer-events-none`
- Tab names and action buttons use aurum-gold (`text-accent`) for visual hierarchy

### YAML
- Preserve comments and formatting when editing existing files (CST mode)
- Key ordering: zone, lifespan, startRoom, image, audio, rooms, mobs, items, shops, quests, gatheringNodes, recipes
- Only serialize non-zero values in StatMap fields

## Testing

- Vitest for data-layer tests only (no UI tests)
- Test files live alongside source in `__tests__/` directories
- Focus areas: YAML round-trip, ID normalization, validation rules, stat formulas

## Git Workflow

- Create a new feature branch from `main` for each piece of work
- One logical change per PR
- Branch naming: `phase{N}/feature-name` or `docs/description`

## Common Pitfalls

- **Tauri asset protocol**: Don't use `convertFileSrc()` for images on Windows. Use the `read_image_data_url` IPC command instead.
- **Flex scrolling**: Containers that need to scroll must have `min-h-0 flex-1` on parent to allow `overflow-y-auto` to work.
- **Settings split**: Settings are split into user-level (API keys in `~/.tauri/settings.json`) and project-level (art/R2 config in `<project>/.arcanum/settings.json`). `get_merged_settings` combines both. `loadSettings()` in `assetStore` auto-seeds project settings on first open. If adding a new setting, decide if it's per-user or per-project, then update the corresponding Rust struct (`Settings` or `ProjectSettings`) and TypeScript interface (`Settings` or `ProjectSettings` in `types/assets.ts`).
- **Reference files**: The `reference/` directory is read-only Kotlin source from the AmbonMUD server. Never modify these files -- they're the source of truth for type shapes.
- **ReactFlow backgrounds**: ReactFlow renders its own opaque canvas layer. To overlay background images on the zone builder, place them ON TOP with `pointer-events-none`, `z-[1]`, and `mix-blend-screen` -- not behind the canvas.
- **Server detection**: The server outputs `"AmbonMUD listening on telnet port {port}"` when ready. Match this exact string in `useServerManager.ts`.
- **Config data-driven fields**: Many game systems (equipment slots, crafting skills, station types, etc.) are data-driven from `application.yaml`. Editors like `ItemEditor`, `RecipeEditor`, `GatheringNodeEditor` derive dropdown options from `configStore` with fallback to hardcoded defaults.
- **Art style templates**: Asset prompt templates in `arcanumPrompts.ts` are keyed by both `AssetType` and `ArtStyle`. When adding a new asset type, add templates for both "arcanum" and "gentle_magic" styles.
- **Global assets**: Stored as simple `Record<string, string>` (key → filename). Use `setIn` not `saveMapSection` when saving -- values are strings, not objects.
- **Map pin coordinates**: Creator stores pins as `[lat, lng]` in Leaflet CRS.Simple where `lat` = Y from bottom edge, `lng` = X from left. When rendering outside Leaflet (e.g. showcase), convert: `pixel_x = lng`, `pixel_y = map_height - lat`.
- **Showcase data flow**: "Publish Lore" in Toolbar → `exportShowcaseData()` → `deploy_showcase_to_r2` Rust command → R2 at `showcase/showcase.json`. The showcase SPA fetches this at runtime. No rebuild needed for content updates.
- **Showcase images**: Article/map images reference R2 URLs via `imageBaseUrl` from creator settings (`r2_custom_domain`). Images must be synced to R2 before they appear on the showcase site.
- **Lore undo/redo**: All lore mutations must call `snapshotLore(s)` in their `set()` call. Missing it means the operation can't be undone. The zone store uses zundo (different pattern).
- **Style suffixes**: After LLM prompt enhancement, the style suffix (`GENTLE_MAGIC_SUFFIX` or `ARCANUM_SUFFIX`) is appended verbatim to ensure consistent aesthetics. Don't include the suffix in the LLM system prompt — it's added after.
- **Generation dimensions**: Image generation APIs receive dimensions capped at 1024px (via `generation::cap_generation_dims`). The backend resizes to the final target dimensions after generation. Don't request >1024px from FLUX models.
- **Command palette**: Ctrl+K opens the global command palette (not sidebar search). The old sidebar search focus handler was removed.
- **Article gallery**: Articles have both `image?: string` (primary) and `gallery?: string[]` (additional). Export resolves both to `imageUrl` and `galleryUrls` in ShowcaseData.
- **Vision API**: `llm_complete_with_vision` requires an Anthropic API key. Used for map analysis. The data URL must be a valid `data:image/...;base64,...` format.
- **Custom templates**: Stored in `lore.yaml` under `customTemplates`. Use `getTemplateSchema(templateId, customTemplates)` from `loreTemplates.ts` instead of directly indexing `TEMPLATE_SCHEMAS` — the latter only has built-in templates. `getAllTemplateSchemas()` returns both.
- **Rewrite vs Enhance**: "Enhance" improves prose quality without changing meaning. "Rewrite" takes user instructions and may change content, fields, or both. Rewrite returns JSON with `content` + `fields` keys; Enhance returns plain text. Both are in the LoreEditor/ArticleEditor toolbar.
- **PDF export**: Uses `window.print()` on a styled HTML document generated from the Markdown Lore Bible. Fonts are loaded from Google Fonts in the print document (requires internet). The print window opens in a new tab.
- **Toolbar background image**: The toolbar filigree (`toolbar-bg.jpg`) was intentionally removed — the `instrument-panel` gradient is sufficient.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Arcanum**

A Tauri 2 desktop app for building MUD game worlds. Arcanum provides zone editing, config tuning, world lore authoring, and cinematic story creation — helping builders craft rich, interconnected game worlds and present them to players and the public.

**Core Value:** Builders can turn their zone worldbuilding into living narratives — stories that work as DM presentation aids at the table and as cinematic experiences on the public showcase.

### Constraints

- **Tech stack**: Must use existing React 19 + Zustand + Tailwind stack. No new frameworks.
- **Design system**: Must follow Arcanum style guide (dark indigo/aurum-gold theme, Cinzel/Crimson Pro fonts).
- **Config compatibility**: Preset values must produce valid `application.yaml` that the Kotlin server accepts.
- **Non-destructive**: Wizard never overwrites values without explicit per-section user approval.
- **Panel registry**: New wizard tab must integrate with the existing panel registry and sidebar navigation.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Context
## Recommended Additions
### Animation Engine
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| motion | ^12.37 | Scene transitions, sprite movement, text reveals, parallax interpolation, presentation slide transitions | Declarative React-native API (`<motion.div>`). Supports keyframe sequences, spring physics, CSS `offset-path` animation (sprite movement along paths), `useAnimate` for imperative sequencing, `useAnimationFrame` for per-frame control. LazyMotion + `m` component reduces initial cost to 4.6kb (load `domAnimation` features on demand at +15kb). Timeline sequencing via `useAnimate` avoids needing a separate sequencing library. 30M+ monthly npm downloads, actively maintained, React 18.2+ compatible. |
- **react-spring**: Better for physics-heavy gesture interactions (drag inertia, spring-only systems). Weaker at timeline sequencing, exit animations, and layout animations. Motion's `useAnimate` provides imperative sequence control that maps directly to scene-by-scene cinematic playback. react-spring's `Parallax` component is scroll-based -- our parallax is time/scene-based, not scroll-based.
- **CSS animations only**: Insufficient for imperative sequencing (play scene 1, then 2, then 3 with variable timing). No spring physics for natural-feeling entity movements. CSS `offset-path` alone can't be dynamically orchestrated scene-by-scene.
- **GSAP**: Powerful but license concerns for commercial use (GreenSock license), large bundle, imperative-only API feels foreign in React component tree.
- **anime.js**: Less React integration, no declarative component API, smaller ecosystem.
- **Rive/Lottie**: Designed for pre-built vector animations, not dynamic scene composition from runtime data (room images, entity sprites).
- `animate` prop: Declarative scene transitions (fade, slide, scale for background/entity/text layers)
- `useAnimate`: Imperative sequence control for presentation mode (advance through scenes programmatically)
- `useAnimationFrame(callback)`: Per-frame particle updates and continuous effects
- `offsetPath` + `offsetDistance` animation: Sprite movement along defined SVG paths
- `AnimatePresence`: Exit animations when switching between scenes
- `variants` + `staggerChildren`: Coordinated text reveal (narration appearing word-by-word or line-by-line)
- `LazyMotion` + `domAnimation`: Bundle-optimized feature loading
### Drag-and-Drop (Timeline Scene Reordering)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @dnd-kit/core | ^6.3 | Drag-and-drop primitives for scene card reordering in timeline editor | Lightweight (10kb), zero-dependency drag engine with sensors (pointer, keyboard), collision detection, and accessibility built-in. Modular architecture -- only import what you need. |
| @dnd-kit/sortable | ^10.0 | Sortable preset for reorderable scene card list | Thin layer on @dnd-kit/core optimized for sortable lists. `useSortable` hook + `SortableContext` provides drag handles, reorder animations, and `arrayMove` utility. Supports horizontal layout constraint via `restrictToHorizontalAxis` modifier. |
| @dnd-kit/utilities | ^3.2 | CSS transform utilities for drag visuals | `CSS.Transform.toString()` for smooth drag overlay rendering. |
- **react-beautiful-dnd / @hello-pangea/dnd**: Higher-level but more opinionated. Heavier bundle. The original (Atlassian) is deprecated; hello-pangea fork is maintained but adds unnecessary abstraction for our simple flat list of scene cards.
- **pragmatic-drag-and-drop**: Atlassian's newer library is framework-agnostic (not React-specific), which means more boilerplate for React integration. Better for complex cross-framework scenarios we don't have.
- **HTML5 drag-and-drop**: No animation support, poor accessibility, inconsistent cross-browser behavior, no keyboard navigation.
- **@dnd-kit/react (v0.3.x)**: The experimental rewrite is promising but at v0.3 -- too early for production use. Stick with the stable v6.x core.
### Particle Effects
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Custom Canvas + `useAnimationFrame` | N/A | Sparks, mist, ambient particles per scene | The particle needs are narrow and specific: 3-5 effect presets (sparks, mist/fog, embers, rain, dust motes) rendered over scene backgrounds. A custom `<ParticleCanvas>` component using HTML5 Canvas 2D + Motion's `useAnimationFrame` for the render loop is simpler, lighter, and more controllable than tsParticles. |
- **@tsparticles/slim**: ~45-60kb gzipped for the slim bundle. Brings a full particle physics engine, interactivity system, and dozens of shape/movement plugins we don't need. The `@tsparticles/react` wrapper hasn't been updated in 2 years (v3.0.0). Configuration is JSON-heavy and harder to integrate with a scene-data-driven model.
- **Custom approach**: 200-400 lines of TypeScript for a particle system with 5 presets. Each preset is a config object (particle count, velocity range, color, opacity curve, size range, spawn region). The render loop uses `useAnimationFrame` from Motion. Canvas is composited over the scene background with `pointer-events: none`. Full control over performance (particle budget per scene).
- **Proton.js**: Another full physics engine -- same problem as tsParticles. Overkill for ambient effects.
### Parallax Layers
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| CSS transforms + Motion `animate` | N/A | Multi-layer parallax depth effect in scene backgrounds | Scene parallax is NOT scroll-driven -- it's time/animation-driven (layers shift during scene transitions or in response to presentation advance). CSS `transform: translateZ()` with `perspective` parent, animated by Motion's `animate` prop, gives precise per-layer control without any parallax library. |
- **@react-spring/parallax**: Scroll-based parallax container. Our parallax is scene-transition-based (layers move when a scene changes or during cinematic playback), not on user scroll.
- **react-scroll-parallax**: Same problem -- designed for scroll-driven websites, not discrete scene transitions.
- **Custom CSS + Motion**: Parallax layers are just divs with different `translateX`/`translateY` offsets that interpolate when the scene changes. Motion's `animate` prop handles this declaratively. No library needed.
### Sprite Movement Paths
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| CSS `offset-path` + Motion | N/A | Animate entity sprites along defined movement paths within a scene | CSS `offset-path: path("M 0 0 C ...")` defines an SVG path; Motion animates `offsetDistance` from "0%" to "100%". Builders define paths in the scene editor (click waypoints); paths are stored as SVG `d` attributes. Motion provides timing, easing, and sequencing. |
- Scene editor: Builders click 3-5 waypoints on the scene preview. Waypoints are converted to a cubic bezier SVG path string (`M x0 y0 C x1 y1 x2 y2 x3 y3 ...`).
- Playback: `<motion.div animate={{ offsetDistance: "100%" }} transition={{ duration: 3 }} style={{ offsetPath: 'path("...")' }} />`
- Stored in scene data as `movementPath: string` (SVG d attribute).
### Fullscreen Presentation & Embedded Player
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Fullscreen API (browser native) | N/A | Enter/exit fullscreen for DM presentation mode | `document.documentElement.requestFullscreen()` is universally supported. No library needed. Tauri 2 supports the Fullscreen API in its webview. |
| Custom `usePresentation` hook | N/A | Keystroke navigation, auto-play timer, scene sequencing | A Zustand slice or custom hook managing: current scene index, playing/paused state, advance/retreat via ArrowRight/ArrowLeft/Space, auto-play with configurable interval. This is 50-100 lines of custom code -- no presentation framework (Spectacle, Reveal.js) is appropriate because our "slides" are rich cinematic scenes, not markdown/HTML slides. |
- **Spectacle**: Designed for developer conference talks with markdown/JSX slides. Our "slides" are rich layered scenes with parallax, particles, entities, and narration. Spectacle's slide model doesn't fit.
- **Reveal.js**: Same mismatch -- HTML-based slide decks, not cinematic scene composition.
- **Swiper/Embla**: Carousel libraries designed for image galleries. Missing: per-scene animation orchestration, particle effects, entity movement sequencing.
## Explicitly NOT Adding
| Category | Rejected | Why Not |
|----------|----------|---------|
| Canvas framework | PixiJS / @pixi/react | Massive overkill (200kb+) for layered divs with CSS transforms. PixiJS is for game rendering with thousands of sprites at 60fps. We have 1-5 entity sprites per scene rendered as DOM elements. CSS + Motion handles this elegantly without a WebGL context. |
| Particle library | @tsparticles/slim | 45-60kb for a full particle physics engine when we need 5 fixed presets with 50-200 particles each. Custom Canvas 2D with `useAnimationFrame` is lighter, simpler, and gives full control. |
| Scroll parallax | @react-spring/parallax, react-scroll-parallax | Wrong paradigm. Our parallax is scene-transition-driven, not scroll-driven. Motion's `animate` prop on positioned divs does exactly what we need. |
| Video rendering | ffmpeg.wasm, MediaRecorder | Exporting stories as video is out of scope for v1.1. The showcase player renders stories live in the browser. |
| 3D engine | Three.js, React Three Fiber | No 3D content in the story system. Parallax depth is simulated with CSS transforms on 2D layers. |
| Timeline library | dnd-timeline, Gantt chart libs | These are scheduling/calendar timeline UIs. Our timeline is a horizontal strip of scene cards -- a sortable list, not a time-range scheduler. @dnd-kit/sortable is the right abstraction. |
| Presentation framework | Spectacle, Reveal.js | Designed for text-based slide decks. Our presentation is a cinematic engine with layered backgrounds, particles, entity animations, and narration overlays. |
| Animation (alt) | react-spring | Weaker at imperative sequencing (scene-by-scene playback), no built-in `AnimatePresence` for exit animations, scroll-based parallax doesn't fit our model. Motion is better for timeline-driven cinematic sequences. |
| Animation (alt) | GSAP | License concerns for desktop app distribution. Imperative-only API is a poor fit for React component tree. Heavy bundle. |
| State library | XState, Redux | Presentation state is a simple index + playing boolean. Zustand slice or custom hook is sufficient. No finite state machine library needed. |
## Alternatives Considered (Full Matrix)
| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Animation | motion ^12.37 | react-spring ^9.7 | Weaker imperative sequencing, scroll-based parallax wrong paradigm, no AnimatePresence |
| Animation | motion ^12.37 | GSAP ^3.12 | License concerns, imperative-only, not React-native |
| Animation | motion ^12.37 | CSS only | No imperative orchestration for scene sequences, no spring physics |
| Drag-and-drop | @dnd-kit/core ^6.3 | @hello-pangea/dnd | Heavier, more opinionated, unnecessary abstraction for flat list |
| Drag-and-drop | @dnd-kit/core ^6.3 | pragmatic-drag-and-drop | Framework-agnostic = more React boilerplate |
| Drag-and-drop | @dnd-kit/core ^6.3 | @dnd-kit/react ^0.3 | Experimental, pre-1.0 -- not production ready |
| Particles | Custom Canvas 2D | @tsparticles/slim | 45-60kb for 5 fixed presets we can write in 300 lines |
| Particles | Custom Canvas 2D | Proton.js | Full physics engine overkill for ambient effects |
| Parallax | CSS + Motion | @react-spring/parallax | Scroll-based, not scene-transition-based |
| Path animation | CSS offset-path + Motion | SVG SMIL | Deprecated by Chrome, poor React integration |
| Path animation | CSS offset-path + Motion | Canvas path rendering | Harder to compose with DOM entity elements |
| Presentation | Custom hook + Fullscreen API | Spectacle | Wrong abstraction (text slides vs cinematic scenes) |
| Presentation | Custom hook + Fullscreen API | Swiper/Embla | Missing animation orchestration, particle effects |
## Installation
# New dependencies for cinematic story authoring
- motion (with LazyMotion/domAnimation): ~4.6kb initial + 15kb on first animation use (tree-shakeable)
- @dnd-kit/core: ~10kb
- @dnd-kit/sortable: ~3kb
- @dnd-kit/utilities: ~1kb
- **Total new code: ~34kb** (loaded on demand via Vite code splitting)
# Only motion for the embedded story player (no dnd-kit needed -- playback only)
## Integration with Existing Stack
| Existing Tech | How Zone Stories Uses It |
|---------------|------------------------|
| zoneStore (Zustand) | Reads zone data (rooms, mobs, items) for entity picker and scene composition |
| loreStore (Zustand) | Stories are a new lore article type -- inherits undo/redo, persistence, showcase export |
| assetStore (Zustand) | Room background images and entity sprites loaded via existing asset pipeline |
| TipTap 3 | Narration text editing within scenes (reuse existing rich text editor) |
| XY Flow | Zone map for entity picking (click a room/mob on the map to add to scene) |
| Tailwind CSS 4 | All wizard UI styled with existing design tokens (`bg-bg-primary`, `text-accent`, etc.) |
| Panel registry | Story editor registered as new panel in Lore group |
| Showcase export | `exportShowcaseData()` extended to include story scenes with animation metadata |
| R2 sync | Story entity images already in R2 via existing asset sync |
| Recharts | Potential reuse for any story analytics (scene count, duration estimates) |
## Motion Configuration for Arcanum
## Data Model Implications (Stack-Relevant)
- **No new database or storage format** -- scenes serialize to the existing `lore.yaml` structure
- **Image references** are asset IDs resolved via the existing asset manifest
- **Movement paths** are SVG `d` attribute strings (compact, portable)
- **Particle presets** are enum strings (`"sparks" | "mist" | "embers" | "rain" | "dust"`)
- **Parallax config** is layer count + depth multiplier per layer (2-3 numbers per scene)
## Showcase Player Architecture
| Feature | Creator (Editor) | Showcase (Player) |
|---------|------------------|-------------------|
| Scene editing | Yes (dnd-kit, TipTap) | No (read-only) |
| Parallax layers | Yes | Yes (same Motion code) |
| Particle effects | Yes | Yes (same Canvas code) |
| Sprite paths | Yes (editable waypoints) | Yes (playback only) |
| Narration text | Yes (editable) | Yes (display only) |
| Presentation mode | Yes (fullscreen) | Yes (inline + fullscreen) |
| Auto-play | Yes | Yes |
| Keyboard nav | Yes | Yes |
## Sources
- [Motion official site](https://motion.dev) -- v12.37+, March 2026
- [Motion React installation docs](https://motion.dev/docs/react-installation) -- React 18.2+ compatible
- [Motion LazyMotion docs](https://motion.dev/docs/react-lazy-motion) -- 4.6kb initial, domAnimation +15kb
- [Motion reduce bundle size](https://motion.dev/docs/react-reduce-bundle-size) -- domAnimation vs domMax features
- [Motion animation docs](https://motion.dev/docs/react-animation) -- keyframes, springs, variants
- [Motion path tutorial](https://motion.dev/tutorials/react-motion-path) -- offset-path + offsetDistance
- [Motion useAnimationFrame](https://motion.dev/docs/react-use-animation-frame) -- per-frame callbacks
- [Motion GitHub](https://github.com/motiondivision/motion) -- 30M+ monthly downloads
- [@dnd-kit/core npm](https://www.npmjs.com/package/@dnd-kit/core) -- v6.3.1, 2400+ dependents
- [@dnd-kit sortable docs](https://docs.dndkit.com/presets/sortable) -- SortableContext, useSortable, arrayMove
- [MDN offset-path](https://developer.mozilla.org/en-US/docs/Web/CSS/offset-path) -- browser support table
- [CSS motion path MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Motion_path)
- [Fullscreen API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API)
- [Motion vs React Spring comparison (2025)](https://hookedonui.com/animating-react-uis-in-2025-framer-motion-12-vs-react-spring-10/)
- [React animation libraries comparison (2026)](https://blog.logrocket.com/best-react-animation-libraries/)
- [tsParticles GitHub](https://github.com/tsparticles/tsparticles) -- considered and rejected for bundle size
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->
