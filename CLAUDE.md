# CLAUDE.md

Project-level instructions for Claude Code when working on this repository.

## Project Overview

Ambon Arcanum is a Tauri 2 desktop app for building MUD game worlds. React 19 + TypeScript frontend, Rust backend. It reads/writes YAML zone files and application.yaml for the AmbonMUD server.

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
  - `assetStore` -- image generation, asset manifest, R2 sync, settings
  - `loreStore` -- world lore: articles, maps, calendars, timeline events, color labels
- **Types**: `src/types/` mirrors Kotlin DTOs from `reference/world-yaml-dtos/`
- **YAML I/O**: Uses `yaml` package CST mode for format-preserving round-trip. See `src/lib/loader.ts`, `src/lib/saveZone.ts`, `src/lib/saveConfig.ts`.
- **Validation**: Client-side validation in `src/lib/validateZone.ts` and `src/lib/validateConfig.ts`. Must mirror rules from `reference/world-loader/WorldLoader.kt`.
- **Graph**: Zone maps use XY Flow (React Flow) with dagre layout. Custom `RoomNode` with background images, entity sprites, and visible exit handles. See `src/components/zone/`.
- **Art Generation**: Two art styles -- "arcanum" (baroque cosmic gold-indigo) and "gentle_magic" (soft dreamlike lavender). Templates in `src/lib/arcanumPrompts.ts`. Supports room, mob, item, and UI asset types.
- **Global Assets**: Key-value pairs in `application.yaml` under `ambonmud.globalAssets` for app-wide generated art (e.g. `compass_rose: abc123.png`).
- **Decorative Backgrounds**: UI panels use themed background images from `src/assets/` at low opacity (10-18%) with `mix-blend-screen` or gradient overlays.
- **Lore System**: Article-based world-building with 11 templates, TipTap rich text editor, @mentions, interactive maps (Leaflet CRS.Simple), timeline, and relationship graph. Types in `src/types/lore.ts`, store in `src/stores/loreStore.ts`, persistence in `src/lib/lorePersistence.ts`.
- **Showcase Export**: `src/lib/exportShowcase.ts` converts `WorldLore` → `ShowcaseData` (TipTap JSON → HTML, relation merging, image URL resolution). Toolbar "Publish Lore" button deploys JSON to R2 via `deploy_showcase_to_r2`.

### Backend (Rust)

- `lib.rs` -- Registers all Tauri commands
- `project.rs` -- File I/O for project/zone/config files
- `settings.rs` -- Settings persistence (API keys, R2 credentials)
- `deepinfra.rs` -- DeepInfra API client for AI image generation
- `runware.rs` -- Runware API client (alternative image provider)
- `assets.rs` -- Asset manifest (JSON) management, content-addressed storage (SHA256 hash filenames)
- `r2.rs` -- Cloudflare R2 sync with AWS Signature V4 signing (no SDK dependency), showcase deploy
- `vibes.rs` -- Zone vibe/context metadata for LLM-informed art generation
- `llm.rs` -- LLM integration for prompt enhancement (Anthropic, OpenRouter)

### Showcase (showcase/)

- Standalone Vite + React 19 + Tailwind 4 SPA deployed to Cloudflare Pages
- Reads `showcase.json` from R2 at runtime (`VITE_SHOWCASE_URL` env var in production, `/data/showcase.json` locally)
- Types in `src/types/showcase.ts` mirror `ShowcaseData` from `creator/src/lib/exportShowcase.ts`
- Pages: Home, Codex (ArticlesPage), Article detail (ArticlePage), Maps, Timeline, Connections (GraphPage), 404
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
- **Settings loading**: `loadSettings()` is called in `App.tsx` on mount. If a new setting is added, update both `Settings` in Rust (`settings.rs`) and TypeScript (`types/assets.ts`).
- **Reference files**: The `reference/` directory is read-only Kotlin source from the AmbonMUD server. Never modify these files -- they're the source of truth for type shapes.
- **ReactFlow backgrounds**: ReactFlow renders its own opaque canvas layer. To overlay background images on the zone builder, place them ON TOP with `pointer-events-none`, `z-[1]`, and `mix-blend-screen` -- not behind the canvas.
- **Server detection**: The server outputs `"AmbonMUD listening on telnet port {port}"` when ready. Match this exact string in `useServerManager.ts`.
- **Config data-driven fields**: Many game systems (equipment slots, crafting skills, station types, etc.) are data-driven from `application.yaml`. Editors like `ItemEditor`, `RecipeEditor`, `GatheringNodeEditor` derive dropdown options from `configStore` with fallback to hardcoded defaults.
- **Art style templates**: Asset prompt templates in `arcanumPrompts.ts` are keyed by both `AssetType` and `ArtStyle`. When adding a new asset type, add templates for both "arcanum" and "gentle_magic" styles.
- **Global assets**: Stored as simple `Record<string, string>` (key → filename). Use `setIn` not `saveMapSection` when saving -- values are strings, not objects.
- **Map pin coordinates**: Creator stores pins as `[lat, lng]` in Leaflet CRS.Simple where `lat` = Y from bottom edge, `lng` = X from left. When rendering outside Leaflet (e.g. showcase), convert: `pixel_x = lng`, `pixel_y = map_height - lat`.
- **Showcase data flow**: "Publish Lore" in Toolbar → `exportShowcaseData()` → `deploy_showcase_to_r2` Rust command → R2 at `showcase/showcase.json`. The showcase SPA fetches this at runtime. No rebuild needed for content updates.
- **Showcase images**: Article/map images reference R2 URLs via `imageBaseUrl` from creator settings (`r2_custom_domain`). Images must be synced to R2 before they appear on the showcase site.
