/**
 * Read CSS custom properties at runtime so JS-driven visualizations
 * (ReactFlow, SVG charts) stay in sync with design tokens in index.css.
 *
 * Falls back gracefully when no DOM is available (e.g. tests).
 */

let _root: CSSStyleDeclaration | null = null;

function root(): CSSStyleDeclaration | null {
  if (_root) return _root;
  if (typeof document === "undefined") return null;
  _root = getComputedStyle(document.documentElement);
  return _root;
}

export function cssVar(name: string): string {
  return root()?.getPropertyValue(name).trim() ?? "";
}

/** Graph / zone-map palette — mirrors --color-graph-* tokens. */
export function graphTokens() {
  return {
    bg:     cssVar("--color-graph-bg"),
    edge:   cssVar("--color-graph-edge"),
    edgeUp: cssVar("--color-graph-edge-up"),
    cross:  cssVar("--color-graph-cross"),
    door:   cssVar("--color-graph-door"),
    grid:   cssVar("--color-graph-grid"),
    node:   cssVar("--color-graph-node"),
  } as const;
}

/** Class identity palette — mirrors --color-class-* tokens. */
export function classColor(classId: string): string {
  const key = `--color-class-${classId.toLowerCase()}`;
  const val = cssVar(key);
  return val || cssVar("--color-class-fallback");
}

/** Chart palette — mirrors --color-chart-* tokens. */
export function chartTokens() {
  return {
    hp:   cssVar("--color-chart-hp"),
    mana: cssVar("--color-chart-mana"),
  } as const;
}
