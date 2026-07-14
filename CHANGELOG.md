# Changelog

All notable changes to Arcanum. Reconstructed from git history and release tags. Dates are the tag dates on `main`.

This project uses ad-hoc semantic versioning — minor bumps for feature work, patch bumps for regressions and server-compat fixes.

## [Unreleased] — v4.0 candidate

The work since `v3.17.0` is a major release cycle: a full visual redesign around the six-island World Map, dialogue voice-over, a lore retrieval index (RAG) wired into every AI writing path, lore→gameplay scaffolding, and a combat/item authoring overhaul. Grouped by theme below; this section becomes `4.0.0` at tag time.

### Added
- **Mount speed & flying authoring** — mount items take an optional `mountSpeed` ride-pace multiplier ((0, 10], server default 1.0) and a `flying` flag that unlocks the game's cross-zone World Map flight travel. Item editor fields with hints, plus validation mirroring the server: mount-items-only, speed range, and same-`mountId` sellers must agree on both values.
- **Dialogue voice-over** — synthesize NPC dialogue audio with ElevenLabs, with per-mob voice and delivery settings (sentence-pause control via break tags, per-voice slider defaults), and publish clips to R2 at a content-addressed hashed path so edited lines never serve stale audio. Voice config is emitted in the standalone MUD export. Backed by `voiceStore`, `elevenlabs.rs`, and `voices.rs`.
- **Lore RAG index** — every article, timeline event, map pin, region, relationship, and entity description is chunked and embedded with Voyage AI (`voyage-3-lite`), stored locally per project, and auto-reindexed (debounced) on lore edits. Every AI writing path — article rewrite/generation, consistency audit, gap analysis, @mention suggestions, the "Ask your world" Archivist chat, and zone/quest generation — now retrieves from the index instead of stuffing the prompt. New Lore Index settings panel with rebuild/clear controls and status.
- **Lore → gameplay scaffolding** — generate gameplay Class / Race, Talent / Creature Power, and a full zone directly from lore articles and the Lore Bible. Lore Ability split into Talent / Creature Power; Species/Profession split into Ancestry/Bestiary and Class/Occupation.
- **Auto-derived World settings** — Overview, History, Geography, Magic System, Tech & Civilisation, and Visual Style are each auto-derived from lore, timeline, maps, and Forge art.
- **OpenAI LLM provider** plus per-asset image-quality override.
- **Large global-asset / HUD art pack** — minimap room stamps (per-terrain), torn-parchment minimap frames, vitals/room-sign HUD frames, inventory and mob action buttons, navigation compass, left-edge nav widgets, and themed panel backgrounds (shop, inn, trainer, journal, spellbook, quest board, mail, terminal, equipment, monster manual). Per-asset aspect ratio and horizontal-flip support for global asset slots.
- **Item & combat authoring** — adaptive item stats (PRIMARY/SECONDARY/TERTIARY with skippable tertiary slot, 60/40 distribution), class `statPriorities`, accessory stat-budget readout, `itemType` / `questItem` / `takeable` / `healMana` fields, item rewards on quests (with turn-in-only quests), and a reworked melee combat formula with a zone level/mix wizard.
- **Quest authoring** moved to a top-level cross-zone panel (`questAuthoringStore`); quest dialogue-flag gating and turn-in NPC override.
- **Trainers folded into mobs** as a `role`, synthesized into the server-facing `trainers:` map on save. Mob templates split from spawn placements.
- **Structured action picker** for dialogue choices; status-effect DOT/HOT tick-scaling preview mirroring the server.
- **Sprite sheet export.**
- **Per-entity `respawnSeconds`** on ground items, features, and doors.
- **Standalone config split** — `world.yaml` split into thematic config files; `commands.yaml` made interchangeable with the MUD-side shape; lottery & dice-gambling config panels wired up.

### Changed
- **v4 visual redesign** — left sidebar rebuilt around the six islands (Arcanum, Forge, Loom, Orrery, Living World, Spire); world map and Loom art refreshed with a new hex layout; island maps wired as panel backgrounds. Article Editor redesigned around section-based composition (V2). Image generation consolidated into a unified Art Panel. Faction allegiance/reputation, timeline editor, Documents panel, World Settings, Housing, and Infrastructure panels all redesigned. Per-panel atmospheric art with an accessibility toggle. Default Claude model bumped to Sonnet 4.6.
- **Tuning & balance** — zone rebalance rewritten as a deterministic restat with role + scaling awareness; multiclass, regen, sanctum/death tuning, and pet ratio scaling mirrored from the AmbonMUD server.
- Ability damage/heal collapsed to a single field; spell/heal/buff schools unified onto one shape.

### Fixed
- Swept AI-slop / SaaS-dashboard tells and mojibake from visible surfaces across the creator.
- ElevenLabs: retry transient 429/5xx, parse snake_case responses, survive deleted voices, restore generation status across restart.
- Editor state no longer leaks across entities (RoomPanel/EntityPanel keyed by selection); atomic-write rename retries transient Windows `ERROR_ACCESS_DENIED`; R2 uploads retry with exponential backoff; vision calls compress images first (fixes >5 MB hub rejection).

## [3.17.0] — 2026-05-08

### Changed
- Refreshed the world map and Loom art with a new hex layout.
- Curated scene subjects for lore article art prompts.

## [3.16.0] — 2026-05-08

### Changed
- Rebuilt the left sidebar around the six islands (Arcanum, Forge, Loom, Orrery, Living World, Spire).

## [3.15.0] — 2026-05-08

### Added
- Quest dialogue-flag gating and a turn-in NPC override.

### Changed
- Split mob templates from spawn placements.
- Sharpened the lore article art pipeline.

### Fixed
- Story sidebar; legacy `mob.room` migration now preserves key position.

## [3.14.0] — 2026-04-25

### Changed
- Overhauled the zone rebalance wizard with role + scaling awareness.
- Mirrored the MUD's sanctum-room and death tuning.
- Slowed mob action cadence and eased skill-point pacing across presets.

## [3.13.87] — 2026-04-23

### Added
- Rainbow butterflies drifting across the world map.

## [3.12.0] — 2026-04-23

### Added
- `itemType` and `questItem` fields.

## [3.11.0] — 2026-04-23

### Fixed
- Locked in archetype contract validation; corrected tuning presets to match verified AmbonMUD server semantics (including a preset that bloated `combat.maxDamage`).

## [3.10.0] — 2026-04-23

### Added
- Inline editors for daily/weekly/global quest pools; daily/bounty/global quest knobs surfaced in Living World → Quests.
- `MobRole` in the editor and validator; tier-computed mob stats surfaced with override flags.
- Zone-level scaling and quest difficulty tiers surfaced in the editor.

### Changed
- Tightened diminishing returns across presets.

## [3.9.0] — 2026-04-22

### Changed
- **Progression config merged into World** — the level cap, XP curve, diminishing returns, and level-up rewards editor now lives inside the World config panel instead of a standalone Orrery hotspot. Existing saved `panel:progression` tabs are remapped to `panel:world` on project open.

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

## [3.4.1] — 2026-04-16

### Fixed
- Tightened toolbar + sidebar layout for narrow widths.

## [3.4.0] — 2026-04-16

### Added
- **Per-world output language** for AI text generation — generated lore and prose can target a language other than English.

## [3.3.0] — 2026-04-16

### Added
- **Hub self-registration** — public signup and account management: in-app signup in onboarding, landing signup + account pages on the showcase, account status + upgrade flow in the creator settings panel. Hub gains signup/account endpoints and gates publish on email verification.
- **Playtester tier** with decoupled quotas, plus GDPR self-delete.

## [3.2.0] — 2026-04-16

### Added
- Linked lore articles are now fed into the zone generator for richer, world-consistent output.

## [3.1.0] — 2026-04-16

### Added
- Generate a rich zone directly from a World Planner plan.

### Changed
- Replaced playtest panel emojis with Arcanum placeholder art.

## [3.0.1] — 2026-04-16

### Changed
- Moved timeline era colors to CSS custom properties; lore fallback prompts defer to the world visual style.

### Removed
- Orphaned `serverStore`, `FactionsPanel`, and `LoreCodexPanel`.

## [3.0.0] — 2026-04-15

### Added
- **World Planner overhaul** — region workshop and sketch canvas for planning zones, factions, and arcs before building them.

### Changed
- Detheme the showcase player + page surfaces; responsive pass on touch targets, table reflow, mobile grid steps, and scroll viewport.

## [2.13.0] — 2026-04-15

### Changed
- Onboarding, accessibility, lore typography, theming tokens, and welcome-screen restraint polish (rolls in the internal 2.12.0 a11y/responsive pass).

## [2.11.0] — 2026-04-15

### Fixed
- Modal accessibility and hub-admin visual alignment.

## [2.10.0] — 2026-04-15

### Added
- **First-class factions & reputation** — reputation factions, enemy relationships, and quest rewards. (Server-side consumption tracked separately; shipped server-side in a later cycle.)
- **Grid-first zone generation** with up/down layout handling, duplicate-zone + AI retheme, and a text↔layout doctor check.

### Fixed
- Lay out up/down-connected floors as separate islands.
- Persist keyboard room/exit deletions to the `WorldFile`.
- Maps/World Planner pill styling.

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

[Unreleased]: https://github.com/jnoecker/AmbonArcanum/compare/v3.17.0...HEAD
[3.17.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v3.17.0
[3.16.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v3.16.0
[3.15.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v3.15.0
[3.14.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v3.14.0
[3.13.87]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v3.13.87
[3.12.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v3.12.0
[3.11.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v3.11.0
[3.10.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v3.10.0
[3.9.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v3.9.0
[3.8.1]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v3.8.1
[3.8.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v3.8.0
[3.7.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v3.7.0
[3.6.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v3.6.0
[3.5.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v3.5.0
[3.4.1]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v3.4.1
[3.4.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v3.4.0
[3.3.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v3.3.0
[3.2.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v3.2.0
[3.1.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v3.1.0
[3.0.1]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v3.0.1
[3.0.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v3.0.0
[2.13.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v2.13.0
[2.11.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v2.11.0
[2.10.0]: https://github.com/jnoecker/AmbonArcanum/releases/tag/v2.10.0
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
