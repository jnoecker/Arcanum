# Ambon Arcanum

World-building and server management tool for [AmbonMUD](https://github.com/jnoecker/AmbonMUD). A Tauri 2 desktop application with a React frontend and Rust backend.

Point it at an AmbonMUD project directory and it becomes the single tool for building zones, configuring game systems, generating art, managing assets, and running the server.

## Features

### World Building
- **Zone map editor** -- React Flow graph with custom room nodes, exit edges, and dagre auto-layout
- **Entity editors** -- Mobs, items, shops, quests, gathering nodes, recipes, dialogue trees
- **Room property panels** -- Title, description, exits, station type, media references
- **Cross-zone navigation** -- Click cross-zone exits to open target zones in new tabs
- **YAML round-trip** -- Format-preserving read/write using the `yaml` package CST mode

### Configuration
- **Structured editors** for all `application.yaml` sections: stats, abilities, status effects, combat, mob tiers, classes, races, progression, economy, crafting, regen, server, and login
- **Stat Designer** -- Data-driven stat definitions with formula binding editor
- **Class/Race Designer** -- HP/mana curves, stat mods with net-zero indicator
- **Raw YAML fallback** -- Unknown config fields shown in a generic property editor so nothing is hidden

### Art Generation & Asset Management
- **AI image generation** via DeepInfra (FLUX Schnell / FLUX Dev models)
- **Prompt enhancement** with LLM-powered style injection (Arcanum baroque-cosmic aesthetic)
- **Asset gallery** with lazy-loaded thumbnails, filtering by type, and sorting
- **Cloudflare R2 sync** -- Content-addressed uploads with SHA-256 dedup, custom domain CDN
- **Batch art generation** for zones with entity-specific prompt templates

### Server Management
- **Process lifecycle** -- Start/stop/restart via Gradle wrapper
- **Console** with log streaming, level filtering, and text search
- **Pre-flight checks** -- Java version, Gradle wrapper, port availability
- **Server status indicator** in toolbar

### Developer Experience
- **Undo/redo** via zustand-temporal (per-store, max 100 history entries)
- **Diff view before save** -- See exactly what YAML changes will be written
- **YAML preview** toggle alongside form editors
- **Global search** across all loaded zones
- **Bulk rename/refactor** -- Rename entity IDs with cascading updates across references
- **Keyboard shortcuts** with configurable bindings
- **Validation engine** -- Zone-level, cross-zone, and config validation with inline errors

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
| Image generation | DeepInfra API (FLUX models) |
| Testing | Vitest |
| Fonts | Cinzel, Crimson Pro, JetBrains Mono |

## Prerequisites

- [Bun](https://bun.sh/) (package manager and script runner)
- [Rust](https://rustup.rs/) (for the Tauri backend)
- An AmbonMUD project directory to point the Creator at

## Getting Started

```bash
cd creator

# Install dependencies
bun install

# Run in development mode (launches both Vite dev server and Tauri window)
bun run tauri dev

# Build for production
bun run tauri build
```

## Project Structure

```
AmbonArcanum/
  creator/                    # Tauri application
    src/                      # React frontend
      components/
        config/panels/        #   Config editor panels (stats, abilities, classes, etc.)
        editors/              #   Entity editors (mob, item, shop, quest, etc.)
        zone/                 #   Zone map editor (React Flow graph, room panel)
        ui/                   #   Shared UI components (form widgets, diff modal)
      stores/                 #   Zustand state stores
      types/                  #   TypeScript type definitions
      lib/                    #   Utilities, hooks, validation, YAML I/O
    src-tauri/
      src/                    # Rust backend
        lib.rs                #   Tauri command registration
        project.rs            #   Project file I/O
        settings.rs           #   Settings persistence
        deepinfra.rs          #   DeepInfra API client + image generation
        assets.rs             #   Asset manifest management
        r2.rs                 #   Cloudflare R2 sync (AWS SigV4 signing)
  reference/                  # Kotlin source from AmbonMUD server (type reference)
    world-yaml-dtos/          #   YAML schema DTOs (source of truth for TS types)
    domain-model/             #   Runtime domain types
    config/                   #   AppConfig + example application.yaml
    registries/               #   Registry loaders (abilities, classes, races, etc.)
    world-loader/             #   WorldLoader.kt (validation rules reference)
    example-zones/            #   Sample zone YAML files
    docs/                     #   Specs (world YAML, stat system, implementation plan)
  ARCANUM_STYLE_GUIDE.md      # Design system documentation
```

## Zustand Stores

| Store | Responsibility |
|-------|---------------|
| `projectStore` | Project metadata, mudDir, open tabs, UI state persistence |
| `zoneStore` | Loaded zones, per-zone dirty flags, undo/redo |
| `configStore` | Parsed `application.yaml`, dirty flag, undo/redo |
| `serverStore` | Server process state, logs, status |
| `validationStore` | Computed validation errors from zone + config state |
| `assetStore` | Generated images, asset manifest, R2 sync, settings |

## Design System

The Arcanum visual style is a baroque-cosmic aesthetic: deep indigo backgrounds, aurum-gold accents, rococo scrollwork motifs, serif typography (Cinzel/Crimson Pro), and unhurried animation. See [ARCANUM_STYLE_GUIDE.md](ARCANUM_STYLE_GUIDE.md) for the full design system.

## Documentation

- [ARCANUM_STYLE_GUIDE.md](ARCANUM_STYLE_GUIDE.md) -- Visual design system, color palette, typography, component specs, art prompts
- [reference/docs/FINAL_PLAN.md](reference/docs/FINAL_PLAN.md) -- Original implementation plan and architecture decisions
- [reference/docs/WORLD_YAML_SPEC.md](reference/docs/WORLD_YAML_SPEC.md) -- Zone YAML format specification
- [reference/docs/STAT_SYSTEM_SPEC.md](reference/docs/STAT_SYSTEM_SPEC.md) -- Data-driven stat system specification
- [reference/README.md](reference/README.md) -- Guide to the Kotlin reference files

## License

Private project. All rights reserved.
