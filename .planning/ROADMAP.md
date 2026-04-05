# Roadmap: Arcanum Tuning Wizard

## Overview

The tuning wizard delivers a preset-driven balance configuration tool in six phases: first establishing the pure data layer (types, formulas, diff engine, field metadata), then authoring validated presets, building the wizard workspace shell, adding the comparison view that is the wizard's core value, implementing the apply workflow with undo safety, and finally layering on chart visualizations. Each phase delivers a coherent, testable capability that the next phase builds on.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Types, formulas, diff engine, and field metadata for all tunable config values
- [ ] **Phase 2: Presets** - Three themed presets (Casual, Balanced, Hardcore) covering all gameplay systems
- [ ] **Phase 3: Wizard Workspace** - Top-level tab with preset selector, search/filter, and Arcanum design system styling
- [ ] **Phase 4: Comparison View** - Before/after comparison organized by system with derived metrics and color-coded diffs
- [ ] **Phase 5: Apply Flow** - Per-section accept/reject with snapshot undo and post-apply health check
- [ ] **Phase 6: Visualizations** - XP curve, mob tier, and stat profile charts via Recharts

## Phase Details

### Phase 1: Foundation
**Goal**: All pure-function infrastructure exists for computing diffs, evaluating formulas, and describing fields -- enabling every downstream UI component to consume structured data
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04
**Success Criteria** (what must be TRUE):
  1. A DeepPartial<AppConfig> type exists and can represent any subset of tunable config values organized into named sections
  2. Formula evaluator computes derived metrics (damage output, XP-to-level, mob HP/damage at level, regen rate, dodge chance) that match Kotlin server reference calculations
  3. Diff engine produces a structured list of field-level changes between any two config snapshots, grouped by section
  4. Every tunable field has a human-readable label, description, and section assignment accessible by config path
  5. All pure functions have Vitest coverage confirming correctness
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- Types, formula evaluators, and TDD tests (FOUND-01, FOUND-02)
- [ ] 01-02-PLAN.md -- Field metadata catalog and diff engine with TDD tests (FOUND-03, FOUND-04)

### Phase 2: Presets
**Goal**: Three complete, validated presets exist that a builder could meaningfully choose between -- each covering all gameplay systems with internally consistent values
**Depends on**: Phase 1
**Requirements**: PRES-01, PRES-02, PRES-03, PRES-04
**Success Criteria** (what must be TRUE):
  1. Casual, Balanced, and Hardcore presets each define values across combat, mob tiers, progression, stats, economy, crafting, quests, social, and world timing
  2. Each preset is stored as a DeepPartial<AppConfig> overlay that merges cleanly over any existing config
  3. Applying any single preset to the default config produces derived metrics that match the preset's stated philosophy (e.g., Casual has lower TTK, faster XP, higher gold)
  4. All preset values pass existing config validation rules without errors
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Wizard Workspace
**Goal**: Builders can open a Tuning Wizard tab, see preset options presented as themed cards, and search/filter across all tunable parameters
**Depends on**: Phase 1
**Requirements**: UI-01, UI-02, UI-03, UI-05
**Success Criteria** (what must be TRUE):
  1. A "Tuning Wizard" entry appears in the sidebar and opens a dedicated workspace when clicked
  2. The workspace follows Arcanum design system: dark indigo background, aurum-gold accents, Cinzel headings, Crimson Pro body text
  3. Preset selector displays themed cards with each preset's name, description, and key characteristics
  4. Search/filter box narrows visible parameters by name or description across all sections
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

### Phase 4: Comparison View
**Goal**: After selecting a preset, builders see a clear before/after comparison that leads with meaningful derived metrics and lets them drill into raw field changes
**Depends on**: Phase 2, Phase 3
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, UI-04
**Success Criteria** (what must be TRUE):
  1. Selecting a preset shows a side-by-side comparison of current config vs preset values, organized by system category (combat, economy, progression, stats, etc.)
  2. Derived metrics (time-to-kill, XP-to-level, gold-per-hour at key levels) appear prominently above raw field diffs
  3. Raw field-level changes are available in expandable sections below the derived metrics
  4. Changes are color-coded: increases, decreases, and unchanged values are visually distinct with context-aware coloring
  5. Every field in the comparison has a contextual tooltip explaining what it does and what it interacts with
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

### Phase 5: Apply Flow
**Goal**: Builders can selectively accept or reject changes per section, apply them to their config with confidence that they can undo, and see warnings if their choices create problems
**Depends on**: Phase 4
**Requirements**: APPLY-01, APPLY-02, APPLY-03, APPLY-04, APPLY-05, UI-06
**Success Criteria** (what must be TRUE):
  1. Each system section has an accept/reject checkbox; only accepted sections are applied
  2. Before applying, a snapshot of the current config is saved as an undo point
  3. After applying, an "Undo" action restores the config to its pre-apply state in one click
  4. A "Reset" action discards all wizard state (selected preset, section toggles) and returns to the initial view
  5. Applied values are written through configStore and saved to application.yaml
  6. After applying with mixed section selections, a health check surfaces any problematic metric combinations
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD
- [ ] 05-03: TBD

### Phase 6: Visualizations
**Goal**: Builders can see chart-based visualizations that make formula interactions intuitive -- XP curves, mob power scaling, and stat effectiveness become visual instead of numeric
**Depends on**: Phase 4
**Requirements**: VIZ-01, VIZ-02, VIZ-03
**Success Criteria** (what must be TRUE):
  1. An XP curve line chart shows XP-per-level for both current config and selected preset, with clear visual differentiation
  2. A mob tier power chart shows HP, damage, armor, and XP across all tiers at a user-selectable level
  3. A stat profile radar chart compares current vs preset stat scaling effectiveness across all stat bindings
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/2 | Planning complete | - |
| 2. Presets | 0/2 | Not started | - |
| 3. Wizard Workspace | 0/3 | Not started | - |
| 4. Comparison View | 0/3 | Not started | - |
| 5. Apply Flow | 0/3 | Not started | - |
| 6. Visualizations | 0/2 | Not started | - |
