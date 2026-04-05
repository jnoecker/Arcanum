# Phase 5: Apply Flow - Research

**Researched:** 2026-04-05
**Domain:** Zustand state management, config mutation with undo, health check logic, React UI patterns
**Confidence:** HIGH

## Summary

Phase 5 adds the accept/reject, apply, undo, and reset workflow to the Tuning Wizard, plus a post-apply health check for mixed-section selections. The codebase already has all the building blocks: `configStore.updateConfig()` for mutating config, `saveProjectConfig()` for YAML persistence, `computeMetrics()` for deriving gameplay metrics, `computeDiff()`/`groupDiffBySection()` for diffing, and the `deepMerge()` utility in TuningWizard.tsx. The `tuningWizardStore` needs extending with `acceptedSections`, `configSnapshot`, and an `undoAvailable` flag. The `ParameterSection` header needs a checkbox alongside the existing chevron and title. A new sticky footer bar component and a health check banner component complete the UI work.

This phase is almost entirely frontend: extending the wizard store, adding two new UI components (footer bar, health check banner), modifying two existing components (ParameterSection header, TuningWizard layout), and adding one pure-function health check module. No Rust backend changes needed -- config persistence already works through `saveProjectConfig()`.

**Primary recommendation:** Implement in 3 plans: (1) store extensions + health check logic with tests, (2) section checkboxes + footer bar + apply/undo/reset flow, (3) health check banner + post-apply integration + visual polish.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Checkbox on each ParameterSection header. Checked = section's changes will apply. Fits the existing collapsible header pattern -- checkbox sits alongside the section title and collapse arrow.
- **D-02:** All 4 section checkboxes default to checked when a preset is selected. Builders uncheck what they don't want.
- **D-03:** Unchecked sections are visually dimmed (40-50% opacity) in the parameter browser. The diff data stays visible but the builder understands those changes won't be applied.
- **D-04:** Sticky footer bar at the bottom of the wizard. Always visible regardless of scroll position. Shows a section count summary like "3 of 4 sections selected" alongside the action buttons.
- **D-05:** Single-level undo snapshot. Before each apply, save the full AppConfig state. Clicking Undo restores that one snapshot.
- **D-06:** Apply button shows dynamic label "Apply N Sections" with the count of checked sections. Disabled when 0 sections checked. No confirmation dialog needed.
- **D-07:** Reset clears ALL wizard state: deselects preset, clears section checkboxes, clears search/filters, returns to the initial 3-preset-card view. Does NOT touch the saved config.
- **D-08:** Inline warning banner appears at the top of the wizard (below metric cards) after applying with mixed sections. Gold/amber for warnings. Non-blocking.
- **D-09:** Tuning-specific metric checks only. Use computeMetrics() formulas to detect imbalanced combinations. NOT the full validateConfig() suite.
- **D-10:** Switching presets resets all section checkboxes to checked.
- **D-11:** After successful apply, wizard stays open. Brief success indicator. Comparison updates to reflect new current config. Undo button activates.
- **D-12:** Builders can apply sequentially. Single undo covers last apply only. Reset clears everything back to wizard start.

### Claude's Discretion
- Success indicator animation/style details
- Exact health check metric thresholds and warning messages
- Footer bar internal layout and spacing
- Checkbox component styling within the section header

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| APPLY-01 | Per-section accept/reject checkboxes for each system category | `acceptedSections: Set<TuningSection>` in store; checkbox in ParameterSection header (D-01, D-02, D-03) |
| APPLY-02 | Config snapshot taken before any apply operation (undo point) | `configSnapshot: AppConfig \| null` in store; captured via `structuredClone(configStore.getState().config)` before apply |
| APPLY-03 | Undo last apply restores config to pre-apply snapshot | Single-level restore: `configStore.updateConfig(snapshot)` + `saveProjectConfig()` (D-05) |
| APPLY-04 | Reset button discards all wizard state and returns to current config | Store `reset()` method clearing selectedPresetId, acceptedSections, searchQuery, configSnapshot (D-07) |
| APPLY-05 | Applied values written to configStore and saved to application.yaml | `configStore.updateConfig(mergedConfig)` + `saveProjectConfig(project)` flow (D-11) |
| UI-06 | Post-apply health check surfaces problematic combinations from cherry-picked sections | `checkTuningHealth()` pure function comparing metrics; inline warning banner (D-08, D-09) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zustand | 5.x (already installed) | Wizard store state management | Project standard; all 11 stores use it [VERIFIED: codebase] |
| React | 19.x (already installed) | UI components | Project standard [VERIFIED: codebase] |
| Tailwind CSS | 4.x (already installed) | Styling | Project standard [VERIFIED: codebase] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| structuredClone | browser built-in | Deep clone AppConfig for snapshot | Used by lore store for undo snapshots [VERIFIED: codebase loreStore pattern] |
| Vitest | 3.x (already installed) | Unit tests for health check logic | Project test runner [VERIFIED: vitest.config.ts] |

### Alternatives Considered
None -- this phase uses only existing project dependencies. No new packages needed.

**Installation:** No new packages required.

## Architecture Patterns

### Recommended Project Structure
```
src/
  stores/
    tuningWizardStore.ts      # Extended with acceptedSections, configSnapshot, applyPreset, undoApply, reset
  lib/tuning/
    healthCheck.ts            # NEW: checkTuningHealth() pure function
    __tests__/
      healthCheck.test.ts     # NEW: TDD tests for health check rules
  components/tuning/
    TuningWizard.tsx          # Modified: add footer bar, health check banner placement
    ParameterSection.tsx      # Modified: add checkbox in header
    ApplyFooterBar.tsx        # NEW: sticky footer with Apply/Undo/Reset buttons
    HealthCheckBanner.tsx     # NEW: warning banner for imbalanced configs
```

### Pattern 1: Store Extension for Apply Flow
**What:** Extend `tuningWizardStore` with `acceptedSections`, `configSnapshot`, and action methods
**When to use:** All apply-flow state lives in the wizard store, not scattered across components
**Example:**
```typescript
// Source: existing tuningWizardStore.ts pattern [VERIFIED: codebase]
interface TuningWizardStore {
  // ... existing fields ...
  acceptedSections: Set<TuningSection>;
  configSnapshot: AppConfig | null;
  undoAvailable: boolean;
  healthWarnings: HealthWarning[];
  applySuccess: boolean;

  toggleAccepted: (s: TuningSection) => void;
  applyPreset: () => Promise<void>;
  undoApply: () => Promise<void>;
  resetWizard: () => void;
  setHealthWarnings: (w: HealthWarning[]) => void;
  clearApplySuccess: () => void;
}
```

### Pattern 2: Selective Merge for Apply
**What:** Build a partial config from only accepted sections' diff entries, then merge onto current config
**When to use:** When the builder has unchecked some sections and clicks Apply
**Example:**
```typescript
// Source: derived from existing deepMerge + computeDiff patterns [VERIFIED: codebase]
function buildPartialFromAccepted(
  presetConfig: DeepPartial<AppConfig>,
  acceptedSections: Set<TuningSection>,
  diffs: DiffEntry[],
): DeepPartial<AppConfig> {
  // Filter diffs to only accepted sections
  const acceptedDiffs = diffs.filter(d => acceptedSections.has(d.section));
  // Build a sparse object from accepted paths only
  const partial: Record<string, unknown> = {};
  for (const diff of acceptedDiffs) {
    setNestedValue(partial, diff.path, diff.newValue);
  }
  return partial as DeepPartial<AppConfig>;
}
```

### Pattern 3: Single-Level Undo via structuredClone
**What:** Snapshot the full AppConfig before apply, restore it on undo
**When to use:** Before every apply operation (D-05)
**Example:**
```typescript
// Source: loreStore undo pattern [VERIFIED: codebase]
// Before apply:
const snapshot = structuredClone(useConfigStore.getState().config);
set({ configSnapshot: snapshot });
// On undo:
const { configSnapshot } = get();
if (configSnapshot) {
  useConfigStore.getState().updateConfig(configSnapshot);
  await saveProjectConfig(project);
  set({ configSnapshot: null, undoAvailable: false });
}
```

### Pattern 4: Health Check as Pure Function
**What:** `checkTuningHealth()` takes two MetricSnapshots (pre-apply current, post-apply) and returns warnings
**When to use:** After any apply with mixed sections (not all 4 accepted)
**Example:**
```typescript
// Source: derived from computeMetrics pattern [VERIFIED: codebase]
interface HealthWarning {
  severity: "warning" | "info";
  message: string;
  detail: string;
}

function checkTuningHealth(
  preApplyMetrics: MetricSnapshot,
  postApplyMetrics: MetricSnapshot,
  acceptedSections: Set<TuningSection>,
): HealthWarning[] {
  // Only run when mixed selections (not all accepted)
  if (acceptedSections.size === 4) return [];
  // Check for imbalanced combinations using metric ratios
  // e.g., gold income increased but mob HP stayed the same
}
```

### Anti-Patterns to Avoid
- **Storing apply logic in components:** All state transitions (snapshot, apply, undo, reset) belong in the store. Components only call store actions and read derived state. [ASSUMED: Zustand best practice]
- **Using configStore for undo:** The configStore is shared across all panels. Wizard undo state must live in tuningWizardStore to avoid interfering with other config editing workflows. [VERIFIED: codebase -- configStore has no undo support]
- **Running validateConfig() for health check:** Per D-09, use computeMetrics() for tuning-specific checks. validateConfig() checks structural issues (port conflicts, missing stat refs) unrelated to balance tuning. [VERIFIED: validateConfig.ts -- validates referential integrity, not game balance]
- **Deep-cloning with JSON.parse/stringify:** Use `structuredClone()` for AppConfig snapshots. JSON round-trip loses type fidelity on Maps/Sets if any exist. The loreStore already uses structuredClone for its undo snapshots. [VERIFIED: loreStore pattern]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deep object cloning | Manual recursive clone | `structuredClone()` | Browser built-in, handles cycles, used by loreStore [VERIFIED: codebase] |
| Deep object merge | New merge utility | `deepMerge()` already in TuningWizard.tsx | Already handles null, arrays, and recursion correctly [VERIFIED: codebase] |
| Config diff computation | Path-walking comparator | `computeDiff()` from diffEngine.ts | Already produces section-tagged DiffEntry[] with metadata [VERIFIED: codebase] |
| Derived metric computation | Formula recalculation | `computeMetrics()` from formulas.ts | Already computes all 8 metric categories at representative levels [VERIFIED: codebase] |
| YAML persistence | Direct file writes | `saveProjectConfig()` from saveConfig.ts | Handles both legacy and standalone formats, auto-serialization [VERIFIED: codebase] |
| Checkbox styling | Custom checkbox component | Tailwind utility classes on `<input type="checkbox">` | Consistent with project's no-component-library approach [VERIFIED: codebase convention] |

**Key insight:** This phase is mostly wiring -- connecting existing data functions (deepMerge, computeDiff, computeMetrics, saveProjectConfig) through new UI controls. The only genuinely new logic is the health check rules.

## Common Pitfalls

### Pitfall 1: Stale Config After Apply
**What goes wrong:** After apply, the comparison view still shows old "current" values because TuningWizard memoized the config reference.
**Why it happens:** `useMemo` dependencies don't track deep changes within the same object reference.
**How to avoid:** `configStore.updateConfig()` already creates a new object reference (via spread in the store set callback). Ensure TuningWizard reads `config` from configStore selector, which triggers re-render on reference change. After apply, all derived computations (presetConfig, diffMap, currentMetrics) will recompute automatically.
**Warning signs:** After applying, the "Current" column still shows pre-apply values.

### Pitfall 2: Selective Apply Drops Non-Accepted Values
**What goes wrong:** Building the partial merge object incorrectly includes fields from non-accepted sections, overwriting values the builder wanted to keep.
**Why it happens:** Using the full preset config overlay instead of filtering by accepted sections.
**How to avoid:** Filter `computeDiff()` output by `acceptedSections` to get only the paths that should change. Build a new partial object from those paths only. Apply that partial via deepMerge, not the raw preset config.
**Warning signs:** After unchecking a section and applying, values in that section change anyway.

### Pitfall 3: Undo Doesn't Persist to Disk
**What goes wrong:** Clicking Undo restores the in-memory config but doesn't save to application.yaml.
**Why it happens:** Only calling `configStore.updateConfig()` but forgetting `saveProjectConfig()`.
**How to avoid:** The undo action must call `updateConfig(snapshot)` AND `saveProjectConfig(project)`. Note that `saveProjectConfig` needs the `project` from `projectStore` -- the store action should access it via `useProjectStore.getState().project`.
**Warning signs:** After undo, closing and reopening the app shows the applied values, not the pre-apply values.

### Pitfall 4: ConfigPanelHost Auto-Save Races with Apply
**What goes wrong:** ConfigPanelHost has a 3-second auto-save timer on config dirty flag. If the wizard applies and the builder navigates to a config panel, auto-save triggers and marks config clean before the wizard's save completes.
**Why it happens:** Both the wizard and ConfigPanelHost independently save on dirty.
**How to avoid:** The wizard's apply action should: (1) `updateConfig(merged)`, (2) immediately `await saveProjectConfig(project)`, (3) then `markClean()`. This completes the save before any auto-save timer fires. The 3-second timer in ConfigPanelHost only fires if `dirty` is true, and we clear it synchronously after save.
**Warning signs:** Intermittent "Auto-save failed" errors in console after wizard apply.

### Pitfall 5: Reset vs Undo Confusion
**What goes wrong:** Reset accidentally also undoes the applied config changes.
**Why it happens:** Mixing up "reset wizard UI state" with "undo config changes."
**How to avoid:** Per D-07, Reset ONLY clears wizard state (selectedPresetId, acceptedSections, searchQuery, collapsedSections). It does NOT touch configStore. The Undo button is the only way to reverse config changes. Reset should also clear `configSnapshot` and `undoAvailable` since the wizard is returning to initial state.
**Warning signs:** After applying preset values, clicking Reset reverses the config changes instead of just clearing the wizard.

### Pitfall 6: deepMerge Not Exported
**What goes wrong:** The `deepMerge` utility is currently defined locally inside TuningWizard.tsx and cannot be imported by the store or other modules.
**Why it happens:** Phase 3 decision to keep it local since it was single-consumer.
**How to avoid:** Either move deepMerge to a shared location (e.g., `lib/tuning/merge.ts`) or duplicate the logic in the store. Moving it is cleaner since the store now also needs it for apply.
**Warning signs:** Import errors when trying to use deepMerge from the store.

## Code Examples

### Section Checkbox in ParameterSection Header
```typescript
// Source: derived from existing ParameterSection.tsx header pattern [VERIFIED: codebase]
<button
  type="button"
  onClick={onToggleCollapsed}
  className="flex w-full cursor-pointer items-center gap-3 border-t border-border-muted py-3"
>
  {/* Section acceptance checkbox (D-01) */}
  {hasPreset && (
    <input
      type="checkbox"
      checked={isAccepted}
      onClick={(e) => e.stopPropagation()}
      onChange={onToggleAccepted}
      className="h-4 w-4 cursor-pointer accent-accent"
    />
  )}
  {/* Chevron */}
  <span className={`inline-block text-text-muted transition-transform duration-200 ${
    isCollapsed ? "rotate-0" : "rotate-90"
  }`}>&#9654;</span>
  {/* Section name */}
  <span className="font-display text-sm uppercase tracking-[0.5px] text-text-secondary">
    {section}
  </span>
  {/* ... badges ... */}
</button>
```

### Sticky Footer Bar Layout
```typescript
// Source: derived from ApiSettingsPanel sticky bottom pattern [VERIFIED: codebase]
<div className="sticky bottom-0 z-10 border-t border-border-muted bg-bg-primary px-6 py-3">
  <div className="flex items-center justify-between">
    {/* Left: section summary */}
    <span className="font-sans text-sm text-text-secondary">
      {acceptedCount} of {totalSections} sections selected
    </span>
    {/* Right: action buttons */}
    <div className="flex items-center gap-3">
      <ActionButton variant="ghost" onClick={handleReset}>Reset</ActionButton>
      {undoAvailable && (
        <ActionButton variant="secondary" onClick={handleUndo}>Undo</ActionButton>
      )}
      <ActionButton
        variant="primary"
        disabled={acceptedCount === 0 || !selectedPresetId}
        onClick={handleApply}
      >
        Apply {acceptedCount} {acceptedCount === 1 ? "Section" : "Sections"}
      </ActionButton>
    </div>
  </div>
</div>
```

### Health Check Warning Banner
```typescript
// Source: derived from Arcanum design system warning patterns [VERIFIED: ARCANUM_STYLE_GUIDE.md conventions]
<div className="mx-6 mt-4 rounded-lg border border-status-warning/30 bg-status-warning/[0.08] px-4 py-3">
  <div className="flex items-start gap-3">
    <span className="text-status-warning">&#9888;</span>
    <div>
      <h4 className="font-sans text-sm font-semibold text-status-warning">
        Balance Warning
      </h4>
      {warnings.map((w, i) => (
        <p key={i} className="mt-1 font-sans text-sm text-text-secondary">{w.message}</p>
      ))}
    </div>
    <button onClick={onDismiss} className="ml-auto text-text-muted hover:text-text-primary">
      &#10005;
    </button>
  </div>
</div>
```

### Apply Action in Store
```typescript
// Source: derived from configStore + saveConfig patterns [VERIFIED: codebase]
applyPreset: async () => {
  const { selectedPresetId, acceptedSections } = get();
  if (!selectedPresetId) return;

  const config = useConfigStore.getState().config;
  const project = useProjectStore.getState().project;
  if (!config || !project) return;

  // D-05: Snapshot before apply
  const snapshot = structuredClone(config);

  const preset = TUNING_PRESETS.find(p => p.id === selectedPresetId);
  if (!preset) return;

  // Build partial from accepted sections only
  const diffs = computeDiff(
    config as unknown as Record<string, unknown>,
    preset.config as unknown as Record<string, unknown>,
  );
  const acceptedDiffs = diffs.filter(d => acceptedSections.has(d.section));
  const partial = buildPartialFromDiffs(acceptedDiffs);
  const merged = deepMerge(config, partial) as AppConfig;

  // Apply to config store and persist
  useConfigStore.getState().updateConfig(merged);
  await saveProjectConfig(project);
  useConfigStore.getState().markClean();

  set({
    configSnapshot: snapshot,
    undoAvailable: true,
    applySuccess: true,
  });
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zustand middleware for undo (zundo) | Manual snapshot for single-level undo | N/A | Simpler than zundo for single-snapshot case; zundo is overkill here [VERIFIED: zone store uses manual arrays, lore store uses snapshot arrays] |

**Deprecated/outdated:** None relevant to this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Health check thresholds: gold income >2x mob HP change triggers warning | Health Check | Low -- thresholds can be tuned after initial implementation; D-09 says Claude's discretion |
| A2 | `structuredClone(AppConfig)` works without issues (no non-cloneable types in AppConfig) | Architecture Patterns | Low -- AppConfig is plain objects/arrays/primitives per config.ts; no functions, Symbols, or DOM nodes |
| A3 | Success indicator should be a brief green text flash (1.5-2s timeout) matching existing pattern | Code Examples | Low -- D-11 says "Brief success indicator"; style is Claude's discretion |

**If this table is empty:** N/A -- three items listed above.

## Open Questions

1. **Health Check Specific Rules**
   - What we know: D-09 says use computeMetrics() to detect imbalanced combinations from cherry-picked sections. Examples include "Casual economy + Hardcore combat = gold floods."
   - What's unclear: The exact set of rules and thresholds. How many rules is appropriate for v1?
   - Recommendation: Start with 3-5 rules comparing cross-section metric ratios. For example: (1) gold income vs mob difficulty imbalance, (2) XP rate vs mob XP reward imbalance, (3) regen speed vs combat damage imbalance. Thresholds should be generous (flag only obvious mismatches). This is Claude's discretion per CONTEXT.md.

2. **deepMerge Location**
   - What we know: Currently local to TuningWizard.tsx. Now needed by both the component and the store.
   - What's unclear: Whether to extract to a shared module or duplicate.
   - Recommendation: Extract to `lib/tuning/merge.ts` and import from both locations. One function, one source of truth.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `creator/vitest.config.ts` |
| Quick run command | `bun run test` |
| Full suite command | `bun run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| APPLY-01 | acceptedSections defaults to all-checked, toggleAccepted works | unit | `bun run test -- --grep "acceptedSections"` | No -- Wave 0 |
| APPLY-02 | configSnapshot is populated before apply | unit | `bun run test -- --grep "configSnapshot"` | No -- Wave 0 |
| APPLY-03 | undoApply restores snapshot to config | unit | `bun run test -- --grep "undo"` | No -- Wave 0 |
| APPLY-04 | resetWizard clears all wizard state | unit | `bun run test -- --grep "reset"` | No -- Wave 0 |
| APPLY-05 | applyPreset writes merged config to configStore | unit | `bun run test -- --grep "apply"` | No -- Wave 0 |
| UI-06 | checkTuningHealth returns warnings for imbalanced combos | unit | `bun run test -- --grep "healthCheck"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `bun run test`
- **Per wave merge:** `bun run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/tuning/__tests__/healthCheck.test.ts` -- covers UI-06 (checkTuningHealth rules)
- [ ] `src/lib/tuning/__tests__/applyFlow.test.ts` -- covers APPLY-01 through APPLY-05 (selective merge, snapshot, undo logic)

## Security Domain

Not applicable for this phase. The apply flow only mutates local config state and writes to the local filesystem via existing `saveProjectConfig()`. No external APIs, no user input validation concerns beyond what already exists, no network operations. The existing YAML serialization in `saveConfig.ts` handles all file I/O safely.

## Sources

### Primary (HIGH confidence)
- `creator/src/stores/tuningWizardStore.ts` -- Current wizard store shape [VERIFIED: codebase read]
- `creator/src/stores/configStore.ts` -- Config mutation pattern [VERIFIED: codebase read]
- `creator/src/lib/saveConfig.ts` -- YAML persistence flow [VERIFIED: codebase read]
- `creator/src/lib/tuning/formulas.ts` -- computeMetrics() API [VERIFIED: codebase read]
- `creator/src/lib/tuning/diffEngine.ts` -- computeDiff() and groupDiffBySection() [VERIFIED: codebase read]
- `creator/src/lib/tuning/types.ts` -- TuningSection enum, DiffEntry, MetricSnapshot [VERIFIED: codebase read]
- `creator/src/components/tuning/TuningWizard.tsx` -- deepMerge utility, wizard layout [VERIFIED: codebase read]
- `creator/src/components/tuning/ParameterSection.tsx` -- Section header structure [VERIFIED: codebase read]
- `creator/src/components/config/panels/ApiSettingsPanel.tsx` -- Sticky bottom bar pattern [VERIFIED: codebase read]
- `creator/src/components/ui/FormWidgets.tsx` -- ActionButton variants [VERIFIED: codebase read]
- `creator/src/components/config/ConfigPanelHost.tsx` -- Auto-save timer pattern, saveProjectConfig usage [VERIFIED: codebase read]
- `.planning/phases/05-apply-flow/05-CONTEXT.md` -- All 12 decisions [VERIFIED: file read]

### Secondary (MEDIUM confidence)
None needed -- all research supported by codebase reads.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- uses only existing dependencies, no new packages
- Architecture: HIGH -- all patterns verified against existing codebase patterns
- Pitfalls: HIGH -- identified from direct code reading of integration points (auto-save timer, deepMerge locality, save persistence)
- Health check logic: MEDIUM -- specific rules and thresholds are designed fresh, but the computation infrastructure (computeMetrics) is verified

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable -- no external dependencies, all code is local)
