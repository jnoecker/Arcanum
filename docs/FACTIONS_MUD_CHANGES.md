# Factions & Reputation — MUD server changes required

Companion doc to the Arcanum **factions & reputation** PR. Arcanum now writes
YAML that references fields the MUD server doesn't yet honor. This document
lists the changes the AmbonMUD side needs to make in order to consume them.

Until the server implements these, the extra fields are harmless — they round
-trip through Arcanum and sit on disk, but the MUD will ignore them.

## Summary of new data shapes

### Config (`application.yaml → ambonmud.factions`)

```yaml
factions:
  defaultReputation: 0
  killPenalty: 5
  killBonus: 3
  tiers:                          # NEW — optional. Omit to use built-in defaults.
    - id: hated
      label: Hated
      minReputation: -20000
    - id: hostile
      label: Hostile
      minReputation: -1000
    - id: unfriendly
      label: Unfriendly
      minReputation: -500
    - id: neutral
      label: Neutral
      minReputation: 0
    - id: friendly
      label: Friendly
      minReputation: 250
    - id: honored
      label: Honored
      minReputation: 1000
    - id: revered
      label: Revered
      minReputation: 5000
    - id: exalted
      label: Exalted
      minReputation: 20000
  definitions: ...                # unchanged
  questRewards: ...               # unchanged
```

Default tiers match the list above; if `tiers` is absent the server should
fall back to the same defaults rather than treating the absence as "no
tiers."

### Zone (`<zone>.yaml` root)

```yaml
zone: thornhaven
startRoom: ...
terrain: urban
faction: royal_court              # NEW — controlling faction for the region
rooms:
  ...
```

### Shop (`<zone>.yaml → shops.<id>`)

```yaml
shops:
  court_armorer:
    name: Court Armorer
    room: plaza
    items: [...]
    requiredReputation:           # NEW — optional rep gate
      faction: royal_court
      min: 250                    # optional; omit for no floor
      max: 20000                  # optional; omit for no ceiling
```

### Quest (`<zone>.yaml → quests.<id>`)

```yaml
quests:
  infiltrate_rebels:
    name: Infiltrate the Rebels
    giver: spy_handler
    requiredReputation:           # NEW — optional rep gate
      faction: rebel_cell
      max: -500                   # e.g. only offered while Hostile or lower
```

## Server-side work

### 1. DTO updates

- `FactionsConfigDTO` — add an optional `tiers: List<ReputationTierDTO>` field.
- Introduce `ReputationTierDTO { id: String, label: String, minReputation: Int }`.
- `WorldFileDTO` — add optional `faction: String`.
- `ShopFileDTO` — add optional `requiredReputation: ReputationRequirementDTO`.
- `QuestFileDTO` — add optional `requiredReputation: ReputationRequirementDTO`.
- Introduce `ReputationRequirementDTO { faction: String, min: Int?, max: Int? }`.

All new fields must be nullable / optional; legacy worlds do not set them.

### 2. `WorldLoader` validation

- If `requiredReputation.faction` is not a key in
  `factions.definitions`, reject the world file with an actionable error.
- If `min` and `max` are both set and `min > max`, reject.
- If a zone's `faction` is not in `factions.definitions`, log a WARNING and
  treat as "no controlling faction."

### 3. Reputation tier resolution

Replace whatever hardcoded tier bands the server uses today with a lookup
against `FactionsConfig.tiers`, sorted ascending by `minReputation`:

```kotlin
fun tierFor(rep: Int, tiers: List<ReputationTier>): ReputationTier =
    tiers.lastOrNull { it.minReputation <= rep } ?: tiers.first()
```

Commands that print reputation (e.g. `faction status`, `who` tooltips) should
use `tier.label` rather than inline strings.

### 4. Rep gates on shops

`ShopSystem` (or wherever the buy/sell/browse path lives) needs, before any
transaction:

```kotlin
shop.requiredReputation?.let { req ->
    val rep = player.reputationWith(req.faction)
    if (req.min != null && rep < req.min) return refuse(shop, "too_low")
    if (req.max != null && rep > req.max) return refuse(shop, "too_high")
}
```

Refusal messages should surface the controlling faction's display name and
the player's current tier — e.g. *"The armorer scowls: 'Hostile aren't
welcome here.'"*

### 5. Rep gates on quests

`QuestSystem.offerQuest()` (the giver interaction) should skip quests whose
`requiredReputation` doesn't match the player's standing. Two subtleties:

- If `max` is set, the quest should *disappear* from the giver's offer list
  when the player exceeds it (otherwise veteran players see junk).
- If `min` is set, the giver should still *acknowledge* the quest exists but
  refuse — a hint nudges the player toward grinding rep rather than wondering
  why content isn't appearing.

### 6. Zone-level controlling faction

`WorldFile.faction` has two intended effects:

1. **Mob inheritance** — a mob without its own `faction` inherits the zone's
   faction when spawned.
2. **Hostile territory reactions** — guard mobs tagged as belonging to that
   faction should be able to check `player.reputationWith(zone.faction) <
   thresholdFromTier("unfriendly")` and react (aggro, refuse service, etc.).

Both behaviors are additive; neither is required for v1 of the feature, but
both become trivial once the field is loaded.

### 7. Migration notes

- The lore-article `organization.configFactionId` field is Arcanum-only. It
  lives in `lore.yaml` alongside the article and is not exposed to the MUD.
- `factions.tiers` is purely additive. Existing worlds that don't set it
  behave identically to today once the server defaults match the above list.

## Testing checklist for the MUD side

- [ ] Legacy world loads without the new fields and runs unchanged.
- [ ] Tier table override (different thresholds/labels) reflects in rep
      readout commands.
- [ ] Shop with `requiredReputation.min` refuses a Neutral player and
      accepts a Friendly one.
- [ ] Quest with `requiredReputation.max` disappears from the giver's list
      once the player crosses the ceiling.
- [ ] Zone-level `faction` propagates to mobs that lack their own faction.
- [ ] `WorldLoader` rejects a zone that references an unknown faction in any
      of the three new places (zone, shop gate, quest gate).
