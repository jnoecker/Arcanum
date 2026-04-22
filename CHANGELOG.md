# Changelog

All notable changes to Arcanum. Reconstructed from git history and release tags. Dates are the tag dates on `main`.

This project uses ad-hoc semantic versioning — minor bumps for feature work, patch bumps for regressions and server-compat fixes.

## [Unreleased]

_No unreleased changes at this time._

## [3.8.1] — 2026-04-22

### Fixed
- **Mob damage invariant check** — `validateZone` now resolves each mob's min/max damage via its `tier` + `level` fallback (matching the server's `WorldLoader`) and errors when `resolvedMax < resolvedMin`. This catches the failure mode where a mob overrides only `maxDamage` (e.g. nerfed NPCs at `maxDamage: 1`) while the tier-derived `minDamage` drifts above that ceiling — previously the server would refuse to boot with `WorldLoadException: resolved maxDamage (X) must be >= minDamage (Y)` and Arcanum had no way to flag it before publish. The new error text points at which side is overridden vs inherited.

## [3.8.0] — 2026-04-22

### Added
- **Achievement-gated exits** — `ExitValue` supports optional `requiresAchievement` and `lockedMessage` fields. The exit editor panel gains an "Achievement gate" section alongside the door editor, with a select populated from `config.achievementDefs`. `validateZone` warns when an exit references an undefined achievement. Server-side enforcement is not included here.
- **Diminishing XP returns** — `progression.xp.diminishing` block (`{ enabled, thresholds: [{ levelsBelow, multiplier }] }`) on `application.yaml`. The Progression config panel gets a new "Diminishing Returns" section with an enable toggle and a thresholds editor. Existing worlds without the block parse as `undefined` and behave as before. Server-side enforcement is not included here.

## [3.7.0] — 2026-04-21

### Fixed
- **Atomic JSON writes** — the asset manifest, user/project settings, admin config, vibes, arcanum meta, and the R2 runtime sync state are now written via a same-directory temp file + atomic rename. A crash, force-quit, or power loss during a write can no longer truncate these files. Resolves intermittent "Failed to parse manifest: EOF while parsing an object" errors that blocked publish flows.

## [3.6.0] — 2026-04-21

### Changed
- **GPT Image bumped from 1.5 → 2** (`openai:gpt-image@2`). Runware v2's `providerSettings.openai` dropped the `background` field, so transparent-background requests at the provider level are gone — client-side bg-removal still handles transparency. Per-image pricing is now token-based (see Runware docs). Legacy `openai:4@1` and `gpt-image-1` model IDs in user/project settings are transparently rewritten to the new ID.

## [3.5.0] — 2026-04-18

### Added
- **Lore chat assistant ("Ask your world")** — a floating panel that answers natural-language questions about the current world by retrieving articles and relations and synthesising with the existing LLM dispatcher. Citations render as inline clickable links that open the referenced article. Reachable via Ctrl+/, the command palette, and a button in the lore toolbar. Conversation history persists per-world in `lore.yaml`.

## [2.5.0] — 2026-04-14

### Added
- **Balance simulation lab** for the Tuning Wizard — models XP curves, encounter outcomes, and progression pacing so a tuning change can be previewed before it's committed.
- **Showcase settings rework** — redesigned the panel with AI-assisted art generation and a live preview of the published site as you tune it.
- **World Planner** surfaced as a tab inside the Maps panel for sketching zones, factions, and arcs before building them.
- **Offline backup** — every project now autosaves, takes periodic snapshots, and can be exported as a zip archive from inside the app.
- **Hub discovery** — the Arcanum Hub landing page now shows richer world cards, Open Graph metadata, and full-text search.
- **Unified undo/redo** across zones, lore articles, stories, and config — a single Ctrl+Z dispatcher routes to whichever surface owns the currently focused panel.

## [2.4.0] — 2026-04-14

### Added
- **In-editor playtest walker** — step through a zone as a player would, right inside Arcanum, without starting a server.
- **Cross-zone entity search** in the command palette (Ctrl+K) — jump directly to mobs, items, quests, and rooms regardless of which zone owns them.

## [2.3.2] — 2026-04-14

### Fixed
- Zone YAML uploaded during R2 deploys no longer retains the `zoneMap` field — the MUD server crashed when it saw it. Stripped on the deploy path.

## [2.3.1] — 2026-04-14

### Fixed
- `zoneMap` is now stripped from image defaults on save as well, closing the same MUD-crash surface from the editor-save path.

## [2.3.0] — 2026-04-14

### Added
- **Zone Layout Doctor** — detects and fixes broken exit wiring and mismatched exit text across a zone with one click.

## [2.2.0] — 2026-04-13

### Added
- **Zone map generator** — produces an AI-illustrated zone map directly from the zone's room data.
- **Housing image generation** and inclusion of dungeons in the batch zone-art pipeline.
- **Custom Arcanum icons** replacing every emoji used as UI chrome.

### Fixed
- Zone-map image collapsing to a thin bar inside flex layouts.
- Stale `bun` references in the `hub-worker` docs (it uses `npm`).

## [2.1.0-rc1] — 2026-04-13

### Changed
- Onboarding simplified, starter content enriched, and a round of playtest-surfaced fixes landed before the next feature branch opened.

## [2.0.0-rc1] — 2026-04-13

### Added
- **Community Edition** — a keys-free, AI-free build configured via `VITE_AI=false` + `--no-default-features`. Full and Community editions are now built side by side by the CI and release pipelines.

### Changed
- Frontend quality audit pass: normalize, optimize, harden, adapt, extract. (Previously released as 1.6.0 internally, rolled into the 2.0 cut.)
- Welcome screen redesign (previously 1.5.0 internally).

## [1.4.0] — 2026-04-12

### Added
- `housingBroker` room role flag.

### Fixed
- Global asset modals rendering behind the sidebar.

## [1.3.0] — 2026-04-12

### Added
- Delete button on story cards in StoryBrowser and inside the story editor header.

## [1.2.0] — 2026-04-12

### Added
- **Onboarding re-skin flow** — new users land on a base Academy zone that's re-skinned by the LLM when they pick a flavor.
- Mob spells and pet spells added to base template types, with spell editors on mob and pet editors.

### Changed
- Switched the Hub LLM from DeepSeek V3.2 to Claude Haiku 4.5.
- Bumped LLM timeouts to 5 min and shortened backstory prompts.
- New users now drop into **Forge > Art** after onboarding.

### Fixed
- Onboarding hang from missing `maxTokens` and timeouts in re-skin LLM calls.
- Robust JSON extraction in re-skin responses with diagnostic logging.

## [1.1.1-rc] — 2026-04-12

### Added
- Flip-image button for mobs, sprites, and pets.

### Changed
- Video request construction moved to `json!` macro (away from serde structs).
- Runware video generation updated for PixVerse V6 API; stale `runware:2` model migrated to `pixverse:1@8`.

### Fixed
- Video duration serializing as integer instead of float.
- Runware video generation task type.
- Rules-of-Hooks violation in `HubSettingsPanel`.
- Lore modals escaping the view-transition containing block via portal.

## [1.1.0-rc] — 2026-04-11

### Added
- **Worldbuilder → lore import wizard** (Obsidian / Markdown vault ingest).
- **Publish-only tier** for hub users.
- **Stylist NPC** support (config, room flag, global asset).
- **Floating save pill** and per-zone save buttons.
- **World atlas** with interzone edges, dagre layout, and draggable zone clusters.
- Runware **Bria RMBG** as a background-removal backend.

### Changed
- Emote presets and secondary currencies redesigned as card grids.
- Factions, enchanting, pets, and housing panels redesigned with hero headers and card-grid layouts.
- Config panels reorganized: World/Server split, Achievements now tabbed, islands reshuffled.
- Zone view panels redesigned and the zone toolbar restructured.
- Mob and item editors split into tabs like the Room panel.
- Shared assets panel unified and persisted-state wipe fixed.
- Art generator reordered; video/audio collapsed into pills.
- `@imgly/background-removal` pre-bundled at Vite dev start.
- COOP/COEP forced via a Vite middleware plugin for cross-origin isolation (multi-threaded background removal).

### Fixed
- Shared HTTP client timeout raised for Hub image generation.
- World `visualStyle` restored in portrait and sprite prompts.

## [1.0.4-rc] — 2026-04-11

### Added
- **Hub AI proxy** with lifetime quotas + admin UI for usage & quota editing.
- **Publish-to-Hub** UI in the Arcanum toolbar and `hub.rs` publish pipeline in the Rust backend.
- **Multi-tenant mode** for the showcase SPA, served from the Hub Worker's `[assets]` binding.
- `hub-worker` (publish/admin/AI API) and `hub-admin` SPA projects.
- Hub moved to the dedicated `arcanum-hub.com` apex, with admin reverse-proxied through the Worker.
- **Hub-first onboarding flow** from the welcome screen.
- **Island back-navigation pill** on all panel views.

### Changed
- Player sprite system rebuilt — removed tiers, fixed art quality.
- Sprite generation pipeline reworked to fix lavender contamination.
- GPT Image 1.5 added via Runware; deploy and batch-art gaps fixed.
- GPT Image quality defaulted to `low` across all three code paths.

### Fixed
- HTML entity decoding during showcase export.
- Infinite re-render loop opening the room panel.
- Search dropdown rendering behind the button row on the showcase home.

## [1.0.3-rc] — 2026-04-11

### Changed
- Settings split: Hub, R2, and GitHub extracted into dedicated panels.

### Fixed
- Crash when clicking gathering nodes in the asset workbench.
- WelcomeScreen scroll cutoff on short viewports.
- Hub LLM model ID and max-tokens clamp.

## [1.0.1-rc] — 2026-04-10

### Added
- **37 UI icons** across the zone editor, room panel, mob editor, and map.
- Bundled MUD default and global asset images for in-app preview.
- Terrain, auction, and mob category fields plus a default assets panel.
- 10 missing config sections + 6 `ServerConfig` fields typed, parsed, saved, and editable (#186).

### Changed
- Asset generator redesigned: compact layout with a categorized type picker.
- Shared patterns deduplicated across frontend and backend (#185).
- UI polish: layout rhythm, component extraction, entity colors (#184).
- Global assets, lottery, and dungeon data aligned with the MUD reference.

### Fixed
- Island map ordering bug.
- Lifespan editable; typed slot positions; auto-derived keywords/descriptions.
- YAML field validation and round-trip issues surfaced by the MUD reference audit.

## [1.0.0-rc] — 2026-04-09

First release candidate.

### Added
- **Editor UX redesign** (#183) — the shell layout Arcanum ships with today.
- **Environment themes** — weather types, sky gradients, zone overrides (#182).
- Background-removal process overhaul.
- Showcase styling refresh.

### Fixed
- `tauri.conf.json` schema: `bundle.icon` → correct field for Tauri 2.
- CI bundle: icons array declared, unsigned macOS codesign disabled.
- macOS CI: replaced deprecated `macos-13` runner with universal-binary build.

## Pre-release history (March 2026)

Arcanum was bootstrapped in March 2026 as the creator tool for AmbonMUD. The pre-1.0 work landed in roughly the following phases:

- **Phase 1** — Tauri v2 + React 19 + Zustand scaffold, YAML round-trip tests.
- **Phase 2** — Zone map viewer (React Flow + dagre), create/delete rooms & exits, drag-to-connect direction picker, save + undo/redo + keyboard shortcuts.
- **Phase 3** — Entity editor foundation (mobs, items, shops, quests, gathering nodes, recipes), dialogue tree editor with collapsible outline, zone-level validation wired to the status bar.
- **Phase 4** — Config editor shell with tabbed panels and save.

From there the feature set broadened into art generation, lore articles, maps, timeline, relationship graph, tuning wizard, story editor, showcase publishing, Hub infrastructure, and the modern multi-realm shell — all before the 1.0 release candidate.

[Unreleased]: https://github.com/jnoecker/AmbonArcanum/compare/v2.5.0...HEAD
[2.5.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v2.5.0
[2.4.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/2.4.0
[2.3.2]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v2.3.2
[2.3.1]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v2.3.1
[2.3.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v2.3.0
[2.2.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v2.2.0
[2.1.0-rc1]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v2.1.0-rc1
[2.0.0-rc1]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v2.0.0-rc1
[1.4.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v1.4.0
[1.3.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v1.3.0
[1.2.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v1.2.0
[1.1.1-rc]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v1.1.1-rc
[1.1.0-rc]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v1.1.0-rc
[1.0.4-rc]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v1.0.4-rc
[1.0.3-rc]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v1.0.3rc
[1.0.1-rc]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v1.0.1rc
[1.0.0-rc]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v1.0.0rc
