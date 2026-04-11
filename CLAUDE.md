# CLAUDE.md

Project-level instructions for Claude Code when working on this repository.

## Project Overview

Arcanum is a Tauri 2 desktop app for building MUD game worlds. React 19 + TypeScript frontend, Rust backend. It reads/writes YAML zone files and application.yaml for the AmbonMUD server.

## Repository Layout

- `creator/` -- The Tauri application (frontend + backend)
- `creator/src/` -- React frontend (components, stores, types, lib)
- `creator/src-tauri/src/` -- Rust backend (Tauri commands)
- `showcase/` -- Public lore showcase website (Vite + React SPA). Runs in three modes: self-hosted (existing `lore.ambon.dev`), hub landing (`arcanum-hub.com`), and per-world subdomain (`<slug>.arcanum-hub.com`). The hub modes are selected at runtime via `detectHubMode()` against `VITE_HUB_ROOT_DOMAIN`.
- `hub-worker/` -- Cloudflare Worker backing the central Arcanum Hub at `arcanum-hub.com`. Owns publish API, admin API, AI proxy (image/LLM/vision), and ships the showcase SPA via an `[assets]` binding. Bindings: D1 `arcanum-hub` (users, worlds, quotas), R2 `arcanum-hub` (per-world showcase.json + WebP images).
- `hub-admin/` -- Tiny Vite + React SPA for admin-only user + quota management, deployed to `arcanum-hub-admin.pages.dev` (proxied through `admin.arcanum-hub.com`). Master-key auth against `HUB_ADMIN_KEY` secret.
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

# Deploy to Cloudflare Pages (self-hosted, lore.ambon.dev)
npx wrangler pages deploy dist --project-name=ambon-showcase
```

### Hub worker + admin

```bash
cd hub-worker

# Deploy worker (also rebuilds the showcase SPA with the hub env var
# and uploads it via the [assets] binding)
npm run deploy

# Apply a migration to the live D1
npx wrangler d1 execute arcanum-hub --remote --file=./src/migrations/<file>.sql

# Set a provider secret (interactive)
npx wrangler secret put RUNWARE_API_KEY

cd ../hub-admin

# Build + deploy the admin SPA
VITE_HUB_API_URL=https://api.arcanum-hub.com npm run build
npx wrangler pages deploy dist --project-name=arcanum-hub-admin --branch=main
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
  - `storyStore` -- story/scene composition and visual storytelling
  - `themeStore` -- runtime theme state
  - `toastStore` -- toast notification queue
  - `tuningWizardStore` -- tuning wizard state (presets, comparisons, pending changes)
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
- `openai_tts.rs` -- OpenAI text-to-speech API client
- `generation.rs` -- Image generation utilities (dimension capping to 1024px, format inference, resize pipeline)
- `assets.rs` -- Asset manifest (JSON) management, content-addressed storage (SHA256 hash filenames)
- `r2.rs` -- Cloudflare R2 sync with AWS Signature V4 signing (no SDK dependency), showcase deploy
- `vibes.rs` -- Zone vibe/context metadata for LLM-informed art generation
- `llm.rs` -- LLM integration for prompt enhancement and vision analysis dispatch (Anthropic, OpenRouter, DeepInfra). Short-circuits to `hub_ai` when `settings.use_hub_ai` is on.
- `anthropic.rs` -- Anthropic Claude API client (text completion + vision)
- `openrouter.rs` -- OpenRouter API client for LLM completion
- `hub.rs` -- Showcase publish pipeline to the central hub. Builds ShowcaseData, strips story `cinematicUrl`, re-encodes every referenced image as lossy WebP via `libwebp`, content-addresses the blobs, diffs against the hub's existing set, uploads missing images + manifest. Progress events stream via `hub-publish-progress`.
- `hub_ai.rs` -- Hub-mode proxy client for image/LLM/vision calls. `is_enabled(&settings)` gates whether the existing provider commands (`runware_generate_image`, `openai_generate_image`, `deepinfra::generate_image`, `llm_complete`, `llm_complete_with_vision`) short-circuit to `/ai/*` endpoints on `api.arcanum-hub.com`. Returns the same `GeneratedImage` shape as the direct-provider path so the frontend is unaware of hub mode.
- `admin.rs` -- HTTP client for remote AmbonMUD admin API (players, zones, mobs, quests, achievements)
- `git.rs` -- Git repository operations (init, status, commit, push, pull, branch management, PR creation)
- `sketch.rs` -- Sketch-to-image analysis via LLM for art enhancement
- `arcanum_meta.rs` -- Build metadata and version info
- `audio_mix.rs` -- Audio mixing and processing
- `cancellation.rs` -- Task cancellation support for long-running operations
- `captions.rs` -- Caption/subtitle generation
- `ffmpeg.rs` -- FFmpeg integration for media processing
- `ffmpeg_progress.rs` -- FFmpeg progress tracking
- `video_encode.rs` -- Video encoding pipeline
- `video_export.rs` -- Video export and rendering

### Showcase (showcase/)

- Standalone Vite + React 19 + Tailwind 4 SPA. Self-hosted deploys still go to Cloudflare Pages (`ambon-showcase` project at `lore.ambon.dev`); the hub serves the same bundle via the Worker's `[assets]` binding, built with `VITE_HUB_ROOT_DOMAIN=arcanum-hub.com`.
- `src/lib/hubMode.ts::detectHubMode()` inspects `window.location.hostname` against `VITE_HUB_ROOT_DOMAIN`. Returns `"root"` (landing), `"world"` with a slug (per-world), or `"self-hosted"` (fallback).
- `DataContext` branches on the result: root mode skips data loading and the `App` shortcut routes to `HubIndexPage` which fetches `/api/index`; world mode fetches `/showcase.json` from the same origin (the Worker resolves the slug from the Host header); self-hosted behaves exactly as before.
- Types in `src/types/showcase.ts` mirror `ShowcaseData` from `creator/src/lib/exportShowcase.ts`
- Pages: Home, Codex (ArticlesPage), Article detail (ArticlePage), Maps, Timeline, Connections (GraphPage), HubIndexPage, 404
- Article detail includes image gallery (crossfade + thumbnail selector) and grouped bidirectional relationship sidebar
- Map pins use Leaflet CRS.Simple coordinates: `position[0]` = lat (Y from bottom), `position[1]` = lng (X). Showcase converts to pixels: `px_x = lng * scale`, `px_y = (height - lat) * scale`
- `wrangler.toml` for Cloudflare Pages deployment; `_redirects` for SPA routing; `public/.assetsignore` excludes `_redirects` from Worker asset uploads (Pages and Workers Assets have different SPA-fallback mechanisms)

### Hub (hub-worker/ + hub-admin/)

- **Domain layout** on `arcanum-hub.com` (dedicated apex; Universal SSL covers the whole first-level subdomain space):
  - `arcanum-hub.com/` — landing page (showcase SPA rendering `HubIndexPage`)
  - `api.arcanum-hub.com/*` — publish + admin + AI API (all JSON)
  - `<slug>.arcanum-hub.com/` — per-world showcase SPA + `/showcase.json` + `/images/<hash>.webp`
  - `admin.arcanum-hub.com/` — admin SPA, transparently reverse-proxied by the Worker to `arcanum-hub-admin.pages.dev` (Pages custom domains lose to Worker wildcard routes in Cloudflare's precedence)
- **Worker bindings** (`hub-worker/wrangler.toml`):
  - `DB` — D1 `arcanum-hub` (users, worlds, AI quotas)
  - `BUCKET` — R2 `arcanum-hub` (worlds/<slug>/showcase.json + worlds/<slug>/images/<hash>.webp)
  - `ASSETS` — showcase `dist/` ships alongside the Worker script; `not_found_handling = "single-page-application"` + `run_worker_first = true` so API paths aren't absorbed by SPA fallback
  - Secrets: `HUB_ADMIN_KEY` (admin master key), `RUNWARE_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`
- **Publish API** (Bearer auth, users table): `POST /publish/check-existing`, `PUT /publish/image/<hash>.webp`, `POST /publish/manifest`. Slug ownership is enforced per publish. Creator side: `creator/src-tauri/src/hub.rs::publish_to_hub`.
- **AI proxy** (Bearer auth, per-user lifetime quotas — default 500 images / 5000 LLM calls, stored as columns on `users`, reset on API key rotation): `POST /ai/image/generate` → Runware (`runware:400@2` FLUX.2, `openai:4@1` GPT Image 1.5), `POST /ai/llm/complete` → OpenRouter DeepSeek V3.2 (`deepseek/deepseek-v3.2-20251201`), `POST /ai/llm/vision` → Claude Sonnet 4.6. Vision calls bill against `prompts_used`. Model allowlist + guardrails (steps ≤ 32, dimensions ≤ 1024, GPT quality forced to `"low"`) enforced server-side.
- **Admin API** (X-Admin-Key header): `GET/POST /admin/users`, `DELETE /admin/users/<id>`, `POST /admin/users/<id>/regenerate-key` (zeros usage counters), `POST /admin/users/<id>/quotas` (per-user override), `GET /admin/worlds`, `DELETE /admin/worlds/<slug>`.
- **Reserved subdomains**: `admin`, `www`, `hub`, `mail`, `ftp`, `ns1`, `ns2` are refused by `isValidSlug()` so nobody can claim them as world slugs. The Worker's `handleReservedSubdomain` proxies `admin.` to the Pages deployment and 301s `www.` to the apex.
- **Hub AI mode on the client**: flipped via `settings.use_hub_ai` (user-level boolean in `~/.tauri/settings.json`). When on, the existing image/LLM/vision Tauri commands check `hub_ai::is_enabled(&settings)` at the top and short-circuit to `hub_ai::generate_image` / `hub_ai::complete` / `hub_ai::complete_with_vision` before touching direct-provider code. The frontend doesn't know about hub mode at all — same command names, same response shapes.

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
- **Worker routes beat Pages custom domains**: In Cloudflare's routing precedence, a Worker route always wins over a Pages custom domain on the same hostname. `admin.arcanum-hub.com` is a Pages deploy but can't use its own custom domain — the Worker's `*.arcanum-hub.com/*` wildcard intercepts first. Fix in `hub-worker/src/index.ts::handleReservedSubdomain`: detect reserved leaf names and reverse-proxy to the Pages deployment. If you add more subdomains (e.g. `status.`, `docs.`), they need entries in `RESERVED_SUBDOMAINS` or they'll be treated as world slugs.
- **Pages rejects wildcard custom domains**: `*.arcanum-hub.com` can't be added to a Pages project in the Cloudflare dashboard — it errors with "add a valid domain." That's why the hub ships the showcase SPA from inside the Worker via an `[assets]` binding. Never try to move the per-world SPA back to Pages.
- **Cloudflare Universal SSL scope**: Free Universal SSL certs only cover the apex + first-level subdomains of a zone. `arcanum-hub.com` works because the hub has its own dedicated apex. Don't put the hub under a deeper path of an existing zone (e.g. `*.arcanum.ambon.dev` would need Advanced Certificate Manager at $10/mo for the wildcard cert, and the original plan broke on this).
- **`_redirects` file vs Worker assets**: `showcase/public/_redirects` is the Pages SPA-fallback rule. Workers Assets flags it as an infinite-loop redirect and refuses to deploy. `showcase/public/.assetsignore` excludes it from Worker uploads without breaking the Pages deploy on `lore.ambon.dev`. Don't delete either file — both are load-bearing for their respective deploy targets.
- **`run_worker_first = true` is required**: Workers Assets defaults to serving static files before running the script. With SPA fallback enabled, that means `/api/index` and `/showcase.json` get absorbed as `index.html` and the Worker never sees them. `run_worker_first = true` in `[assets]` keeps the Worker authoritative; handlers that want to fall through to the SPA call `env.ASSETS.fetch(req)` explicitly.
- **Hub mode is transparent**: The frontend has no awareness of `use_hub_ai`. The branching lives in the Rust command dispatchers (`runware.rs`, `openai_images.rs`, `deepinfra.rs`, `llm.rs`) — each checks `hub_ai::is_enabled(&settings)` at the top and short-circuits to `hub_ai::*` before its direct-provider code. When you add a new AI-dispatching command, add the same early-return branch. Frontend settings UI still has a checkbox for users to flip the mode.
- **Hub AI quota pattern**: `users.images_used` and `users.prompts_used` are lifetime counters (not rolling windows). Vision calls bucket into `prompts_used`. Both reset to 0 whenever `updateUserApiKeyHash()` runs — that's how rotation serves double duty as both security (invalidate leaked key) and replenishment (fresh allowance). Never increment the counter on a failed provider call; hub handlers only increment after upstream returns 2xx.
- **Hub model allowlist is hard**: `hub-worker/src/handlers/ai.ts` rejects any model ID not in the `IMAGE_MODELS` set or the hardcoded `LLM_MODEL`/`VISION_MODEL`. Extending to a new model means editing the allowlist and, for images, confirming the provider settings shape (GPT Image needs `providerSettings.openai`, FLUX doesn't). The creator side has `hub_ai::translate_model_for_hub()` for mapping direct-provider model names to hub-supported IDs (e.g. DeepInfra FLUX → `runware:400@2`).
- **DeepInfra in hub mode**: DeepInfra is not a hub provider. When `use_hub_ai` is on, `deepinfra::generate_image` translates the requested DeepInfra model to Runware FLUX.2 via `translate_model_for_hub()`. Projects that still have `image_provider: "deepinfra"` in their settings keep working — they just get served by Runware instead.
- **Hub deploy script rebuilds showcase**: `hub-worker/package.json::build:assets` runs the showcase build with the hub env var, then drops the `_redirects` file from `dist/` before `wrangler deploy` picks it up. If you run `wrangler deploy` directly instead of `npm run deploy`, you'll ship whatever stale bundle is in `showcase/dist/` — typically the self-hosted build without hub mode.
- **Anthropic vision via hub**: Billed separately from image gen — the hub's `ANTHROPIC_API_KEY` needs credit on the Anthropic console. Low balance manifests as a 400 from the provider with "Your credit balance is too low." The hub correctly passes the error through without incrementing `prompts_used`.

## Project

**Arcanum Tuning Wizard**

A tuning wizard for Arcanum that helps MUD builders understand and configure the 300+ gameplay-related numeric values in `application.yaml`. Instead of editing raw numbers across 45+ config panels, builders pick a themed preset, see a before/after comparison of how it changes key metrics, and accept or reject changes per category.

**Core Value:** Builders can confidently configure game balance without needing to understand every formula interaction — presets give them a solid starting point, comparisons show them what changed and why.

### Constraints

- **Tech stack**: Must use existing React 19 + Zustand + Tailwind stack. No new frameworks.
- **Design system**: Must follow Arcanum style guide (dark indigo/aurum-gold theme, Cinzel/Crimson Pro fonts).
- **Config compatibility**: Preset values must produce valid `application.yaml` that the Kotlin server accepts.
- **Non-destructive**: Wizard never overwrites values without explicit per-section user approval.
- **Panel registry**: New wizard tab must integrate with the existing panel registry and sidebar navigation.

## Technology Stack

## Languages
- TypeScript ^5.8.0 - Frontend (React components, stores, types, lib)
- Rust (edition 2021) - Backend (Tauri commands, API clients, file I/O)
- YAML - Data format for zone files and `application.yaml`
- JSON - Settings persistence, asset manifests
- HTML/CSS - Tailwind-based UI styling
## Runtime
- Tauri 2 - Desktop application shell (Rust backend + webview frontend)
- WebView2 (Windows) - Renders the React frontend
- Node.js/Bun - Development tooling only (not shipped)
- Bun - Frontend (creator). Lockfile: `creator/bun.lock` (present)
- npm - Showcase. Lockfile: `showcase/package-lock.json` (present)
- Cargo - Rust backend. Lockfile managed by Cargo automatically
## Frameworks
- React 19 (`^19.0.0`) - UI framework
- Tauri 2 - Desktop app framework (IPC, native APIs)
- Zustand 5 (`^5.0.0`) - State management (multiple independent stores)
- Zundo 2 (`^2.3.0`) - Undo/redo middleware for Zustand
- Tailwind CSS 4 (`^4.0.0`) - Utility-first CSS (via PostCSS plugin `@tailwindcss/postcss ^4.2.1`)
- XY Flow / React Flow (`@xyflow/react ^12.10.1`) - Zone map graph visualization
- TipTap 3 (`@tiptap/react ^3.21.0`) - Rich text editor (lore articles)
- Leaflet 1.9.4 + react-leaflet 5 - Interactive maps (CRS.Simple)
- React Arborist 3 (`^3.4.3`) - Tree view component
- Tippy.js 6 (`^6.3.7`) - Tooltips
- dagre (`@dagrejs/dagre ^2.0.4`) - Directed graph layout
- `@fontsource/cinzel ^5.2.8` - Display headings
- `@fontsource/crimson-pro ^5.2.8` - Body text
- `@fontsource/jetbrains-mono ^5.2.8` - Code/monospace
- Vitest 3 (`^3.0.0`) - Test runner (data-layer tests only)
- Vite 6 (`^6.0.0`) - Frontend bundler and dev server
- `@vitejs/plugin-react ^4.3.0` - React JSX transform
- PostCSS 8 (`^8.4.0`) - CSS processing
- Autoprefixer 10 (`^10.4.0`) - CSS vendor prefixes
- `@tauri-apps/cli ^2` - Tauri build tooling
## Rust Dependencies (Backend)
- `tauri 2` - Application framework
- `serde 1` + `serde_json 1` + `serde_yaml 0.9` - Serialization
- `tokio 1` (features: fs, process) - Async runtime
- `reqwest 0.12` (features: json, rustls-tls) - HTTP client for all external APIs
- `sha2 0.10` - SHA-256 hashing (content-addressed assets, AWS Sig V4)
- `hmac 0.12` - HMAC for AWS Signature V4 signing
- `hex 0.4` - Hex encoding
- `base64 0.22` - Base64 encode/decode for image data
- `image 0.25` (features: jpeg, png, webp) - Image resize, format conversion
- `imagesize 0.13` - Fast image dimension detection
- `uuid 1` (features: v4) - UUID generation
- `chrono 0.4` (features: serde) - Date/time handling
- `regex 1` - Text pattern matching
- `tauri-plugin-dialog 2` - Native file dialogs
- `tauri-plugin-fs 2` - Filesystem access
- `tauri-plugin-shell 2` - Shell command execution
- `tauri-plugin-window-state 2.4.1` - Window position/size persistence
- `windows-sys 0.59` (Windows only) - Win32 API for job objects and process management
## Showcase Dependencies
- React 19 (`^19.0.0`) + React DOM
- React Router DOM 7 (`^7.1.1`) - Client-side routing (SPA)
- XY Flow (`@xyflow/react ^12.4.4`) - Relationship graph
- dagre (`@dagrejs/dagre ^1.1.4`) - Graph layout
- DOMPurify 3 (`^3.3.3`) - HTML sanitization (renders article HTML safely)
- Same fonts as creator (Cinzel, Crimson Pro, JetBrains Mono)
- Vite 6, Tailwind CSS 4, TypeScript ^5.7.0
## Key Dependencies
- `@tauri-apps/api ^2` - IPC bridge between frontend and Rust backend
- `yaml ^2.7.0` - YAML CST-mode parsing for format-preserving round-trip editing
- `@xyflow/react ^12.10.1` - Zone map graph editor
- `@tiptap/react ^3.21.0` - Lore article rich text editing
- `reqwest 0.12` - All external API communication from Rust
- `@imgly/background-removal ^1.7.0` - Client-side background removal for generated images
- `leaflet ^1.9.4` - Map rendering with custom coordinate systems
## Configuration
- Target: ES2021, strict mode enabled
- Path alias: `@/` maps to `./src/` (in `creator/tsconfig.json` and `creator/vite.config.ts`)
- JSX: react-jsx
- Strict checks: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`
- Config: `creator/vite.config.ts`
- Dev server: port 1420, strict port
- Manual chunks: fonts, editor (TipTap), graph (XY Flow), map (Leaflet), tree, image, tauri, yaml
- Config: `showcase/vite.config.ts`
- Custom entry points: main + service worker (`src/sw.ts`)
- Config: `creator/src-tauri/tauri.conf.json`
- Identifier: `dev.arcanum.app`
- Window: 1400x900 default, 1024x700 minimum
- Dev command: `bun run dev`
- Build command: `bun run build`
- CSP: disabled (null)
- `showcase/.env.production` - Exists (showcase env config)
- User settings: `~/.tauri/settings.json` (API keys)
- Project settings: `<project>/.arcanum/settings.json` (art pipeline, R2 config)
## Platform Requirements
- Bun (creator package manager)
- npm (showcase package manager)
- Rust toolchain (edition 2021)
- Tauri CLI v2
- Git (for git integration features)
- Windows (primary target, uses `windows-sys` for process management)
- WebView2 runtime
- Showcase: Cloudflare Pages (static SPA)

## Conventions

## Naming Patterns
- Components: PascalCase `.tsx` -- `MobEditor.tsx`, `AssetGallery.tsx`, `RoomNode.tsx`
- Hooks: camelCase with `use` prefix -- `useEntityEditor.ts`, `useImageSrc.ts`, `useArrayField.ts`
- Libraries/utilities: camelCase `.ts` -- `zoneEdits.ts`, `normalize.ts`, `loader.ts`
- Stores: camelCase with `Store` suffix -- `zoneStore.ts`, `projectStore.ts`, `assetStore.ts`
- Types: camelCase `.ts` in `creator/src/types/` -- `world.ts`, `config.ts`, `lore.ts`, `project.ts`, `story.ts`
- Rust modules: snake_case `.rs` -- `project.rs`, `deepinfra.rs`, `openai_images.rs`
- camelCase for all TypeScript functions: `loadAllZones`, `parseAppConfigYaml`, `normalizeId`
- snake_case for all Rust functions: `validate_mud_dir`, `generate_image`, `read_image_data_url`
- React components are PascalCase functions: `export function MobEditor()`
- Exported hook functions start with `use`: `export function useEntityEditor<T>()`
- camelCase for local and state variables: `filePath`, `zoneId`, `entityId`
- UPPER_SNAKE_CASE for constants: `MAX_HISTORY`, `MEDIA_EXTENSIONS`, `MANIFEST_FILE`
- Constant arrays of option objects use UPPER_SNAKE_CASE: `TIER_OPTIONS`, `BEHAVIOR_TEMPLATES`
- Use `interface` for object shapes (not `type`): `interface ZoneStore { ... }`
- Use `type` only for aliases and unions: `type StatMap = Record<string, number>`
- Interfaces use PascalCase: `WorldFile`, `MobFile`, `ValidationIssue`
- Suffix with `File` for YAML-serialized types mirroring Kotlin DTOs: `RoomFile`, `MobFile`, `ItemFile`
- Suffix with `Store` for Zustand store interfaces: `ZoneStore`, `ProjectStore`
- Suffix with `Props` for component props: `MobEditorProps`
## Code Style
- No Prettier or ESLint config files detected -- formatting is manual/convention-based
- 2-space indentation in TypeScript/TSX
- Double quotes for string literals in TypeScript
- Semicolons at end of statements
- Trailing commas in multi-line lists and parameters
- TypeScript strict mode enabled via `tsconfig.json`
- Key strict rules: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`
- No ESLint or Biome configuration detected
- Target: ES2021
- Module: ESNext with bundler resolution
- JSX: react-jsx (automatic runtime)
- Strict: true (all strict checks enabled)
- Config at `creator/tsconfig.json`
## Import Organization
- `@/` maps to `creator/src/` -- configured in both `creator/tsconfig.json` and `creator/vite.config.ts`
- Always use `@/` for cross-directory imports: `import type { WorldFile } from "@/types/world"`
- Use relative imports only for sibling files within the same directory
## Component Design
- Functional components only (no classes)
- Export named functions, not default exports: `export function MobEditor() {}`
- Exception: lazy-loaded components use default exports resolved at import: `lazy(() => import("./AppShell").then(m => ({ default: m.AppShell })))`
- Props defined as interface above component: `interface MobEditorProps { ... }`
- Use `memo()` for performance-sensitive components: `const RoomNode = memo(function RoomNode() { ... })`
- `ActionButton` -- variant-based button (primary/secondary/ghost/danger)
- `DialogShell` -- modal dialog wrapper with title, footer, overlay
- `Section`, `FieldRow`, `TextInput`, `NumberInput`, `SelectInput`, `CheckboxInput`
- `Spinner` -- inline loading indicator
- Local `cx()` utility for conditional class concatenation (not clsx/classnames)
## Zustand Store Patterns
- Use `create<StoreInterface>((set, get) => ({ ... }))` from zustand
- Each store is in its own file under `creator/src/stores/`
- Interface defined above the store: `interface ZoneStore { ... }` then `export const useZoneStore = create<ZoneStore>(...)`
- Always select individual fields: `useProjectStore((s) => s.project)`
- Never select the whole store: ~~`useProjectStore()`~~
- This prevents unnecessary re-renders
- Use `set()` callback with spread: `set((state) => ({ zones: new Map(state.zones) }))`
- Zone data mutations create new objects (immutable updates): `{ ...existing, data, dirty: true }`
- Zone edit functions (`creator/src/lib/zoneEdits.ts`) are pure functions returning new `WorldFile` objects
- Zone store: manual history arrays (`past`/`future` per zone) with `MAX_HISTORY = 100`
- Lore store: snapshot-based via `snapshotLore(s)` call in every `set()` mutation (50-entry history)
- All lore mutations MUST call `snapshotLore(s)` or the operation cannot be undone
## Error Handling
- Try/catch with `console.error` for non-critical failures (file loading, parsing)
- Validation functions return typed issue arrays: `ValidationIssue[]` with `severity: "error" | "warning"`
- No global error boundary detected
- All Tauri commands return `Result<T, String>` -- Tauri serializes the error string to the frontend
- Use `.map_err(|e| e.to_string())?` for error propagation
- Pattern: `fn_name(...) -> Result<ReturnType, String>`
## Logging
- `console.error(message, error)` for caught exceptions
- No structured logging framework
- Rust side uses standard error returns (no tracing/log crate observed)
## Comments
- Use boxed ASCII dividers for major sections within files:
- This pattern is used consistently in test files, lib files, and CSS
- Used sparingly on exported utility functions and hooks
- Brief single-line `/** ... */` format preferred
- Example: `/** Shared setup for zone entity editors. Returns the resolved entity, a patch callback... */`
- Section headers for logical groupings within a file
- Brief doc comments on exported public APIs
- Inline comments for non-obvious logic
## Function Design
- Zone edit functions in `creator/src/lib/zoneEdits.ts` are pure: take `WorldFile` + params, return new `WorldFile`
- Validation functions are pure: take data, return `ValidationIssue[]`
- Throw errors for invalid operations: `throw new Error("Room already exists")`
- Custom hooks in `creator/src/lib/use*.ts`
- Return tuple or object with `as const`: `return { entity, patch, handleDelete, rooms } as const`
- Wrap callbacks with `useCallback`, derive data with `useMemo`
## Styling
- Tailwind imported via `@import "tailwindcss"` in `creator/src/index.css`
- Custom theme tokens defined in `@theme { }` block in `creator/src/index.css`
- Additional CSS custom properties in `:root { }` block
- Backgrounds: `bg-bg-abyss`, `bg-bg-primary`, `bg-bg-secondary`, `bg-bg-tertiary`, `bg-bg-elevated`, `bg-bg-hover`
- Text: `text-text-primary`, `text-text-secondary`, `text-text-muted`, `text-text-link`
- Borders: `border-border-default`, `border-border-muted`, `border-border-focus`
- Accent: `text-accent`, `bg-accent`, `text-accent-muted`
- Warm: `text-warm`, `bg-warm`, `text-warm-pale`, `text-warm-deep`
- Status: `text-status-success`, `text-status-warning`, `text-status-error`, `text-status-info`
- Display: `font-display` (Cinzel)
- Body: `font-sans` (Crimson Pro -- despite the name, it's a serif)
- Code: `font-mono` (JetBrains Mono)
- `.ornate-input` -- styled text input with hover/focus transitions
- `.focus-ring` -- focus-visible outline ring
- `.shell-pill` -- pill-shaped button with hover effects
- `.action-button`, `.action-button-primary`, etc. -- button variants
- `.dialog-overlay` -- modal backdrop
- Animation utilities: `.animate-aurum-pulse`, `.animate-unfurl-in`, `.animate-warm-breathe`
- Deep indigo backgrounds, never light mode
- Body background is a multi-stop radial + linear gradient
- All color tokens designed for dark backgrounds
- Use low opacity (10-18%) with `pointer-events-none`
- `mix-blend-soft-light` for config/lore panel backgrounds
- `mix-blend-screen` for ReactFlow overlays (with `z-[1]`)
## YAML Handling
- Use `parseDocument()` for format-preserving parsing (preserves comments and formatting)
- Use `doc.toJS()` to extract plain JavaScript objects
- When saving, use CST mode to preserve original formatting
- Key functions: `creator/src/lib/loader.ts`, `creator/src/lib/saveZone.ts`, `creator/src/lib/saveConfig.ts`
- `zone, lifespan, startRoom, image, audio, rooms, mobs, items, shops, quests, gatheringNodes, recipes`
- Only serialize non-zero values in StatMap fields
- Normalize asset refs (strip local filesystem paths) before saving
## Module Design
- Named exports for everything: `export function`, `export interface`, `export const`
- No default exports except where required by lazy loading
- No barrel files (index.ts re-exports) -- import directly from source files
- One primary export per file for components
- Utility files may export multiple related functions (e.g., `zoneEdits.ts` exports all CRUD functions)
- Types grouped by domain in `creator/src/types/`: `world.ts`, `config.ts`, `lore.ts`, `project.ts`, `story.ts`

## Architecture

## Pattern Overview
- Frontend-heavy: most business logic lives in TypeScript (stores, lib utilities, validation)
- Rust backend is a thin service layer: file I/O, HTTP clients for external APIs, asset management, git operations
- Communication via Tauri `invoke()` calls returning `Result<T, String>`
- State managed by 15 independent Zustand stores with no cross-store subscriptions (stores read each other via `getState()` when needed)
- Two project formats: "legacy" (Gradle-based AmbonMUD checkout) and "standalone" (flat directory with split YAML files)
## Layers
- Purpose: Application chrome, workspace switching, navigation, tab management
- Location: `creator/src/components/AppShell.tsx`, `creator/src/components/Toolbar.tsx`, `creator/src/components/Sidebar.tsx`, `creator/src/components/MainArea.tsx`, `creator/src/components/StatusBar.tsx`
- Contains: Layout, workspace toggle, tab bar, command palette, global modals (asset generator, gallery, shortcuts help)
- Depends on: `projectStore`, `assetStore`, panel registry
- Used by: `App.tsx` (root)
- Purpose: Central routing table for all navigable panels. Maps panel IDs to metadata (label, group, host type, descriptions).
- Location: `creator/src/lib/panelRegistry.ts`
- Contains: ~60 panel definitions organized into 7 groups (studio, characters, world, lore, content, operations, command)
- Depends on: Nothing
- Used by: `Sidebar.tsx`, `MainArea.tsx`, `Toolbar.tsx`, `CommandPalette.tsx`
- Purpose: Container components that wrap domain-specific editors with shared chrome (auto-save, decorative backgrounds, section headers)
- Location:
- Contains: Panel routing switch, save orchestration, background decoration
- Depends on: `configStore`, `loreStore`, `zoneStore`, `assetStore`, panel registry
- Used by: `MainArea.tsx`
- Purpose: Visual zone map editing with ReactFlow, entity editing panels
- Location: `creator/src/components/zone/`
- Key files:
- Depends on: `zoneStore`, `projectStore`, `assetStore`, `vibeStore`, zone editing utilities in `lib/`
- Used by: `MainArea.tsx` (for `kind: "zone"` tabs)
- Purpose: Form-based editors for individual zone entities (mobs, items, shops, quests, etc.)
- Location: `creator/src/components/editors/`
- Key files: `MobEditor.tsx`, `ItemEditor.tsx`, `ShopEditor.tsx`, `QuestEditor.tsx`, `RecipeEditor.tsx`, `GatheringNodeEditor.tsx`, `TrainerEditor.tsx`, `DialogueEditor.tsx`, `DungeonEditor.tsx`
- Depends on: `zoneStore`, `configStore` (for data-driven dropdown options), entity editing lib functions
- Used by: `EntityPanel.tsx`
- Purpose: Editors for `application.yaml` game system configuration (40+ panels)
- Location: `creator/src/components/config/panels/`
- Key files: `ClassesPanel.tsx`, `CombatPanel.tsx`, `ProgressionPanel.tsx`, `EconomyPanel.tsx`, `StatsPanel.tsx`, etc.
- Contains: Form-based editors that mutate `configStore.config` via `updateConfig()`
- Depends on: `configStore`
- Used by: `ConfigPanelHost.tsx`
- Purpose: Complex config editors with list management (add/remove/reorder items)
- Location: `creator/src/components/config/`
- Key files: `ClassDesigner.tsx`, `RaceDesigner.tsx`, `AbilityDesigner.tsx`, `StatusEffectDesigner.tsx`, `CommandDesigner.tsx`, `CraftingStudio.tsx`, `GuildDesigner.tsx`, `AchievementDesigner.tsx`, `AchievementDefEditor.tsx`, `QuestTaxonomyDesigner.tsx`
- Depends on: `configStore`, `DefinitionWorkbench.tsx` (shared list+detail pattern)
- Used by: `ConfigPanelHost.tsx`
- Purpose: World-building article management, maps, timelines, relationships, AI tools
- Location: `creator/src/components/lore/`
- Key files:
- Depends on: `loreStore`, `assetStore`, lore lib utilities
- Used by: `LorePanelHost.tsx`
- Purpose: Application state containers. Each store is independent to avoid re-render cascading.
- Location: `creator/src/stores/`
- Key stores:
- Pattern: `create<Interface>((set, get) => ({ ... }))` with `invoke()` calls to Rust backend
- Cross-store reads: via `useOtherStore.getState()` (not subscriptions)
- Purpose: Pure logic, data transformations, YAML I/O, validation, AI prompt generation
- Location: `creator/src/lib/`
- Key modules:
- Purpose: System-level operations that cannot run in the browser sandbox
- Location: `creator/src-tauri/src/`
- Modules:
- Entry point: `lib.rs` (registers all commands), `main.rs` (Tauri bootstrap)
- Purpose: TypeScript type definitions mirroring Kotlin DTOs from the AmbonMUD server
- Location: `creator/src/types/`
- Key files: `world.ts` (zone/room/mob/item types), `config.ts` (AppConfig), `project.ts` (Project, Tab), `lore.ts` (WorldLore, Article), `assets.ts` (Settings, AssetEntry), `admin.ts`, `sprites.ts`, `sketch.ts`, `story.ts` (story/scene composition types)
## Data Flow
- Each Zustand store is independent — no middleware chaining
- Zone store: manual undo/redo with `past`/`future` arrays per zone (100-entry max)
- Lore store: manual undo/redo with `lorePast`/`loreFuture` arrays (50-entry max, uses `structuredClone`)
- Config store: no undo support (dirty flag only)
- Cross-store communication: stores call `useOtherStore.getState()` for reads (e.g., `assetStore` reads `projectStore` for `mudDir`)
- UI state persistence: `uiPersistence.ts` saves/loads workspace, tabs, collapsed sections to `localStorage`
## Key Abstractions
- Purpose: Unified navigation for 60+ editor panels across two workspaces
- Examples: `creator/src/lib/panelRegistry.ts`
- Pattern: Each panel has an `id`, `host` type (config/studio/lore/command), and `group`. The `host` determines which container component wraps it. `MainArea.tsx` switches on `host` to route to `ConfigPanelHost`, `LorePanelHost`, `StudioWorkspace`, or dedicated command components.
- Purpose: Multi-document editing with tab persistence
- Examples: `creator/src/stores/projectStore.ts`, `creator/src/types/project.ts`
- Pattern: Tabs are `{ id, kind, label, panelId? }`. Kind is "panel" or "zone". Zone tabs have `id: "zone:{zoneId}"`. Panel tabs have `id: "panel:{panelId}"`. Tabs are restored from `localStorage` on project open.
- Purpose: Immutable asset storage with deduplication
- Examples: `creator/src-tauri/src/assets.rs`
- Pattern: Files stored with SHA256 hash filenames. Asset manifest (`assets.json`) maps IDs to entries with metadata (type, context, prompt, dimensions). Variants share a `variantGroup` key with one marked `isActive`.
- Purpose: Reusable list+detail pattern for config editors that manage collections (classes, abilities, races, etc.)
- Examples: `creator/src/components/config/DefinitionWorkbench.tsx`
- Pattern: Left panel shows searchable/filterable list, right panel shows detail editor for selected item. Used by `ClassDesigner`, `AbilityDesigner`, `StatusEffectDesigner`, `CommandDesigner`, etc.
- Purpose: In-memory representation of a zone YAML file
- Examples: `creator/src/types/world.ts`
- Pattern: Top-level keys: `zone`, `lifespan`, `startRoom`, `image`, `audio`, `rooms`, `mobs`, `items`, `shops`, `quests`, `gatheringNodes`, `recipes`. Rooms/mobs/items/etc. are `Record<string, EntityFile>` maps.
## Entry Points
- Location: `creator/src/main.tsx` → `creator/src/App.tsx`
- Triggers: Tauri window launch
- Responsibilities: Renders `WelcomeScreen` (no project) or `AppShell` (project loaded). Loads settings on mount.
- Location: `creator/src-tauri/src/main.rs` → `creator/src-tauri/src/lib.rs`
- Triggers: App startup
- Responsibilities: Registers all Tauri commands (123 commands across 17 modules), initializes plugins (dialog, fs, shell, window-state)
- Location: `showcase/src/main.tsx` → `showcase/src/App.tsx`
- Triggers: Browser navigation to Cloudflare Pages URL
- Responsibilities: Fetches `showcase.json` from R2, renders read-only world lore (articles, maps, timeline, graph)
## Error Handling
- Rust: All `#[tauri::command]` functions return `Result<T, String>` — errors are string messages, not typed
- Frontend: `invoke().catch(() => {})` for fire-and-forget calls (e.g., `set_active_project_dir`)
- Frontend: `try/catch` with error state for user-facing operations
- YAML parsing: wrapped in try/catch, falls back to defaults on parse failure
- Lore loading: returns `DEFAULT_WORLD_LORE` on any error
## Cross-Cutting Concerns

