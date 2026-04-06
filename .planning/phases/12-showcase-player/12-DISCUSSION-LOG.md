# Phase 12: Showcase Player - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 12-Showcase Player
**Areas discussed:** Animation strategy, Story discovery & routing, Player chrome & controls, Scroll-driven mode

---

## Animation Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Add Motion to showcase | Port CinematicRenderer directly. ~30KB gzipped, exact parity with creator. LazyMotion + tree-shaking. | ✓ |
| CSS-only rebuild | Rebuild with CSS @keyframes. Zero deps but reimplements everything, risk of visual drift. | |
| Lightweight JS animation lib | Smaller lib (popmotion ~5KB) but requires rewriting all Motion APIs. Significant adaptation. | |

**User's choice:** Add Motion to showcase
**Notes:** Direct port for exact parity was the priority.

### Code Sharing Follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Copy to showcase | Copy renderer + supporting components into showcase/src/components/player/. Independent evolution. | ✓ |
| Shared package/workspace | Extract into shared package. True single source but monorepo complexity. | |
| Build-time copy script | Script copies from creator before build. Fragile if paths change. | |

**User's choice:** Copy to showcase
**Notes:** Independent copies, no cross-project build complexity.

---

## Story Discovery & Routing

| Option | Description | Selected |
|--------|-------------|----------|
| New "Stories" nav item | Add Stories page to main nav. /stories listing + /stories/:id player. Story articles in Codex link to player. | ✓ |
| Embedded in Codex article | No separate nav. Story articles get embedded player below content. | |
| Both: nav + article embed | Stories page in nav plus "Play Story" button on story articles. Two entry points. | |

**User's choice:** New "Stories" nav item
**Notes:** None

### Listing Page Follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Cover image cards | Grid of cards with cover image, title, scene count, zone name. Like featured articles grid. | ✓ |
| Cinematic hero list | Vertical list with large full-width cover images, title overlaid. Like streaming service. | |
| You decide | Claude picks layout | |

**User's choice:** Cover image cards
**Notes:** None

### Export Format Follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Extend ShowcaseData with stories[] | Add stories array to showcase.json. Each story includes resolved scene data. Via existing "Publish Lore" flow. | ✓ |
| Separate story JSON files | Each story as separate JSON on R2. Lazy load on demand. | |
| You decide | Claude picks | |

**User's choice:** Extend ShowcaseData with stories[]
**Notes:** None

---

## Player Chrome & Controls

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom control bar | Persistent bar with prev/next, play/pause, scene counter, mode switcher. Like video player. | ✓ |
| Auto-hiding overlay | Controls appear on hover/tap, fade after 3s. Like YouTube. More immersive. | |
| Minimal — keyboard hint only | Almost no chrome. Scene counter + first-visit hint. | |

**User's choice:** Bottom control bar
**Notes:** None

### Auto-play Timing Follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed presets: 5s, 10s, 15s | Dropdown with 3 presets. Default 10s. Timer resets on manual nav. | ✓ |
| Narration-aware timing | Wait for typewriter to finish + configurable pause. | |
| Custom input field | Number input for any interval (3-30s). | |

**User's choice:** Fixed presets: 5s, 10s, 15s
**Notes:** None

### Layout Follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Within layout, 16:9 player area | Nav header visible. 16:9 container centered. Title above, controls below. | ✓ |
| Full viewport with back button | Full viewport takeover. Back arrow in top-left. | |

**User's choice:** Within layout, 16:9 player area
**Notes:** None

---

## Scroll-Driven Mode

| Option | Description | Selected |
|--------|-------------|----------|
| Mode switcher in control bar | Toggle: Click-through / Auto-play / Scroll. Scroll mode expands to vertical snap layout. Control bar hides. | ✓ |
| Scroll is a separate URL/route | /stories/:id for click, /stories/:id/scroll for scroll. Two pages. | |
| Scroll is the only mode | Always vertical scroll-snap. Click/keyboard scroll to next snap. Simplest. | |

**User's choice:** Mode switcher in control bar
**Notes:** None

### Scroll Animation Follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Animate on snap | IntersectionObserver triggers entrance animations when scene snaps into view. Back = final state. | ✓ |
| Static scenes, no animation | All scenes in final state. Visual storyboard. Simpler. | |
| Parallax-like scroll effects | Subtle parallax layers respond to scroll position. More complex. | |

**User's choice:** Animate on snap
**Notes:** Consistent with Phase 11 D-12 (backward = final state, no re-animation).

### Mobile Follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, mobile-first scroll | Native touch/swipe with CSS scroll-snap. Swipe up = next, down = prev. No custom gestures. | ✓ |
| Desktop only, tap controls on mobile | Scroll mode disabled on mobile. Tap to advance instead. | |
| You decide | Claude picks based on browser compat research. | |

**User's choice:** Yes, mobile-first scroll
**Notes:** None

---

## Claude's Discretion

- Exact story card dimensions and hover effects
- CinematicRenderer adaptation for showcase context
- Control bar icon choices and styling
- Mode switcher UI pattern
- "Play Story" button design on Codex article pages
- Mode switching behavior mid-story
- ShowcaseStory interface shape
- Empty state for StoriesPage
- Scroll mode viewport behavior

## Deferred Ideas

None — discussion stayed within phase scope.
