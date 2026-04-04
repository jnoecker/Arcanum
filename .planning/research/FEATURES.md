# Feature Landscape

**Domain:** Game balance tuning wizard for MUD world builder (300+ parameters across combat, economy, progression, stats, crafting, quests, social, world timing)
**Researched:** 2026-04-04
**Confidence:** MEDIUM-HIGH (domain patterns well-established; specific MUD tuning tooling is niche)

## Table Stakes

Features users expect. Missing = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Themed presets (5-6) | Core value proposition -- builders pick a starting point instead of tweaking 300 fields blindly | Medium | Casual, Balanced, Hardcore, Grindy MMO, Fast PvP, Story-focused. Each preset is a full snapshot of all tunable values. |
| Before/after comparison view | Without seeing what changed, presets are a black box. Every config tool worth using shows diffs. | Medium | Side-by-side or inline diff of current values vs preset values, grouped by system (combat, economy, etc.). |
| Per-section accept/reject | Builders will never trust a tool that overwrites everything at once. Granular control is non-negotiable. | Medium | Checkboxes or toggle per config section (e.g., accept combat changes but reject economy changes). |
| Contextual tooltips/descriptions | 300+ numeric fields are meaningless without explanation. Every game design tool documents its fields. | Low | Short description of what each value does, what reasonable ranges look like, what other values it interacts with. |
| Reset to current values | Users need an escape hatch. Fear of irreversible changes kills adoption. | Low | "Discard all changes" button that reverts to the configStore state before wizard was opened. |
| Undo last apply | After applying a preset section, let users undo it. Builds trust. | Low | Leverage existing configStore patterns. Snapshot before apply, restore on undo. |
| System grouping | Showing 300 flat fields is overwhelming. Grouping by game system (combat, economy, progression) is how every balance spreadsheet is organized. | Low | Mirror the existing config panel categories: Combat, Mob Tiers, Progression, Stats, Economy, Crafting, Quests, Social, World Timing. |
| Search/filter | With 300+ values, users need to find specific parameters quickly. | Low | Text search across parameter names and descriptions. |
| Value validation | Presets must produce valid YAML the Kotlin server accepts. Invalid values = broken game. | Low | Reuse existing validation from validateConfig.ts. Show inline errors. |

## Differentiators

Features that set the wizard apart from "just edit the YAML." Competitive advantage over raw config panels.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| XP curve visualization | Interactive chart showing XP-per-level curve with sliders. Builders instantly see how exponent/base/multiplier changes feel at level 1 vs level 50. | Medium | Chart.js or Recharts line graph. X = level, Y = XP required. Update live as parameters change. This is the single most impactful visualization -- XP curves are notoriously hard to reason about from raw numbers. |
| Mob tier power chart | Bar chart showing HP, damage, armor, XP reward across tiers at selected levels (e.g., level 1, 10, 25, 50). | Medium | 4 grouped bars per metric, level selector. Shows whether elite mobs are actually harder than standard ones at each level. |
| Computed metrics panel | Show derived values: "A level 20 warrior with 18 STR deals X-Y damage per hit" or "It takes Y kills to level from 10 to 11." Makes abstract numbers concrete. | Medium-High | Requires implementing the server's formulas in TypeScript. Key formulas: damage = base + (stat / divisor), XP needed = baseXp * level^exponent + linearXp * level, mob HP at level = baseHp + hpPerLevel * level. |
| Economy flow summary | Show gold income (mob kills, quests, crafting) vs gold sinks (shops, gambling, respec, housing) at various levels. Identifies inflation risks. | Medium-High | Aggregate across multiple config sections. Present as simple income/expense table, not full Machinations-style simulation. |
| Dependency highlighting | When hovering over a value, highlight other values it interacts with. E.g., hovering over `meleeDamageDivisor` highlights `meleeDamageStat` and mob tier HP values. | Medium | Static dependency map (hand-authored, not auto-detected). Visual lines or glow on related fields. |
| Preset blending | Instead of all-or-nothing, blend between two presets: "70% Casual, 30% Hardcore." | Medium | Lerp numeric values between two preset snapshots. Slider control. Only works for numeric fields. |
| Custom preset save/load | Save current config as a named preset. Import/export presets as JSON. | Low-Medium | Store in project .arcanum directory. JSON format for portability. |
| "What changed" summary | After applying sections, show a human-readable changelog: "Combat is now 30% harder, XP gain is 2x faster, economy is tighter." | Medium | Compare old vs new values, generate natural-language summary per section. Can be deterministic (percentage change thresholds) or LLM-enhanced (v2). |
| Level-by-level data table | Expandable table showing computed values at every level: HP, mana, XP needed, damage range, mob stats. The "spreadsheet view" game designers expect. | Medium | Computed from formulas. Sortable columns. Exportable to CSV for external analysis. |
| Balance warnings | Flag known problematic combinations: "Dodge cap is 95% but dodgePerPoint is so high that level 30 characters hit cap -- consider lowering." | Medium-High | Rule-based system. Start with 5-10 hand-authored rules for the most common pitfalls. Expandable. |
| LLM holistic analysis | Feed all config values to an LLM and get a narrative analysis: "Your economy is inflationary because mob gold at level 50 exceeds all gold sinks." | High | Requires prompt engineering, token budget management, and good formatting. V2 feature per PROJECT.md. |

## Anti-Features

Features to explicitly NOT build. Each would add complexity without proportional value for this specific use case.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full game simulation / Monte Carlo | Machinations-style simulation is a separate product. Arcanum builders need quick tuning, not statistical modeling. The server is the real simulation engine. | Show computed metrics at specific levels instead. "Level 20 warrior vs level 20 elite mob" is more useful than 1000 simulated combats. |
| Live server integration | Running the actual game server to test balance adds massive complexity (process management, test characters, automated combat). | Compute derived values client-side using the same formulas the server uses. |
| Collaborative/multiplayer editing | Arcanum is a single-user desktop app. Multi-user preset sharing is out of scope. | Export/import presets as JSON files for manual sharing. |
| AI-generated presets | Having an LLM generate entire preset configurations is unreliable and hard to validate. | Use hand-authored presets based on known MUD balance patterns. LLM analysis (reading, not writing) is the v2 path. |
| Graph-based visual programming | Machinations-style node graphs for defining value relationships are powerful but require a separate mental model. Overkill for a tuning wizard. | Static dependency highlighting (hover to see connections) gives 80% of the insight at 10% of the complexity. |
| Per-field history/versioning | Tracking individual field change history adds storage and UI complexity. | Rely on git for history (project already has git integration). Undo covers the immediate need. |
| Difficulty auto-scaling | Dynamic difficulty adjustment at runtime is a server feature, not a config tool feature. | Presets cover the "pick a difficulty" use case. The wizard tunes static config, not runtime behavior. |
| Replacing existing config panels | The wizard is additive. Rebuilding 45+ existing panels into the wizard would be a rewrite with no clear benefit. | Wizard links to relevant config panels for fine-tuning after preset application. |

## Feature Dependencies

```
Themed Presets (core data)
  -> Before/After Comparison (needs preset + current to diff)
  -> Per-Section Accept/Reject (needs comparison to know what to accept)
    -> "What Changed" Summary (needs applied changes to summarize)
    -> Undo Last Apply (needs snapshot before apply)

System Grouping (organizational foundation)
  -> Search/Filter (operates within grouped structure)
  -> Contextual Tooltips (attached to grouped fields)
  -> Dependency Highlighting (connects fields across groups)

XP Curve Visualization (standalone chart component)
  -> Level-by-Level Data Table (uses same computation)
  -> Computed Metrics Panel (extends to combat/economy)
    -> Economy Flow Summary (aggregates computed metrics)
    -> Balance Warnings (analyzes computed metrics for issues)
      -> LLM Holistic Analysis (feeds warnings + metrics to LLM)

Custom Preset Save/Load (independent utility)
Preset Blending (requires 2+ presets loaded)
```

## MVP Recommendation

Prioritize (Phase 1):
1. **Themed presets** (5-6 presets) -- the core value proposition
2. **Before/after comparison view** -- makes presets useful instead of scary
3. **Per-section accept/reject** -- makes presets safe to use
4. **System grouping with tooltips** -- makes the UI navigable
5. **Reset/undo** -- trust and safety net
6. **Value validation** -- prevents broken configs

Prioritize (Phase 2):
7. **XP curve visualization** -- highest-impact differentiator, relatively contained scope
8. **Mob tier power chart** -- second most impactful visualization
9. **Computed metrics panel** -- makes abstract numbers concrete
10. **Search/filter** -- quality-of-life as content grows
11. **Custom preset save/load** -- lets builders iterate on their own balance

Defer:
- **Balance warnings**: Requires deep domain knowledge to author rules. Do after the tool is being used and real pain points emerge.
- **Economy flow summary**: Requires aggregating across many config sections. High effort, medium payoff.
- **Preset blending**: Nice-to-have but per-section accept/reject covers the "mix and match" use case adequately.
- **LLM holistic analysis**: Explicitly v2 per PROJECT.md. Needs the computed metrics infrastructure first.
- **Level-by-level data table**: Useful but not essential if charts cover the key levels.
- **Dependency highlighting**: Medium effort for a polish feature. Add when the core tool is solid.
- **"What changed" summary**: Nice polish after core apply flow works.

## Sources

- [Machinations.io - Game Design Platform](https://machinations.io/) -- industry-leading game balance simulation tool, informed anti-feature decisions
- [Spreadsheet Tools in Game Design - Guillem Orpinell](https://medium.com/@urpi/spreadsheet-tools-in-game-design-57511eac68c) -- how designers organize balance data
- [Avoid the Cell Swamp - War Robots / MY.GAMES](https://medium.com/my-games-company/avoid-the-cell-and-table-swamp-maintaining-game-balance-with-ease-9f3e90bf45ac) -- patterns for managing complex game economies
- [Wizard UI Design Best Practices - Lollypop Design](https://lollypop.design/blog/2026/january/wizard-ui-design/) -- 3-5 step wizard pattern, progressive disclosure
- [Game Balance & Tuning - Myk Eff](https://soundand.design/balance-tuning-8e0871ad0a0b) -- balance methodology (doubling/halving, formula-driven tuning)
- [RPG Level-Based Progression - Davide Aversa](https://www.davideaversa.it/blog/gamedesign-math-rpg-level-based-progression/) -- XP curve formulas and visualization approaches
- [Economy Balancing Using Spreadsheets - Game Developer](https://www.gamedeveloper.com/design/my-approach-to-economy-balancing-using-spreadsheets) -- income vs sink analysis patterns
- [How to Balance an RPG - Kotaku](https://kotaku.com/how-to-balance-an-rpg-1625516832) -- practical RPG balancing methodology
- [Dependency Graphs in Games - Game Developer](https://www.gamedeveloper.com/programming/dependency-graphs-in-games) -- parameter dependency visualization approaches
- Arcanum `creator/src/types/config.ts` -- actual config type definitions (300+ fields across 40+ interfaces)
