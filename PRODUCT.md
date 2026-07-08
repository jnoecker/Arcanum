# Product

## Register

product

## Users

Indie developers, writers, hobbyist worldbuilders, and small teams building MUD game worlds and worldbuilding projects. They range from technically comfortable to complete beginners. They use Arcanum for long creative sessions (hours at a time), switching between zone mapping, entity editing, config tuning, lore writing, and AI art generation. The tool has power-user features (command palette, keyboard shortcuts, dense editors) but must be approachable to someone opening it for the first time. Discoverability and guided onboarding matter as much as depth.

## Product Purpose

Arcanum is a Tauri 2 desktop worldbuilding tool that edits YAML world files for the AmbonMUD server (zones, mobs, items, quests), manages game configuration, generates AI art for every entity type, and publishes public lore showcases. Success means a builder can hold an entire world in their head through the tool — navigating between hundreds of rooms, mobs, items, and articles without friction — while the interface stays worthy of the act of creation.

## Brand Personality

**Cosmological. Precise. Ornate.**

The Arcanum is the Creator's own instrument — a window into the architecture of a world. The interface should feel like it was carved into existence by the same force that shaped the land. Never a SaaS dashboard with a dark theme.

Emotional goals: grandeur, creative confidence, unhurried focus. The cosmos does not rush.

## Anti-references

Generic AI-generated UIs: glassmorphism, gradient text, hero metrics, identical card grids, Inter/Geist fonts, teal-purple-pink palettes. Modern SaaS dashboards. Anything flat, corporate, or template-driven.

## Design Principles

1. **Ember against the deep** — Warm accent light appears only where something is alive, active, or important. A single ember highlight against midnight-teal carries enormous weight. Don't dilute it.
2. **Density serves the builder** — This is a data-dense creative tool, not a marketing page. Small type (10px workhorse), tight spacing, and information-rich panels are appropriate. Progressive disclosure for secondary features, but never hide what power users need frequently.
3. **Texture over flatness** — Every major surface has visual texture: background images, gradient overlays, subtle glow. Flat solid-color panels feel dead. Texture must be quiet (low opacity, `pointer-events-none`) — never competing with content.
4. **Semantic tokens, not arbitrary values** — Colors, sizes, tracking, gradients, and shadows come from the token system in `creator/src/index.css`. Hard-coded values indicate a missing token, not a design choice.
5. **Accessibility is structural** — Keyboard navigation, focus traps, ARIA labels, `prefers-reduced-motion`, and sufficient contrast are baseline requirements, not polish items.

## Accessibility & Inclusion

Keyboard-first navigation throughout; full-screen overlays must use dialog semantics with focus traps (see CLAUDE.md accessibility contract). All motion honors `prefers-reduced-motion`. Contrast targets WCAG AA against the midnight-teal palette. The app is themeable (dark and light anchor palettes) via semantic tokens — components must never hardcode palette hexes.

## See also

- `.impeccable.md` — condensed design context (palette, type scale, utilities, patterns)
- `ARCANUM_STYLE_GUIDE.md` — full design system
- `CLAUDE.md` — architecture, conventions, pitfalls
