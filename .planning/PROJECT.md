# Arcanum Tuning Wizard

## What This Is

A tuning wizard for Arcanum that helps MUD builders understand and configure the 300+ gameplay-related numeric values in `application.yaml`. Instead of editing raw numbers across 45+ config panels, builders pick a themed preset, see a before/after comparison of how it changes key metrics, and accept or reject changes per category.

## Core Value

Builders can confidently configure game balance without needing to understand every formula interaction — presets give them a solid starting point, comparisons show them what changed and why.

## Requirements

### Validated

- ✓ Config system with 45+ panels covering all game systems — existing
- ✓ Zustand configStore with auto-save to application.yaml — existing
- ✓ TypeScript type coverage for all config interfaces — existing
- ✓ Panel registry routing system — existing
- ✓ Config panel host with decorative backgrounds and section headers — existing
- ✓ Tuning Wizard as new top-level tab in the app — v1.0
- ✓ 3 themed presets (Casual, Balanced, Hardcore) with 137 tunable fields — v1.0
- ✓ Before/after comparison view with derived metrics and color-coded diffs — v1.0
- ✓ Per-section accept/reject when applying preset changes — v1.0
- ✓ Coverage of all gameplay systems (combat, economy, progression, stats, crafting, quests, social, world timing) — v1.0
- ✓ XP curve, mob tier power, and stat radar chart visualizations — v1.0
- ✓ Health check warnings for problematic section combinations — v1.0
- ✓ Searchable parameter browser with section filtering — v1.0

### Active

(None yet — awaiting next milestone)

### Out of Scope

- Server/infrastructure settings (ports, logging, observability) — not gameplay-relevant
- Modifying the existing config panel UI — wizard is additive, not a replacement
- Multiplayer playtesting or live server integration — wizard works offline on YAML
- Ability/status effect/class/race definition editing — those are content, not tuning
- Deterministic balance rules — deferred to v2 (health check covers immediate need)
- LLM-powered holistic analysis — deferred to v2 (presets + comparison sufficient for v1)

## Context

Arcanum is a mature Tauri 2 desktop app (React 19 + TypeScript frontend, Rust backend) for building MUD game worlds. The config system is comprehensive but presents hundreds of numeric fields as raw inputs without contextual guidance on how they interact. The mob tier system alone has 44 fields (11 per tier x 4 tiers), and stat bindings connect stats to combat formulas through divisors that are non-obvious to tune.

The existing config panel architecture uses a panel registry + ConfigPanelHost pattern. The wizard will be a new top-level workspace, not a config panel. It reads from and writes to the same configStore.

Key config domains for tuning:
- **Combat**: mob tiers (HP/damage/armor/XP/gold per tier per level), damage formulas, tick rates
- **Progression**: XP curve (base, exponent, linear, multiplier), level-up rewards (HP/mana per level)
- **Stats**: stat bindings (which stat affects what, with divisors), dodge/regen/scaling formulas
- **Economy**: buy/sell multipliers, crafting costs, gambling odds, lottery
- **Quests**: bounty/daily/global quest rewards and timing
- **Social**: group XP bonus, faction reputation scaling
- **World**: day/night cycle length, weather transitions

## Constraints

- **Tech stack**: Must use existing React 19 + Zustand + Tailwind stack. No new frameworks.
- **Design system**: Must follow Arcanum style guide (dark indigo/aurum-gold theme, Cinzel/Crimson Pro fonts).
- **Config compatibility**: Preset values must produce valid `application.yaml` that the Kotlin server accepts.
- **Non-destructive**: Wizard never overwrites values without explicit per-section user approval.
- **Panel registry**: New wizard tab must integrate with the existing panel registry and sidebar navigation.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| New top-level tab, not a config panel | Wizard is a distinct workflow, not just another settings page | ✓ Good — registered as `command` host in panel registry, World group |
| Presets + comparison first, intelligence later | Ship useful tool quickly; LLM analysis is a v2 layer | ✓ Good — shipped complete wizard without LLM dependency |
| Per-section accept/reject | Gives builders granular control over what changes; reduces fear of presets overwriting customization | ✓ Good — section checkboxes with sticky apply bar |
| 3 themed presets (not 5-6) | 3 presets (Casual/Balanced/Hardcore) covers the core spectrum; additional presets deferred to v2 | ✓ Good — sufficient differentiation validated by TDD metrics |
| Comparison view (not simulation) | Lower complexity than interactive sim; still shows impact clearly | ✓ Good — derived metrics + charts give strong visual feedback |
| Recharts for visualizations | Lightweight charting library, good React integration, supports radar/line/bar | ✓ Good — clean integration with Vite chunking |
| Session-only Zustand store | Wizard state doesn't persist across sessions — fresh start each time | ✓ Good — avoids stale preset state |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

## Current State

v1.0 Tuning Wizard shipped (2026-04-05). All 6 phases complete: foundation data layer (types, formulas, diff engine, 137 field metadata), 3 themed presets (Casual/Balanced/Hardcore), wizard workspace with preset cards and searchable parameter browser, before/after comparison view with derived metric KPI cards, per-section apply flow with undo/reset and health check warnings, and Recharts visualizations (XP curve, mob tier power, stat radar). 107 commits, 222 files, +22K lines.

---
*Last updated: 2026-04-05 after v1.0 milestone*
