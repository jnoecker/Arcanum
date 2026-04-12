# CLAUDE.md

Project-level instructions for Claude Code when working on this repository. Also the canonical architecture + conventions + pitfalls document for human contributors — see [`README.md`](README.md) for the public-facing overview and [`docs/DEVELOPER_GUIDE.md`](docs/DEVELOPER_GUIDE.md) for the step-by-step onboarding walkthrough.

## Project overview

Arcanum is a Tauri 2 desktop worldbuilding tool. React 19 + TypeScript 5.8 frontend, Rust backend. It edits YAML world files for the AmbonMUD server (zones, mobs, items, quests, etc.), manages application-wide game configuration, generates AI art for every entity type, and publishes read-only public lore showcases via Cloudflare R2 — either self-hosted or through the optional Arcanum Hub.

## Repository layout

- `creator/` — the Tauri application
  - `creator/src/` — React frontend (components, stores, types, lib)
  - `creator/src-tauri/src/` — Rust backend
- `showcase/` — public lore viewer SPA (Vite + React 19 + Tailwind 4). Runs in three modes selected at runtime by `detectHubMode()`: **self-hosted** (`lore.ambon.dev`), **hub root** (`arcanum-hub.com`), and **per-world hub subdomain** (`<slug>.arcanum-hub.com`).
- `hub-worker/` — Cloudflare Worker backing the central Arcanum Hub. Owns publish API, admin API, AI proxy (image/LLM/vision), and ships the showcase SPA via an `[assets]` binding. Bindings: D1 `arcanum-hub` (users, worlds, quotas), R2 `arcanum-hub` (per-world `showcase.json` + WebP images).
- `hub-admin/` — small Vite + React SPA for admin-only user/quota management, deployed to Cloudflare Pages and reverse-proxied through `admin.arcanum-hub.com`. Master-key auth against `HUB_ADMIN_KEY`.
- `reference/` — read-only Kotlin source from the AmbonMUD server. Source of truth for YAML DTO shapes and server-side validation rules. **Never modify.**
- `docs/` — developer documentation
- `ARCANUM_STYLE_GUIDE.md` — design system (palette, typography, motion, components, art prompts)
- `.impeccable.md` — condensed design context for AI-assisted development

## Development commands

```bash
# Creator (Tauri app)
cd creator
bun install
bun run tauri dev           # Vite + Tauri dev mode (port 1420)
bunx tsc --noEmit           # TypeScript check
bun run test                # Vitest data-layer tests
bun run tauri build         # Production bundle
cd src-tauri && cargo check # Rust check

# Showcase (public SPA)
cd showcase
npm install
npm run dev
npm run typecheck
npm run build
npx wrangler pages deploy dist --project-name=ambon-showcase  # Self-hosted deploy (lore.ambon.dev)

# Hub worker
cd hub-worker
npm install
npm run dev                                                   # wrangler dev on :8787
npm run deploy                                                # Rebuilds showcase with VITE_HUB_ROOT_DOMAIN, then wrangler deploy
npx wrangler d1 execute arcanum-hub --remote --file=./src/migrations/<file>.sql
npx wrangler secret put RUNWARE_API_KEY

# Hub admin
cd hub-admin
npm install
VITE_HUB_API_URL=https://api.arcanum-hub.com npm run build
npx wrangler pages deploy dist --project-name=arcanum-hub-admin --branch=main
```

## Architecture

### Frontend (React + TypeScript)

- **State** — Zustand stores in `src/stores/`, each independent. No middleware chaining and no cross-store subscriptions; stores read each other via `useOtherStore.getState()` when they need to.
  - `projectStore` — project metadata, open tabs, active tab, pending navigation
  - `zoneStore` — loaded zone data, per-zone dirty flags, undo/redo (via zundo, 100-entry history)
  - `configStore` — parsed `application.yaml`, dirty flag
  - `serverStore` — server process state, logs
  - `validationStore` — computed validation errors
  - `assetStore` — image generation, asset manifest, R2 sync, user + project settings
  - `loreStore` — articles, maps, calendars, timeline events, color labels, undo/redo (snapshot-based, 50-entry history)
  - `vibeStore` — zone vibe/context metadata for art generation
  - `adminStore` — live server connection, player/zone/mob/quest/achievement data
  - `gitStore` — git repository status, commit history, branch management
  - `spriteDefinitionStore` — player sprite definitions: tiers, achievements, staff categories, variants
  - `storyStore` — story/scene composition and visual storytelling
  - `themeStore` — runtime theme state
  - `toastStore` — toast notification queue
  - `tuningWizardStore` — tuning wizard state: presets, comparisons, pending changes
- **Types** — `src/types/` mirrors Kotlin DTOs from `reference/world-yaml-dtos/`. Suffix with `File` for YAML-serialized types (`RoomFile`, `MobFile`), `Store` for store interfaces, `Props` for component props.
- **YAML I/O** — `yaml` package in CST mode for format-preserving round-trip. Loaders in `src/lib/loader.ts`, savers in `src/lib/saveZone.ts` and `src/lib/saveConfig.ts`. Zone key ordering: `zone, lifespan, startRoom, image, audio, rooms, mobs, items, shops, quests, gatheringNodes, recipes`. Only serialize non-zero values in StatMap fields.
- **Validation** — Client-side in `src/lib/validateZone.ts` and `src/lib/validateConfig.ts`. Must mirror `reference/world-loader/WorldLoader.kt`.
- **Graph** — Zone maps use XY Flow with dagre layout. Custom `RoomNode` with background images, entity sprites, and visible exit handles. See `src/components/zone/`.
- **Panel registry** — `src/lib/panelRegistry.ts` defines ~60 panels across 7 groups (studio, characters, world, lore, content, operations, command). Each panel has a `host` type (`studio` / `config` / `lore` / `command`) that `MainArea.tsx` uses to route to the right container.
- **Art generation** — Project-defined `visualStyle` field drives prompts for all generated images. `getStyleSuffix()` and `getPreamble()` defer to the world's visual style when set, falling back to built-in "arcanum" or "gentle_magic" styles. `buildToneDirective()` is injected into every AI system prompt. Templates in `src/lib/arcanumPrompts.ts`, keyed by asset type. Generation dimensions capped at 1024px (resized to the final target in Rust). Class color palettes injected for ability/status icon generation.
- **Global assets** — Key-value pairs in `application.yaml` under `ambonmud.globalAssets` (e.g. `compass_rose: abc123.png`). Stored as a flat `Record<string, string>`.
- **Decorative backgrounds** — Config and lore panel hosts use `config-bg.png` at 10% opacity with `mix-blend-soft-light`. Sidebar uses gradient glow only.
- **Lore system** — Article-based worldbuilding with 11 built-in templates plus user-defined custom templates (via `TemplateEditorPanel`), TipTap rich text, @mentions, interactive maps (Leaflet CRS.Simple), timeline with eras, relationship graph, multi-image galleries. AI tools: timeline inference, relationship inference (deterministic + field-based), gap analysis, consistency auditing, @mention suggestions, rewrite-with-instructions. Bulk ops: multi-select, retag, reparent, delete, draft toggle, template change. Full-text search, Obsidian import, Lore Bible export to Markdown and PDF, command palette (Ctrl+K). Types in `src/types/lore.ts`, store in `src/stores/loreStore.ts`, persistence in `src/lib/lorePersistence.ts`.
- **Showcase export** — `src/lib/exportShowcase.ts` converts `WorldLore` → `ShowcaseData` (TipTap JSON → HTML, relation merging, image URL resolution). Toolbar "Publish Lore" button deploys JSON via `deploy_showcase_to_r2` (self-hosted) or `publish_to_hub` (hub mode).

### Backend (Rust)

All public functions exposed to the frontend are `#[tauri::command]` and return `Result<T, String>`.

- `lib.rs` — registers all Tauri commands
- `main.rs` — Tauri bootstrap
- `project.rs` — project/zone/config file I/O (legacy + standalone formats)
- `project_settings.rs` — project-level settings stored in `<project>/.arcanum/settings.json`
- `settings.rs` — user-level settings (`~/.tauri/settings.json`) + merged settings command
- `fs_utils.rs` — shared filesystem helpers
- `http.rs` — shared HTTP client utilities
- `assets.rs` — asset manifest (JSON) with content-addressed SHA-256 storage
- `generation.rs` — image generation utilities (dimension capping to 1024px, format inference, resize pipeline)
- `deepinfra.rs` — DeepInfra API client (FLUX image generation)
- `runware.rs` — Runware API client (alternative image provider)
- `openai_images.rs` — OpenAI GPT Image provider
- `openai_tts.rs` — OpenAI text-to-speech client
- `anthropic.rs` — Anthropic Claude client (text + vision)
- `openrouter.rs` — OpenRouter LLM client
- `llm.rs` — LLM dispatcher for prompt enhancement and vision analysis. Short-circuits to `hub_ai` when `settings.use_hub_ai` is on.
- `vibes.rs` — zone vibe/context metadata for LLM-informed art generation
- `sketch.rs` — sketch-to-image analysis via LLM
- `r2.rs` — Cloudflare R2 sync with AWS Signature V4 signing (no SDK), plus `deploy_showcase_to_r2`
- `hub.rs` — showcase publish pipeline to the central hub. Builds `ShowcaseData`, strips story `cinematicUrl`, re-encodes every referenced image as lossy WebP via the `webp` crate, content-addresses the blobs, diffs against the hub's existing set, uploads missing images + manifest. Progress events stream via `hub-publish-progress`.
- `hub_ai.rs` — hub-mode proxy client for image/LLM/vision calls. `is_enabled(&settings)` gates whether the existing provider commands short-circuit to `/ai/*` endpoints on `api.arcanum-hub.com`. Returns the same `GeneratedImage` shape as direct-provider calls so the frontend is unaware of the mode switch.
- `admin.rs` — HTTP client for the remote AmbonMUD admin API (players, zones, mobs, quests, achievements)
- `git.rs` — git operations (init, status, commit, push, pull, branch, PR creation)
- `arcanum_meta.rs` — build metadata and version info
- `audio_mix.rs`, `captions.rs`, `ffmpeg.rs`, `ffmpeg_progress.rs`, `video_encode.rs`, `video_export.rs` — media processing pipeline (FFmpeg via `ffmpeg-sidecar`)
- `cancellation.rs` — task cancellation for long-running operations

### Showcase

- Standalone Vite + React 19 + Tailwind 4 SPA. Self-hosted deploys go to Cloudflare Pages (`ambon-showcase` project at `lore.ambon.dev`). The hub serves the same bundle via the Worker's `[assets]` binding, built with `VITE_HUB_ROOT_DOMAIN=arcanum-hub.com`.
- `src/lib/hubMode.ts::detectHubMode()` inspects `window.location.hostname` against `VITE_HUB_ROOT_DOMAIN`. Returns `"root"` (landing), `"world"` with a slug, or `"self-hosted"` (fallback).
- `DataContext` branches on the result: root mode routes to `HubIndexPage` which fetches `/api/index`; world mode fetches `/showcase.json` from the same origin (the Worker resolves the slug from the Host header); self-hosted behaves as before.
- Types in `src/types/showcase.ts` mirror `ShowcaseData` from `creator/src/lib/exportShowcase.ts`.
- Pages: Home, Codex (`ArticlesPage`), Article detail (`ArticlePage`), Maps, Timeline, Connections (`GraphPage`), `HubIndexPage`, 404.
- Article detail includes a crossfade image gallery and a grouped bidirectional relationship sidebar.
- Map pins use Leaflet CRS.Simple coordinates: `position[0]` = lat (Y from bottom), `position[1]` = lng (X). Showcase converts to pixels: `px_x = lng * scale`, `px_y = (height - lat) * scale`.
- `wrangler.toml` for Cloudflare Pages; `_redirects` for SPA routing; `public/.assetsignore` excludes `_redirects` from Worker asset uploads (Pages and Workers Assets use different SPA-fallback mechanisms).

### Hub (hub-worker + hub-admin)

- **Domain layout** on `arcanum-hub.com` (dedicated apex; free Universal SSL covers first-level subdomains):
  - `arcanum-hub.com/` — landing page (showcase SPA rendering `HubIndexPage`)
  - `api.arcanum-hub.com/*` — publish + admin + AI API (all JSON)
  - `<slug>.arcanum-hub.com/` — per-world showcase SPA + `/showcase.json` + `/images/<hash>.webp`
  - `admin.arcanum-hub.com/` — admin SPA, transparently reverse-proxied by the Worker to `arcanum-hub-admin.pages.dev`
- **Worker bindings** (`hub-worker/wrangler.toml`):
  - `DB` — D1 `arcanum-hub` (users, worlds, AI quotas)
  - `BUCKET` — R2 `arcanum-hub` (`worlds/<slug>/showcase.json` + `worlds/<slug>/images/<hash>.webp`)
  - `ASSETS` — showcase `dist/` ships alongside the Worker; `not_found_handling = "single-page-application"` + `run_worker_first = true` so API paths aren't absorbed by SPA fallback
  - Secrets: `HUB_ADMIN_KEY`, `RUNWARE_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`
- **Publish API** (Bearer auth): `POST /publish/check-existing`, `PUT /publish/image/<hash>.webp`, `POST /publish/manifest`. Slug ownership enforced per publish. Creator side: `creator/src-tauri/src/hub.rs::publish_to_hub`.
- **AI proxy** (Bearer auth, per-user lifetime quotas — default 500 images / 5000 LLM calls, stored on `users`, reset on API key rotation):
  - `POST /ai/image/generate` → Runware (`runware:400@2` FLUX.2, `openai:4@1` GPT Image 1.5)
  - `POST /ai/llm/complete` → OpenRouter DeepSeek V3.2 (`deepseek/deepseek-v3.2-20251201`)
  - `POST /ai/llm/vision` → Claude Sonnet 4.6
  - Vision calls bill against `prompts_used`. Model allowlist + guardrails (steps ≤ 32, dimensions ≤ 1024, GPT quality forced to `"low"`) enforced server-side.
- **Admin API** (X-Admin-Key header): `GET/POST /admin/users`, `DELETE /admin/users/<id>`, `POST /admin/users/<id>/regenerate-key` (zeros usage counters), `POST /admin/users/<id>/quotas`, `GET /admin/worlds`, `DELETE /admin/worlds/<slug>`.
- **Reserved subdomains** — `admin`, `www`, `hub`, `mail`, `ftp`, `ns1`, `ns2` are refused by `isValidSlug()` so nobody can claim them as world slugs. The Worker's `handleReservedSubdomain` proxies `admin.` to the Pages deployment and 301s `www.` to the apex.
- **Hub AI mode on the client** — flipped via `settings.use_hub_ai` (user-level boolean in `~/.tauri/settings.json`). When on, the existing image/LLM/vision Tauri commands check `hub_ai::is_enabled(&settings)` at the top and short-circuit to `hub_ai::generate_image` / `hub_ai::complete` / `hub_ai::complete_with_vision` before touching direct-provider code. The frontend doesn't know about hub mode at all — same command names, same response shapes.

### IPC pattern

Images are served to the frontend as base64 data URLs via the `read_image_data_url` Tauri command. This bypasses the Tauri asset protocol, which has issues on Windows.

## Coding conventions

### TypeScript

- Path alias: `@/` maps to `creator/src/`. Use it for cross-directory imports; relative imports only for siblings in the same directory.
- 2-space indentation, double quotes, semicolons, trailing commas in multi-line lists.
- Strict mode on. Notable rules: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`. No Prettier or ESLint config — formatting is convention-based.
- Prefer `interface` for object shapes; use `type` only for aliases and unions.
- Named exports only (`export function MobEditor()`). Exception: lazy-loaded components use default exports for `React.lazy()`.
- Functional components only. Props as an `interface` above the component. Use `memo()` for performance-sensitive components.
- Component files: PascalCase `.tsx`. Hook files: camelCase with `use` prefix. Library files: camelCase `.ts`. Stores: camelCase with `Store` suffix.
- Shared form primitives: `ActionButton`, `DialogShell`, `Section`, `FieldRow`, `TextInput`, `NumberInput`, `SelectInput`, `CheckboxInput`, `Spinner`. Local `cx()` utility for conditional classes (not clsx/classnames).
- No barrel files — import directly from source.

### Zustand stores

- `create<StoreInterface>((set, get) => ({ ... }))` with the interface defined above the store.
- **Always select individual fields:** `useProjectStore((s) => s.project)`. Never select the whole store object — it re-renders on every change.
- Use immutable updates: `set((state) => ({ zones: new Map(state.zones) }))`. Zone data mutations create new objects (`{ ...existing, data, dirty: true }`).
- Zone edit functions in `creator/src/lib/zoneEdits.ts` are pure — they take a `WorldFile` and params, return a new `WorldFile`.
- Zone store uses zundo with per-zone `past` / `future` arrays (`MAX_HISTORY = 100`).
- Lore store uses snapshot-based undo: every mutation must call `snapshotLore(s)` inside the `set()` callback. Missing it means the operation can't be undone. 50-entry history via `structuredClone`.
- Config store has no undo — dirty flag only.

### Rust

- All public Tauri commands return `Result<T, String>` — Tauri serializes the error string to the frontend. Use `.map_err(|e| e.to_string())?` for propagation.
- Async file operations go through `tokio::fs`.
- Module names: `snake_case.rs`.
- Cargo deps include `tauri 2`, `serde 1`, `serde_yaml 0.9`, `tokio 1` (features: fs, process), `reqwest 0.12` (rustls-tls), `sha2 0.10`, `hmac 0.12`, `image 0.25` (jpeg/png/webp), `webp 0.3`, `imagesize 0.13`, `chrono 0.4`, `ffmpeg-sidecar 2`, `which 6`, and on Windows `windows-sys 0.59` (Win32 job objects + threading).

### Styling

- Dark theme only — deep midnight-teal backgrounds, hearth-ember accents. Follow [`ARCANUM_STYLE_GUIDE.md`](ARCANUM_STYLE_GUIDE.md).
- Fonts: Cinzel (display), Crimson Pro (body), JetBrains Mono (code). No sans-serif anywhere.
- Design tokens defined in `creator/src/index.css` — use semantic utilities (`bg-bg-primary`, `text-text-primary`, `border-border-default`, `text-accent`, `text-warm`) rather than hard-coded colors.
- Decorative backgrounds use low opacity (10–18%) with `pointer-events-none`.
- Tab names and primary action buttons use ember accent (`text-accent`) for visual hierarchy.

### YAML handling

- Use `parseDocument()` for format-preserving parsing (comments + ordering survive).
- `doc.toJS()` to extract plain JavaScript objects.
- Key functions: `creator/src/lib/loader.ts`, `saveZone.ts`, `saveConfig.ts`.
- Zone key ordering: `zone, lifespan, startRoom, image, audio, rooms, mobs, items, shops, quests, gatheringNodes, recipes`.
- Only serialize non-zero values in StatMap fields.
- Normalize asset refs (strip local filesystem paths) before saving.

### Error handling

- Frontend: `try/catch` with error state for user-facing operations; `console.error` for non-critical logging. `invoke().catch(() => {})` for fire-and-forget calls.
- Rust: all commands return `Result<T, String>`. No typed error hierarchy.
- YAML parsing wraps in try/catch and falls back to defaults. Lore loading returns `DEFAULT_WORLD_LORE` on any error.
- No global React error boundary.

### Comments

- Default to writing no comments. Use them only when the *why* is non-obvious — hidden constraints, subtle invariants, or workarounds for specific bugs.
- Brief single-line `/** ... */` doc comments on exported public APIs are OK.
- Don't explain *what* code does — named identifiers already do that.
- Don't reference the current task, fix, or callers ("used by X", "added for the Y flow") — that belongs in the PR description and rots as the codebase evolves.

## Testing

- Vitest, data-layer only. No UI tests.
- Tests live alongside source in `__tests__/` directories.
- Focus areas: YAML round-trip, ID normalization, validation rules, stat formulas.
- `bun run test` runs once; `bun run test:watch` re-runs on save.

## Git workflow

- Create a new feature branch off `main` for each piece of work. Never reuse an existing topic branch that may carry unrelated commits.
- Keep PRs focused: one logical change per PR.
- Branch naming: `feature/short-name`, `fix/short-name`, `docs/description`.
- CI (typecheck + tests + `cargo check` for creator; typecheck + build for showcase) must be green before merge.

## Common pitfalls

- **Tauri asset protocol on Windows** — Don't use `convertFileSrc()` for images. Use the `read_image_data_url` IPC command instead.
- **Flex scrolling** — Containers that need to scroll must have `min-h-0 flex-1` on the parent to allow `overflow-y-auto` to work.
- **Settings split** — Settings are split into user-level (API keys in `~/.tauri/settings.json`) and project-level (art/R2 config in `<project>/.arcanum/settings.json`). `get_merged_settings` combines both. `loadSettings()` in `assetStore` auto-seeds project settings on first open. When adding a new setting, decide whether it's per-user or per-project, then update the corresponding Rust struct (`Settings` or `ProjectSettings`) and TypeScript interface (`Settings` or `ProjectSettings` in `types/assets.ts`).
- **Reference files** — The `reference/` directory is read-only Kotlin source from the AmbonMUD server. Never modify these files — they're the source of truth for type shapes and validation rules.
- **ReactFlow backgrounds** — ReactFlow renders its own opaque canvas layer. To overlay background images on the zone builder, place them ON TOP with `pointer-events-none`, `z-[1]`, and `mix-blend-screen` — not behind the canvas.
- **Server detection** — The server outputs `"AmbonMUD listening on telnet port {port}"` when ready. Match this exact string in `useServerManager.ts`.
- **Config data-driven fields** — Many game systems (equipment slots, crafting skills, station types) are data-driven from `application.yaml`. Editors like `ItemEditor`, `RecipeEditor`, `GatheringNodeEditor` derive dropdown options from `configStore` with fallback to hardcoded defaults.
- **Art style templates** — Asset prompt templates in `arcanumPrompts.ts` are keyed by both `AssetType` and `ArtStyle`. When adding a new asset type, add templates for both "arcanum" and "gentle_magic" styles.
- **World visual style** — Projects declare their own `visualStyle` field. `getStyleSuffix()` and `getPreamble()` defer to the world-defined style when set, falling back to the built-in styles. `buildToneDirective()` is injected into every AI system prompt (text and image). Don't hardcode style suffixes — the world owns them.
- **Global assets** — Stored as a flat `Record<string, string>` (key → filename). Use `setIn` when saving, not `saveMapSection` — values are strings, not objects.
- **Map pin coordinates** — Creator stores pins as `[lat, lng]` in Leaflet CRS.Simple where `lat` = Y from bottom edge, `lng` = X from left. When rendering outside Leaflet (e.g. showcase), convert: `pixel_x = lng`, `pixel_y = map_height - lat`.
- **Showcase data flow** — "Publish Lore" in Toolbar → `exportShowcaseData()` → `deploy_showcase_to_r2` (self-hosted) or `publish_to_hub` (hub mode). The showcase SPA fetches this at runtime. No rebuild required for content updates.
- **Showcase images** — Article/map images reference R2 URLs via `imageBaseUrl` from creator settings (`r2_custom_domain`). Images must be synced to R2 before they appear on the showcase.
- **Lore undo/redo** — All lore mutations must call `snapshotLore(s)` inside their `set()` callback. Missing it means the operation can't be undone. The zone store uses a different pattern (zundo middleware).
- **Generation dimensions** — Image generation APIs receive dimensions capped at 1024px via `generation::cap_generation_dims`. The backend resizes to the final target after generation. Don't request >1024px from FLUX models.
- **Command palette** — Ctrl+K opens the global command palette, not a sidebar search. The old sidebar search focus handler was removed.
- **Article gallery** — Articles have both `image?: string` (primary) and `gallery?: string[]` (additional). Export resolves both to `imageUrl` and `galleryUrls` in `ShowcaseData`.
- **Vision API** — `llm_complete_with_vision` requires an Anthropic API key (or hub mode with credit on the hub's Anthropic account). Used for map analysis. The data URL must be a valid `data:image/...;base64,...` format.
- **Custom templates** — Stored in `lore.yaml` under `customTemplates`. Use `getTemplateSchema(templateId, customTemplates)` from `loreTemplates.ts` instead of indexing `TEMPLATE_SCHEMAS` directly — the latter only has built-in templates. `getAllTemplateSchemas()` returns both.
- **Rewrite vs Enhance** — "Enhance" improves prose quality without changing meaning and returns plain text. "Rewrite" takes user instructions, may change content + fields, and returns JSON with `content` + `fields` keys. Both live in the article editor toolbar.
- **PDF export** — Uses `window.print()` on a styled HTML document generated from the Markdown Lore Bible. Fonts are loaded from Google Fonts in the print document (requires internet). The print window opens in a new tab.
- **Worker routes beat Pages custom domains** — Cloudflare's routing precedence is Worker route > Pages custom domain on the same hostname. `admin.arcanum-hub.com` is a Pages deploy but can't use its own custom domain — the Worker's `*.arcanum-hub.com/*` wildcard intercepts first. Fix in `hub-worker/src/index.ts::handleReservedSubdomain`: detect reserved leaf names and reverse-proxy to the Pages deployment. New subdomains (e.g. `status.`, `docs.`) need entries in `RESERVED_SUBDOMAINS` or they'll be treated as world slugs.
- **Pages rejects wildcard custom domains** — `*.arcanum-hub.com` can't be added to a Pages project — it errors with "add a valid domain." That's why the hub ships the showcase SPA from inside the Worker via an `[assets]` binding. Never try to move the per-world SPA back to Pages.
- **Cloudflare Universal SSL scope** — Free Universal SSL certs only cover the apex + first-level subdomains of a zone. `arcanum-hub.com` works because the hub has its own dedicated apex. Don't put the hub under a deeper path of an existing zone (`*.arcanum.ambon.dev` would need Advanced Certificate Manager for the wildcard cert).
- **`_redirects` file vs Worker assets** — `showcase/public/_redirects` is the Pages SPA-fallback rule. Workers Assets flags it as an infinite-loop redirect and refuses to deploy. `showcase/public/.assetsignore` excludes it from Worker uploads without breaking the Pages deploy on `lore.ambon.dev`. Both files are load-bearing for their respective deploy targets.
- **`run_worker_first = true` is required** — Workers Assets defaults to serving static files before running the Worker. With SPA fallback enabled, that means `/api/index` and `/showcase.json` get absorbed as `index.html` and the Worker never sees them. `run_worker_first = true` in `[assets]` keeps the Worker authoritative; handlers that want to fall through to the SPA call `env.ASSETS.fetch(req)` explicitly.
- **Hub mode is transparent to the frontend** — The frontend has no awareness of `use_hub_ai`. Branching lives in the Rust command dispatchers (`runware.rs`, `openai_images.rs`, `deepinfra.rs`, `llm.rs`) — each checks `hub_ai::is_enabled(&settings)` at the top and short-circuits to `hub_ai::*` before its direct-provider code. When adding a new AI-dispatching command, add the same early-return branch.
- **Hub AI quota pattern** — `users.images_used` and `users.prompts_used` are lifetime counters (not rolling windows). Vision calls bucket into `prompts_used`. Both reset to 0 whenever `updateUserApiKeyHash()` runs — rotation serves double duty as security (invalidate leaked key) and replenishment (fresh allowance). Never increment the counter on a failed provider call; hub handlers only increment after upstream returns 2xx.
- **Hub model allowlist is strict** — `hub-worker/src/handlers/ai.ts` rejects any model ID not in the `IMAGE_MODELS` set or the hardcoded `LLM_MODEL` / `VISION_MODEL`. Extending to a new model means editing the allowlist and, for images, confirming the provider settings shape (GPT Image needs `providerSettings.openai`, FLUX doesn't). `hub_ai::translate_model_for_hub()` maps direct-provider model names to hub-supported IDs.
- **DeepInfra in hub mode** — DeepInfra is not a hub provider. When `use_hub_ai` is on, `deepinfra::generate_image` translates the requested DeepInfra model to Runware FLUX.2 via `translate_model_for_hub()`. Projects with `image_provider: "deepinfra"` in their settings keep working — they just get served by Runware.
- **Hub deploy script rebuilds showcase** — `hub-worker/package.json::build:assets` runs the showcase build with the hub env var, then drops the `_redirects` file from `dist/` before `wrangler deploy` picks it up. Running `wrangler deploy` directly inside `hub-worker/` ships whatever stale bundle is in `showcase/dist/` — typically the self-hosted build without hub mode. Always use `npm run deploy`.
- **Anthropic vision via hub** — Billed separately from image generation. The hub's `ANTHROPIC_API_KEY` needs credit on the Anthropic console. Low balance manifests as a 400 from the provider with "Your credit balance is too low." The hub correctly passes the error through without incrementing `prompts_used`.

## Further reading

- [`docs/DEVELOPER_GUIDE.md`](docs/DEVELOPER_GUIDE.md) — setup walkthrough for new contributors
- [`README.md`](README.md) — project overview and feature summary
- [`ARCANUM_STYLE_GUIDE.md`](ARCANUM_STYLE_GUIDE.md) — design system
- [`hub-worker/README.md`](hub-worker/README.md) — hub architecture and routing
- [`reference/docs/WORLD_YAML_SPEC.md`](reference/docs/WORLD_YAML_SPEC.md) — zone YAML schema (read-only reference)
- [`reference/docs/STAT_SYSTEM_SPEC.md`](reference/docs/STAT_SYSTEM_SPEC.md) — stat system specification (read-only reference)
