# Domain Pitfalls

**Domain:** Game balance tuning wizard for MUD world builder
**Researched:** 2026-04-04

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or a tool nobody trusts.

### Pitfall 1: Preset Values Silently Produce Broken Formulas

**What goes wrong:** A preset sets mob tier damage high but does not adjust stat binding divisors or regen rates to compensate. The result is a game where bosses one-shot players or where HP regen outpaces all damage. The builder applies the preset, sees "Hardcore" label, trusts it, and ships a broken config.

**Why it happens:** The 300+ config fields in `application.yaml` form an interconnected formula graph. `MobTierConfig.damagePerLevel` is meaningless without knowing `StatBindings.hpScalingDivisor`, `RegenConfig.regenAmount`, `LevelRewardsConfig.hpPerLevel`, and `CombatConfig.tickMillis`. Presets authored by editing one section at a time miss cross-section interactions.

**Consequences:** Builders lose trust in the wizard entirely. They revert to manual editing, defeating the tool's purpose. Worse, they might publish a broken config to players.

**Prevention:**
- Author presets as complete, internally-consistent snapshots covering ALL gameplay-relevant sections simultaneously -- not per-section fragments stitched together.
- Build a small set of "derived metric" calculations (e.g., "time-to-kill at level 10 vs standard mob", "XP needed for level 20", "gold earned per hour") and validate that every preset produces sane values for these metrics.
- Include derived metrics in the comparison view so builders can see the emergent impact, not just the raw numbers.
- Add automated sanity checks: flag when a preset's TTK drops below 1 second or XP-to-level exceeds 100 hours of grinding.

**Detection:** Before shipping, run each preset through the derived metric calculations and verify no metric is an outlier. If you cannot compute derived metrics yet, you are not ready to ship presets.

**Phase:** Must be addressed in Phase 1 (preset authoring). The derived metrics engine is the foundation that makes presets trustworthy.

---

### Pitfall 2: Partial Apply Creates Frankenstein Configs

**What goes wrong:** Per-section accept/reject is the right UX decision (PROJECT.md confirms this), but it creates a combinatorial problem: accepting "Hardcore combat" with "Casual progression" and "Grindy economy" may produce a config that no preset author ever tested. The resulting game is incoherent.

**Why it happens:** Each preset is designed as a holistic package. Cherry-picking sections breaks the internal consistency. The `StatBindings` divisors assume certain mob tier values; the XP curve assumes certain quest reward rates.

**Consequences:** The wizard enables users to create invalid combinations that feel worse than manual editing because the user assumed preset-quality balance.

**Prevention:**
- After per-section apply, re-run derived metrics and show an updated "health check" panel. Flag combinations that produce outlier metrics (e.g., "With these choices, time-to-kill is 0.3 seconds at level 10 -- this may feel too easy").
- Group related sections that should be accepted/rejected together. Present "Combat + Stats" as one accept/reject unit rather than splitting `mobTiers`, `combat`, and `stats.bindings` into three independent choices.
- Show a final confirmation with the combined derived metrics before writing to `configStore`.

**Detection:** If the comparison view only shows raw value diffs without derived metrics, this pitfall is active. If there are no warnings for cross-section inconsistencies, this pitfall is active.

**Phase:** Phase 2 (comparison view + per-section apply). The grouping and health-check logic must ship alongside the apply mechanism, not as a follow-up.

---

### Pitfall 3: Comparison View Shows Noise Instead of Signal

**What goes wrong:** The before/after comparison displays all 300+ changed fields as a flat diff. Builder sees 200 rows of numbers and learns nothing. They either accept everything blindly or reject everything out of overwhelm.

**Why it happens:** The simplest implementation iterates `AppConfig` and shows every field that differs. This is technically correct but useless for decision-making. Most fields (e.g., `WeatherConfig.minTransitionMs`) are not balance-critical, while the few that matter (XP exponent, mob tier HP scaling, stat divisors) are buried.

**Consequences:** The wizard becomes a wall of numbers. Builders go back to editing individual config panels where at least they have contextual labels.

**Prevention:**
- Categorize fields into tiers: **Critical** (XP curve, mob tiers, stat bindings), **Important** (economy multipliers, regen rates), **Minor** (timing, cosmetic). Show Critical by default, collapse the rest.
- Lead with derived metrics: "Time to level 20: 8h -> 3h", "Boss fight duration: 45s -> 120s". Put raw field changes behind an expandable detail section.
- Use visual indicators (color-coded bars, sparklines) rather than raw numbers. "Mob HP at level 20: [======] -> [============]" communicates faster than "200 -> 450".
- Group changes by game system (Combat, Progression, Economy) rather than by config interface nesting.

**Detection:** If user testing shows people scrolling past the comparison view without reading it, the view is too noisy. If no derived metrics are visible on the default comparison view, this pitfall is active.

**Phase:** Phase 2 (comparison view design). This is a UX problem, not a data problem -- the grouping and metric calculations from Phase 1 feed directly into this.

---

### Pitfall 4: Presets Overwrite User's Careful Tuning Without Undo

**What goes wrong:** Builder spends an hour tuning mob tier values manually in config panels. They open the wizard, curiously apply a preset to "see what happens", and their custom values are gone. The configStore has no undo history (unlike loreStore).

**Why it happens:** `configStore` is a simple Zustand store with `updateConfig()` that overwrites the entire `AppConfig`. There is no undo/redo mechanism (CONCERNS.md confirms zone store uses zundo, lore store uses snapshots, but configStore has neither). The wizard writes to the same store.

**Consequences:** Data loss. Builder rage. Uninstall.

**Prevention:**
- Implement a "snapshot before apply" mechanism: before the wizard writes any changes, snapshot the current `config` to a restore point. Offer a single "Undo wizard changes" button.
- Do NOT add full undo/redo to configStore (overkill for this milestone). A single "revert to pre-wizard state" is sufficient and much simpler.
- The comparison view itself must show the diff BEFORE applying -- never apply first and show the diff after.
- Consider a "dry run" mode where the wizard computes derived metrics for both current and preset values without touching configStore at all until the user explicitly confirms.

**Detection:** If clicking "Apply" in the wizard immediately mutates configStore with no way to revert, this pitfall is active.

**Phase:** Phase 2 (apply mechanism). The snapshot must be implemented before the apply button is wired up. Non-negotiable.

---

### Pitfall 5: Preset Values Go Stale as Config Schema Evolves

**What goes wrong:** Arcanum adds a new config field (e.g., `PrestigeConfig` or `EnchantingConfig`). Existing presets do not include values for the new field. Applying a preset either leaves the new field at its default (inconsistent with the preset's intended balance) or overwrites it with `undefined` (breaking the config).

**Why it happens:** Presets are static snapshots of config values. The `AppConfig` type in `config.ts` already has 40+ sub-interfaces and grows with each Arcanum release. Presets authored today will not cover fields added tomorrow.

**Consequences:** Subtle balance bugs after Arcanum updates. New features launch with no preset coverage, making the wizard feel incomplete. Or worse, applying a preset nullifies new config sections.

**Prevention:**
- Presets should only store values they explicitly set, not a full `AppConfig` snapshot. The apply logic merges preset values over the current config, leaving unset fields untouched.
- Define presets as `Partial<AppConfig>` (deeply partial) with a schema version. When applying, the wizard only overwrites fields present in the preset.
- Add a "preset coverage" check: when loading a preset, compare its keys against the current `AppConfig` type. Flag uncovered sections as "not affected by this preset" in the UI.
- When adding new config fields, add a CI/lint step or manual checklist item to review whether presets should include the new field.

**Detection:** If preset files are full `AppConfig` objects rather than partial overlays, this pitfall is active. If there is no versioning on presets, this pitfall is active.

**Phase:** Phase 1 (preset data model). The partial-overlay vs full-snapshot decision must be made at the start. Changing this later requires rewriting all presets.

## Moderate Pitfalls

### Pitfall 6: Derived Metrics Are Wrong and Nobody Notices

**What goes wrong:** The "time-to-kill" calculation assumes a simplified combat model (player attacks every tick, mob has no armor reduction, no dodge). The displayed metric says "Boss TTK: 30s" but in the actual server the fight takes 90s because of armor, dodge chance, and miss rate. Builders tune to wrong metrics.

**Prevention:**
- Document every derived metric formula explicitly, including what it does and does not account for.
- Reference the Kotlin server formulas in `reference/` as the source of truth. The metric calculations should mirror the server logic, not approximate it.
- Label metrics with their fidelity level: "Estimated TTK (no dodge/armor)" vs "Full TTK (all mechanics)". Honest labeling prevents false confidence.
- Start with simple metrics and explicitly label them as estimates. Do not present estimates as precise predictions.

**Phase:** Phase 1 (derived metrics engine). Get the formulas right before building UI on top of them.

---

### Pitfall 7: The Wizard Becomes a Config Panel Clone

**What goes wrong:** Scope creep turns the wizard into another place to edit individual config values. Instead of "pick preset, compare, apply sections", it becomes "edit every field with a different layout". Now there are two places to edit config, they can conflict, and neither is clearly the primary workflow.

**Prevention:**
- The wizard is read-compare-apply, not edit. Users cannot modify individual field values in the wizard.
- If a user wants to tweak a specific value, the wizard links them to the relevant config panel. Clear separation of concerns.
- No inline editing in the comparison view. Show values, show diffs, apply or reject sections.

**Detection:** If any text input fields appear in the wizard that write to configStore, scope has crept.

**Phase:** Phase 2 (comparison view). Resist the temptation to add "just a quick edit" to diff rows.

---

### Pitfall 8: 5-6 Presets Is Both Too Many and Too Few

**What goes wrong:** With 6 presets (Casual, Balanced, Hardcore, Grindy MMO, Fast PvP, Story-focused), most builders will want something between two presets. They pick "Balanced" as a starting point and then manually adjust 50 fields, negating the wizard's value. Meanwhile, maintaining 6 presets across 300+ fields is a maintenance burden.

**Prevention:**
- Start with 3 presets (Casual, Balanced, Hardcore) that form a clear spectrum. These are easier to author correctly and easier for users to understand.
- Add genre presets (Grindy, PvP, Story) only in a later phase after the core 3 are validated and the derived metrics engine is proven.
- Each preset should have a clear one-sentence philosophy visible in the UI: "Casual: Players should never die to normal mobs and level up every 15-20 minutes."
- The value is not in picking a perfect preset but in seeing how presets change derived metrics, which teaches builders how the systems interact.

**Phase:** Phase 1 (preset authoring). Ship 3, expand later. Less is more.

---

### Pitfall 9: YAML Serialization Corrupts Config on Apply

**What goes wrong:** The wizard applies changes via `configStore.updateConfig()`, which triggers `saveConfig()`. The save process uses `yaml.parseDocument()` + `doc.set()` + `doc.toString()`. If the wizard produces values with unexpected types (string "100" instead of number 100, or `null` for optional fields), the YAML output may break the Kotlin server's parser.

**Prevention:**
- Preset values must be typed to match the TypeScript interfaces exactly. Use the same type-checking that existing config panels use.
- The wizard should not introduce a new save path. It writes to `configStore.updateConfig()` and relies on the existing `saveConfig()` pipeline. No custom serialization.
- Test: apply each preset, save, reload, and verify the config round-trips without loss or type coercion. This test should be automated.

**Detection:** If the wizard has any direct file I/O or custom YAML serialization, this pitfall is active.

**Phase:** Phase 2 (apply mechanism). Use the existing save path, do not invent a new one.

---

### Pitfall 10: Comparison View Does Not Show "Why"

**What goes wrong:** The comparison shows "XP exponent: 1.5 -> 2.0" but the builder does not know whether 2.0 is a lot or a little, or what it means for gameplay. The comparison is technically accurate but pedagogically useless.

**Prevention:**
- Every critical field change should include a tooltip or inline note explaining the impact: "Higher exponent = exponentially more XP needed per level = slower late-game progression."
- Derived metrics are the primary "why" channel. "XP to level 20: 50,000 -> 200,000" answers the question the raw exponent change does not.
- For mob tiers, show a mini level-scaling chart: "Standard mob HP at levels 1/10/20/30" as a small inline sparkline or table.

**Phase:** Phase 2 (comparison view). Explanatory content can be added iteratively, but the derived metrics must be present from day one.

## Minor Pitfalls

### Pitfall 11: Wizard Tab Adds Cognitive Load to Existing Navigation

**What goes wrong:** The app already has Config as a major section with 45+ panels. Adding a Tuning Wizard tab creates confusion about whether to use the wizard or config panels. New users do not know which is the "right" place to start.

**Prevention:**
- Add a clear callout in the config section: "New to game balance? Start with the Tuning Wizard."
- The wizard's landing state should explain its purpose in 2 sentences, not dump users into a preset selector immediately.
- Position the wizard in the sidebar as a peer of Config, not nested within it.

**Phase:** Phase 2 (UI integration). Sidebar placement decision.

---

### Pitfall 12: Oversized Wizard Component File

**What goes wrong:** Given existing tech debt (CONCERNS.md lists 10+ files over 600 lines), the wizard becomes another monolithic component mixing preset logic, comparison rendering, derived metrics, and apply/revert state.

**Prevention:**
- Plan the component decomposition upfront: `PresetSelector`, `ComparisonView`, `DerivedMetricsPanel`, `SectionApplyControls`, `WizardStore` (separate Zustand store for wizard state).
- The wizard should NOT put its state in `configStore`. Use a dedicated `tuningWizardStore` for wizard-specific state (selected preset, comparison data, section accept/reject flags). Only write to `configStore` on final apply.

**Phase:** Phase 1 (architecture). Define the component boundaries before writing code.

---

### Pitfall 13: Missing Config Sections in Preset Coverage

**What goes wrong:** Presets cover Combat, Progression, and Economy but ignore Crafting, Housing, Guild, and Prestige. The wizard feels incomplete for builders who care about those systems.

**Prevention:**
- Audit all gameplay-relevant sections of `AppConfig` during preset authoring. The out-of-scope sections (server, admin, observability, logging) are clearly non-gameplay. Everything else should at least be assessed.
- Use the coverage check from Pitfall 5: the wizard UI should show which sections a preset affects and which it leaves untouched.
- Prioritize by impact: Combat + Progression + Stats + Economy cover 80% of gameplay feel. Crafting + Social + World timing are lower priority and can be added in later presets.

**Phase:** Phase 1 (preset authoring). At minimum, document which sections each preset covers.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Preset data model | Full snapshot vs partial overlay (Pitfall 5) | Use deeply-partial overlay with schema version from day one |
| Preset authoring | Broken formula interactions (Pitfall 1) | Build derived metrics engine first, validate presets against it |
| Preset count | Too many presets to maintain (Pitfall 8) | Ship 3 core presets, expand later |
| Derived metrics | Wrong formulas (Pitfall 6) | Reference Kotlin server code in `reference/`, label fidelity |
| Comparison view | Information overload (Pitfall 3) | Lead with derived metrics, collapse raw fields |
| Comparison view | No explanatory context (Pitfall 10) | Tooltips + derived metrics as the "why" layer |
| Per-section apply | Frankenstein configs (Pitfall 2) | Group related sections, show post-apply health check |
| Apply mechanism | No undo (Pitfall 4) | Snapshot config before apply, offer one-click revert |
| Apply mechanism | YAML corruption (Pitfall 9) | Use existing saveConfig() path, no custom serialization |
| Wizard UI | Scope creep into editing (Pitfall 7) | Read-compare-apply only, link to config panels for edits |
| Component architecture | Monolith component (Pitfall 12) | Decompose upfront, use dedicated wizard store |
| Navigation | Confusion with config panels (Pitfall 11) | Clear wizard purpose statement, sidebar peer placement |

## Sources

- Project context: `.planning/PROJECT.md` (requirements, config domains, constraints)
- Codebase concerns: `.planning/codebase/CONCERNS.md` (tech debt, missing undo in configStore)
- Config types: `creator/src/types/config.ts` (AppConfig with 40+ sub-interfaces, StatBindings formula graph)
- Config store: `creator/src/stores/configStore.ts` (simple set/update, no undo)
- Config save: `creator/src/lib/saveConfig.ts` (YAML CST round-trip pipeline)
- [Game Balance: A Definitive Guide](https://gamedesignskills.com/game-design/game-balance/)
- [Design 101: Balancing Games](https://www.gamedeveloper.com/design/design-101-balancing-games)
- [Emergent Gameplay - Blood Moon Interactive](https://www.bloodmooninteractive.com/articles/emergent-gameplay.html)
- [Designing Perfect Feature Comparison Tables - Smashing Magazine](https://www.smashingmagazine.com/2017/08/designing-perfect-feature-comparison-table/)
- [Comparison Table UX Pattern](https://uxpatterns.dev/patterns/data-display/comparison-table)
- [Enterprise UX Design for Complex Workflows](https://traust.com/blog/enterprise-ux-design-for-complex-workflows/)
