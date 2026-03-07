# AmbonArcanum  — Final Implementation Plan

This is the agreed-upon plan for building the Creator app. It supersedes the brainstorming in CREATOR_PLAN.md where they differ.

---

## Core Concept

The Creator is the control plane for a local AmbonMUD installation. Point it at an AmbonMUD project directory and it becomes the single tool for configuring, running, and monitoring the server. It reads all world YAML and application.yaml, provides visual editors for everything, writes changes back, and manages the server process lifecycle.

### Scope

- Standalone mode only (no ENGINE/GATEWAY multi-instance)
- No embedded player client
- Local project directory only
- Creator is the sole editor (no file watching for external changes)
- New data formats only (dynamic `stats: StatMap`, `statMods: StatMap`, `engine.stats.bindings`)
- Room features (CONTAINER/LEVER/SIGN) deferred — world state system is under construction

---

## Tech Stack

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Desktop framework | Tauri v2 | tauri-plugin-fs, tauri-plugin-dialog, tauri-plugin-shell |
| Frontend | React 19, TypeScript 5.8+ | |
| Build | Vite 7, Bun | |
| State management | Zustand + slices | Avoids Context re-render issues at scale; supports middleware for undo |
| Undo/redo | zustand-temporal | Per-slice temporal middleware, max 100 history entries |
| Graph editor | React Flow | Room/exit map visualization |
| YAML parsing | `yaml` npm package (CST mode) | Format-preserving round-trip |
| Styling | Tailwind CSS | Fresh dark theme, fast form-heavy development |
| Testing | Vitest | Data layer only: YAML parsing, ID normalization, validation, stat formulas |

---

## Project Model

```typescript
interface Project {
  version: 1;
  name: string;
  mudDir: string;          // root of AmbonMUD project (contains gradlew, src/, etc.)
  openZones: string[];     // which zones are currently open as tabs
  lastOpenTab?: string;
}
```

All paths derived from `mudDir`:

| What | Path |
|------|------|
| World zones | `<mudDir>/src/main/resources/world/*.yaml` |
| Application config | `<mudDir>/src/main/resources/application.yaml` |
| Gradle wrapper | `<mudDir>/gradlew.bat` (Windows) / `<mudDir>/gradlew` (Unix) |
| Player saves | `<mudDir>/data/players/` |
| World mutations | `<mudDir>/data/world_mutations.yaml` |
| Login screen | `<mudDir>/src/main/resources/login.txt` |

On project open: validate the directory looks like an AmbonMUD checkout, then read all zone YAMLs + application.yaml into memory. With ~50 zones of a few hundred entities each, everything fits comfortably in memory.

---

## Data Model (TypeScript)

### Dynamic Stats

Stats are fully data-driven. The Creator builds all stat-related UI dynamically from config.

```typescript
// Stat definition from engine.stats.definitions
interface StatDefinition {
  id: string;           // "STR" — uppercase key
  displayName: string;  // "Strength"
  abbreviation: string; // "STR"
  description: string;  // tooltip text
  baseStat: number;     // default for new characters (typically 10)
}

// Stat bindings from engine.stats.bindings
interface StatBindings {
  meleeDamageStat: string;
  meleeDamageDivisor: number;
  dodgeStat: string;
  dodgePerPoint: number;
  maxDodgePercent: number;
  spellDamageStat: string;
  spellDamageDivisor: number;
  hpScalingStat: string;
  hpScalingDivisor: number;
  manaScalingStat: string;
  manaScalingDivisor: number;
  hpRegenStat: string;
  hpRegenMsPerPoint: number;
  manaRegenStat: string;
  manaRegenMsPerPoint: number;
  xpBonusStat: string;
  xpBonusPerPoint: number;
}

// Used everywhere stats appear (items, races, status effects)
type StatMap = Record<string, number>;
```

### World Content Types

Mirror the Kotlin DTOs from `world-yaml-dtos/`, using new formats only:

- **WorldFile** — zone, lifespan, startRoom, image, audio, rooms, mobs, items, shops, quests, gatheringNodes, recipes
- **RoomFile** — title, description, exits, station, image, video, music, ambient
- **ExitValue** — to (room ID string), optional door
- **MobFile** — name, room, tier, level, stat overrides, drops, behavior, dialogue, quests (list of quest IDs)
- **ItemFile** — displayName, description, keyword, slot, damage, armor, stats (StatMap), consumable, charges, onUse, room, matchByKey, basePrice, image, video
- **ShopFile** — name, room, items list
- **QuestFile** — name, description, giver (mob ID), completionType, objectives, rewards
- **BehaviorFile** — template + params
- **DialogueNodeFile** — text, choices with conditions and actions
- **GatheringNodeFile** — skill, yields, respawn, room
- **RecipeFile** — skill, materials, output, station

### Config Types (application.yaml)

The Creator owns the entire application.yaml. Structured editors for known sections; raw YAML key-value editor for unknown/unrecognized fields.

Known managed sections:
- `engine.stats.definitions` + `engine.stats.bindings` (Stat Designer)
- `engine.abilities.definitions` (Ability Editor)
- `engine.statusEffects.definitions` (Status Effect Editor — uses `statMods: StatMap`)
- `engine.combat` (Combat Config)
- `engine.mob.tiers` (Mob Tier Config)
- `engine.regen` (Regen Config)
- `engine.economy` (Economy Config)
- `engine.crafting` (Crafting Config)
- `engine.group` (Group Config)
- `engine.classes.definitions` (Class Designer)
- `engine.races.definitions` (Race Designer)
- `progression` (Progression Config)
- `server` (Server Config — ports, tick rate)
- `login` (Login Config)

Unknown fields: displayed in a generic YAML property editor (key-value table with type inference) so nothing is hidden or lost.

---

## Zustand Store Architecture

Separate slices to avoid re-render cascading:

```
stores/
  projectStore.ts     — project metadata, mudDir, open tabs
  zoneStore.ts        — all loaded zones (Map<zoneId, ZoneState>), per-zone dirty flags
  configStore.ts      — parsed application.yaml state, dirty flag
  serverStore.ts      — process state, logs, status (stopped/starting/running/stopping/error)
  validationStore.ts  — computed validation errors (derived from zone + config state)
  uiStore.ts          — sidebar state, selected entities, panel sizes
```

Each store with zone/config data gets zustand-temporal middleware for undo/redo (max 100 entries). Undo is scoped per-store, not global — undoing a zone change doesn't undo a config change.

---

## App Layout

```
AppShell
  Toolbar (save, start/stop/restart, validate, undo/redo, server status badge)
  Sidebar (zone tree navigator, entity lists per zone)
  TabBar (open zone/config/console tabs)
  MainArea
    ZoneEditor (when zone tab active)
      MapCanvas (React Flow graph)
        RoomNode (custom node — title, mob/item count badges, shop/station icons)
        ExitEdge (custom edge — direction label, door icon, cross-zone color)
      PropertyPanel (right side, contextual)
        RoomPanel / MobEditor / ItemEditor / ShopEditor / QuestEditor
    ConfigEditor (when config tab active)
      Tabbed sub-navigation for each managed section
      StatDesigner / AbilityEditor / StatusEffectEditor / CombatConfig / etc.
      RawYamlEditor (for unknown fields)
    ClassDesigner (when classes tab active)
    RaceDesigner (when races tab active)
    Console (when console tab active)
      LogStream (filterable, searchable, auto-scroll, persists across tab switches)
  StatusBar (validation error count, dirty indicator, server state)
```

---

## Key Editor Details

### Zone/Room Map (React Flow)

- Rooms as custom nodes with title, badge counts, icons
- Exits as custom edges with direction labels and door indicators
- Auto-layout via dagre (N=up, S=down, E=right, W=left); positions saved to `.creator-layout.json` per zone
- Double-click node: open room property panel
- Drag between nodes: create exit (direction inferred from relative position)
- Click canvas: create new room
- Right-click: context menu (delete, duplicate, add mob/item/shop)
- Cross-zone exits: distinct color + tooltip showing target zone:room. Click navigates to that zone (opens in new tab if not already open)

### Mob Editor

- Tier selector with computed stats preview (HP/damage/armor/XP/gold from tier formulas)
- Override toggles for each computed field
- Drop editor: repeating rows with item ID dropdown + chance slider (0-100%)
- Behavior selector: template dropdown, conditional param fields (patrol route room picker, flee HP%, aggro/flee messages)
- Quest assignment: multi-select from zone's quest list (bidirectional — also editable from quest side)

### Item Editor

- Slot selector (HEAD/BODY/HAND or none)
- Dynamic stat bonus inputs: renders one +/- input per defined stat, only serializes non-zero values
- Damage/armor fields
- Consumable toggle, charges, onUse (healHp/grantXp)
- basePrice with computed buy/sell preview using economy multipliers
- Room placement picker (dropdown of rooms in zone, or unplaced)

### Quest Editor

- Name, description, giver (mob ID dropdown — bidirectional with mob's quest list)
- Completion type: AUTO / NPC_TURN_IN
- Objectives: repeating rows with type (KILL/COLLECT), targetKey (mob/item ID dropdown), count
- Rewards: XP, gold

### Dialogue Editor

- Collapsible tree/outline view (not a graph — dialogue is hierarchical branching, not arbitrary connections)
- Each node: text field, list of choices
- Each choice: text, next node reference, optional minLevel, requiredClass, action
- Inline editing with add/remove/reorder

### Stat Designer (Config)

- Stat list: reorderable table (order = display order everywhere). Columns: abbreviation, display name, base value, description
- Stat editor form: ID (auto-uppercase, immutable after creation), displayName, abbreviation, description, baseStat
- Delete with validation (cannot delete stats referenced by bindings, race mods, items, status effects)
- Formula Binding Editor: table of mechanics, each with stat dropdown + divisor/scale input + human-readable preview

### Ability / Status Effect Editors (Config)

- Searchable/filterable grid with detail form
- Ability: displayName, description, manaCost, cooldown, levelRequired, targetType, effect (type-dependent fields), requiredClass dropdown, image
- Status effect: displayName, effectType (DOT/HOT/STAT_BUFF/STAT_DEBUFF/STUN/ROOT/SHIELD), duration, tick interval, tick values, shield amount, max stacks, statMods (dynamic StatMap inputs for STAT_BUFF/STAT_DEBUFF)

### Class / Race Designers (Config)

- Class: ID, displayName, description, hpPerLevel, manaPerLevel, primaryStat (stat dropdown), selectable toggle, startRoom (room picker). HP/Mana curve graph for levels 1-50.
- Race: ID, displayName, description, statMods (dynamic +/- steppers for all defined stats, only non-zero serialized). Net-zero indicator. Effective base stats preview.

### Raw YAML Fallback

For any application.yaml fields not covered by a structured editor, display a key-value property table. Users can view and edit values as strings/numbers/booleans. This ensures no config is hidden or silently dropped.

---

## YAML Round-Trip Strategy

1. Use `yaml` package CST mode to preserve comments, key ordering, and formatting
2. Zone files: read as CST, edit in UI, patch back using CST for existing files, clean serialization for new files
3. application.yaml: read full file as CST, patch managed sections, preserve everything else untouched
4. Key ordering convention for zone YAML: zone, lifespan, startRoom, image, audio, rooms, mobs, items, shops, quests, gatheringNodes, recipes
5. Block scalars for multi-line descriptions; flow style for simple inline objects
6. Only write non-zero stat values in StatMap fields

---

## Validation Engine

Client-side validation, debounced 300ms on change. Errors shown inline + summarized in status bar.

### Zone-level

- Zone name non-blank
- startRoom exists in rooms
- No duplicate IDs within zone
- All exit targets resolve (within zone or cross-zone)
- Direction strings valid (n/s/e/w/u/d)
- All mob/item/shop/quest room refs resolve
- All drop itemIds resolve
- Mob quests list references valid quest IDs in same zone
- Quest giver references valid mob ID in same zone
- Behavior templates valid; patrol routes reference valid rooms
- Gathering node skill must be MINING/HERBALISM; recipe skill must be SMITHING/ALCHEMY
- All gathering node/recipe item refs resolve
- Room/recipe station values valid (FORGE/ALCHEMY_TABLE/WORKBENCH)

### Cross-zone

- All cross-zone exit targets resolve to rooms in loaded zones
- No duplicate normalized IDs across zones (rooms, mobs, items)
- Lifespan consistency for split zones

### Config-level

- Stat IDs unique, uppercase alphanumeric 2-6 chars, baseStat > 0
- All binding stat refs point to defined stats; divisors > 0
- Ability requiredClass references a defined class
- Ability statusEffectId references a defined status effect
- Status effect statMods keys reference defined stats
- Race statMods keys reference defined stats
- Class primaryStat references a defined stat
- Class startRooms reference valid rooms
- Numeric ranges valid throughout

---

## Server Management

### Process Lifecycle

- Start: `gradlew run` / `gradlew.bat run` as child process via tauri-plugin-shell
- Stop: SIGINT/SIGTERM, force-kill after timeout
- Restart: stop then start
- Save & Reload: write changed files, restart

### Pre-flight Checks

- Java 21+ on PATH or JAVA_HOME
- gradlew exists and is executable
- Configured ports (default 4000/8080) are not in use

### Log Streaming

- Capture stdout/stderr, display in Console panel
- Auto-scroll with pause-on-scroll
- Filter by log level (DEBUG/INFO/WARN/ERROR)
- Text search
- Highlight world-loading errors
- Persists across tab switches

### Status Indicator

Toolbar badge: Stopped (gray) | Starting (yellow/spinner) | Running (green) | Stopping (yellow/spinner) | Error (red)

---

## Testing Strategy

Vitest on the data layer. No UI/integration tests initially. Priority:

1. **YAML round-trip**: parse all example zone files, serialize back, diff (should be minimal/zero)
2. **ID normalization**: unit tests matching WorldLoader behavior
3. **Validation rules**: import example zones, verify zero errors; import intentionally broken zones, verify correct errors
4. **Stat formula calculations**: unit tests for all game formulas (melee damage, dodge, HP scaling, etc.)
5. **Config parsing**: parse example application.yaml, verify typed state matches expected values

---

## Implementation Phases

### Phase 1: Project Shell + Server Management

1. Initialize Tauri v2 project (React 19, TS, Vite 7, Bun, Tailwind)
2. Zustand store skeleton (project, server, UI stores)
3. Project open flow: directory picker, validate AmbonMUD checkout, derive paths
4. Layout shell: toolbar, sidebar, tab bar, main area, status bar
5. Read all zone YAMLs + application.yaml into typed state on project open
6. Server process management: start/stop/restart via gradlew
7. Console tab with log streaming, filtering, search
8. Server status indicator in toolbar
9. Pre-flight checks (Java, ports)
10. Vitest setup + YAML round-trip tests on example zones

### Phase 2: Zone Map Editor

1. React Flow integration: RoomNode, ExitEdge custom components
2. Dagre auto-layout from exit topology
3. Room property panel (title, description, exits, station, image, music, ambient)
4. Create/delete rooms via canvas interactions
5. Create/delete exits via drag between nodes
6. Cross-zone exit visualization (color + tooltip + click-to-navigate)
7. YAML export: serialize zones back to files (CST-preserving)
8. Undo/redo via zustand-temporal
9. Save & Reload workflow
10. Layout position persistence (.creator-layout.json)

### Phase 3: Entity Editors

1. Mob editor: tier preview, stat overrides, drops, behavior, quest assignment
2. Dialogue tree editor: collapsible outline with inline editing
3. Item editor: slot, dynamic stat bonuses, consumable/charges/onUse, basePrice
4. Shop editor: name, room, item picker with search
5. Quest editor: name, giver (bidirectional), objectives, rewards, completionType
6. Gathering node editor: skill, yields, respawn, room
7. Recipe editor: skill, materials, output, station
8. Zone-level validation (wired to status bar)

### Phase 4: Config Editor

1. Parse application.yaml into typed config store
2. Tabbed config UI shell
3. Stat Designer: stat list + editor + formula binding editor
4. Ability list + detail form (filterable, ~100 abilities)
5. Status effect list + detail form (dynamic statMods)
6. Combat, mob tier, progression, economy, regen, crafting, group panels
7. Server + login config panels
8. Raw YAML fallback editor for unknown fields
9. Config validation
10. CST-preserving application.yaml write-back

### Phase 5: Class/Race Designer

1. Class list with search
2. Class editor: ID, displayName, description, hpPerLevel, manaPerLevel, primaryStat, selectable, startRoom
3. HP/Mana curve graph (levels 1-50)
4. Race list with search
5. Race editor: ID, displayName, description, dynamic statMods with +/- steppers
6. Net-zero indicator, effective base stats preview
7. Cross-references: ability requiredClass, class start rooms, class primaryStat

### Phase 6: Polish

1. YAML preview panel (toggle raw YAML alongside forms)
2. Diff view before save
3. Global search across zones
4. Bulk rename / refactor IDs across references
5. Keyboard shortcuts
6. Window state persistence (size, position, panel sizes, last project)

---

## Key Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| YAML round-trip loses comments/formatting | CST mode; round-trip tests on all example zones from Phase 1 |
| React Flow performance on large zones | Built-in virtualization; test early with 200+ nodes |
| application.yaml partial patching corrupts unmanaged sections | CST-level patching; backup before write |
| Type drift between server and Creator | Vitest round-trip + validation tests catch drift early |
| Child process edge cases (zombies, port conflicts) | PID tracking, timeout force-kill, port check before start |
| Platform differences (Windows/Mac/Linux) | Tauri abstracts most; test gradlew.bat vs gradlew |
| Server-side spec changes during development | Reference docs in this repo updated as specs land; Creator targets new formats only |
