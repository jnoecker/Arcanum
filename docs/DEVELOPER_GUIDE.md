# Arcanum Developer Guide

Everything you need to go from a fresh clone to a working dev build, plus the workflow and architecture context to navigate the codebase.

If you're already familiar with the repo layout, the top-level [`README.md`](../README.md) is the fast path. This guide is for someone opening Arcanum for the first time.

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| [Bun](https://bun.sh/) | Latest | Package manager and script runner for `creator/` |
| [Rust](https://rustup.rs/) | Stable toolchain, edition 2021 | Tauri backend |
| [Tauri CLI v2](https://v2.tauri.app/) | 2.x | `cargo install tauri-cli --version '^2'` or use the bundled `@tauri-apps/cli` dep |
| [Node.js](https://nodejs.org/) | 22 LTS | Showcase, hub-worker, hub-admin |
| npm | Bundled with Node | Same as above |
| [Git](https://git-scm.com/) | Any recent | Required for the creator's git-integration features |

### Platform-specific

- **Windows (primary development target):** [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) (pre-installed on Windows 10/11).
- **macOS:** Xcode command-line tools (`xcode-select --install`).
- **Linux:** `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libgtk-3-dev` (matches the CI workflow).

### External services (optional)

Only required if you're touching the features that use them:

- **DeepInfra / Runware / OpenAI** — image generation. API keys set in user settings inside the app.
- **Anthropic** — Claude vision for map analysis. API key set in user settings.
- **OpenRouter** — LLM prompt enhancement. API key set in user settings.
- **Cloudflare R2** — asset CDN. Account ID, bucket, access key, secret, custom domain set in project settings.
- **Cloudflare D1 + Workers + Pages** — only if you're developing against the hub.

None of these are needed to build and launch Arcanum. You can explore the full UI without any keys configured; only the AI and publishing features will be gated.

## First build

```bash
git clone https://github.com/jnoecker/AmbonArcanum.git
cd AmbonArcanum/creator
bun install
bun run tauri dev
```

The first `bun run tauri dev` is slow — Cargo compiles ~200 crates. Expect several minutes on a cold machine. Subsequent launches are fast.

**What success looks like:**

1. Vite prints `Local: http://localhost:1420/` and holds.
2. Cargo finishes compiling and prints `Running target/debug/arcanum[.exe]`.
3. A native window titled "Arcanum" opens at 1400x900 and shows the welcome screen.
4. Closing the window terminates both Vite and Cargo cleanly.

If the window opens blank or the console shows `Failed to load resource`, the Vite server didn't come up first — stop everything and re-run.

## Verifying the setup

```bash
cd creator

# TypeScript (must pass — CI enforces this)
bunx tsc --noEmit

# Rust check
cd src-tauri && cargo check && cd ..

# Data-layer tests (fast, no UI)
bun run test
```

All three should pass on `main`. If any fail on a fresh clone, open an issue — the CI guarantees they pass on `main`.

## Directory map

```
AmbonArcanum/
├── creator/                 # Arcanum desktop app
│   ├── src/                 #   React frontend (TypeScript)
│   │   ├── components/      #     UI — AppShell, editors, panels, lore, zone, wizard, ...
│   │   ├── stores/          #     Zustand stores (15 independent stores)
│   │   ├── lib/             #     Pure utilities — YAML I/O, validation, prompt templates, edit functions
│   │   ├── types/           #     TypeScript types — mirrors Kotlin DTOs in reference/
│   │   ├── assets/          #     Background images for UI surfaces
│   │   ├── App.tsx          #     Root component (welcome vs AppShell)
│   │   ├── main.tsx         #     Vite entry point
│   │   └── index.css        #     Tailwind 4 + design tokens (@theme block)
│   ├── src-tauri/           #   Rust backend
│   │   ├── src/             #     Tauri commands (~30 modules)
│   │   ├── Cargo.toml
│   │   └── tauri.conf.json  #     Window size, identifier, CSP, bundle config
│   ├── package.json
│   └── vite.config.ts       #   Port 1420, manual chunks, COOP/COEP middleware
│
├── showcase/                # Public read-only lore viewer (Vite + React SPA)
│   ├── src/                 #   Self-contained — no Tauri dependency
│   ├── public/              #   _redirects (for Pages SPA fallback), data/, .assetsignore
│   └── wrangler.toml        #   Cloudflare Pages deploy config
│
├── hub-worker/              # Optional Cloudflare Worker (Arcanum Hub backend)
│   ├── src/
│   │   ├── handlers/        #   Publish, admin, AI proxy
│   │   ├── migrations/      #   D1 SQL migrations
│   │   ├── schema.sql
│   │   └── index.ts         #   Request router
│   └── wrangler.toml
│
├── hub-admin/               # Optional admin SPA for hub user/quota management
│   └── src/                 #   Master-key gated against HUB_ADMIN_KEY
│
├── reference/               # Read-only — AmbonMUD Kotlin source (source of truth for YAML DTOs)
│
├── docs/                    # You are here
├── .github/workflows/       # ci.yml, release.yml
├── README.md
├── CLAUDE.md                # Architecture + conventions + known pitfalls
├── ARCANUM_STYLE_GUIDE.md   # Design system
└── .impeccable.md           # Condensed design context
```

## Development workflow

### Making a change

1. Create a feature branch off `main`: `git checkout -b feature/short-name`. One logical change per PR.
2. Edit code. Tauri dev mode hot-reloads frontend changes; Rust changes trigger an automatic rebuild and relaunch.
3. Before committing:
   - `bunx tsc --noEmit` — the strictest setting is `noUncheckedIndexedAccess`, which surfaces most real bugs as compile errors.
   - `cd src-tauri && cargo check` — only if you touched Rust.
   - `bun run test` — only if you touched data-layer code (`creator/src/lib/`, `creator/src/stores/`).
4. Push and open a PR against `main`. CI runs typecheck + tests + `cargo check` on every push.

No formatter is configured. Follow the surrounding style:

- **TypeScript:** 2-space indent, double quotes, semicolons, trailing commas. `interface` for object shapes, `type` for unions.
- **Rust:** Standard `rustfmt` defaults. All public functions exposed to the frontend are `#[tauri::command]` and return `Result<T, String>`.

### Testing

Vitest runs **data-layer tests only** — no UI tests. Tests live alongside source in `__tests__/` directories. Focus areas: YAML round-trip, ID normalization, validation rules, stat formulas. When you add or change a data transform, add a test.

`bun run test` runs once; `bun run test:watch` re-runs on file save.

### Submitting a PR

- CI must be green before merge.
- Prefer small PRs. Split unrelated changes.
- The commit message convention is free-form — look at `git log` for examples.

## Architecture at a glance

Deep details live in [`CLAUDE.md`](../CLAUDE.md). The one-page version:

**Frontend-heavy.** Most business logic is TypeScript — the Rust backend is a thin service layer (file I/O, HTTP clients, asset management, git operations, FFmpeg integration). They talk through Tauri's `invoke()` IPC with every command returning `Result<T, String>`.

**Fifteen independent Zustand stores.** No middleware chaining, no cross-store subscriptions. Stores read each other via `useOtherStore.getState()` when they need to. Always select individual fields (`useProjectStore((s) => s.project)`), never the whole store — this is what prevents re-render cascades.

**YAML is load-bearing.** Zone files and `application.yaml` are edited with the `yaml` package's CST mode so comments and field ordering survive round-trips. Loaders live in `creator/src/lib/loader.ts`; savers in `saveZone.ts` and `saveConfig.ts`.

**Two project formats.** "Legacy" is a Gradle-based AmbonMUD checkout with a monolithic `application.yaml`. "Standalone" is a flat directory with 11 split config files plus `zones/<name>/zone.yaml`. The format is detected by the `validate_project` Rust command and every loader/saver dispatches on `project.format`.

**Panel registry drives navigation.** `creator/src/lib/panelRegistry.ts` defines ~60 panels across 7 groups. Each panel has a `host` type (`studio` / `config` / `lore` / `command`) that `MainArea.tsx` uses to route to the right container component.

**Tauri commands are typed in TypeScript through inference only.** There's no codegen layer — when you add a command, mirror the types manually between `creator/src-tauri/src/*.rs` and the TypeScript call site.

## Where new features typically go

| You want to... | Go to... |
|---|---|
| Add a config panel (new `application.yaml` section) | `creator/src/components/config/panels/` + register in `panelRegistry.ts` |
| Add a list-and-detail editor (abilities, classes, items) | Use `DefinitionWorkbench` pattern in `creator/src/components/config/` |
| Add a lore article template | Extend `TEMPLATE_SCHEMAS` in `creator/src/lib/loreTemplates.ts` |
| Add an AI asset type | Add templates in `creator/src/lib/arcanumPrompts.ts` + wire into the asset generator |
| Add a Tauri command | Create or extend a module in `creator/src-tauri/src/`, register it in `lib.rs` |
| Add a validation rule | Extend `creator/src/lib/validateZone.ts` or `validateConfig.ts`. Must mirror `reference/world-loader/WorldLoader.kt`. |
| Add undo to a new mutation | Zone store: call `pushHistory()` before the change. Lore store: call `snapshotLore(s)` inside `set()`. |

## Hub development (optional)

Only needed if you're working on publish/AI proxy/admin features.

```bash
cd hub-worker
npm install
wrangler d1 create arcanum-hub        # One-time: creates the D1 database
wrangler r2 bucket create arcanum-hub # One-time: creates the R2 bucket
# Paste the database_id from the first command into wrangler.toml
npm run db:init:local
npm run dev                           # Local worker on :8787
```

The worker uses path-prefixed routes in dev (`/api/publish/*`, `/dev/world/<slug>/showcase.json`) instead of the production subdomain layout. See [`hub-worker/README.md`](../hub-worker/README.md) for the full routing table.

The hub worker also bundles the showcase SPA via `[assets]`. `npm run deploy` rebuilds the showcase with `VITE_HUB_ROOT_DOMAIN=arcanum-hub.com`, strips `_redirects` from `dist/` (Workers Assets rejects it), then runs `wrangler deploy`.

For the admin SPA:

```bash
cd hub-admin
npm install
VITE_HUB_API_URL=http://127.0.0.1:8787 npm run dev
```

## Common tasks

### Adding a new store

1. Create `creator/src/stores/myStore.ts` with a typed `create<MyStore>((set, get) => ({ ... }))`.
2. Import it with field-level selectors only: `const x = useMyStore((s) => s.x)`.
3. Never subscribe to the whole store object — that re-renders on every change.

### Adding a new Tauri command

1. Add or extend a module in `creator/src-tauri/src/`. Function signature: `#[tauri::command] pub async fn my_command(...) -> Result<T, String>`.
2. Register it in `lib.rs` under `invoke_handler![...]`.
3. On the frontend: `import { invoke } from "@tauri-apps/api/core"` and call `await invoke<T>("my_command", { ... })`.

### Updating a dependency

- **Creator (JS):** `cd creator && bun update <pkg>`. CI uses `--frozen-lockfile`, so commit `bun.lock`.
- **Creator (Rust):** `cd creator/src-tauri && cargo update -p <crate>`. Commit `Cargo.lock`.
- **Showcase / hub:** `cd showcase && npm update <pkg>` (and the hub dirs similarly). All use `package-lock.json`.

### Writing a test

Tests live alongside source in `__tests__/` directories. Vitest with no configuration file — it picks up `*.test.ts` and `*.test.tsx`. Prefer pure-function tests; don't import React components into Vitest.

## Troubleshooting

### `bun install` fails with lockfile errors

`bun.lock` is authoritative. If CI says `--frozen-lockfile` failed, run `bun install` locally without the flag and commit the updated lockfile.

### Tauri builds fail on Linux with "webkit2gtk not found"

Install the system deps from CI:

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libgtk-3-dev
```

### Rust check hangs on `cargo check`

The Tauri build the first time downloads ~200 crates. Let it finish — subsequent checks are cached. If it's still slow after the first success, check your `target/` directory size and run `cargo clean` if it's over a few GB.

### Images show as broken on Windows

Don't use `convertFileSrc()` for image references — the Tauri asset protocol has issues on Windows. Serve images through the `read_image_data_url` IPC command instead, which returns a base64 data URL.

### `bun run tauri dev` launches, but the window is blank

Vite didn't start before Tauri tried to connect. Stop everything (`Ctrl+C`, kill any orphan `vite` / `arcanum` processes) and retry. The Vite dev server must be reachable at `localhost:1420` before the Tauri window opens.

### Scrolling containers don't scroll

Any scrollable flex child needs `min-h-0 flex-1` on its parent — without `min-h-0`, flex children won't shrink below their content size, so `overflow-y-auto` has nothing to clip.

### "Global assets" save produces broken YAML

Global assets in `application.yaml` are a flat `Record<string, string>` (key → filename). Use `setIn` for updates, not `saveMapSection` — the latter expects nested object values.

### Lore changes can't be undone

Every lore mutation must call `snapshotLore(s)` inside the `set()` callback. Missing that call is the single most common source of "undo doesn't work" bugs. The zone store uses a different pattern (zundo middleware), so this only applies to lore.

### Validation errors don't show

`validationStore` is computed lazily — it only recalculates when a store marks itself dirty. If you added a new validation rule and it doesn't appear, make sure the triggering store calls `markDirty()` after your change.

### "Which hub mode is the showcase in?"

`showcase/src/lib/hubMode.ts::detectHubMode()` inspects `window.location.hostname` against `VITE_HUB_ROOT_DOMAIN`. In local dev it falls back to `self-hosted` and reads `/data/showcase.json`.

### Hub deploy shows stale showcase content

`hub-worker` bundles the showcase `dist/` via its `[assets]` binding. Running `wrangler deploy` directly ships whatever's already in `showcase/dist/`, which is probably the self-hosted build. Always use `npm run deploy` inside `hub-worker/` — it rebuilds the showcase with the hub env var first.

## More reading

- [`../CLAUDE.md`](../CLAUDE.md) — architecture details, coding conventions, and the full list of known pitfalls
- [`../ARCANUM_STYLE_GUIDE.md`](../ARCANUM_STYLE_GUIDE.md) — design system
- [`../hub-worker/README.md`](../hub-worker/README.md) — hub routing, R2 layout, admin endpoints
- [`../reference/docs/WORLD_YAML_SPEC.md`](../reference/docs/WORLD_YAML_SPEC.md) — zone YAML schema (read-only reference)
- [`../reference/docs/STAT_SYSTEM_SPEC.md`](../reference/docs/STAT_SYSTEM_SPEC.md) — stat system specification (read-only reference)
