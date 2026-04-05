# Phase 3: Wizard Workspace - Research

**Researched:** 2026-04-04
**Domain:** React UI workspace -- panel registration, Zustand store, component composition
**Confidence:** HIGH

## Summary

Phase 3 is a frontend-only UI phase that builds the Tuning Wizard workspace shell. All data dependencies (presets, field metadata, diff engine, formulas) are already implemented and tested in Phases 1 and 2. The work is exclusively React component creation, Zustand store creation, and panel registry integration.

The existing codebase has well-established patterns for all three integration points: (1) panel registration via `panelRegistry.ts` with `PANEL_MAP` and sidebar group arrays, (2) command-hosted panels routed through `MainArea.tsx` with lazy loading, and (3) independent Zustand stores following `create<Interface>((set, get) => ({...}))`. No new libraries are needed.

**Primary recommendation:** Follow the existing `command` host pattern (like `PlayerSpriteManager`, `Console`, `AdminDashboard`) for routing, create a new `tuningWizardStore.ts` for session state, and build 5-6 components in `creator/src/components/tuning/` that consume Phase 1/2 artifacts directly.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Three equal-width cards in a horizontal row, centered. All three presets visible at once without scrolling.
- **D-02:** Each card shows: preset name (Cinzel heading), 1-2 line description, and 3-4 key metric indicators.
- **D-03:** Each preset card has a subtle accent color -- distinct soft glow or border tint (warm gold for Casual, cool silver for Balanced, crimson for Hardcore).
- **D-04:** On selection, chosen card gets a prominent glow/border; unselected cards dim slightly. Parameter browser populates with preset values and scrolls into view.
- **D-05:** Register "Tuning Wizard" in the World sidebar group alongside Combat, Progression, Economy, etc.
- **D-06:** Use `host: "command"` in panel registry with a dedicated `TuningWizard` component.
- **D-07:** Persist wizard state in a new Zustand store (`tuningWizardStore`). State survives tab switches within the session.
- **D-08:** Sticky search/filter bar positioned between preset cards and parameter list.
- **D-09:** Section filtering uses clickable chips for all 4 TuningSection values. Multiple sections active simultaneously. All active by default.
- **D-10:** Search matches against FIELD_METADATA's `label`, `description`, and dotted config path.
- **D-11:** Parameters grouped under 4 collapsible section headers matching TuningSection. Each header shows field count.
- **D-12:** Before preset selected, each parameter row shows: field label, current value from configStore, and description.
- **D-13:** After preset selection, each parameter row gains "Preset Value" column. Fields where preset differs are highlighted.
- **D-14:** Empty state shows all parameters with current values. Selecting a preset adds comparison column.

### Claude's Discretion
- Exact accent colors per preset card (warm gold, cool silver, crimson are guidelines)
- Key metric indicator format on cards (pills, bars, text labels)
- Collapsible section default state (all expanded vs first expanded)
- Exact search debounce timing and highlight behavior
- Store structure: standalone `tuningWizardStore` vs extending existing stores

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Tuning Wizard registered as new top-level tab in panel registry and sidebar | Panel registration pattern fully documented -- add entry to `WORLD_PANELS` array, add lazy import + switch case in `MainArea.tsx` |
| UI-02 | Wizard workspace follows Arcanum design system (dark indigo, aurum-gold, Cinzel/Crimson Pro) | All color tokens, font families, and CSS custom properties documented from `index.css` |
| UI-03 | Preset selector with themed cards showing preset name, description, and key characteristics | `TUNING_PRESETS` array provides `name`, `description`, `sectionDescriptions`; `computeMetrics()` provides key stats |
| UI-05 | Search/filter across parameter names and descriptions | `FIELD_METADATA` record provides `label`, `description`, and path keys for search matching |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.x | UI framework | Already in project |
| Zustand | 5.x | State management | Project standard, one store per domain |
| Tailwind CSS | 4.x | Styling | Project standard, custom Arcanum tokens |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | - | - | All dependencies satisfied by existing project stack |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled search | Fuse.js | Overkill -- simple substring match on 137 fields needs no fuzzy search library |
| CSS Grid for parameter rows | Table element | Grid gives more control over responsive column sizing; matches Tailwind patterns |

**Installation:** No new packages needed. All dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure
```
creator/src/
  components/tuning/
    TuningWizard.tsx          # Workspace root (command host component)
    PresetCard.tsx            # Individual preset card
    SearchFilterBar.tsx       # Sticky search input + section chips
    ParameterSection.tsx      # Collapsible section with header + field rows
    ParameterRow.tsx          # Single parameter row (label, current, preset, description)
  stores/
    tuningWizardStore.ts      # Session state: selectedPresetId, searchQuery, activeSections, collapsedSections
  lib/tuning/
    (existing files unchanged)
```

### Pattern 1: Panel Registration
**What:** Add a `PanelDef` entry to `WORLD_PANELS` in `panelRegistry.ts` and route it in `MainArea.tsx`.
**When to use:** For UI-01 sidebar + tab integration.
**Example:**
```typescript
// In panelRegistry.ts WORLD_PANELS array:
{
  id: "tuningWizard",
  label: "Tuning Wizard",
  group: "world",
  host: "command",
  kicker: "World",
  title: "Tuning Wizard",
  description: "Configure game balance with themed presets and parameter comparison.",
  maxWidth: "max-w-7xl",
}
```

### Pattern 2: Command Host Routing in MainArea
**What:** Lazy import + switch case for command-hosted panels.
**When to use:** For routing the TuningWizard component.
**Example:**
```typescript
// Lazy import at top of MainArea.tsx:
const TuningWizard = lazy(() =>
  import("./tuning/TuningWizard").then(m => ({ default: m.TuningWizard }))
);

// In the command switch block:
case "tuningWizard": content = <TuningWizard />; break;
```

### Pattern 3: Zustand Store (Session-Only)
**What:** Independent store with no localStorage persistence.
**When to use:** For wizard UI state that survives tab switches but not app restarts.
**Example:**
```typescript
import { create } from "zustand";
import { TuningSection } from "@/lib/tuning/types";

const ALL_SECTIONS = new Set([
  TuningSection.CombatStats,
  TuningSection.EconomyCrafting,
  TuningSection.ProgressionQuests,
  TuningSection.WorldSocial,
]);

interface TuningWizardStore {
  selectedPresetId: string | null;
  searchQuery: string;
  activeSections: Set<TuningSection>;
  collapsedSections: Set<TuningSection>;
  selectPreset: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  toggleSection: (s: TuningSection) => void;
  toggleCollapsed: (s: TuningSection) => void;
}

export const useTuningWizardStore = create<TuningWizardStore>((set) => ({
  selectedPresetId: null,
  searchQuery: "",
  activeSections: new Set(ALL_SECTIONS),
  collapsedSections: new Set(),
  selectPreset: (id) => set({ selectedPresetId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  toggleSection: (s) => set((state) => {
    const next = new Set(state.activeSections);
    if (next.has(s)) next.delete(s); else next.add(s);
    return { activeSections: next };
  }),
  toggleCollapsed: (s) => set((state) => {
    const next = new Set(state.collapsedSections);
    if (next.has(s)) next.delete(s); else next.add(s);
    return { collapsedSections: next };
  }),
}));
```

### Pattern 4: Reading Current Config Values
**What:** Use `configStore.config` + `getNestedValue` to extract current field values for parameter display.
**When to use:** For D-12 parameter browsing with current values.
**Example:**
```typescript
// Reuse getNestedValue pattern from diffEngine.ts
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined),
    obj,
  );
}

// In ParameterRow, get current value:
const config = useConfigStore((s) => s.config);
const currentValue = config ? getNestedValue(config as unknown as Record<string, unknown>, field.path) : undefined;
```

### Pattern 5: Computing Preset Card Metrics
**What:** Use `computeMetrics()` with a merged config to derive human-readable key stats.
**When to use:** For D-02 preset card metric indicators.
**Example:**
```typescript
// Merge preset overlay onto current config, then compute
import { computeMetrics } from "@/lib/tuning/formulas";
import { TUNING_PRESETS } from "@/lib/tuning/presets";

// For each preset, compute metrics and extract key indicators:
// - XP to level 20 (from xpPerLevel[20])
// - Standard mob HP at level 10 (from mobHp.standard[10])
// - Player HP at level 20 (from playerHp[20])
// - Regen interval (from regenInterval[10])
```

### Anti-Patterns to Avoid
- **Subscribing to entire configStore:** Select only `config` field: `useConfigStore((s) => s.config)`. Never `useConfigStore()`.
- **Cross-store subscriptions:** Read other stores via `getState()` in actions, not via Zustand subscriptions.
- **Default exports:** Use named exports for all components. Only use default for lazy-loading resolution.
- **CSS modules or styled-components:** Use Tailwind with semantic tokens only.
- **Sans-serif fonts:** All text must use Cinzel (display), Crimson Pro (body), or JetBrains Mono (code).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Field-level diff | Custom comparison | `computeDiff()` from `diffEngine.ts` | Already handles recursive traversal, FIELD_METADATA filtering, and DiffEntry creation |
| Metric computation | Manual formula evaluation | `computeMetrics()` from `formulas.ts` | Already evaluates all formulas at representative levels |
| Section grouping | Manual categorization | `FIELD_METADATA[path].section` | Every field already has a TuningSection assignment |
| Diff grouping | Custom bucketing | `groupDiffBySection()` from `diffEngine.ts` | Returns pre-initialized Record with all 4 sections |
| Preset data | Hardcoded card content | `TUNING_PRESETS` array from `presets.ts` | Contains `name`, `description`, `sectionDescriptions`, and full config overlay |

**Key insight:** Phases 1 and 2 built all the data infrastructure. Phase 3 is purely UI rendering and interaction -- no business logic to create.

## Common Pitfalls

### Pitfall 1: Flex Scroll Container
**What goes wrong:** Parameter list does not scroll, content overflows or gets clipped.
**Why it happens:** Missing `min-h-0 flex-1` on parent containers in a flex column layout.
**How to avoid:** The TuningWizard root must be `flex min-h-0 flex-1 flex-col`. The scroll container (below the sticky bar) needs `overflow-y-auto min-h-0 flex-1`.
**Warning signs:** Content extends below the viewport without scrollbar.

### Pitfall 2: Sticky Bar Z-Index
**What goes wrong:** Sticky search bar scrolls behind other content or doesn't stick.
**Why it happens:** Sticky positioning requires the scroll container to be the direct parent (not document body). Also needs proper `z-index`.
**How to avoid:** Make the wizard root the scroll container. SearchFilterBar uses `sticky top-0 z-10` with explicit `bg-bg-primary` background (no transparency -- otherwise content shows through).
**Warning signs:** Search bar disappears on scroll, or parameter rows render on top of it.

### Pitfall 3: Set Serialization in Zustand
**What goes wrong:** Zustand doesn't trigger re-renders when mutating Sets in place.
**Why it happens:** Zustand uses shallow equality by default; `Set.add()` / `Set.delete()` mutates the same reference.
**How to avoid:** Always create a new Set: `set((state) => ({ activeSections: new Set(state.activeSections) }))` then add/delete.
**Warning signs:** Clicking filter chips or collapse toggles has no visible effect.

### Pitfall 4: const enum Import Issues
**What goes wrong:** `TuningSection` is a `const enum` which can cause issues with isolated module transforms (Vite/esbuild).
**Why it happens:** `const enum` values are inlined at compile time; with `isolatedModules`, cross-file const enums can fail.
**How to avoid:** The existing Phase 1/2 code already uses `TuningSection` across files and tests pass -- so the Vite config handles it. But be aware: if importing fails, the fallback is to use the string values directly (`"Combat & Stats"`, etc.).
**Warning signs:** Build errors mentioning "const enum" or "isolatedModules".

### Pitfall 5: Config Null Guard
**What goes wrong:** Parameter browser crashes when `configStore.config` is null (no project loaded).
**Why it happens:** Config is null until a project with `application.yaml` is opened.
**How to avoid:** Show empty state ("No configuration loaded") when `config === null`. Guard all `getNestedValue` calls.
**Warning signs:** White screen or React error boundary when opening wizard without a project.

### Pitfall 6: Search Debounce Without Cleanup
**What goes wrong:** Stale search results flash briefly after rapid typing.
**Why it happens:** setTimeout without cleanup on component unmount or re-render.
**How to avoid:** Use `useRef` for the timeout ID and clear it in the useEffect cleanup. Or use a simple `useState` + `useEffect` debounce pattern.
**Warning signs:** Search results flicker or show previous query results momentarily.

## Code Examples

### Panel Registration (verified from panelRegistry.ts)
```typescript
// Source: creator/src/lib/panelRegistry.ts lines 54-81 (WORLD_PANELS)
// Add to WORLD_PANELS array. Position after existing entries:
{
  id: "tuningWizard",
  label: "Tuning Wizard",
  group: "world",
  host: "command",
  kicker: "World",
  title: "Tuning Wizard",
  description: "Configure game balance with themed presets and parameter comparison.",
  maxWidth: "max-w-7xl",
  subGroup: "Core",  // Place alongside Combat, Progression, Stat Bindings
}
```

### MainArea Command Routing (verified from MainArea.tsx)
```typescript
// Source: creator/src/components/MainArea.tsx lines 76-83
// Existing pattern:
case "sprites": content = <PlayerSpriteManager />; break;
case "console": content = <Console />; break;
case "admin": content = <AdminDashboard />; break;
// Add:
case "tuningWizard": content = <TuningWizard />; break;
```

### Preset Card Accent Colors (from index.css tokens)
```typescript
// Source: creator/src/index.css color tokens
const PRESET_ACCENTS: Record<string, { border: string; glow: string; text: string }> = {
  casual:   { border: "border-warm",         glow: "shadow-[0_0_20px_rgba(200,164,106,0.35)]", text: "text-warm" },
  balanced: { border: "border-stellar-blue",  glow: "shadow-[0_0_20px_rgba(140,174,201,0.35)]", text: "text-stellar-blue" },
  hardcore: { border: "border-status-error",  glow: "shadow-[0_0_20px_rgba(219,184,184,0.35)]", text: "text-status-error" },
};
```

### Search/Filter Logic
```typescript
// Filter FIELD_METADATA entries by search query and active sections
function filterFields(
  query: string,
  activeSections: Set<TuningSection>,
): [string, FieldMeta][] {
  const lowerQuery = query.toLowerCase();
  return Object.entries(FIELD_METADATA).filter(([path, meta]) => {
    if (!activeSections.has(meta.section)) return false;
    if (!query) return true;
    return (
      meta.label.toLowerCase().includes(lowerQuery) ||
      meta.description.toLowerCase().includes(lowerQuery) ||
      path.toLowerCase().includes(lowerQuery)
    );
  });
}
```

### Diff-Based Highlighting
```typescript
// Source: creator/src/lib/tuning/diffEngine.ts
// Use computeDiff to get changed fields, then build a Set for O(1) lookup:
import { computeDiff } from "@/lib/tuning/diffEngine";

const diffs = computeDiff(
  config as unknown as Record<string, unknown>,
  preset.config as unknown as Record<string, unknown>,
);
const changedPaths = new Set(diffs.map(d => d.path));
const diffMap = new Map(diffs.map(d => [d.path, d]));
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `creator/vitest.config.ts` |
| Quick run command | `cd creator && bun run test` |
| Full suite command | `cd creator && bun run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | Panel registered in PANEL_MAP with correct host/group | unit | `cd creator && bunx vitest run src/lib/__tests__/panelRegistry.test.ts -x` | Wave 0 |
| UI-02 | Design system compliance | manual-only | Visual inspection | N/A |
| UI-03 | Preset cards render all 3 presets with correct data | manual-only | Visual inspection (component depends on DOM) | N/A |
| UI-05 | Search/filter logic returns correct fields | unit | `cd creator && bunx vitest run src/lib/tuning/__tests__/searchFilter.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd creator && bun run test`
- **Per wave merge:** `cd creator && bun run test`
- **Phase gate:** Full suite green + visual inspection of wizard workspace

### Wave 0 Gaps
- [ ] `creator/src/lib/__tests__/panelRegistry.test.ts` -- covers UI-01 (verify tuningWizard in PANEL_MAP with host="command", group="world")
- [ ] `creator/src/lib/tuning/__tests__/searchFilter.test.ts` -- covers UI-05 (verify search across label, description, path; verify section filtering)

Note: UI-02 and UI-03 are visual requirements that cannot be meaningfully unit-tested. They require visual inspection against the UI-SPEC. The data layer tests for Phases 1/2 already verify that preset data and field metadata are correct.

## Sources

### Primary (HIGH confidence)
- `creator/src/lib/panelRegistry.ts` -- Panel registration pattern, PanelDef interface, WORLD_PANELS structure
- `creator/src/components/MainArea.tsx` -- Command host routing pattern, lazy loading, switch cases
- `creator/src/components/Sidebar.tsx` -- Sidebar rendering with PanelButtonGrid, group/subGroup structure
- `creator/src/stores/configStore.ts` -- Config store interface, `config: AppConfig | null`
- `creator/src/lib/tuning/types.ts` -- TuningSection enum, FieldMeta, DiffEntry interfaces
- `creator/src/lib/tuning/presets.ts` -- TuningPreset interface, TUNING_PRESETS array
- `creator/src/lib/tuning/fieldMetadata.ts` -- FIELD_METADATA record (137 entries)
- `creator/src/lib/tuning/diffEngine.ts` -- computeDiff(), groupDiffBySection()
- `creator/src/lib/tuning/formulas.ts` -- computeMetrics()
- `creator/src/index.css` -- All color tokens and CSS custom properties
- `.planning/phases/03-wizard-workspace/03-UI-SPEC.md` -- Visual and interaction contract

### Secondary (MEDIUM confidence)
- None needed -- all sources are project-internal

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies; existing project stack
- Architecture: HIGH - All patterns verified from existing codebase
- Pitfalls: HIGH - Based on project-specific CLAUDE.md pitfalls and direct code inspection

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable -- no external dependencies to age)
