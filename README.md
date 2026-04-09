# Arcanum

A desktop tool for building fictional worlds — lore, maps, timelines, relationship graphs, AI-generated art, and a one-click public showcase site. Built with Tauri 2 (React + Rust).

Arcanum started as the creator tool for [AmbonMUD](https://github.com/jnoecker/AmbonMUD), but its lore and world-building features work for any setting: tabletop RPGs, novels, game design bibles, or worldbuilding for its own sake.

## Features

### Lore & World Building
- **Article system** -- 11 built-in templates + custom user-defined templates (character, location, organization, species, event, language, profession, ability, item, world_setting, freeform, plus any custom types) with rich text editor (TipTap), @mentions, template-specific fields, and article gallery (multiple images per article)
- **Template editor** -- Create custom template types with named fields (text, textarea, number, select, tags), color coding, and descriptions. Custom templates appear everywhere built-in templates do
- **Interactive maps** -- Upload map images, place colored pins linked to articles, duplicate maps to create themed variants, AI-powered map analysis via Claude Vision (identifies features and suggests pins)
- **Timeline** -- Calendar systems with eras, timeline events with importance levels (minor/major/legendary), linked to articles. AI timeline inference extracts temporal references from article content
- **Relationship graph** -- React Flow visualization of article connections (explicit relations + @mention extraction), dagre auto-layout. Deterministic relationship inference from structured fields (affiliation, allies, rivals, leader, parent hierarchy)
- **Color labels** -- Reusable named color palette for map pins and categorization
- **AI rewrite** -- "Rewrite with Instructions" rewrites article content and fields based on user directions (e.g., "change species from Alorae to Archae"), with preview before accepting
- **Quality tools** -- Consistency auditor (orphaned refs, duplicate titles, timeline mismatches), gap analysis (missing templates, leaderless factions, isolated locations), smart @mention suggestions (finds plain-text references that should be linked)
- **Bulk operations** -- Multi-select articles via Ctrl+Click, batch retag, reparent, template change, draft/publish toggle, bulk delete with undo support
- **Import/Export** -- Obsidian/Markdown vault import wizard (front-matter mapping, wiki-link→@mention conversion), Lore Bible export to Markdown and PDF (structured document with TOC, timeline, relations, styled typography)
- **Lore showcase** -- One-click publish to a public-facing website with image gallery and bidirectional relationship sidebar (see [Showcase](#showcase) below)

### Art Generation & Asset Management
- **AI image generation** via DeepInfra (FLUX models), Runware, or OpenAI
- **Two art styles** -- "Arcanum" (baroque cosmic gold-indigo) and "Gentle Magic" (soft dreamlike lavender)
- **Prompt enhancement** with LLM-powered style injection (Anthropic Claude, OpenRouter)
- **Asset gallery** with lazy-loaded thumbnails, filtering by type/zone, curated vs all views
- **Cloudflare R2 sync** -- Content-addressed uploads with SHA-256 dedup, custom domain CDN
- **Batch art generation** for zones with entity-specific prompt templates
- **Portrait and ability icon studios** -- Race/class portraits and ability/status-effect icons
- **Music and video generation** -- Audio and cinematic asset creation

### MUD Zone Building
- **Zone map editor** -- React Flow graph with custom room nodes, exit edges, dagre auto-layout, and ambient starfield background
- **Entity editors** -- Mobs, items, shops, quests, gathering nodes, recipes, dialogue trees, room features
- **Room property panels** -- Title, description, exits, station type, media references with spring-physics transitions
- **Cross-zone navigation** -- Click cross-zone exits to open target zones in new tabs
- **YAML round-trip** -- Format-preserving read/write using the `yaml` package CST mode

### Game System Configuration
- **Structured editors** for all `application.yaml` sections: stats, abilities, status effects, combat, mob tiers, classes, races, progression, economy, crafting, housing, factions, weather, and more
- **Stat Designer** -- Data-driven stat definitions with formula binding editor
- **Class/Race Designer** -- HP/mana curves, stat mods with net-zero indicator
- **Raw YAML fallback** -- Unknown config fields shown in a generic property editor so nothing is hidden
- **Per-project settings** -- Art pipeline, R2 credentials, and generation config stored per-project (API keys stay user-level)

### Server Management
- **Process lifecycle** -- Start/stop/restart via Gradle wrapper
- **Console** with log streaming, level filtering, and text search
- **Pre-flight checks** -- Java version, Gradle wrapper, port availability
- **Server status indicator** in toolbar (hidden for standalone projects)

### Developer Experience
- **Undo/redo** -- Zone undo via zundo (max 100 entries), lore undo via history stacks (max 50 entries). Context-aware Ctrl+Z/Ctrl+Shift+Z
- **Command palette** (Ctrl+K) -- Quick jump to any article, panel, or zone with fuzzy search
- **Full-text search** -- Search across article content, fields, tags, and private notes with contextual snippets
- **Diff view before save** -- See exactly what YAML changes will be written
- **YAML preview** toggle alongside form editors
- **Article duplication** -- Clone articles with all fields, content, relations, and tags
- **Bulk rename/refactor** -- Rename entity IDs with cascading updates across references
- **Keyboard shortcuts** -- Ctrl+S save, Ctrl+Z undo, Ctrl+K command palette, ? help
- **Validation engine** -- Zone-level, cross-zone, and config validation with inline errors
- **Zone vibe system** -- LLM-generated context metadata for art-consistent generation

## Showcase

The `showcase/` directory contains a standalone public-facing website for sharing world lore. It's a Vite + React 19 + Tailwind 4 SPA that reads exported lore data from Cloudflare R2.

**Pages:** Home (world overview + search), Codex (template-grouped article browser with grid/list views), Article detail (rich text + fields + relations), Maps (scaled image viewer with interactive pins), Timeline (era-grouped vertical timeline), Connections (React Flow relationship graph)

**Publishing workflow:**
1. Click **Publish Lore** in the Arcanum toolbar -- exports lore data and uploads `showcase.json` to R2
2. The showcase site fetches the JSON from R2 at runtime -- no rebuild needed after the initial deploy
   The JSON URL comes from Cloudflare Pages `VITE_SHOWCASE_URL` at runtime when Pages Functions are deployed, or `showcase/.env.production` as a fallback for local/static builds.
   The image URLs inside `showcase.json` come from the creator's `r2_custom_domain` setting when you click `Publish Lore`.

**Initial deployment:**
```bash
cd showcase
npm install
npm run build
npx wrangler pages deploy dist --project-name=ambon-showcase
```

After the initial deploy, add a custom domain in Cloudflare Pages settings if desired. Subsequent lore updates only require clicking "Publish Lore" in the creator.

**Development:**
```bash
cd showcase
npm run dev          # Vite dev server (uses /data/showcase.json locally)
npm run typecheck    # TypeScript check
npm run build        # Production build (fetches from R2 via VITE_SHOWCASE_URL)
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop framework | Tauri v2 |
| Frontend | React 19, TypeScript 5.8 |
| Build | Vite 6, Bun |
| Styling | Tailwind CSS 4 |
| State management | Zustand 5 + Zundo (undo/redo) |
| Graph editor | XY Flow (React Flow) |
| YAML | `yaml` package (CST mode) |
| Backend | Rust (Tauri commands) |
| Asset CDN | Cloudflare R2 (S3-compatible, AWS SigV4 signing) |
| Image generation | DeepInfra API, Runware API, OpenAI API |
| LLM integration | Anthropic Claude, OpenRouter |
| Testing | Vitest |
| Fonts | Cinzel, Crimson Pro, JetBrains Mono (via Fontsource) |

## Prerequisites

- [Bun](https://bun.sh/) (package manager and script runner for the creator app)
- [Rust](https://rustup.rs/) (Rust toolchain for the Tauri backend)
- [Tauri CLI v2](https://v2.tauri.app/) (`cargo install tauri-cli`)
- [Node.js + npm](https://nodejs.org/) (for the showcase site only)
- Git (for git integration features)
- Windows: WebView2 runtime (included in Windows 10/11)

## Getting Started

```bash
cd creator

# Install dependencies
bun install

# Run in development mode (launches both Vite dev server and Tauri window)
bun run tauri dev

# TypeScript type check
bunx tsc --noEmit

# Run tests
bun run test

# Build for production
bun run tauri build
```

## Project Structure

```
Arcanum/
  creator/                    # Arcanum (Tauri application)
    src/                      # React frontend
      components/
        admin/                #   Admin panel (live server connection, player/mob management)
        config/panels/        #   Config editor panels (stats, abilities, classes, etc.)
        editors/              #   Entity editors (mob, item, shop, quest, etc.)
        lore/                 #   Lore system (article editor, maps, timeline, relations)
        map/                  #   Interactive world map navigation
        settings/             #   Settings panels (user + project settings)
        tuning/               #   Tuning wizard (presets, comparisons, per-category approval)
        zone/                 #   Zone map editor (React Flow graph, room panel, starfield)
        ui/                   #   Shared UI components (form widgets, diff modal, focus trap)
        wizard/               #   Project creation wizard (multi-step)
      stores/                 #   Zustand state stores
      types/                  #   TypeScript type definitions (world, config, project, assets, lore, story, sprites)
      lib/                    #   Utilities, hooks, validation, YAML I/O, prompt templates
      assets/                 #   Background images for UI surfaces
    src-tauri/
      src/                    # Rust backend
        lib.rs                #   Tauri command registration
        project.rs            #   Project file I/O (legacy + standalone formats)
        settings.rs           #   User-level settings + merged settings command
        project_settings.rs   #   Project-level settings (<project>/.arcanum/settings.json)
        deepinfra.rs          #   DeepInfra API client (image generation)
        runware.rs            #   Runware API client (alternative image provider)
        openai_images.rs      #   OpenAI image generation provider
        openai_tts.rs         #   OpenAI text-to-speech API client
        assets.rs             #   Asset manifest management (SHA-256 content-addressed)
        r2.rs                 #   Cloudflare R2 sync (AWS SigV4 signing) + showcase deploy
        llm.rs                #   LLM integration for prompt enhancement
        anthropic.rs          #   Anthropic Claude API client
        openrouter.rs         #   OpenRouter API client
        vibes.rs              #   Zone vibe/context metadata for art generation
        generation.rs         #   Image generation utilities (dimension cap, format inference)
        admin.rs              #   Remote admin API client (player/zone/mob management)
        git.rs                #   Git operations (init, commit, push, pull, branch, PR)
        sketch.rs             #   Sketch analysis for image enhancement
        arcanum_meta.rs       #   Build metadata and version info
        audio_mix.rs          #   Audio mixing and processing
        cancellation.rs       #   Task cancellation for long-running operations
        captions.rs           #   Caption/subtitle generation
        ffmpeg.rs             #   FFmpeg integration for media processing
        ffmpeg_progress.rs    #   FFmpeg progress tracking
        video_encode.rs       #   Video encoding pipeline
        video_export.rs       #   Video export and rendering
  showcase/                   # Public lore showcase website (Vite + React SPA)
    src/
      components/             #   Layout, MapViewer, ShowcaseNode
      pages/                  #   Home, Codex, Article, Maps, Timeline, Graph, 404
      lib/                    #   DataContext, templates, graph builder
      types/                  #   ShowcaseData types (mirrors exportShowcase.ts)
    public/data/              #   Local showcase.json for development
    .env.production           #   R2 URL for production builds
    wrangler.toml             #   Cloudflare Pages deployment config
  reference/                  # Kotlin source from AmbonMUD server (read-only type reference)
    world-yaml-dtos/          #   YAML schema DTOs (source of truth for TS types)
    domain-model/             #   Runtime domain types
    config/                   #   AppConfig + example application.yaml
    registries/               #   Registry loaders (abilities, classes, races, etc.)
    world-loader/             #   WorldLoader.kt (validation rules reference)
    example-zones/            #   Sample zone YAML files
    docs/                     #   Specs (world YAML, stat system, implementation plan)
  ARCANUM_STYLE_GUIDE.md      # Design system documentation
  .impeccable.md              # Design context for AI-assisted development
```

## Zustand Stores

| Store | Responsibility |
|-------|---------------|
| `projectStore` | Project metadata, open tabs, active tab, config sub-tabs, pending navigation |
| `zoneStore` | Loaded zones, per-zone dirty flags, undo/redo (via zundo) |
| `configStore` | Parsed `application.yaml`, dirty flag, write/save operations |
| `serverStore` | Server process state, logs, output streaming |
| `validationStore` | Computed validation errors for zones and config, panel visibility |
| `assetStore` | Asset manifest, image directory, generation UI state, R2 sync, user + project settings |
| `loreStore` | World lore: articles, maps, calendars, timeline events, color labels, undo/redo (50-entry history) |
| `vibeStore` | Zone vibe/context metadata for LLM-informed art generation |
| `adminStore` | Admin panel state, live server connection, player/zone/mob/quest/achievement data |
| `gitStore` | Git repository status, commit history, branch management |
| `spriteDefinitionStore` | Player sprite definitions: tiers, achievements, staff categories, variants |
| `storyStore` | Story/scene composition and visual storytelling |
| `themeStore` | Runtime theme state |
| `toastStore` | Toast notification queue |
| `tuningWizardStore` | Tuning wizard state: presets, comparisons, pending changes |

## CI/CD

GitHub Actions workflows in `.github/workflows/`:

- **`ci.yml`** -- Runs on PRs and pushes to `main`. TypeScript type checks + Rust checks + tests for the creator; TypeScript check + build for the showcase.
- **`release.yml`** -- Triggered by version tags or manual dispatch. Builds cross-platform installers (Windows, macOS Intel/ARM, Linux) using the Tauri GitHub Action and creates a GitHub release.

## Design System

The Arcanum visual style is a baroque-cosmic aesthetic: deep indigo backgrounds, violet-lavender accents, serif typography (Cinzel/Crimson Pro), and unhurried animation. The design token system lives in `creator/src/index.css` with custom Tailwind theme tokens, gradient utilities, and typography scale extensions. See [ARCANUM_STYLE_GUIDE.md](ARCANUM_STYLE_GUIDE.md) for the full design system and [.impeccable.md](.impeccable.md) for the condensed design context.

## Documentation

- [ARCANUM_STYLE_GUIDE.md](ARCANUM_STYLE_GUIDE.md) -- Visual design system, color palette, typography, component specs, art prompts
- [.impeccable.md](.impeccable.md) -- Design context, principles, type scale, and gradient utilities
- [CLAUDE.md](CLAUDE.md) -- AI assistant instructions, coding conventions, common pitfalls
- [reference/docs/WORLD_YAML_SPEC.md](reference/docs/WORLD_YAML_SPEC.md) -- Zone YAML format specification
- [reference/docs/STAT_SYSTEM_SPEC.md](reference/docs/STAT_SYSTEM_SPEC.md) -- Data-driven stat system specification
- [reference/docs/FINAL_PLAN.md](reference/docs/FINAL_PLAN.md) -- Original implementation plan and architecture decisions
- [reference/README.md](reference/README.md) -- Guide to the Kotlin reference files

## License

Private project. All rights reserved.
