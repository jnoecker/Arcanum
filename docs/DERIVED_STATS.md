# Derived Stats — Authoring Design

> **Status (mostly shipped).** The core of this plan is implemented. The rest
> of this document is the original design rationale, kept because the budget
> math and calibration targets are still the reference. What actually shipped,
> and where it diverged from the first draft below:
>
> - **Item authoring** — implemented as `tier` + `archetype` +
>   `primaryStat`/`secondaryStat`/`tertiaryStat` (the "Item authoring shape"
>   section), **not** the `rarity` + `role` taxonomy floated later in "Item
>   authoring — proposed shape". Derivation lives in
>   `creator/src/lib/tuning/itemBudget.ts` (`deriveItemStats`), wired into the
>   item editor; tertiary slot is skippable (60/40). `ItemFile` carries
>   `level`, `tier`, `archetype`, and the three stat slots
>   (`creator/src/types/world.ts`).
> - **Mob authoring** — implemented as a single `toughness` dial
>   (`-2…+2` → `hpMult`/`dmgMult`/`xpMult`/`goldMult`) in
>   `creator/src/lib/mobToughness.ts`, with the four raw mults behind a
>   power-user disclosure.
> - **Level scaling** — switched to multiplicative; see
>   [`MULTIPLICATIVE_SCALING_SPEC.md`](MULTIPLICATIVE_SCALING_SPEC.md)
>   (shipped server-side).
> - **Server contract** — AmbonMUD round-trips the new item metadata fields as
>   opaque data (`ItemFile.kt`). **Pending:** the mob `hpMult/dmgMult/xpMult/
>   goldMult` fields are written by Arcanum but not yet added to the server's
>   `MobFile` — harmless until the server consumes them.
>
> Treat the calibration tables and budget formula below as authoritative;
> treat the "proposed shape" / "open questions" sections as historical.

Arcanum is an authoring tool. AmbonMUD is a game server. The two have opposite
shapes:

- **Server** validates: "you wrote `damage: 4` on a level-1 common item — that's
  over budget, here's a warning."
- **Arcanum** derives: "you said `slot: weapon, level: 5, rarity: rare,
  role: damage-focused` — I'll write `damage: 5, stats: { STR: 1 }` for you."

[PR #243](https://github.com/jnoecker/Arcanum/pull/243) (closed) mirrored the
server's validator shape, which added knobs without removing any. This doc is
the replacement plan: builders pick *intent*, Arcanum writes *numbers*.

## Calibration Reference + Progression Targets

Numbers in the existing world were "squished" — random low integers with no
shared scale. The targets below are the anchor every formula in this doc must
land within (±20%). They're partially borrowed from Aardwolf magnitudes, but
the *game shape* (30 levels, 10 hours, 12 equipment slots, stat cap 100) is
ours.

### Game shape

| Parameter | Value |
|---|---|
| Max level | 30 |
| Target playtime to max | ~10 hours |
| Level pacing | ~4/hr early → ~3/hr mid → ~1–2/hr late |
| Stat cap (any single stat) | 100 |
| Equipment slots | ~12 |

### L1 magnitudes (the un-squish)

| Resource | Range | Notes |
|---|---|---|
| HP | 120–180 | Warrior ~160, Mage ~110, Cleric ~140 |
| Mana | 80–180 | Mage ~180, Warrior ~80, Cleric ~150 |
| Moves | 500–700 | Mostly class-flat |
| Base stat range | 12–18 | Primary ~17, racial-favored ~16, others 12–14 |

### Aardwolf L1 anchor (real combat sample)

Level 1 Tigran Warrior, starter gear: HP 160, MN 150, MV 625; STR 26/19,
DEX 19/18, CON 16/16.

- Sword swing: ~30 dmg (Damroll 28)
- Punch (no weapon): 6–10 dmg — **weapon is ~3–5×** barehanded
- Trivial mob ("farm hand"): ~36 HP, ~220 XP/kill
- Tiny mob ("weed"): ~18 HP, 164 XP
- Same-level "standard" mob target: ~150 HP (5 trivial-equivalents)
- L1→L2: +13 HP, +15 MN, +15 MV, +3 trains, +4 practices, +1 skill

### Per-level progression

| Knob | Formula / target |
|---|---|
| XP per level `xpToNext(n)` | `XP_L1 × 1.5^(n-1)` |
| XP per kill | grows ~1.4×/level (slightly less than XP/level, so time/level rises modestly) |
| Combat scaling rate `r` | **1.1×/level** on player HP/damage and mob HP/damage |
| Stat gain per level | 3 trains, allocated by player |
| Practices per level | 4 |
| Skills unlocked | ~1 every 1–2 levels |

The 1.1× rate is the "fights stay the same shape but with bigger numbers"
choice: a same-level standard mob takes ~4–5 rounds to kill at every level.
Over 30 levels: `1.1^29 ≈ 15×` growth, which is the scaling budget for HP,
damage, and item budgets.

### Stat trajectory (cap 100)

Endgame target: primary maxed, 1–2 secondaries high, tertiaries mid.

| Tier | L1 | L30 | Per-level (avg) |
|---|---|---|---|
| Primary | 17 | 100 | +~3 |
| Secondary (1–2) | 15 | ~75 | +~2 |
| Tertiary (3) | 13 | ~50 | +~1 |

Totals to roughly +9 distributable points across 6 stats per level — covered
by 3 trains spent on allocation, plus gear stat bonuses, plus minor automatic
class growth.

### Derived ceilings (from `1.1×/level` scaling)

| Quantity | L1 | L30 |
|---|---|---|
| Warrior HP | 160 | ~2,400 |
| Mage HP | 110 | ~1,650 |
| Cleric HP | 140 | ~2,100 |
| Trivial mob HP | 36 | ~540 |
| Standard mob HP (same level) | ~150 | ~2,250 |
| Weapon damage / swing | ~30 | ~450 |

### Zone difficulty layering

Best-practice composition for a difficulty ramp. Becomes a soft validator
("zone is targeted at level 7; X% of mobs match, Y% are over") rather than
a hard rule.

| Zone role | Composition |
|---|---|
| Anchor zone for level N | 100% level N |
| Bridge zone N → N+1 | ~75% N, 25% N+1 |
| Bridge zone N+1 (back-side) | ~75% N+1, 25% N |
| Anchor zone for level N+1 | 100% level N+1 |

Authors can intentionally place over-level mobs as boss spikes — surfacing
them as warnings (not errors) keeps the bespoke flow alive.

### Item authoring shape

Author touches:

| Field | Values |
|---|---|
| `slot` | weapon / body / head / etc. (existing) |
| `level` | 1–30 |
| `tier` | Trash / Common / Uncommon / Rare / Epic / Legendary |
| `archetype` | Damage / Armor / Balanced / Stat (forced to Stat for accessories) |
| `primaryStat` | STR / INT / WIS / DEX / CON / LUCK |
| `secondaryStat?` | same set |
| `tertiaryStat?` | same set |

Arcanum derives `damage`, `armor`, `stats: { ... }`. Each derived field is
editable as an explicit override.

**Budget formula:**

```
totalBudget = slotBase[slot] × 1.1^(level-1) × tierMult[tier]
```

**Slot base budgets** (L1 common): `weapon 100, body 100, shield 70, legs 70,
arms 70, head 50, feet 50, hands 50, back 50, waist 50, ring 40, neck 40,
wrist 40, light/held/floating 30`.

**Tier multipliers** (Legendary = Common at +5 levels):

| Tier | Multiplier | Common-equivalent level |
|---|---|---|
| Trash | 0.83 | −2 |
| Common | 1.00 | 0 |
| Uncommon | 1.13 | +1.25 |
| Rare | 1.27 | +2.5 |
| Epic | 1.43 | +3.75 |
| Legendary | 1.61 | +5 |

**Archetype split** (of `totalBudget`):

| Archetype | Damage | Armor | Stats |
|---|---|---|---|
| Damage | 60% | 0% | 40% |
| Armor | 0% | 60% | 40% |
| Balanced | 30% | 30% | 40% |
| Stat (accessories) | 0% | 0% | 100% |

**Point costs** (tunable in playtest): `damagePointCost: 20, armorPointCost: 10,
statPointCost: 5`.

**Stat distribution** within stat-budget:
- 1 stat → 100% primary
- 2 stats → 60% primary / 40% secondary
- 3 stats → 50% primary / 30% secondary / 20% tertiary

### Mob authoring shape

Author touches: `tier` (trivial/weak/standard/elite/boss), `level`, and one
**toughness** dial (−2 / −1 / 0 / +1 / +2 — maps to ~0.6× / 0.8× / 1.0× /
1.25× / 1.6× on `hpMult` and `dmgMult`). XP and gold mults track combat
toughness 1:1 by default.

Hidden behind disclosure: the four individual `hpMult/dmgMult/xpMult/goldMult`
fields, and the existing Stat Overrides section for bespoke bosses.

The editor's primary readout is the resolved stat line ("HP 540 · DMG 45–55 ·
XP 1200 · GOLD 80–110") at the top of the editor, not buried in placeholders.

### Server-side touchpoints (AmbonMUD)

Only required change: accept and round-trip the new optional item fields
(`level`, `tier`, `archetype`, `primaryStat`, `secondaryStat`, `tertiaryStat`)
without rejecting them. Validation stays Arcanum-side; the server treats them
as opaque metadata. Mob `toughness` is purely Arcanum-side — it writes the
existing `hpMult/dmgMult/xpMult/goldMult` fields the server already supports
from PR #243's equivalent server work.

### Gaps to fill via playtesting

- Class baselines for non-Warrior classes (HP/MN/MV at L1, growth shape)
- Same-level standard-mob fight at L5, L15, L25 to validate the 1.1× rate
- Item budget defaults — `statPointCost` was clearly wrong in PR #243; re-tune
  once a hand-curated L5 / L15 reference item set exists
- Practice / skill curve (Aardwolf gives 4 practices + 1 skill per level — is
  that our shape or do we want a denser ability tree?)

## Goals

1. The author never has to compute `damage`, `armor`, or per-stat values for a
   normal item. They pick slot, level, rarity, and role; Arcanum fills the rest.
2. The author never has to compute `hp`, `minDamage`, etc. for a normal mob.
   They pick tier, level, and a single "toughness" knob; Arcanum shows the
   resulting numbers and writes the YAML.
3. The server contract is unchanged. YAML still carries raw `damage`, `hp`, etc.
   The server-side validator quietly becomes a regression test for the derivation
   (over-budget output = Arcanum bug, not a builder gotcha).
4. Explicit overrides remain available for bespoke / boss / scripted content.
   "Power user" knobs sit behind a disclosure, not in the default flow.

## Item authoring — proposed shape

### Inputs the author touches

| Field | What it means |
|-------|---------------|
| `slot` | Already authored. Drives base budget. |
| `level` | What level player this is intended for. |
| `rarity` | `common` → `legendary`. Scales the magnitude of every derived stat. |
| `role` | Distribution profile (see below). What kind of item is this? |
| `name`, `description`, `image` | Already authored. |

### Role profiles (proposed)

A role is a fixed budget-distribution recipe. Starting set:

| Role | Distribution (of budget points) | Notes |
|---|---|---|
| `weapon_striker` | 100% damage | Pure DPS weapon. |
| `weapon_balanced` | 70% damage, 30% scaling stat | Damage + a primary stat. |
| `weapon_caster` | 60% damage, 40% INT/WIS | Magic implement. |
| `armor_heavy` | 80% armor, 20% CON | Tanky body / shield. |
| `armor_balanced` | 60% armor, 40% mixed stats | Default body piece. |
| `armor_light` | 40% armor, 60% DEX/AGI | Rogue-style. |
| `stat_stick` | 0% damage/armor, 100% stats | Rings, necks, trinkets. |
| `utility` | Special case (charges, on-use) | Skips derivation. |

Open: how many roles? Six to eight feels right — enough to express common
patterns without becoming a taxonomy quiz. Roles are slot-aware (a ring can't
pick `weapon_striker`).

### What gets written to YAML

The author touches `slot` / `level` / `rarity` / `role`. Arcanum writes:

```yaml
items:
  iron_sword:
    displayName: iron sword
    slot: weapon
    level: 5
    rarity: rare
    role: weapon_striker      # Arcanum-only field (stripped on MUD export?)
    damage: 5                 # derived
    image: ...
```

Open: does `role` ship to the server (additive, ignored if unknown), or stay
Arcanum-side only and get stripped on save? Cheapest path is to ship it —
future server features (e.g. dynamic loot) might want it.

### Tweak / override flow

After picking role, the author sees the computed numbers as **non-disabled
inputs** that they *can* edit. The moment they edit one, that field becomes
an explicit override (visually distinct — a small "overridden" pip, same
pattern as the existing mob Stat Overrides section). A "reset" button on each
field clears the override.

This keeps the bespoke-boss flow alive without making it the default.

## Mob authoring — proposed shape

The mob editor already has the right bones: `tier` + `level` produces a
tier-derived baseline that's previewed in placeholder hints inside the Stat
Overrides section. The disconnect is presentation, not logic:

- **Move the preview to the top of the editor**, not buried in placeholders.
  When `tier: standard` + `level: 7` is set, the editor's primary readout is
  "HP 40 · DMG 8-10 · XP 90 · GOLD 17-22" in clear text — not faint hints on
  fields the author isn't touching.
- **Replace four mult fields with one toughness slider** (or two: combat
  toughness and reward generosity). The slider maps to `hpMult` + `dmgMult`
  by default; `xpMult` / `goldMult` track combat toughness with a coupling
  ratio (open: 1:1, or rewards trail combat slightly?). The four individual
  mults stay as a disclosed power-user view for edge cases.
- **Keep Stat Overrides as a collapsed power-user section** for bespoke
  bosses, exactly as it is today.

## Migration

Existing zones have hand-authored `damage` / `armor` / `stats` on items, and
hand-authored `hp` / `damage` on mobs. Two options:

1. **Treat them as overrides forever.** When loaded, if an item has no `level`
   / `rarity` / `role`, it shows up as a "legacy / fully overridden" item in the
   editor — the new flow is hidden, the raw fields are exposed. Authors opt
   into the derived flow by picking a role.
2. **Best-fit on load.** Run an inference pass: given the slot + raw stats,
   pick the (level, rarity, role) that comes closest, and present the result
   to the author with a "this is my guess — accept or adjust?" prompt.

Recommend (1) for low risk. (2) is nice but introduces a content-changing
operation that runs without explicit user consent.

## What we keep from PR #243

Almost nothing as code, but the *reference* is useful:

- `evaluateItemBudget` math is still the right budget formula. The derivation
  layer will use the same math in reverse (given budget, distribute points).
- `DEFAULT_ITEM_BUDGET` defaults need a separate sanity pass — `statPointCost:
  1.0` letting a level-3 uncommon body have ~14 stat points is too generous.
  Probably `statPointCost: 3.0` brings it into the right zone, but this needs
  to be cross-checked against the server's progression math (a level-30 player's
  stat-from-allocation budget is the natural ceiling for "epic gear").
- The mob multiplier validation in `validateZone` (must be in (0, 10]) is fine
  to keep when we add the toughness slider — slider just stays in range by
  construction.

## Open questions / decisions before code

1. Role taxonomy: which six to eight roles ship? Best answered by surveying
   the existing zones' items — what categories already exist organically?
2. Does `role` ship to the server YAML or stay Arcanum-only?
3. Single toughness knob or two (combat / rewards)? Single is simpler; two
   maps more cleanly to the four underlying mults.
4. Budget defaults: revise `statPointCost` and slot bases before or after
   the UI work? Recommend before — bad defaults make the new UI feel wrong.
5. Migration: legacy-as-override (option 1) or best-fit inference (option 2)?

## Rough phasing

1. **Defaults pass.** Re-tune `DEFAULT_ITEM_BUDGET` on both sides (Arcanum
   constant + Kotlin defaults + Balanced preset) until a worked example at
   level 5 / rare / `weapon_striker` produces sensible numbers across all
   slots. No UI changes yet.
2. **Item role + derivation in editor.** Add `role` to `ItemFile`, ship the
   role profiles, write a `deriveItemStats(slot, level, rarity, role)` pure
   function, wire the editor to drive its outputs into the existing
   `damage` / `armor` / `stats` fields. Tweaks become overrides.
3. **Mob preview redesign.** Promote the tier-derived preview to the editor
   header, replace four mult fields with one toughness slider, keep raw mults
   under a disclosure.
4. **(Optional) legacy inference / docs / changelog.**
