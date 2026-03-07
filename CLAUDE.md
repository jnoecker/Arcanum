# CLAUDE.md

Project-level instructions for Claude Code when working on this repository.

## Project Overview

Ambon Arcanum is a Tauri 2 desktop app for building MUD game worlds. React 19 + TypeScript frontend, Rust backend. It reads/writes YAML zone files and application.yaml for the AmbonMUD server.

## Repository Layout

- `creator/` -- The Tauri application (frontend + backend)
- `creator/src/` -- React frontend (components, stores, types, lib)
- `creator/src-tauri/src/` -- Rust backend (Tauri commands)
- `reference/` -- Kotlin source files from AmbonMUD server (read-only reference)
- `ARCANUM_STYLE_GUIDE.md` -- Design system (colors, typography, components)

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

## Architecture

### Frontend (React + TypeScript)

- **State**: Zustand stores in `src/stores/`. Each store is independent to avoid re-render cascading.
  - `projectStore` -- project metadata, open tabs
  - `zoneStore` -- loaded zone data, dirty flags, undo/redo (via zundo)
  - `configStore` -- parsed application.yaml
  - `serverStore` -- server process state, logs
  - `validationStore` -- computed validation errors
  - `assetStore` -- image generation, asset manifest, R2 sync, settings
- **Types**: `src/types/` mirrors Kotlin DTOs from `reference/world-yaml-dtos/`
- **YAML I/O**: Uses `yaml` package CST mode for format-preserving round-trip. See `src/lib/loader.ts`, `src/lib/saveZone.ts`, `src/lib/saveConfig.ts`.
- **Validation**: Client-side validation in `src/lib/validateZone.ts` and `src/lib/validateConfig.ts`. Must mirror rules from `reference/world-loader/WorldLoader.kt`.
- **Graph**: Zone maps use XY Flow (React Flow) with dagre layout. See `src/components/zone/`.

### Backend (Rust)

- `lib.rs` -- Registers all Tauri commands
- `project.rs` -- File I/O for project/zone/config files
- `settings.rs` -- Settings persistence (API keys, R2 credentials)
- `deepinfra.rs` -- DeepInfra API client for AI image generation
- `assets.rs` -- Asset manifest (JSON) management
- `r2.rs` -- Cloudflare R2 sync with AWS Signature V4 signing (no SDK dependency)

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
