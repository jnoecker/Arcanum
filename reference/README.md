# AmbonMUD Reference Files

These files are copied from the AmbonMUD server codebase for reference when building the Creator tool. The Creator's TypeScript types and validation rules must mirror these Kotlin sources.

## Planning Documents

- **[FINAL_PLAN.md](docs/FINAL_PLAN.md)** — Agreed-upon implementation plan for the Creator app (tech stack, architecture, phases, data model)
- **[WORLD_YAML_SPEC.md](docs/WORLD_YAML_SPEC.md)** — YAML format specification for world zone files
- **[STAT_SYSTEM_SPEC.md](docs/STAT_SYSTEM_SPEC.md)** — Data-driven stat system spec (dynamic stats, bindings, formulas)

## Directory Layout

### `docs/`
Planning and specification documents (see above).

### `world-yaml-dtos/` (14 files)
Kotlin data classes that define the YAML schema for world zone files. These are the **primary source of truth** for TypeScript type generation.

- `WorldFile.kt` — Top-level zone file: zone name, lifespan, startRoom, rooms, mobs, items, shops, quests, etc.
- `RoomFile.kt` — Room: title, description, exits, features, station, image, video, music, ambient
- `ExitValue.kt` — Exit: target room ID + optional door
- `DoorFile.kt` — Door on an exit: closed/locked state, key item
- `MobFile.kt` — Mob spawn: name, room, tier, level, stats, drops, behavior, dialogue, quests
- `MobDropFile.kt` — Mob drop: item ID + chance percentage
- `ItemFile.kt` — Item: displayName, slot, stats (StatMap), damage, armor, consumable, onUse, basePrice
- `ShopFile.kt` — Shop: name, room, item list
- `BehaviorFile.kt` — Mob behavior: template + params (patrol, flee, aggro, wander)
- `DialogueNodeFile.kt` — Dialogue tree: text, choices with conditions and actions
- `QuestFile.kt` — Quest: name, giver, objectives, rewards, completionType
- `FeatureFile.kt` — Room feature: CONTAINER/LEVER/SIGN with state, key, items, text (deferred)
- `GatheringNodeFile.kt` — Gathering node: skill, yields, respawn
- `RecipeFile.kt` — Crafting recipe: skill, materials, output, station

### `domain-model/` (33 files)
Core domain types used throughout the engine. These define enums, value objects, and runtime models.

Key files for TypeScript mirroring:
- `StatBlock.kt` — Stat block (being replaced by dynamic StatMap — see STAT_SYSTEM_SPEC.md)
- `ItemSlot.kt` — Equipment slots enum
- `Direction.kt` — Movement directions (N/S/E/W/U/D)
- `Gender.kt` — Gender enum
- `PlayerClassDef.kt` / `RaceDef.kt` — Data-driven class/race definitions
- `DamageRange.kt`, `Rewards.kt`, `Progress.kt` — Value types
- `QuestDef.kt`, `AchievementDef.kt` — Quest/achievement definitions
- `CraftingSkill.kt`, `CraftingStationType.kt`, `GatheringNodeDef.kt`, `RecipeDef.kt` — Crafting types
- `Room.kt`, `World.kt` — Runtime world model (post-loading)
- `MobTemplate.kt`, `MobSpawn.kt`, `MobDrop.kt`, `ItemSpawn.kt`, `ShopDefinition.kt` — Runtime entities
- `RoomFeature.kt`, `FeatureState.kt` — Room feature model (deferred)

### `config/` (2 files)
- **AppConfig.kt** — Full configuration schema (~33K). Contains all config data classes: abilities, status effects, combat, mob tiers, progression, economy, regen, classes, races, stats, bindings.
- **application.yaml** — Default config with all ability definitions, status effects, combat params, mob tiers, progression curve, economy, regen, class/race definitions, stat definitions and bindings.

### `registries/` (11 files)
Registry and loader patterns — shows how config is parsed into runtime data. Useful for understanding data relationships.

- `AbilityDefinition.kt` / `AbilityRegistry.kt` / `AbilityRegistryLoader.kt` — Ability system
- `StatusEffectDefinition.kt` / `StatusEffectRegistry.kt` / `StatusEffectRegistryLoader.kt` — Status effects
- `PlayerClassRegistry.kt` / `PlayerClassRegistryLoader.kt` — Class registry
- `RaceRegistry.kt` / `RaceRegistryLoader.kt` — Race registry
- `PlayerProgression.kt` — XP curve, level-up rewards, class-specific HP/mana scaling

### `world-loader/` (1 file)
- **WorldLoader.kt** (~30K) — Parses zone YAML files into the runtime world model. Contains all validation rules that the Creator's client-side validation engine must mirror.

### `example-zones/` (6 files)
Representative zone YAML files showing real-world content and formatting conventions:
- `tutorial_glade.yaml` — Small starter zone with basic rooms, mobs, items
- `ambon_hub.yaml` — Central hub zone with shops, NPCs, exits to other zones
- `demo_ruins.yaml` — Combat-focused zone with mobs, drops, quests
- `low_training_barrens.yaml` — Training zone with mob tiers and behaviors
- `crafting_workshop.yaml` — Crafting-focused zone with gathering nodes, recipes, stations
- `achievements.yaml` — Achievement definitions (different structure — achievement config, not a zone)
