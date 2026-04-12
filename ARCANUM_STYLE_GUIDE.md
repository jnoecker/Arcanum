# Arcanum Design System

**Version:** `arcanum_v2` (ember / tide-teal palette)
**Product:** Arcanum — desktop worldbuilding tool (creator), lore showcase SPA, and hub.

---

## Table of contents

1. [Core philosophy](#core-philosophy)
2. [Visual language](#visual-language)
3. [Color system](#color-system)
4. [Typography](#typography)
5. [Motion & animation](#motion--animation)
6. [Component design language](#component-design-language)
7. [Art styles](#art-styles)
8. [Validation checklist](#validation-checklist)

---

## Core philosophy

The Arcanum is the Creator's own instrument — a window into the architecture of a world. The person operating it is not a player inside the world; they are above it, looking down with the same perspective the Creator once held. Every design decision should reinforce that position: vast in scale, precise in intent, ornate because creation is abundant, never sparse.

This style is:

- **Cosmological, not intimate** — Scale is always implied. The user is working at the level of worlds.
- **Baroque in detail, cosmic in composition** — Ornamentation is present and deliberate, but it serves the grandeur rather than decorating for decoration's sake.
- **Ember against the deep** — Warm hearth-ember light is the primary creative accent. It appears only where something is alive, active, or important. Against midnight-blue and tide-teal structure, a single ember highlight carries enormous weight.
- **Unhurried** — The cosmos does not rush. Animations are slow, deliberate, and inevitable. Nothing snaps; everything unfurls.

**Key principle:** This is not a modern SaaS dashboard dressed up with a dark theme. It is a window into the architecture of a world. Every panel, button, and indicator should feel like it was carved into existence by the same force that shaped the land.

---

## Visual language

### Shape vocabulary

The baroque tradition is defined by movement, abundance, and the refusal to let any surface rest passively.

- **C-curves and S-curves** — Borders, dividers, and decorative elements terminate in curls rather than hard stops.
- **Scrollwork** — Panel borders and section dividers may incorporate subtle curling flourishes rendered as faint ember or tide-teal lines.
- **Spiral arms** — Active or highlighted elements trail gentle spiraling light threads, tightening toward a center as they dissipate.
- **Gradual dissolution** — Nothing abruptly ends. Decorative elements fade to transparency at their extremities.

**Preferred:**
- Rounded terminals on all lines and dividers (ends curl or dissolve)
- Large panel corners with optional subtle scrollwork overlay
- Tree-view and graph connectors: gentle arcs, never right-angle bends
- Active/focus states expressed as an encircling glow, not a hard border change

**Forbidden:**
- Flat corporate geometry (perfect rectangles without treatment)
- Right-angle tree or graph connectors
- Neon or saturated primary colors
- Anything that reads as a modern SaaS product (sharp shadows, heavy card grids, flat color fills)
- Pure black backgrounds — use the midnight trough palette

### Light behavior

This is deep-ocean luminosity, not ambient diffusion.

1. **Concentrated ember** — Warm ember-orange light emanates from active, important, or alive elements. It has a clear source. It pools and fades outward. The server is running; this is what that looks like.
2. **Tide-teal ambient fill** — A cool teal glow fills the darkness without flattening it. It gives the deep background depth and dimension without competing with the ember accent.

**Rules:**
- Ember light only appears where something demands attention or represents the active creative force.
- Tide-teal light is the atmosphere, the medium through which the tool exists.
- Stars and pinpoint lights (tiny, pure white) live in background art, not in UI chrome.
- Glow should bloom softly — a 20–40px feathered spread on important elements.
- No hard drop shadows. All shadows use the deep midnight base color and spread widely.

---

## Color system

The canonical palette is the midnight / tide-teal / parchment / ember / umber system. These values match the tokens defined in `creator/src/index.css` — the CSS is the source of truth; this table documents them.

### Deep space (backgrounds)

| Name | Hex | Use | Token |
|---|---|---|---|
| Midnight Trough | `#001524` | Deepest background, outermost shell | `--color-bg-abyss` |
| Tidewell | `#032534` | Primary panel base | `--color-bg-primary` |
| Harbor Glass | `#073746` | Secondary panel surfaces | `--color-bg-secondary` |
| Deep Current | `#0f5160` | Focused or active surfaces | `--color-bg-tertiary` |
| Salt Teal | `#15616d` | Elevated surfaces, structural tint | `--color-bg-elevated` |
| Bright Tide | `#1d7280` | Hover state on elevated surfaces | `--color-bg-hover` |

### Structure & information

| Name | Hex | Use | Token |
|---|---|---|---|
| Tide Teal | `#15616d` | Structural chrome, surfaces, selectors | `--color-arcane-teal` |
| Bright Current | `#2f93a1` | Info states, links, charts, selected items | `--color-stellar-blue` |
| Weathered Copper | `#c0622a` | Secondary warm structure, category accents | `--color-violet` (legacy name) |

### Warm accents — the creative force

| Name | Hex | Use | Token |
|---|---|---|---|
| Hearth Ember | `#ff7d00` | Primary creative accent — active states, primary buttons, running server | `--color-accent`, `--color-warm` |
| Ember Bloom | `#ffb86b` | Highlights, glow centers, hover | `--color-warm-pale` |
| Charred Umber | `#78290f` | Pressed state, shadowed warm accent | `--color-warm-deep` |
| Muted Ember | `#c96300` | Subdued accent for disabled states | `--color-accent-muted` |

### Text & neutrals

| Name | Hex | Use | Token |
|---|---|---|---|
| Ivory Parchment | `#ffecd1` | Primary text | `--color-text-primary` |
| Weathered Linen | `#dccbb3` | Secondary text, captions | `--color-text-secondary` |
| Driftwood | `#ad9d88` | Muted text, placeholders, inactive labels | `--color-text-muted` |
| Ember Link | `#ff7d00` | Text links | `--color-text-link` |

### Borders

| Name | Hex | Use | Token |
|---|---|---|---|
| Void Edge | `#2e7680` | Default border | `--color-border-default` |
| Muted Edge | `#174852` | Subtle dividers | `--color-border-muted` |
| Focus Ring | `#ff7d00` | Keyboard focus | `--color-border-focus` |

### Semantic states

| State | Color | Hex | Token | Notes |
|---|---|---|---|---|
| Server running | Hearth Ember | `#ff7d00` | `--color-server-running` | Breathing ember pulse |
| Server starting | Ember Warning | `#ff9d3d` | `--color-server-starting` | Thread animation |
| Server stopped | Drift Teal | `#6d8b92` | `--color-server-stopped` | Still, cool, no animation |
| Server error | Void Crimson | `#d9756b` | `--color-server-error` | Slow low-frequency pulse |
| Success | Moss Signal | `#7cb66d` | `--color-status-success` | Muted green, readable on dark chrome |
| Warning | Ember Warning | `#ff9d3d` | `--color-status-warning` | Urgent without reading as destructive |
| Info | Bright Current | `#2f93a1` | `--color-status-info` | Informational, structural |
| Error / Destructive | Void Crimson | `#d9756b` | `--color-status-error` | Delete, force-stop, irreversible |

### Opacity guidelines

- **100%** — Primary text, primary UI elements, server status indicators
- **80%** — Overlay backgrounds, hover-state fills
- **50%** — Secondary text, inactive tabs
- **35%** — Glow borders, scrollwork overlays, structural decorative lines
- **10–18%** — Barely-visible background textures, decorative image overlays

### Tailwind utilities

Use semantic Tailwind classes rather than hard-coded colors:

- Backgrounds: `bg-bg-abyss`, `bg-bg-primary`, `bg-bg-secondary`, `bg-bg-tertiary`, `bg-bg-elevated`, `bg-bg-hover`
- Text: `text-text-primary`, `text-text-secondary`, `text-text-muted`, `text-text-link`
- Borders: `border-border-default`, `border-border-muted`, `border-border-focus`
- Accent / warm: `text-accent`, `bg-accent`, `text-accent-muted`, `text-warm`, `bg-warm`, `text-warm-pale`, `text-warm-deep`
- Status: `text-status-success`, `text-status-warning`, `text-status-error`, `text-status-info`

Hard-coded `rgba()` values or px sizes indicate a missing token, not a design choice.

---

## Typography

All serif. Sans-serif has no place in this UI — it reads as modern and corporate, which is what the Arcanum is not.

| Role | Font | Weights | Size | Use |
|---|---|---|---|---|
| Display / Titles | `Cinzel` | 400, 600, 700 | 18–36px | App title, section headings, zone names, major labels |
| Body | `Crimson Pro` | 400, 500, 600 | 14–16px | Panel text, descriptions, config labels, list items |
| Small UI | `Crimson Pro` | 400 | 10–13px | Captions, metadata, tree-node labels, badge text |
| Code / YAML | `JetBrains Mono` | 400, 500 | 13–15px | Config editing, YAML, command output, server logs |

Fallbacks: `Palatino, serif` (display); `Georgia, serif` (body); `Consolas, monospace` (code). Font files are loaded via `@fontsource/*` packages bundled into a `vendor-fonts` chunk.

- **Cinzel** is derived from Roman inscriptional lettering — it carries the weight of ancient authority without feeling decorative.
- **Crimson Pro** has an old-book warmth that complements Cinzel without competing, and stays readable at 10px.
- **JetBrains Mono** handles every code context — YAML editors, command output, log streams.

### Type scale

| Token | Size | Role |
|---|---|---|
| `text-3xs` | 10px | Sub-caption (room nodes, sprite cells) |
| `text-2xs` | 12px | UI chrome, badges, button labels, metadata |
| `text-xs` | 13px | Form inputs, secondary content |
| `text-sm` | 14px | Body text, descriptions |
| `text-base` | 15px | Default body (set on `<body>`) |
| `text-lg`+ | 18px+ | Section headings (with `font-display`) |

### Tracking scale

| Token | Value | Role |
|---|---|---|
| `tracking-label` | 0.18em | Badges, small uppercase labels |
| `tracking-ui` | 0.22em | Section headers, filter labels, metadata |
| `tracking-wide-ui` | 0.32em | Workspace titles, hero labels |

### Special treatments

- **Emphasis:** italic Crimson Pro. No bold for body text.
- **Key values / entity names:** Hearth Ember, normal weight.
- **Error messages:** Void Crimson, italic.
- **Links:** Ember orange, no underline by default; hover brightens toward Ember Bloom.
- **Section dividers:** thin centered horizontal rule with a small baroque diamond or circle glyph at the midpoint, rendered in Void Edge at 35% opacity.

---

## Motion & animation

Motion in the Arcanum is the motion of the cosmos: inevitable, unhurried, operating at scales that make haste irrelevant. Nothing snaps. Nothing bounces.

### Principles

- **Slow and gravitational** — Background elements rotate on 30–90 second cycles. The user almost cannot perceive the motion; they feel it rather than see it.
- **Weaving and threading** — Light and energy move in flowing curved paths. They do not travel in straight lines.
- **Unfurling** — Panels enter by opening outward from a center point or by fading in while gently expanding. They do not slide from edges.
- **No sudden starts** — All animations use easing that begins gently. Even fast interactions (hover: 200ms) feel considered.

### Easing functions

```css
--ease-unfurl:    cubic-bezier(0.16, 1, 0.3, 1);    /* Standard entry */
--ease-dissolve:  cubic-bezier(0.7, 0, 0.84, 0);    /* Standard exit */
--ease-cosmic:    cubic-bezier(0.4, 0, 0.2, 1);     /* Smooth bidirectional — hover states */
/* Ambient rotations use `animation-timing-function: linear` for constant angular velocity */
```

### Duration guidelines

| Category | Duration | Easing |
|---|---|---|
| Hover state | 180ms | `ease-cosmic` |
| Focus ring appear | 200ms | `ease-unfurl` |
| Button press | 120ms | `ease-cosmic` |
| Panel open | 400ms | `ease-unfurl` |
| Panel close | 280ms | `ease-dissolve` |
| Modal appear | 500ms | `ease-unfurl` |
| Tree node expand | 300ms | `ease-unfurl` |
| Server state change | 800ms | `ease-cosmic` |
| Tooltip | 200ms in, 120ms out | `ease-unfurl` / `ease-dissolve` |
| Toast | 400ms in, 300ms out | `ease-unfurl` / `ease-dissolve` |
| Ember pulse (running) | 3s loop | `ease-cosmic` |
| Background rotation | 60s loop | `linear` |

### Animation categories

1. **Ambient (always on)** — Very slow (60–90s) rotation of a cosmic spiral at 8–12% opacity. Subtle tide-teal nebula wisps drifting across deep backgrounds on 15–20 second cycles. If the user notices the background moving, it is too fast or too bright.
2. **Interaction** — Button hover blooms `var(--glow-warm)`, 180ms. Press scales to 0.97, 120ms. Focus ring unfurls around the focused element, 200ms.
3. **System state (server lifecycle)** — Running → warm ember glow + breathing pulse + subtle background rotation. Stopped → glow fades, everything cools. Error → slow low-frequency Void Crimson pulse (4s cycle), background rotation halts. The stillness communicates wrongness. Building / reloading → thin ember line traces the border of the active panel on a 2s circuit.
4. **Data change** — Save → ember ripple emanates from the save button across the panel, 600ms. Validation error → affected field border shifts to Void Crimson with a single 300ms pulse. Zone reload → active panel cross-fades, 500ms.

Respect `prefers-reduced-motion` — disable ambient rotations and breathing pulses when it's set.

---

## Component design language

### Panels and surfaces

**Primary panel:**
- Background: `var(--bg-panel)` (gradient from Salt Teal to Tidewell at 92–95% opacity)
- Border: 1px Void Edge, optional baroque corner accent at 35% opacity
- Border radius: 14–18px
- Box shadow: `var(--shadow-panel)`
- Optional faint inner ember glow at 40% intensity on active / focused panels

**Elevated panel (modal, popover, flyout):**
- Background: Deep Current
- Border: 1px Void Edge at 50% opacity
- Box shadow: `var(--shadow-panel)` combined with `var(--glow-warm)`
- Backdrop blur 12px (where supported) over underlying content

**Panel header:**
- Cinzel, 12px, uppercase, letter-spacing 0.22em, Weathered Linen color
- Bottom border: 1px Void Edge with a centered subtle flourish

### Buttons

**Primary (creative action — create zone, add mob, apply config):**
- Background: linear gradient from Charred Umber to Hearth Ember
- Text: Ivory Parchment, Cinzel, 13px, letter-spacing 0.5px
- Border: 1px Hearth Ember at 50% opacity
- Box shadow: `var(--glow-warm)`
- Border radius: 8px
- Hover: gradient brightens toward Ember Bloom, glow intensifies, 180ms
- Press: scale 0.97, gradient darkens

**Secondary (structural actions — open editor, view log, navigate):**
- Background: Tidewell
- Text: Weathered Linen, Crimson Pro, 14px
- Border: 1px Void Edge
- Hover: border brightens toward Hearth Ember, text shifts to Ivory Parchment

**Destructive (delete, force-stop, irreversible ops):**
- Background: Charred Umber at very low luminosity
- Text: Void Crimson
- Border: 1px Void Crimson at 60% opacity
- Hover: border and text brighten, slow pulse
- Never uses an ember accent

**Ghost (secondary navigation, inline actions):**
- Background: transparent
- Text: Driftwood
- Border: none
- Hover: text shifts to Ivory Parchment with a faint ember underline

### Input fields

**Default:**
- Background: Midnight Trough
- Border: 1px Void Edge
- Text: Ivory Parchment, Crimson Pro, 14px
- Placeholder: Driftwood
- Border radius: 8px

**Focus:**
- Border: 1px Hearth Ember at 60% opacity
- Box shadow: `0 0 0 2px rgba(255, 125, 0, 0.18)` (soft ember ring)
- Transition: 200ms `ease-unfurl`

**Error:**
- Border: 1px Void Crimson
- Box shadow: `0 0 0 2px rgba(217, 117, 107, 0.2)`

**YAML / code editor:**
- Background: Midnight Trough
- Font: JetBrains Mono, 13px
- Line numbers: Driftwood
- Syntax token colors:
  - Keys: Hearth Ember
  - Strings: Ivory Parchment
  - Numbers: Bright Current
  - Booleans: Ember Bloom
  - Comments: Driftwood, italic
  - Errors: Void Crimson

### Tree views

- Connector lines: gentle SVG arcs in Void Edge at 50% opacity (not right-angle bends)
- Expand / collapse icon: small baroque chevron in Driftwood
- Node text: Crimson Pro, 14px, Weathered Linen
- Selected: Ivory Parchment text, 3px Hearth Ember left border, faint ember background tint
- Hover: subtle background highlight
- Expand animation: 300ms `ease-unfurl` height reveal

### Data tables

- Header row: Cinzel, 12px, uppercase, 0.22em tracking, Weathered Linen
- Header bottom border: 1px Void Edge with a faint centered flourish
- Rows: alternating Tidewell / Harbor Glass at ~3% brightness delta
- Row hover: Deep Current background, 2px Hearth Ember left border
- Selected row: Harbor Glass background, 3px Hearth Ember left border, Ivory Parchment text
- Dividers: 1px Void Edge at 40% opacity

### Server status indicator

The most emotionally expressive component in the tool — it communicates the state of the world the Creator has built.

- **Running:** large ember orb with a breathing pulse (3s cycle, 70–100% opacity). "RUNNING" in Cinzel, Ivory Parchment. Faint warm tint in the surrounding area; subtle ember thread animating around the panel border on a 2s circuit.
- **Stopped:** cool drift-teal orb, no animation. "STOPPED" in Cinzel, Driftwood. Surrounding area fully still. The stillness is the message.
- **Error:** deep Void Crimson orb with a slow 4s pulse (menacing, not urgent). "ERROR" in Cinzel. Surrounding area still, very faint crimson tint. Error message below in Crimson Pro italic.
- **Starting / reloading:** ember thread animation traces the panel border on loop. Orb fades between stopped-cool and running-warm. "STARTING…" / "RELOADING…" in Cinzel at 70% opacity.

### Tabs

- Inactive: Crimson Pro, 14px, Driftwood, no border
- Active: Crimson Pro, 14px, Ivory Parchment, 2px Hearth Ember underline (full tab width)
- Hover: Ivory Parchment text, Void Edge underline
- Transition: 180ms `ease-cosmic`

### Toggles / checkboxes

- Track (off): Void Edge background, 1px Driftwood border, 999px radius
- Track (on): Hearth Ember gradient, 1px Ember Bloom border, soft ember glow
- Thumb: Ivory Parchment circle with `var(--shadow-deep)`
- Transition: 220ms `ease-cosmic`

### Tooltips

- Background: Deep Current at 95% opacity, backdrop blur 8px
- Border: 1px Void Edge
- Text: Crimson Pro, 13px, Ivory Parchment
- Box shadow: `var(--shadow-panel)`
- Border radius: 8px

---

## Art styles

Arcanum supports two art styles for generated content — both selectable from the asset generator. Projects can also override both via the world-defined `visualStyle` field, which feeds into every prompt as a tone directive.

### Arcanum (`arcanum_v2`)

The Creator's own instrument — baroque cosmic ember-against-tide. The style of the Arcanum tool itself and its UI chrome.

- **Palette:** Midnight trough and tide-teal deeps, hearth-ember accents, parchment highlights.
- **Forms:** Baroque / rococo scrollwork as glowing energy threads, fractaline structures, spiral arms of light.
- **Light:** Concentrated ember emanating from active elements, tide-teal ambient fill.
- **Composition:** Cosmological scale, painterly oil technique, objects float in void or baroque architecture.
- **Entity portraits:** Faithful anatomy lit with the ember/tide palette; baroque ornamentation frames the character, not replaces them.

### Gentle Magic (`surreal_softmagic_v1`)

The world as experienced from within — soft, dreamlike, emotionally safe. For MUD world content: rooms, creatures, items, maps.

- **Palette:** Deep mist, lavender, pale blue, dusty rose, moss green, soft gold.
- **Forms:** Gentle curves, organic lived-in quality, slight vertical elongation, micro-warping allowed.
- **Light:** Ambient and diffused, source-ambiguous, ground-level glow, soft bloom, floating motes.
- **Composition:** Dreamlike and breathable, intimate rather than grand, space between elements matters.
- **Entity portraits:** Faithful anatomy with soft ambient lighting; the dreamlike quality enhances the character.

### Asset types

Both styles have templates for the following asset types (defined in `creator/src/lib/arcanumPrompts.ts`):

| Type | Label | Description |
|---|---|---|
| `background` | Background | Full-screen environment art for UI panels |
| `ornament` | Panel Ornament | Horizontal decorative borders and dividers |
| `status_art` | Server Status Art | Server control panel artwork |
| `empty_state` | Empty State | Shown when no content is loaded |
| `entity_portrait` | Entity Portrait | Framed character or creature portrait |
| `ability_sprite` | Ability Sprite | Square icon for abilities |
| `zone_map` | Zone Map | Bird's-eye cartographic world map |
| `splash_hero` | Splash / Welcome | Grand welcome / gateway art |
| `loading_vignette` | Loading Vignette | Centered loading indicator art |
| `panel_header` | Panel Header Bar | Ultra-wide thin decorative banner |
| `room` | Room Scene | Interior / exterior environment for a MUD room |
| `mob` | Creature / NPC | Character or creature portrait |
| `item` | Item / Object | Single object rendered as inventory-style icon |

### Global assets

Generated art can be registered as global assets in `application.yaml` under `ambonmud.globalAssets` — key-value pairs where the key is a semantic name (e.g. `compass_rose`, `login_splash`) and the value is the content-addressed filename (e.g. `abc123def.png`). Global assets are app-wide and served via the same image base URL as entity images.

### Prompt preamble

All Arcanum-style generations include this preamble as a tone anchor:

```
Arcanum style (arcanum_v2): deep midnight and tide-teal ocean backgrounds,
baroque rococo light scrollwork rendered as glowing energy threads, warm
hearth-ember as the primary accent color against cool tide-teal atmospheric
fill, sweeping spiral arms of light, fractaline structures, slow cosmological
scale, no runes or text, no humanoid figures in UI art, no neon colors, no
harsh edges
```

### Universal negative prompt

```
text, words, letters, runes, glyphs, watermarks, logos, signatures, modern
technology, computers, user interfaces, neon colors, hot pink, electric blue,
lime green, harsh shadows, hard edges, flat design, cartoon, anime,
photorealism, studio lighting, stock photo aesthetic, horror elements, gore
```

When the prompt is for an entity portrait or room scene, `humanoid figures` and `faces` are removed from the negative list — those are the subject.

---

## Validation checklist

When reviewing a component, screen, or artwork against this style:

**Scale & weight**
- [ ] Does this feel like it operates at cosmological scale?
- [ ] Is the ember accent used sparingly — only where something is alive or important?
- [ ] Does the midnight background give a sense of infinite depth?

**Ornamentation**
- [ ] Are curves baroque — do they terminate in scrollwork, dissolve, or curl?
- [ ] Are there any abrupt hard edges where there should be a flourish or fade?
- [ ] Is decorative detail present but not cluttered?

**Light behavior**
- [ ] Does ember light have a clear source and bloom softly?
- [ ] Is the tide-teal ambient fill present without competing with the ember?
- [ ] Are glows feathered (no hard-edged halos)?

**Motion**
- [ ] Is all animation unhurried — does nothing snap or bounce?
- [ ] Does the server's running / stopped state feel emotionally distinct?
- [ ] Would the background motion be invisible if the user stopped looking for it?
- [ ] Does it respect `prefers-reduced-motion`?

**Typography**
- [ ] Does all display text use Cinzel?
- [ ] Is Crimson Pro used for body / UI — no sans-serif?
- [ ] Is code / YAML always in JetBrains Mono?

**Tokens**
- [ ] Are all colors drawn from `creator/src/index.css` tokens (`bg-bg-primary`, `text-accent`, etc.)?
- [ ] No hard-coded `rgba()` or px sizes without a semantic token?

**Emotional check**
- [ ] Does this feel like the Creator's instrument?
- [ ] Does the ember feel earned?
- [ ] Is this unmistakably different from a modern SaaS dashboard?
- [ ] Would someone opening this tool for the first time feel the weight of what they're about to do?

**If it feels like a modern productivity tool, it has drifted. Revise.**
