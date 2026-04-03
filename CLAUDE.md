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
