# Phase 3: Wizard Workspace - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 03-wizard-workspace
**Areas discussed:** Preset selector layout, Workspace structure, Search and filtering, Parameter browsing

---

## Preset Selector Layout

### Card arrangement

| Option | Description | Selected |
|--------|-------------|----------|
| Three equal cards in a row | Horizontal row of equally-sized cards, centered. Clean, balanced — shows all three at once without scrolling. | ✓ |
| Featured center card with flanking | Balanced preset larger in center, Casual and Hardcore flanking at smaller size. | |
| Vertical stack | Cards stacked top-to-bottom, full width. More room for detail per card but requires scrolling. | |

**User's choice:** Three equal cards in a row
**Notes:** None

### Card content

| Option | Description | Selected |
|--------|-------------|----------|
| Name + description + key stats | Preset name (Cinzel heading), 1-2 line description, then 3-4 key metrics as visual indicators. | ✓ |
| Name + description only | Minimal — just the identity. Details appear after selection. | |
| Name + full section descriptions | Show all 4 sectionDescriptions from the preset metadata. | |

**User's choice:** Name + description + key stats
**Notes:** None

### Card theming

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle accent color per preset | Each card has a distinct soft glow or border tint within the Arcanum dark palette. | ✓ |
| Icon-based differentiation | Same styling, unique icon/emblem per card. | |
| You decide | Claude picks the visual treatment. | |

**User's choice:** Subtle accent color per preset
**Notes:** None

### Selection UX

| Option | Description | Selected |
|--------|-------------|----------|
| Card highlights + scrolls to parameters | Selected card gets prominent glow/border, unselected dim. Parameter browser scrolls into view. | ✓ |
| Card selection opens detail drawer | Clicking a card opens a side drawer showing full preset details. | |
| Two-step: select then confirm | Click to preview, click again to activate. | |

**User's choice:** Card highlights + workspace scrolls to parameter view
**Notes:** None

---

## Workspace Structure

### Sidebar placement

| Option | Description | Selected |
|--------|-------------|----------|
| New entry in World group | Add to existing World sidebar group alongside Combat, Progression, Economy. | ✓ |
| New top-level sidebar group | Create a new "Tuning" group in the sidebar. | |
| Operations group | Add alongside Services, Deployment, Raw YAML. | |

**User's choice:** New entry in World group
**Notes:** None

### Host type

| Option | Description | Selected |
|--------|-------------|----------|
| New 'command' host with dedicated component | Like PlayerSpriteManager — standalone workspace, not a simple config panel. | ✓ |
| Reuse 'config' host | Uses ConfigPanelHost with auto-save chrome. | |
| You decide | Claude picks whichever host type best serves the wizard's layout. | |

**User's choice:** New 'command' host with dedicated component
**Notes:** None

### State persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, persist in a Zustand store | New store holds selected preset, search query, filter state. Survives tab switches. | ✓ |
| No, reset on tab switch | Start fresh each time the wizard tab opens. | |

**User's choice:** Yes, persist in a Zustand store
**Notes:** None

---

## Search and Filtering

### Search bar position

| Option | Description | Selected |
|--------|-------------|----------|
| Sticky bar between presets and parameters | Below preset cards, above parameter list. Always visible with search input + filter chips. | ✓ |
| Top of workspace (above preset cards) | Search first, then presets, then parameters. | |
| You decide | Claude picks the best placement. | |

**User's choice:** Sticky bar between presets and parameters
**Notes:** None

### Section filtering

| Option | Description | Selected |
|--------|-------------|----------|
| Clickable section chips | Horizontal row of 4 section chips that toggle on/off. Multiple active. All by default. | ✓ |
| Dropdown select | Single dropdown to choose one section at a time. | |
| You decide | Claude picks the filter mechanism. | |

**User's choice:** Clickable section chips
**Notes:** None

### Search match scope

| Option | Description | Selected |
|--------|-------------|----------|
| Field label + description + config path | Matches against label, description, and dotted config path. | ✓ |
| Field label only | Only matches the human-readable label. | |
| You decide | Claude decides what's searchable. | |

**User's choice:** Field label + description + config path
**Notes:** None

---

## Parameter Browsing

### Organization

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped by section with collapsible headers | Parameters under 4 section headers, each collapsible, with field count. | ✓ |
| Flat alphabetical list | All 137 fields in one sorted list. | |
| Card grid by section | Each section is a card containing its fields. | |

**User's choice:** Grouped by section with collapsible headers
**Notes:** None

### Pre-select display

| Option | Description | Selected |
|--------|-------------|----------|
| Label + current value + description | Field label, current value from configStore, description from FIELD_METADATA. | ✓ |
| Label + current value only | Compact — descriptions on hover/tooltip. | |
| Label only | Minimal — values shown after preset selection. | |

**User's choice:** Label + current value + description
**Notes:** None

### Post-select display

| Option | Description | Selected |
|--------|-------------|----------|
| Add preset value column + highlight differences | Gain "Preset Value" column, color-coded differences. Bridge to Phase 4. | ✓ |
| Replace current values with preset values | Show only preset values, current via toggle. | |
| You decide | Claude decides how to show delta. | |

**User's choice:** Add preset value column + highlight differences
**Notes:** None

### Empty state

| Option | Description | Selected |
|--------|-------------|----------|
| Show all parameters with current values | Always populated. Selecting a preset adds comparison column. Useful for browsing. | ✓ |
| Prompt to select a preset first | Empty message until preset chosen. | |

**User's choice:** Show all parameters with current values
**Notes:** None

---

## Claude's Discretion

- Exact accent colors per preset card
- Key metric indicator format on cards
- Collapsible section default state
- Search debounce timing and highlight behavior
- Store structure details

## Deferred Ideas

None — discussion stayed within phase scope
