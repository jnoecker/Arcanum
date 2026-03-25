# Ambon Arcanum

World-building and server management tool for [AmbonMUD](https://github.com/jnoecker/AmbonMUD). A Tauri 2 desktop application with a React frontend and Rust backend.

Point it at an AmbonMUD project directory — legacy (monolithic `application.yaml` + zone files) or standalone (split config + `zones/` directory) — and it becomes the single tool for building zones, configuring game systems, generating art, managing assets, and running the server.

## Features

### World Building
- **Zone map editor** -- React Flow graph with custom room nodes, exit edges, dagre auto-layout, and ambient starfield background
- **Entity editors** -- Mobs, items, shops, quests, gathering nodes, recipes, dialogue trees
- **Room property panels** -- Title, description, exits, station type, media references with spring-physics transitions
- **Cross-zone navigation** -- Click cross-zone exits to open target zones in new tabs
- **YAML round-trip** -- Format-preserving read/write using the `yaml` package CST mode

### Configuration
- **Structured editors** for all `application.yaml` sections: stats, abilities, status effects, combat, mob tiers, classes, races, progression, economy, crafting, regen, server, and login
- **Stat Designer** -- Data-driven stat definitions with formula binding editor
- **Class/Race Designer** -- HP/mana curves, stat mods with net-zero indicator
- **Raw YAML fallback** -- Unknown config fields shown in a generic property editor so nothing is hidden
- **Standalone project support** -- Split config into 11 focused YAML files with MUD export

### Art Generation & Asset Management
- **AI image generation** via DeepInfra (FLUX models) or Runware (alternative provider)
- **Two art styles** -- "Arcanum" (baroque cosmic gold-indigo) and "Gentle Magic" (soft dreamlike lavender)
- **Prompt enhancement** with LLM-powered style injection (Anthropic Claude, OpenRouter)
- **Asset gallery** with lazy-loaded thumbnails, filtering by type/zone, curated vs all views
- **Cloudflare R2 sync** -- Content-addressed uploads with SHA-256 dedup, custom domain CDN
- **Batch art generation** for zones with entity-specific prompt templates
- **Portrait and ability icon studios** -- Race/class portraits and ability/status-effect icons
- **Music and video generation** -- Audio and cinematic asset creation

### Server Management
- **Process lifecycle** -- Start/stop/restart via Gradle wrapper
- **Console** with log streaming, level filtering, and text search
- **Pre-flight checks** -- Java version, Gradle wrapper, port availability
- **Server status indicator** in toolbar (hidden for standalone projects)

### Developer Experience
- **Undo/redo** via zundo (per-zone, max 100 history entries)
- **Diff view before save** -- See exactly what YAML changes will be written
- **YAML preview** toggle alongside form editors
- **Global search** across all loaded zones (Ctrl+K)
- **Bulk rename/refactor** -- Rename entity IDs with cascading updates across references
- **Keyboard shortcuts** -- Ctrl+S save, Ctrl+Z undo, Ctrl+Tab cycle, ? help
- **Validation engine** -- Zone-level, cross-zone, and config validation with inline errors
- **Zone vibe system** -- LLM-generated context metadata for art-consistent generation

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop framework | Tauri v2 |
| Frontend | React 19, TypeScript 5.8 |
| Build | Vite 7, Bun |
| Styling | Tailwind CSS 4 |
| State management | Zustand 5 + Zundo (undo/redo) |
| Graph editor | XY Flow (React Flow) |
| YAML | `yaml` package (CST mode) |
| Backend | Rust (Tauri commands) |
| Asset CDN | Cloudflare R2 (S3-compatible, AWS SigV4 signing) |
| Image generation | DeepInfra API, Runware API |
| LLM integration | Anthropic Claude, OpenRouter |
| Testing | Vitest |
| Fonts | Cinzel, Crimson Pro, JetBrains Mono (via Fontsource) |

## Prerequisites

- [Bun](https://bun.sh/) (package manager and script runner)
- [Rust](https://rustup.rs/) (for the Tauri backend)
- An AmbonMUD project directory to point Ambon Arcanum at

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
AmbonArcanum/
  creator/                    # Ambon Arcanum (Tauri application)
    src/                      # React frontend
      components/
        config/panels/        #   Config editor panels (stats, abilities, classes, etc.)
        editors/              #   Entity editors (mob, item, shop, quest, etc.)
        zone/                 #   Zone map editor (React Flow graph, room panel, starfield)
        ui/                   #   Shared UI components (form widgets, diff modal, focus trap)
        wizard/               #   Project creation wizard (multi-step)
      stores/                 #   Zustand state stores
      types/                  #   TypeScript type definitions (world, config, project, assets)
      lib/                    #   Utilities, hooks, validation, YAML I/O, prompt templates
      assets/                 #   Background images for UI surfaces
    src-tauri/
      src/                    # Rust backend
        lib.rs                #   Tauri command registration
        project.rs            #   Project file I/O (legacy + standalone formats)
        settings.rs           #   Settings persistence (API keys, R2 credentials)
        deepinfra.rs          #   DeepInfra API client (image generation)
        runware.rs            #   Runware API client (alternative image provider)
        assets.rs             #   Asset manifest management (SHA-256 content-addressed)
        r2.rs                 #   Cloudflare R2 sync (AWS SigV4 signing)
        llm.rs                #   LLM integration for prompt enhancement
        anthropic.rs          #   Anthropic Claude API client
        openrouter.rs         #   OpenRouter API client
        vibes.rs              #   Zone vibe/context metadata for art generation
        server.rs             #   MUD server process management
        arcanum_meta.rs       #   Build metadata and version info
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
| `assetStore` | Asset manifest, image directory, generation UI state, R2 sync, settings |
| `vibeStore` | Zone vibe/context metadata for LLM-informed art generation |

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
