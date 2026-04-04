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

### Active

- [ ] Tuning Wizard as new top-level tab in the app
- [ ] 5-6 themed presets (Casual, Balanced, Hardcore, Grindy MMO, Fast PvP, Story-focused)
- [ ] Before/after comparison view showing key metrics at various levels
- [ ] Per-section accept/reject when applying preset changes
- [ ] Coverage of all gameplay systems: combat, economy, progression, stats, crafting, quests, social, world timing
- [ ] Deterministic balance rules that flag known problematic combinations (v2 stretch)
- [ ] LLM-powered holistic analysis of config balance (v2 stretch)

### Out of Scope

- Server/infrastructure settings (ports, logging, observability) — not gameplay-relevant
- Modifying the existing config panel UI — wizard is additive, not a replacement
- Multiplayer playtesting or live server integration — wizard works offline on YAML
- Ability/status effect/class/race definition editing — those are content, not tuning

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
| New top-level tab, not a config panel | Wizard is a distinct workflow, not just another settings page | -- Pending |
| Presets + comparison first, intelligence later | Ship useful tool quickly; LLM analysis is a v2 layer | -- Pending |
| Per-section accept/reject | Gives builders granular control over what changes; reduces fear of presets overwriting customization | -- Pending |
| 5-6 themed presets | Covers spectrum from casual to hardcore plus genre-specific flavors | -- Pending |
| Comparison view (not simulation) | Lower complexity than interactive sim; still shows impact clearly | -- Pending |

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

---
*Last updated: 2026-04-04 after initialization*
