# Phase 5: Apply Flow - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Builders can selectively accept or reject changes per section, apply them to their config with confidence that they can undo, and see warnings if their choices create problems. This phase adds the apply/undo/reset workflow and health check to the existing comparison view.

</domain>

<decisions>
## Implementation Decisions

### Section Acceptance UX
- **D-01:** Checkbox on each ParameterSection header. Checked = section's changes will apply. Fits the existing collapsible header pattern — checkbox sits alongside the section title and collapse arrow.
- **D-02:** All 4 section checkboxes default to checked when a preset is selected. Builders uncheck what they don't want. Optimizes for the common case of accepting everything.
- **D-03:** Unchecked sections are visually dimmed (40-50% opacity) in the parameter browser. The diff data stays visible but the builder understands those changes won't be applied.

### Apply/Undo/Reset Controls
- **D-04:** Sticky footer bar at the bottom of the wizard. Always visible regardless of scroll position. Shows a section count summary like "3 of 4 sections selected" alongside the action buttons.
- **D-05:** Single-level undo snapshot. Before each apply, save the full AppConfig state. Clicking Undo restores that one snapshot. Simple, predictable, covers the "oops" case.
- **D-06:** Apply button shows dynamic label "Apply N Sections" with the count of checked sections. Disabled when 0 sections checked. No confirmation dialog needed — the label itself communicates scope.
- **D-07:** Reset clears ALL wizard state: deselects preset, clears section checkboxes, clears search/filters, returns to the initial 3-preset-card view. Does NOT touch the saved config — just resets the wizard UI.

### Health Check
- **D-08:** Inline warning banner appears at the top of the wizard (below metric cards) after applying with mixed sections. Gold/amber for warnings. Non-blocking — builders can dismiss and continue.
- **D-09:** Tuning-specific metric checks only. Use computeMetrics() formulas to detect imbalanced combinations (e.g., Casual economy + Hardcore combat = gold floods). NOT the full validateConfig() suite which checks structural issues unrelated to tuning.

### State Flow
- **D-10:** Switching presets resets all section checkboxes to checked. New preset = fresh comparison. Prior section selections are discarded.
- **D-11:** After successful apply, wizard stays open. Brief success indicator (green flash or banner). Comparison updates to reflect new current config (applied values become "current"). Undo button activates.
- **D-12:** Builders can apply sequentially (apply Casual, then apply Hardcore on top). Single undo covers last apply only. Reset clears everything back to wizard start.

### Claude's Discretion
- Success indicator animation/style details
- Exact health check metric thresholds and warning messages
- Footer bar internal layout and spacing
- Checkbox component styling within the section header

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above

### Existing Code (source of truth)
- `creator/src/stores/tuningWizardStore.ts` — Current wizard state shape, must extend for section acceptance and undo
- `creator/src/stores/configStore.ts` — updateConfig() and save flow for applying preset values
- `creator/src/lib/saveConfig.ts` — saveProjectConfig() for persisting to application.yaml
- `creator/src/lib/tuning/formulas.ts` — computeMetrics() for health check calculations
- `creator/src/lib/tuning/types.ts` — TuningSection enum, MetricSnapshot, TuningPreset
- `creator/src/components/tuning/TuningWizard.tsx` — Main wizard layout, integration point for footer bar
- `creator/src/components/tuning/ParameterSection.tsx` — Section headers where checkboxes will be added
- `creator/src/lib/validateConfig.ts` — validateConfig() for reference (NOT used in health check, but shows validation pattern)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tuningWizardStore`: Already tracks selectedPresetId, activeSections, collapsedSections. Extend with `acceptedSections: Set<TuningSection>` and `configSnapshot: AppConfig | null`
- `configStore.updateConfig()`: Handles dirty flagging and config mutation. Call this to apply preset values.
- `saveProjectConfig()`: Handles YAML persistence (monolithic or split). Call after updateConfig().
- `computeMetrics()`: Already computes derived metrics from AppConfig. Reuse for health check comparisons.
- `ParameterSection`: Already has collapsible headers with section title and field count. Add checkbox to this header row.

### Established Patterns
- Zustand store with Set-based state (activeSections, collapsedSections) — extend with acceptedSections
- Zone store manual undo: past/future arrays with MAX_HISTORY. Simpler for tuning: single snapshot field.
- ActionButton component with primary/secondary/ghost/danger variants — use for Apply/Undo/Reset buttons

### Integration Points
- TuningWizard.tsx bottom area: Add sticky footer bar with action buttons
- ParameterSection header: Add checkbox input before/after section title
- TuningWizard handleSelect(): After collapseAll(), also reset acceptedSections to all-checked
- configStore: Read current config for snapshot, write updated config on apply

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-apply-flow*
*Context gathered: 2026-04-05*
