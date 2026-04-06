# Architecture Patterns

**Domain:** Game balance tuning wizard for MUD world builder
**Researched:** 2026-04-04

## Recommended Architecture

The tuning wizard is a self-contained workspace that reads from and writes to the existing `configStore`. It introduces four new components with clear boundaries: a **Preset Engine** (pure data), a **Diff Engine** (pure computation), a **Formula Evaluator** (pure computation), and a **Wizard Workspace** (UI). No new Zustand stores are needed -- the wizard uses local React state for its transient working state and commits final changes to `configStore.updateConfig()`.

### High-Level Data Flow

```
Preset Definition (static data)
       |
       v
  Diff Engine ---- current configStore.config
       |
       v
  ConfigDiff (per-section change sets)
       |
       v
  Formula Evaluator (computes derived metrics at sample levels)
       |
       v
  Comparison Renderer (before/after tables)
       |
       v
  Selective Apply (user checks/unchecks sections)
       |
       v
  configStore.updateConfig() --> auto-save via ConfigPanelHost debounce
```

### Component Boundaries

| Component | Responsibility | Location | Communicates With |
|-----------|---------------|----------|-------------------|
| **Preset Definitions** | Static data: named sets of partial `AppConfig` values organized by tuning section | `src/lib/tuning/presets.ts` | Read by Diff Engine |
| **Diff Engine** | Computes per-section diffs between current config and a preset | `src/lib/tuning/diffEngine.ts` | Reads Preset Definitions + configStore state |
| **Formula Evaluator** | Computes derived game metrics (DPS, XP-to-level, gold/hour, HP at level N) from an `AppConfig` snapshot | `src/lib/tuning/formulaEvaluator.ts` | Reads any `AppConfig` (current or preview) |
| **Tuning Wizard Workspace** | Top-level UI: preset selector, section cards, comparison tables, apply controls | `src/components/tuning/TuningWizard.tsx` | Reads configStore, calls Diff Engine + Formula Evaluator, writes to configStore |
| **Section Card** | Per-section UI: shows changed fields, before/after metrics, accept/reject toggle | `src/components/tuning/SectionCard.tsx` | Receives diff data and metrics as props |
| **Comparison Table** | Renders before/after metric rows at sample levels (1, 10, 25, 50, max) | `src/components/tuning/ComparisonTable.tsx` | Receives metric arrays as props |

### Detailed Component Designs

#### 1. Preset Definitions (`src/lib/tuning/presets.ts`)

A preset is a `Partial<AppConfig>` organized into **tuning sections**. Each section maps to a logical game system (combat, progression, economy, etc.) and contains only the fields that preset wants to change.

```typescript
interface TuningSection {
  id: string;                    // "combat" | "progression" | "economy" | etc.
  label: string;                 // "Combat & Mob Tiers"
  description: string;           // "Tick rates, damage ranges, mob scaling"
  icon?: string;                 // Optional icon identifier
  fields: DeepPartial<AppConfig>; // The subset of config this section touches
}

interface TuningPreset {
  id: string;                    // "casual" | "balanced" | "hardcore" | etc.
  label: string;                 // "Casual"
  description: string;           // "Relaxed pacing, generous rewards, forgiving death"
  philosophy: string;            // 1-2 sentence design philosophy shown to user
  sections: TuningSection[];
}
```

**Why `DeepPartial<AppConfig>` per section, not a flat value map:** The config shape is deeply nested (`progression.xp.baseXp`, `mobTiers.weak.baseHp`). Using the same type shape means (a) TypeScript catches typos, (b) merging is `structuredClone + deepMerge`, no path-string gymnastics, (c) adding a new field to a preset is just adding to the object literal.

**Why sections live inside presets, not as a global taxonomy:** Different presets may group fields differently. A "Story-focused" preset might bundle progression + economy into a single "Pacing" section, while "Hardcore" separates them. Sections are a preset's opinion about what belongs together.

Presets are **5-6 static objects** defined in code (not stored on disk). They are the "expert opinion" baked into the wizard. Approximately 50-80 fields per preset across 6-8 sections.

#### 2. Diff Engine (`src/lib/tuning/diffEngine.ts`)

Pure function: takes current `AppConfig` and a `TuningPreset`, returns a `ConfigDiff`.

```typescript
interface FieldChange {
  path: string;           // dot-notation: "mobTiers.weak.baseHp"
  currentValue: unknown;
  presetValue: unknown;
  label: string;          // human-readable: "Weak Mob Base HP"
}

interface SectionDiff {
  sectionId: string;
  label: string;
  description: string;
  changes: FieldChange[];  // only fields that differ
  accepted: boolean;       // UI toggle state (default: true)
}

interface ConfigDiff {
  presetId: string;
  sections: SectionDiff[];
  totalChanges: number;
}

function computeDiff(current: AppConfig, preset: TuningPreset): ConfigDiff;
```

The diff engine walks the preset's `fields` object recursively, compares each leaf value against the current config at the same path, and emits a `FieldChange` only when values differ. This means if the user already has `baseHp: 100` and the preset also wants `100`, it does not appear as a change.

**Why not use the existing `diff.ts`:** The existing `diffLines` is a text-based LCS diff for YAML display. The wizard needs a structured, field-level diff that preserves types, paths, and human labels. Different problem.

#### 3. Formula Evaluator (`src/lib/tuning/formulaEvaluator.ts`)

Pure function: takes an `AppConfig` snapshot and a set of sample levels, returns computed game metrics. These formulas mirror the Kotlin server's actual calculations (from `reference/`).

```typescript
interface LevelMetrics {
  level: number;
  xpToNextLevel: number;
  totalXpToReach: number;
  playerHp: number;
  playerMana: number;
  meleeDps: number;           // estimated from stat bindings + base damage
  weakMobHp: number;
  standardMobHp: number;
  eliteMobHp: number;
  bossMobHp: number;
  weakMobXpReward: number;
  killsToLevel: number;       // weak mob kills needed to level
  goldPerHour: number;        // estimated from mob gold drops + kill rate
  // ... extend as needed per section
}

interface MetricSnapshot {
  label: string;              // "Current" or preset name
  levels: LevelMetrics[];     // metrics at sample levels [1, 5, 10, 25, 50, maxLevel]
}

function evaluateMetrics(config: AppConfig, sampleLevels: number[]): MetricSnapshot;
```

The evaluator implements the key formulas from the MUD server:
- **XP curve:** `baseXp * (level ^ exponent) + (linearXp * level) * multiplier`
- **Player HP:** `baseHp + (hpPerLevel * level) + (statValue / hpScalingDivisor * level)`
- **Mob HP at level:** `tierBaseHp + (tierHpPerLevel * level)`
- **Estimated DPS:** `(minDamage + maxDamage) / 2 + (statValue / meleeDamageDivisor)` divided by tick rate
- **Gold/hour:** mob gold per kill * estimated kills per hour (from DPS vs mob HP)

**Key insight:** The evaluator does not need to be exact -- it needs to be directionally correct and consistent between "before" and "after" so the comparison is meaningful. Approximate formulas that match the server's shape are fine.

#### 4. Wizard Workspace (`src/components/tuning/TuningWizard.tsx`)

The top-level component, rendered as a `host: "command"` panel (like PlayerSpriteManager, Console, AdminDashboard). Uses **local React state** for wizard working state -- no new Zustand store needed because:

- Wizard state is transient (preset selection, section toggles, preview config)
- Only one wizard instance exists at a time
- Final output is a single `configStore.updateConfig()` call
- No undo/redo needed for wizard state itself (undo happens by not applying)

**Local state shape:**

```typescript
interface WizardState {
  selectedPresetId: string | null;
  diff: ConfigDiff | null;
  previewConfig: AppConfig | null;  // current config + accepted section changes
  currentMetrics: MetricSnapshot | null;
  previewMetrics: MetricSnapshot | null;
}
```

**Wizard layout (top to bottom):**

1. **Preset Selector Bar** -- horizontal row of preset cards (icon, name, philosophy tagline). Clicking one computes the diff.
2. **Summary Strip** -- "N changes across M sections" with global Accept All / Reject All controls.
3. **Section Cards** -- scrollable list of `SectionCard` components, one per section with changes. Each card has:
   - Section header (label, description, accept/reject toggle)
   - Field change list (path, old value -> new value, with semantic coloring)
   - Inline comparison table for that section's key metrics
4. **Sticky Footer** -- "Apply N accepted changes" button + "Cancel" button

**Preview recomputation:** When the user toggles a section's accepted state, the wizard rebuilds `previewConfig` by merging only accepted sections' fields onto the current config, then re-runs the formula evaluator. This is cheap (a few hundred field merges + arithmetic) and can run synchronously.

#### 5. Section Card (`src/components/tuning/SectionCard.tsx`)

Presentational component receiving props:

```typescript
interface SectionCardProps {
  section: SectionDiff;
  currentMetrics: LevelMetrics[];   // for this section's relevant metrics
  previewMetrics: LevelMetrics[];   // with this section's changes applied
  onToggleAccepted: (sectionId: string) => void;
}
```

Renders:
- Collapsible header with section name + change count badge + toggle switch
- Field change rows: `fieldLabel: oldValue -> newValue` with red/green coloring
- Comparison table (only metrics relevant to this section)

#### 6. Comparison Table (`src/components/tuning/ComparisonTable.tsx`)

Pure presentational component. Takes two `MetricSnapshot` arrays and renders a table:

```
Level | Current HP | Preview HP | Delta | Current XP | Preview XP | Delta
  1   |    100     |    120     | +20%  |    1000    |    800     | -20%
  10  |    250     |    300     | +20%  |   15000    |   12000    | -20%
  ...
```

Delta cells use semantic coloring: green for "better for the player" (context-dependent), red for "harsher", neutral for informational.

### Integration with Existing App

#### Panel Registry

Add one entry to `COMMAND_PANELS` in `panelRegistry.ts`:

```typescript
{ id: "tuning", label: "Tuning Wizard", group: "world", host: "command",
  kicker: "Balance", title: "Tuning wizard",
  description: "Apply themed balance presets with before/after comparison.",
  maxWidth: "max-w-7xl" }
```

Using `host: "command"` means MainArea routes it to a dedicated component (same pattern as sprites, console, admin) rather than wrapping it in ConfigPanelHost. This is correct because the wizard is not a config panel -- it has its own layout, no auto-save timer, and manages its own scroll.

#### MainArea Routing

Add one `case` in the `host === "command"` switch in `MainArea.tsx`:

```typescript
case "tuning": content = <TuningWizard />; break;
```

#### Sidebar Placement

The panel goes in the `"world"` sidebar group (alongside Combat, Progression, Economy). Consider placing it at the top of the group or in its own `subGroup: "Tuning"` to visually separate it from the raw config panels.

#### ConfigStore Interaction

The wizard reads via `useConfigStore.getState().config` (snapshot, not subscription) when computing diffs. It writes via `useConfigStore.getState().updateConfig(mergedConfig)` when the user clicks Apply. This triggers the existing dirty flag and auto-save flow in ConfigPanelHost -- but since the wizard is a command panel, the auto-save will fire the next time the user opens any config panel. To handle this, the wizard should call `saveProjectConfig()` directly after applying, or trigger an explicit save.

**Recommendation:** After `updateConfig()`, call `saveProjectConfig()` explicitly in the apply handler. This matches the pattern used by other command panels that modify config indirectly.

### File Structure

```
src/
  lib/
    tuning/
      presets.ts              # TuningPreset definitions (5-6 presets)
      presetTypes.ts          # TypeScript interfaces for preset/diff/metrics types
      diffEngine.ts           # computeDiff(current, preset) -> ConfigDiff
      formulaEvaluator.ts     # evaluateMetrics(config, levels) -> MetricSnapshot
      fieldLabels.ts          # Human-readable labels for config field paths
  components/
    tuning/
      TuningWizard.tsx        # Top-level workspace component
      PresetSelector.tsx      # Horizontal preset card row
      SectionCard.tsx         # Per-section diff + comparison
      ComparisonTable.tsx     # Before/after metric table
      FieldChangeRow.tsx      # Single field old->new display
      ApplyFooter.tsx         # Sticky apply/cancel bar
```

## Patterns to Follow

### Pattern 1: Command Panel Integration

**What:** Register the wizard as a `host: "command"` panel, not `host: "config"`.

**When:** The component has its own layout, scroll management, and save logic that differs from standard config panels.

**Why:** ConfigPanelHost wraps panels with auto-save, decorative chrome, and a `Section` component. The wizard needs a different layout (preset bar + section cards + sticky footer). Using `host: "command"` opts out of ConfigPanelHost entirely, matching sprites/console/admin precedent.

### Pattern 2: Snapshot-Then-Merge for Non-Destructive Preview

**What:** When the user selects a preset, snapshot the current config via `structuredClone(configStore.config)`. Build the preview by merging accepted sections onto the snapshot. Never mutate the configStore until explicit Apply.

**When:** Any time you need to show "what if" state without committing it.

**Why:** The wizard's core promise is non-destructive preview. Mutating configStore during browsing would trigger dirty flags, auto-save, and confusion. The snapshot pattern keeps wizard state isolated until the user commits.

```typescript
// In the wizard's apply handler:
function applyChanges(currentConfig: AppConfig, diff: ConfigDiff): AppConfig {
  let merged = structuredClone(currentConfig);
  for (const section of diff.sections) {
    if (!section.accepted) continue;
    merged = deepMerge(merged, section.fields);
  }
  return merged;
}
```

### Pattern 3: Pure Functions for Testability

**What:** Keep diffEngine, formulaEvaluator, and preset definitions as pure functions with no React or store dependencies. They take `AppConfig` in, return data out.

**When:** All computation logic.

**Why:** These functions contain the wizard's core logic and will have the most edge cases (formula accuracy, deep merge correctness, field path traversal). Pure functions are trivially testable with Vitest. The project already follows this pattern with `validateZone.ts`, `validateConfig.ts`, and the export utilities.

### Pattern 4: Local State for Transient UI

**What:** Use `useState`/`useReducer` in `TuningWizard.tsx` instead of creating a new Zustand store.

**When:** State that is meaningful only while the wizard tab is open and does not need to persist, be shared across components, or support undo.

**Why:** The wizard's working state (which preset is selected, which sections are accepted, the computed diff and metrics) is ephemeral. Creating a Zustand store for this would be over-engineering -- the state has one consumer (the wizard component tree), requires no persistence, and resets naturally when the tab closes. If future requirements add cross-component needs (e.g., a toolbar badge showing pending changes), promoting to a store is straightforward.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Presets in YAML

**What:** Making presets user-editable or storing them in application.yaml.

**Why bad:** Presets are expert-authored balance opinions. Letting users edit them turns them into "just more config fields" -- defeating the purpose. User customization happens by accepting/rejecting sections, not by editing the presets themselves.

**Instead:** Hardcode presets in TypeScript. If custom presets become a v2 feature, store them in a separate `.arcanum/custom-presets.json` file, not in application.yaml.

### Anti-Pattern 2: Full Config Snapshot Comparison

**What:** Diffing the entire AppConfig as two YAML strings.

**Why bad:** AppConfig has 700+ fields. Most are irrelevant to a given preset. A text diff would be noisy, unstructured, and impossible to accept/reject by section. It also cannot provide human-readable labels or section grouping.

**Instead:** Structured field-level diff that only includes fields the preset touches.

### Anti-Pattern 3: Creating a tuningStore

**What:** Adding a new Zustand store for wizard state.

**Why bad:** The wizard's state has one consumer, is transient, and resets on tab close. A store adds boilerplate, risks stale subscriptions if not cleaned up, and creates a false impression that this state is app-wide.

**Instead:** Local React state in the wizard component. Promote to a store only if requirements change (e.g., persisting wizard state across tab switches, which could also be solved with tab-level state persistence).

### Anti-Pattern 4: Mutating ConfigStore During Preview

**What:** Applying preset values to configStore to show the preview, then reverting on cancel.

**Why bad:** Triggers dirty flag, auto-save debounce, and any subscribers to configStore (entity editors derive dropdown options from it). Reverting may not restore the exact original if auto-save fires in between.

**Instead:** Snapshot + local merge as described in Pattern 2.

## Scalability Considerations

| Concern | Current (v1) | Future (v2) |
|---------|-------------|-------------|
| Number of presets | 5-6 hardcoded | Could add user-created presets stored in `.arcanum/` |
| Formula accuracy | Approximate formulas matching server shape | Could import exact Kotlin formula implementations or validate against server |
| Metric coverage | Core metrics (HP, DPS, XP, gold) | Could add per-class breakdowns, ability damage curves, crafting efficiency |
| Section granularity | 6-8 sections per preset | Could allow per-field accept/reject (current design supports this -- `SectionDiff.changes` already tracks individual fields) |
| LLM analysis | None in v1 | v2 stretch: feed config to LLM for holistic balance review, flag problematic combinations |
| Comparison depth | Static metric tables | Could add interactive charts (DPS over level range, XP curve visualization) |

## Build Order (Dependency Chain)

The components have clear dependencies that dictate build order:

1. **Types + Preset Definitions** (no dependencies)
   - `presetTypes.ts` -- interfaces for TuningPreset, ConfigDiff, LevelMetrics, etc.
   - `presets.ts` -- at least 2 presets (Casual + Balanced) to test with
   - `fieldLabels.ts` -- human-readable labels for config paths

2. **Diff Engine** (depends on types + presets)
   - `diffEngine.ts` -- computeDiff function
   - Tests: verify field-level comparison, section grouping, no-change filtering

3. **Formula Evaluator** (depends on types, independent of diff engine)
   - `formulaEvaluator.ts` -- evaluateMetrics function
   - Tests: verify XP curve, HP scaling, mob metrics match expected values

4. **Comparison Table + Field Change Row** (presentational, depends on types)
   - `ComparisonTable.tsx` -- renders metric snapshots
   - `FieldChangeRow.tsx` -- renders individual field changes

5. **Section Card** (depends on comparison table + field change row)
   - `SectionCard.tsx` -- composed from the above presentational components

6. **Wizard Workspace** (depends on everything above)
   - `TuningWizard.tsx` -- wires it all together with local state
   - `PresetSelector.tsx` -- preset card row
   - `ApplyFooter.tsx` -- sticky apply/cancel bar
   - Panel registry integration + MainArea routing

7. **Remaining Presets** (depends on wizard being testable)
   - Complete all 5-6 presets with real values
   - Test each preset produces reasonable before/after comparisons

Steps 2 and 3 can run in parallel. Steps 4 and 5 can run in parallel with 2/3 if types are done. Step 6 requires all prior steps. Step 7 is content work that can happen after the scaffold is functional.

## Sources

- Codebase analysis: `creator/src/stores/configStore.ts` (22 lines, minimal store surface)
- Codebase analysis: `creator/src/lib/panelRegistry.ts` (panel registration pattern with host types)
- Codebase analysis: `creator/src/components/MainArea.tsx` (command panel routing pattern)
- Codebase analysis: `creator/src/types/config.ts` (full AppConfig shape, 745 lines)
- Codebase analysis: `creator/src/components/config/ConfigPanelHost.tsx` (auto-save chrome pattern)
- Codebase analysis: `creator/src/lib/diff.ts` (existing text diff -- not suitable for structured config diff)
- Architecture analysis: `.planning/codebase/ARCHITECTURE.md` (overall app patterns)

---

*Architecture research: 2026-04-04*
