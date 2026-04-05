# Phase 3: Wizard Workspace - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

A new top-level "Tuning Wizard" tab accessible from the sidebar that lets builders select a themed preset via cards, browse all 137 tunable parameters organized by section, search/filter parameters, and see a basic current-vs-preset value comparison. This is the workspace shell that Phase 4 (Comparison View) and Phase 5 (Apply Flow) build upon.

</domain>

<decisions>
## Implementation Decisions

### Preset Selector Layout
- **D-01:** Three equal-width cards in a horizontal row, centered in the workspace. All three presets visible at once without scrolling.
- **D-02:** Each card shows: preset name (Cinzel heading), 1-2 line description, and 3-4 key metric indicators (e.g., "XP Curve: Relaxed", "Combat: Gentle", "Economy: Generous") to give builders a quick feel for the preset's philosophy.
- **D-03:** Each preset card has a subtle accent color — distinct soft glow or border tint (e.g., warm gold for Casual, cool silver for Balanced, crimson for Hardcore) within the Arcanum dark palette. Differentiated but cohesive.
- **D-04:** On selection, the chosen card gets a prominent glow/border and unselected cards dim slightly. The parameter browser section below populates with the preset's values and scrolls into view.

### Workspace Structure
- **D-05:** Register "Tuning Wizard" in the World sidebar group alongside Combat, Progression, Economy, etc. It's a world-systems tuning tool.
- **D-06:** Use `host: "command"` in panel registry with a dedicated `TuningWizard` component. The wizard is a standalone workspace (like PlayerSpriteManager or AdminDashboard), not a simple config panel — it has its own layout with preset cards + parameter browser that doesn't fit ConfigPanelHost's auto-save chrome.
- **D-07:** Persist wizard state (selected preset, search query, filter state) in a new Zustand store (`tuningWizardStore` or similar). State survives tab switches within the session.

### Search and Filtering
- **D-08:** Sticky search/filter bar positioned between the preset cards and the parameter list. Always visible. Contains a search text input + section filter chips.
- **D-09:** Section filtering uses clickable chips for all 4 TuningSection values (Combat & Stats, Economy & Crafting, Progression & Quests, World & Social). Multiple sections can be active simultaneously. All active by default.
- **D-10:** Search matches against FIELD_METADATA's `label`, `description`, and the dotted config path (e.g., "combat.mobTiers"). Covers both human-readable and technical lookups.

### Parameter Browsing
- **D-11:** Parameters grouped under 4 collapsible section headers matching TuningSection. Within sections, fields listed by sub-group or alphabetically. Each section header shows field count.
- **D-12:** Before a preset is selected, each parameter row shows: field label, current value from configStore, and description from FIELD_METADATA. The browser is useful for exploration even without a preset.
- **D-13:** After preset selection, each parameter row gains a "Preset Value" column showing the selected preset's value. Fields where preset differs from current are highlighted with color-coding. This is the Phase 3 bridge to Phase 4's full comparison view.
- **D-14:** Empty state (no preset selected) shows all parameters with current values. Selecting a preset adds the comparison column. The wizard is always populated and browsable.

### Claude's Discretion
- Exact accent colors per preset card (warm gold, cool silver, crimson are guidelines — Claude tunes to Arcanum palette)
- Key metric indicator format on cards (pills, bars, text labels)
- Collapsible section default state (all expanded vs first expanded)
- Exact search debounce timing and highlight behavior
- Store structure: standalone `tuningWizardStore` vs extending existing stores

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Panel System
- `creator/src/lib/panelRegistry.ts` -- PanelDef interface, sidebar groups, host types, PANEL_MAP. Add new entry here.
- `creator/src/components/MainArea.tsx` -- Routes tabs to host components. Add "command" case for tuning wizard.
- `creator/src/components/config/ConfigPanelHost.tsx` -- Reference for config panel chrome pattern (do NOT reuse for wizard, but understand the pattern).
- `creator/src/components/Sidebar.tsx` -- Sidebar rendering, group navigation.

### Phase 1 & 2 Artifacts (Dependencies)
- `creator/src/lib/tuning/types.ts` -- DeepPartial, TuningSection enum, FieldMeta, MetricSnapshot
- `creator/src/lib/tuning/fieldMetadata.ts` -- FIELD_METADATA constant with 137 field entries (labels, descriptions, sections, ranges)
- `creator/src/lib/tuning/presets.ts` -- TuningPreset interface, CASUAL_PRESET, BALANCED_PRESET, HARDCORE_PRESET, TUNING_PRESETS array
- `creator/src/lib/tuning/formulas.ts` -- computeMetrics() for deriving key stats to show on preset cards
- `creator/src/lib/tuning/diffEngine.ts` -- computeDiff() for current-vs-preset comparison

### Config Store
- `creator/src/stores/configStore.ts` -- Current AppConfig state, the "current values" source for parameter browsing

### Design System
- `ARCANUM_STYLE_GUIDE.md` -- Colors, typography, component patterns for the Arcanum dark theme
- `creator/src/index.css` -- CSS custom properties and theme tokens

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PanelDef` interface in `panelRegistry.ts` -- registration pattern for new panels
- `TUNING_PRESETS` array in `presets.ts` -- iterable preset data with metadata (name, description, sectionDescriptions)
- `FIELD_METADATA` in `fieldMetadata.ts` -- complete field catalog with labels, descriptions, sections for browsing/search
- `computeMetrics()` in `formulas.ts` -- derive key stats for preset card indicators
- `computeDiff()` in `diffEngine.ts` -- compute current-vs-preset field differences
- `configStore` -- source of current AppConfig values
- Existing `command` host pattern: `PlayerSpriteManager`, `Console`, `AdminDashboard` are all standalone command-hosted components

### Established Patterns
- Zustand stores: independent, one per domain, select individual fields
- Tailwind CSS with semantic tokens (`bg-bg-primary`, `text-accent`, etc.)
- Lazy-loaded components via `lazy(() => import(...))`
- `font-display` (Cinzel) for headings, `font-sans` (Crimson Pro) for body
- Section components use `Section`, `FieldRow`, `TextInput` from `ui/FormWidgets`

### Integration Points
- `panelRegistry.ts` -- add PanelDef entry to WORLD_PANELS array
- `MainArea.tsx` -- add lazy import and switch case for "tuningWizard" panel
- New store in `creator/src/stores/` for wizard UI state
- New component directory: `creator/src/components/tuning/` for wizard components

</code_context>

<specifics>
## Specific Ideas

- The parameter browser with current values serves as a useful config exploration tool even without preset selection — builders can browse all 137 tunable fields with descriptions
- The basic current-vs-preset highlighting in Phase 3 is intentionally simpler than Phase 4's full comparison view — Phase 3 shows "changed" vs "unchanged", Phase 4 adds derived metrics, color-coded direction, and expandable details
- Preset card key stats should be computed from `computeMetrics()` and formatted as human-readable indicators, not raw numbers

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 03-wizard-workspace*
*Context gathered: 2026-04-05*
