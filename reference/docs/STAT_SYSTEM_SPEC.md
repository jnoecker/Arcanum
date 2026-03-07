# AmbonMUD Stat System — Creator Reference

This document describes how the data-driven stat system will work after the refactor. The Creator tool should be built against this spec.

---

## Overview

Stats are fully defined in YAML config. The default set is the classic 6 (STR, DEX, CON, INT, WIS, CHA) but creators can add, remove, or modify stats. Formula bindings connect stats to game mechanics (melee damage, dodge, HP scaling, etc.) so changing which stat powers which mechanic is pure config.

---

## Config Schema

Stats live under `engine.stats` in `application.yaml`:

```yaml
engine:
  stats:
    definitions:
      STR:
        displayName: "Strength"
        abbreviation: "STR"
        description: "Physical power. Increases melee damage."
        baseStat: 10
      DEX:
        displayName: "Dexterity"
        abbreviation: "DEX"
        description: "Agility and reflexes. Increases dodge chance."
        baseStat: 10
      CON:
        displayName: "Constitution"
        abbreviation: "CON"
        description: "Endurance and health. Increases max HP and HP regen."
        baseStat: 10
      INT:
        displayName: "Intelligence"
        abbreviation: "INT"
        description: "Arcane aptitude. Increases max mana and spell damage."
        baseStat: 10
      WIS:
        displayName: "Wisdom"
        abbreviation: "WIS"
        description: "Insight and perception. Increases mana regen."
        baseStat: 10
      CHA:
        displayName: "Charisma"
        abbreviation: "CHA"
        description: "Force of personality. Increases XP gain."
        baseStat: 10

    bindings:
      meleeDamageStat: "STR"
      meleeDamageDivisor: 3
      dodgeStat: "DEX"
      dodgePerPoint: 2
      maxDodgePercent: 30
      spellDamageStat: "INT"
      spellDamageDivisor: 3
      hpScalingStat: "CON"
      hpScalingDivisor: 5
      manaScalingStat: "INT"
      manaScalingDivisor: 5
      hpRegenStat: "CON"
      hpRegenMsPerPoint: 200
      manaRegenStat: "WIS"
      manaRegenMsPerPoint: 200
      xpBonusStat: "CHA"
      xpBonusPerPoint: 0.005
```

---

## TypeScript Types

### Stat Definition

```typescript
interface StatDefinition {
  id: string;           // "STR" — uppercase key, matches the YAML map key
  displayName: string;  // "Strength"
  abbreviation: string; // "STR" — used in compact displays
  description: string;  // tooltip / help text
  baseStat: number;     // default value for new characters (typically 10)
}
```

### Stat Bindings

```typescript
interface StatBindings {
  // Melee combat
  meleeDamageStat: string;     // stat ID (e.g. "STR")
  meleeDamageDivisor: number;  // damage bonus = (stat - baseStat) / divisor

  // Dodge
  dodgeStat: string;           // stat ID (e.g. "DEX")
  dodgePerPoint: number;       // dodge% per point above baseStat
  maxDodgePercent: number;     // cap on dodge chance

  // Spell damage
  spellDamageStat: string;     // stat ID (e.g. "INT")
  spellDamageDivisor: number;

  // HP scaling (per level)
  hpScalingStat: string;       // stat ID (e.g. "CON")
  hpScalingDivisor: number;    // HP bonus per level = (stat - baseStat) / divisor

  // Mana scaling (per level)
  manaScalingStat: string;     // stat ID (e.g. "INT")
  manaScalingDivisor: number;

  // HP regeneration
  hpRegenStat: string;         // stat ID (e.g. "CON")
  hpRegenMsPerPoint: number;   // ms reduction in regen interval per point above baseStat

  // Mana regeneration
  manaRegenStat: string;       // stat ID (e.g. "WIS")
  manaRegenMsPerPoint: number;

  // XP bonus
  xpBonusStat: string;         // stat ID (e.g. "CHA")
  xpBonusPerPoint: number;     // multiplier per point above baseStat (0.005 = 0.5%)
}
```

### Stat Map (used everywhere stats appear)

Stats are represented as `Record<string, number>` — a map from stat ID to value:

```typescript
type StatMap = Record<string, number>;  // e.g. { "STR": 11, "DEX": 10, "LCK": 7 }
```

This is used in:
- Race stat mods: `statMods: StatMap`
- Item bonuses: `stats: StatMap`
- Status effect mods: `statMods: StatMap`
- Player base stats: `stats: StatMap`
- Player effective stats: `effectiveStats: StatMap`

---

## Where Stats Appear in Content

### Race Definitions

```yaml
engine:
  races:
    definitions:
      HUMAN:
        displayName: "Human"
        statMods:
          STR: 1
          CHA: 1
      ELF:
        displayName: "Elf"
        statMods:
          STR: -1
          DEX: 2
          CON: -2
          INT: 1
```

Only non-zero mods need to be listed. The Creator should show all defined stats with +/- steppers, but only write non-zero values to YAML.

### Item Definitions (in zone YAML)

```yaml
items:
  iron_helm:
    displayName: "Iron Helm"
    slot: HEAD
    armor: 3
    stats:
      CON: 2
      STR: 1
```

Only stats with non-zero bonuses are listed. The Creator's item editor should show all defined stats but only serialize non-zero values.

### Status Effect Definitions

```yaml
engine:
  statusEffects:
    definitions:
      BLESS:
        name: "Bless"
        type: STAT_BUFF
        durationMs: 60000
        statMods:
          STR: 3
          CON: 2
```

### Class Definitions

Classes don't directly modify stats, but `primaryStat` is a hint for UI display:

```yaml
engine:
  classes:
    definitions:
      WARRIOR:
        displayName: "Warrior"
        primaryStat: "STR"
```

---

## Game Formulas

These formulas show how stats connect to gameplay. The Creator should display these relationships and let users configure the bindings + divisors.

### Melee Damage Bonus
```
bonus = floor((effective[meleeDamageStat] - baseStat) / meleeDamageDivisor)
```
Default: `floor((STR - 10) / 3)` → STR 13 = +1 damage, STR 16 = +2

### Dodge Chance
```
dodge% = (effective[dodgeStat] - baseStat) * dodgePerPoint
capped at maxDodgePercent
```
Default: `(DEX - 10) * 2`, max 30% → DEX 15 = 10% dodge

### Spell Damage Bonus
```
bonus = floor((effective[spellDamageStat] - baseStat) / spellDamageDivisor)
```
Default: `floor((INT - 10) / 3)`

### Max HP Per Level
```
baseHP = 10
perLevel = class.hpPerLevel  (e.g. Warrior=8, Mage=4)
statBonus = floor((effective[hpScalingStat] - baseStat) / hpScalingDivisor) * levelsGained
maxHP = baseHP + (level - 1) * perLevel + statBonus
```

### Max Mana Per Level
```
baseMana = 20
perLevel = class.manaPerLevel  (e.g. Warrior=4, Mage=16)
statBonus = floor((effective[manaScalingStat] - baseStat) / manaScalingDivisor) * levelsGained
maxMana = baseMana + (level - 1) * perLevel + statBonus
```

### HP Regen Interval
```
baseInterval = engine.regen.hp.baseIntervalMs  (default 5000ms)
minInterval = engine.regen.hp.minIntervalMs    (default 1000ms)
bonus = (effective[hpRegenStat] - baseStat) * hpRegenMsPerPoint
interval = max(baseInterval - bonus, minInterval)
```

### Mana Regen Interval
```
baseInterval = engine.regen.mana.baseIntervalMs  (default 8000ms)
minInterval = engine.regen.mana.minIntervalMs    (default 2000ms)
bonus = (effective[manaRegenStat] - baseStat) * manaRegenMsPerPoint
interval = max(baseInterval - bonus, minInterval)
```

### XP Bonus
```
bonusMultiplier = 1.0 + max(0, effective[xpBonusStat] - baseStat) * xpBonusPerPoint
adjustedXP = floor(baseXP * bonusMultiplier)
```
Default: CHA 12 = +1% XP, CHA 20 = +5% XP

### Effective Stat Calculation
```
effective[stat] = base[stat] + equipmentBonus[stat] + statusEffectMod[stat]
```

Where:
- `base` = player's base stat (set at creation from race mods + baseStat default)
- `equipmentBonus` = sum of all equipped items' stat bonuses
- `statusEffectMod` = sum of all active STAT_BUFF/STAT_DEBUFF effects

---

## GMCP Protocol

The server sends stat data to the web client via the `Char.Stats` GMCP package:

```json
{
  "stats": [
    {
      "id": "STR",
      "name": "Strength",
      "abbrev": "STR",
      "base": 11,
      "effective": 14
    },
    {
      "id": "DEX",
      "name": "Dexterity",
      "abbrev": "DEX",
      "base": 10,
      "effective": 12
    },
    {
      "id": "LCK",
      "name": "Luck",
      "abbrev": "LCK",
      "base": 5,
      "effective": 7
    }
  ]
}
```

Stats are sent as an ordered array (matching definition order in config). The web client renders them dynamically — it does not assume which stats exist.

---

## Creator UI Components

### Stat Designer

Located in the config editor, alongside abilities, status effects, etc.

**Stat list:** Table or card view of all defined stats. Columns: abbreviation, display name, base value, description. Drag to reorder (order is significant — it controls display order everywhere).

**Stat editor form:**
- ID (auto-uppercase, immutable after creation — used as map key everywhere)
- Display name (free text)
- Abbreviation (short, for compact displays like score command)
- Description (for tooltips and help text)
- Base stat value (default for new characters, typically 10)
- Delete button (with validation — cannot delete a stat that's referenced by a binding, race mod, item, or status effect)

### Formula Binding Editor

A panel that shows each game mechanic and lets the user assign a stat + configure the divisor/scaling:

| Mechanic | Stat | Divisor/Scale | Preview |
|----------|------|---------------|---------|
| Melee Damage | [STR v] | 3 | "+1 per 3 STR above 10" |
| Dodge Chance | [DEX v] | 2%/pt, max 30% | "+2% per DEX above 10" |
| Spell Damage | [INT v] | 3 | "+1 per 3 INT above 10" |
| HP Scaling | [CON v] | /5 per level | "+1 HP/level per 5 CON above 10" |
| Mana Scaling | [INT v] | /5 per level | "+1 Mana/level per 5 INT above 10" |
| HP Regen | [CON v] | 200ms/pt | "-200ms regen interval per CON above 10" |
| Mana Regen | [WIS v] | 200ms/pt | "-200ms regen interval per WIS above 10" |
| XP Bonus | [CHA v] | 0.5%/pt | "+0.5% XP per CHA above 10" |

Each stat dropdown lists all defined stats. The preview column shows a human-readable description of the effect.

### Stat References in Other Editors

**Race editor:** stat mods section shows all defined stats with +/- steppers. Only non-zero values serialized.

**Item editor:** stats section shows all defined stats with +/- inputs. Only non-zero values serialized.

**Status effect editor:** for STAT_BUFF/STAT_DEBUFF types, show stat mod inputs for all defined stats.

**Class editor:** `primaryStat` dropdown lists all defined stats. This is a UI hint only (shown in class selection, score display).

---

## Validation Rules

The Creator must enforce these constraints:

1. **Stat ID uniqueness** — no duplicate stat IDs
2. **Stat ID format** — uppercase alphanumeric, 2-6 chars (matches existing conventions)
3. **Base stat > 0** — must be positive
4. **Binding stat exists** — every stat referenced in a binding must be a defined stat
5. **Cannot delete referenced stat** — if a stat ID appears in any binding, race mod, item bonus, or status effect, it cannot be deleted without first removing those references
6. **Divisors > 0** — all divisor values in bindings must be positive
7. **Max dodge percent 0-100** — dodge cap must be a valid percentage
8. **XP bonus per point >= 0** — cannot be negative

---

## Migration Notes

### Existing zone YAML files

Old format (named fields):
```yaml
items:
  iron_helm:
    constitution: 2
    strength: 1
```

New format (stats map):
```yaml
items:
  iron_helm:
    stats:
      CON: 2
      STR: 1
```

The server reads both formats. When the Creator saves a zone file, it writes the new format. This means:
- Existing zones work without modification
- Once opened and saved in the Creator, zones use the new format
- Round-trip preserves stat values

### Existing player saves

Player saves will be auto-migrated on next login:
- Old format: individual `strength: 11`, `dexterity: 10`, etc.
- New format: `stats: { STR: 11, DEX: 10, ... }`
- Custom stats get the baseStat default on first login

### Adding a new stat to an existing game

When a creator adds a new stat (e.g. LUCK):
1. Define it in `engine.stats.definitions` with a `baseStat` value
2. Existing players receive `baseStat` as their base value on next login
3. Add it to race mods, items, and status effects as desired
4. Optionally bind it to a formula (or leave it unbound — it still exists as a moddable attribute)

### Removing a stat

When a creator removes a stat:
1. First remove all references (bindings, race mods, items, status effects)
2. Delete the definition
3. Existing player saves retain the old value but it has no effect
4. On next save, the orphaned stat value is dropped
