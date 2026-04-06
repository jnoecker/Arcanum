# Phase 4: Comparison View - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

After selecting a preset, builders see a clear before/after comparison that leads with meaningful derived metrics and lets them drill into raw field changes. The comparison view is the wizard's core value — making raw numbers meaningful by showing impact at key game milestones. Color-coded diffs and contextual tooltips make the comparison scannable and informative.

</domain>

<decisions>
## Implementation Decisions

### Derived Metrics Presentation
- **D-01:** Summary cards with 2-3 curated headline metrics per section. Each card shows current vs preset side-by-side with delta arrows and percentage change. Cards are grouped in a 2x2 grid (one per TuningSection).
- **D-02:** Highlight metrics at three representative levels: Lv10, Lv30, Lv50 — spanning early, mid, and late game milestones.
- **D-03:** Combat metric cards use Normal mob tier only. Other tiers (Strong, Elite, Boss) are visible when drilling into raw field diffs below.
- **D-04:** Curated metrics per section card (not exhaustive). Combat gets Mob HP + Player Damage + Dodge; Progression gets XP-to-Level + Player HP; Economy gets Gold/Kill + shop multiplier; World gets regen interval + relevant timing.

### Comparison Layout Flow
- **D-05:** Metric summary cards appear between preset cards and the parameter browser. Top-down flow: choose preset → see metric impact → drill into field details. Preset cards stay at top, search/filter bar and parameter browser remain below metrics.
- **D-06:** Metric cards only appear after a preset is selected. Before selection, the parameter browser is the main content (matching Phase 3's pattern where diff columns only appear after selection).
- **D-07:** Raw field sections default to collapsed after preset selection. Metric cards are the star; builders expand sections only to drill into specific field changes.

### Context-Aware Color Coding
- **D-08:** Direction-only coloring with no value judgment. Green for increase, red for decrease, muted for unchanged. No attempt to assess "better vs worse" — that depends on builder intent and is inherently subjective per field.
- **D-09:** Show arrow + percentage delta alongside values (e.g., "▼ 15.6%"). Helps builders gauge magnitude at a glance without mental math.

### Tooltip Design
- **D-10:** Hover popovers on field labels using the existing Tippy.js dependency. Familiar, non-intrusive, doesn't change row layout.
- **D-11:** Each tooltip shows: field description (always present), interaction note (when available in FieldMeta), and a colored impact badge (HIGH / MEDIUM / LOW). Leverages all existing FieldMeta data.
- **D-12:** Derived metric rows in summary cards also get formula tooltips. Hovering a metric like "Mob HP (Normal, Lv30)" explains the calculation: "baseHp + hpPerLevel × level". Helps builders understand what drives the numbers.

### Claude's Discretion
- Exact metric selection per section card (which 2-3 of the available metrics are most informative)
- Metric card visual design (internal layout, spacing, typography within the card pattern)
- Tooltip positioning and styling within Tippy.js configuration
- Transition/animation when metric cards appear after preset selection
- Whether to show a "changes count" badge on collapsed section headers

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1-3 Artifacts (Dependencies)
- `creator/src/lib/tuning/types.ts` — DeepPartial, TuningSection enum, FieldMeta (has description, interactionNote, impact), DiffEntry, MetricSnapshot, REPRESENTATIVE_LEVELS
- `creator/src/lib/tuning/formulas.ts` — computeMetrics(), xpForLevel(), mobHpAtLevel(), mobAvgDamageAtLevel(), mobAvgGoldAtLevel(), statBonus(), dodgeChance(), playerHpAtLevel(), regenIntervalMs()
- `creator/src/lib/tuning/fieldMetadata.ts` — FIELD_METADATA constant with 137 field entries (labels, descriptions, sections, impact, interactionNote, min/max)
- `creator/src/lib/tuning/diffEngine.ts` — computeDiff(), groupDiffBySection()
- `creator/src/lib/tuning/presets.ts` — TuningPreset interface, CASUAL_PRESET, BALANCED_PRESET, HARDCORE_PRESET, TUNING_PRESETS array

### Existing Wizard Components (Phase 3)
- `creator/src/components/tuning/TuningWizard.tsx` — Root workspace: preset cards, search bar, parameter browser. Metric cards insert between preset row and search bar.
- `creator/src/components/tuning/ParameterRow.tsx` — Field row with basic diff coloring. Needs tooltip addition and enhanced color coding with percentage deltas.
- `creator/src/components/tuning/ParameterSection.tsx` — Collapsible sections. Default collapsed state changes after preset selection.
- `creator/src/components/tuning/PresetCard.tsx` — Preset selection cards (no changes needed)
- `creator/src/components/tuning/SearchFilterBar.tsx` — Search/filter bar (no changes needed)
- `creator/src/stores/tuningWizardStore.ts` — Session-only UI state. May need collapsed-default logic.

### Config & Design System
- `creator/src/stores/configStore.ts` — Source of current AppConfig values
- `creator/src/types/config.ts` — Full AppConfig interface
- `ARCANUM_STYLE_GUIDE.md` — Colors, typography, component patterns for Arcanum dark theme
- `creator/src/index.css` — CSS custom properties and theme tokens (status-success for green, status-error for red, text-muted for unchanged)

### Tooltip Dependency
- Tippy.js (`tippy.js ^6.3.7`) — Already in project dependencies, used elsewhere for tooltips

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `computeMetrics()` in `formulas.ts` — Returns full MetricSnapshot with all 8 metric types at 6 levels. Metric cards consume this directly.
- `computeDiff()` + `groupDiffBySection()` in `diffEngine.ts` — Already computes field-level diffs and groups by section. Parameter browser already uses these.
- `deepMerge()` in `TuningWizard.tsx` — Local utility for merging preset onto current config. Used to compute merged config for metrics.
- `FIELD_METADATA` — Already has `description`, `interactionNote`, and `impact` fields needed for tooltips. No schema changes needed.
- Tippy.js — Already a project dependency for tooltips elsewhere in the app.

### Established Patterns
- Zustand selectors: `useTuningWizardStore((s) => s.selectedPresetId)` — select individual fields
- Tailwind semantic tokens: `text-status-success` (green), `text-status-error` (red), `text-text-muted` (unchanged)
- `font-display` (Cinzel) for section headings, `font-sans` (Crimson Pro) for body text, `font-mono` for numeric values
- `useMemo` for derived computations (presetMetrics, filteredFields, diffMap already memoized)

### Integration Points
- New `MetricCards` component (or similar) added to `TuningWizard.tsx` between preset row and search bar
- `ParameterRow.tsx` enhanced with Tippy tooltip on label + percentage delta display
- `ParameterSection.tsx` default collapse state changes when preset is selected
- `tuningWizardStore.ts` may need a `setAllCollapsed()` action for preset-triggers-collapse behavior

</code_context>

<specifics>
## Specific Ideas

- Metric cards should feel like dashboard KPI cards — compact, scannable, with clear before/after comparison. The 2x2 grid maps to the 4 TuningSection values.
- The percentage delta format "▼ 15.6%" with directional arrow + color is the primary visual signal. Builders scan deltas across sections to quickly understand a preset's personality.
- Formula tooltips on metric cards (D-12) bridge understanding: builders see "Mob HP dropped 15%" and can hover to learn "that's baseHp + hpPerLevel × level" — connecting the derived impact to the raw fields they can explore below.
- The collapsed-by-default field sections (D-07) represent a deliberate shift from Phase 3's browse-everything pattern. Phase 4's value is in the derived metrics; raw fields are supporting detail.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-comparison-view*
*Context gathered: 2026-04-05*
