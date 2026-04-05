# Requirements: Arcanum Tuning Wizard

**Defined:** 2026-04-04
**Core Value:** Builders can confidently configure game balance without needing to understand every formula interaction

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation

- [ ] **FOUND-01**: Tuning wizard types defined as DeepPartial<AppConfig> organized into tuning sections
- [ ] **FOUND-02**: Formula evaluator implements key server formulas in TypeScript (damage, XP curve, mob stats, regen, dodge)
- [ ] **FOUND-03**: Diff engine computes structured field-level changes between current config and preset
- [ ] **FOUND-04**: Field metadata catalog provides human-readable labels, descriptions, and grouping for all tunable fields

### Presets

- [ ] **PRES-01**: 3 themed presets defined: Casual, Balanced, Hardcore
- [ ] **PRES-02**: Each preset covers all gameplay systems: combat, mob tiers, progression, stats, economy, crafting, quests, social, world timing
- [ ] **PRES-03**: Presets stored as partial overlays (DeepPartial<AppConfig>) to survive schema evolution
- [ ] **PRES-04**: Preset values validated against existing config validation rules

### Comparison View

- [ ] **COMP-01**: Before/after comparison view showing current config vs selected preset
- [ ] **COMP-02**: Comparison organized by system grouping (combat, economy, progression, stats, etc.)
- [ ] **COMP-03**: Derived metrics shown prominently (time-to-kill, XP-to-level, gold-per-hour at key levels)
- [ ] **COMP-04**: Raw field diffs available in expandable sections below derived metrics
- [ ] **COMP-05**: Color-coded changes: increases, decreases, unchanged — context-aware (e.g., lower XP-to-level = good)

### Apply Flow

- [ ] **APPLY-01**: Per-section accept/reject checkboxes for each system category
- [ ] **APPLY-02**: Config snapshot taken before any apply operation (undo point)
- [ ] **APPLY-03**: Undo last apply restores config to pre-apply snapshot
- [ ] **APPLY-04**: Reset button discards all wizard state and returns to current config
- [ ] **APPLY-05**: Applied values written to configStore and saved to application.yaml

### Wizard UI

- [ ] **UI-01**: Tuning Wizard registered as new top-level tab in panel registry and sidebar
- [ ] **UI-02**: Wizard workspace follows Arcanum design system (dark indigo, aurum-gold, Cinzel/Crimson Pro)
- [ ] **UI-03**: Preset selector with themed cards showing preset name, description, and key characteristics
- [ ] **UI-04**: Contextual tooltips on every tunable field explaining what it does and what it interacts with
- [ ] **UI-05**: Search/filter across parameter names and descriptions
- [ ] **UI-06**: Post-apply health check surfaces any problematic combinations from cherry-picked sections

### Visualization

- [ ] **VIZ-01**: XP curve chart (Recharts) showing XP-per-level for current vs preset config
- [ ] **VIZ-02**: Mob tier power chart showing HP, damage, armor, XP across tiers at selectable levels
- [ ] **VIZ-03**: Stat profile radar chart comparing current vs preset stat scaling effectiveness

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Additional Presets

- **PRES-05**: Grindy MMO preset (steep XP curve, high mob density rewards, deep crafting economy)
- **PRES-06**: Fast PvP preset (low TTK, flat progression, tight economy)
- **PRES-07**: Story-focused preset (generous progression, minimal grind, rich quest rewards)

### Intelligence Layer

- **INTEL-01**: Deterministic balance warning rules (5-10 hand-authored rules for common pitfalls)
- **INTEL-02**: LLM holistic analysis of current config (narrative balance assessment)
- **INTEL-03**: Dependency highlighting on hover (show connected fields)

### Power Features

- **POWER-01**: Custom preset save/load (store in project .arcanum directory)
- **POWER-02**: Preset blending slider (lerp between two presets)
- **POWER-03**: Economy flow summary (income vs sinks across levels)
- **POWER-04**: Level-by-level data table with CSV export
- **POWER-05**: "What changed" natural language summary after apply

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full game simulation / Monte Carlo | Machinations-style simulation is a separate product; computed metrics at specific levels are more actionable |
| Live server integration | Massive complexity; client-side formulas approximate the server sufficiently |
| AI-generated presets | LLM-authored complete presets are unreliable; hand-authored with LLM analysis is the v2 path |
| Replacing existing config panels | Wizard is additive; existing panels remain for fine-tuning |
| Per-field change history | Git covers versioning; undo covers immediate need |
| Difficulty auto-scaling | Runtime server feature, not config tool feature |
| Collaborative preset sharing | Arcanum is single-user; JSON export/import covers manual sharing |
| Graph-based visual programming | Overkill for tuning wizard; dependency highlighting gives 80% of insight |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| FOUND-04 | Phase 1 | Pending |
| PRES-01 | Phase 2 | Pending |
| PRES-02 | Phase 2 | Pending |
| PRES-03 | Phase 2 | Pending |
| PRES-04 | Phase 2 | Pending |
| COMP-01 | Phase 4 | Pending |
| COMP-02 | Phase 4 | Pending |
| COMP-03 | Phase 4 | Pending |
| COMP-04 | Phase 4 | Pending |
| COMP-05 | Phase 4 | Pending |
| APPLY-01 | Phase 5 | Pending |
| APPLY-02 | Phase 5 | Pending |
| APPLY-03 | Phase 5 | Pending |
| APPLY-04 | Phase 5 | Pending |
| APPLY-05 | Phase 5 | Pending |
| UI-01 | Phase 3 | Pending |
| UI-02 | Phase 3 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 4 | Pending |
| UI-05 | Phase 3 | Pending |
| UI-06 | Phase 5 | Pending |
| VIZ-01 | Phase 6 | Pending |
| VIZ-02 | Phase 6 | Pending |
| VIZ-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-04-04*
*Last updated: 2026-04-04 after roadmap creation*
