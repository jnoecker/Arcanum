// ─── Theme system ───────────────────────────────────────────────────
// 4-color theme palettes derive the full set of CSS custom properties used
// throughout the app. The user picks (or pastes) Background, Surface, Text,
// and Accent — everything else is derived from those four anchors.
//
// Status colors, class identity colors, lore template colors, diff colors,
// and chart colors are intentionally NOT themed — they are semantic.

export interface ThemePalette {
  /** Name shown in the UI. */
  name: string;
  /** Darkest color — drives the abyss / page background. */
  background: string;
  /** Mid surface — drives panels, sections, hover states, borders. */
  surface: string;
  /** Light color — drives primary text. */
  text: string;
  /** Saturated pop — drives accent, links, glows, active states. */
  accent: string;
}

export const DEFAULT_THEME: ThemePalette = {
  name: "Arcanum (default)",
  background: "#22293c",
  surface: "#313a56",
  text: "#dbe3f8",
  accent: "#a897d2",
};

/** Built-in palettes the user can apply with one click. */
export const PRESET_THEMES: ThemePalette[] = [
  DEFAULT_THEME,
  {
    name: "Aurum Dusk",
    background: "#1a1410",
    surface: "#2e241c",
    text: "#f0e4d0",
    accent: "#c8a46a",
  },
  {
    name: "Verdant Hollow",
    background: "#0f1a14",
    surface: "#1d2e23",
    text: "#dbe8d6",
    accent: "#8da97b",
  },
  {
    name: "Cinder Rose",
    background: "#1a0f14",
    surface: "#2c1a23",
    text: "#f3dde2",
    accent: "#d68aa0",
  },
  {
    name: "Tidepool",
    background: "#0c1820",
    surface: "#162a36",
    text: "#d6e8f0",
    accent: "#6fb5c7",
  },
  {
    name: "Lichen",
    background: "#13181a",
    surface: "#222b2c",
    text: "#dde6e2",
    accent: "#a3c48e",
  },
];

// ─── Color math ─────────────────────────────────────────────────────

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): RGB {
  const m = hex.replace("#", "").trim();
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(v, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
  return "#" + [c(r), c(g), c(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}

/** Linearly mix two hex colors. t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  return rgbToHex({
    r: ra.r + (rb.r - ra.r) * t,
    g: ra.g + (rb.g - ra.g) * t,
    b: ra.b + (rb.b - ra.b) * t,
  });
}

/** Relative luminance (0..1) for a hex color, per WCAG. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// ─── Derivation ─────────────────────────────────────────────────────

/** Build the full CSS-variable map from a 4-color palette. */
export function themeToVars(theme: ThemePalette): Record<string, string> {
  const bg = theme.background;
  const surface = theme.surface;
  const text = theme.text;
  const accent = theme.accent;

  // Background ramp: darker than bg for the abyss, then surface, with lighter
  // variants mixed toward the surface color.
  const abyss = mix(bg, "#000000", 0.18);
  const bgPrimary = bg;
  const bgSecondary = mix(bg, surface, 0.4);
  const bgTertiary = surface;
  const bgElevated = surface;
  const bgHover = mix(surface, text, 0.08);

  // Borders: from muted (closer to surface) to default (mid) to accent-tinted focus.
  const borderMuted = mix(surface, text, 0.05);
  const borderDefault = mix(surface, text, 0.18);
  const borderFocus = accent;

  // Text ramp: primary is the literal text color, lower tiers mix toward bg.
  const textPrimary = text;
  const textSecondary = mix(text, bg, 0.22);
  const textMuted = mix(text, bg, 0.42);

  // Accent variants.
  const accentMuted = mix(accent, bg, 0.22);
  const accentEmphasis = text;

  // Warm: a tonally shifted version of the accent — slightly toward the
  // complementary warm side. We just use accent-mixed-with-text for a softer
  // glow band when the accent itself is cool.
  const warm = accent;
  const warmPale = mix(accent, text, 0.38);
  const warmDeep = mix(accent, bg, 0.42);

  // Surface scrims (panel backdrops).
  const scrim = rgba(bg, 0.72);
  const scrimLight = rgba(bg, 0.46);

  // Graph backgrounds — keep them tied to bg ramp.
  const graphBg = mix(bg, "#000000", 0.32);
  const graphGrid = mix(bg, surface, 0.5);
  const graphNode = surface;
  const graphEdge = mix(surface, text, 0.32);
  const graphEdgeUp = accent;

  return {
    // ─── Backgrounds ─────────────────────────────────────
    "--color-bg-abyss": abyss,
    "--color-bg-primary": bgPrimary,
    "--color-bg-secondary": bgSecondary,
    "--color-bg-tertiary": bgTertiary,
    "--color-bg-elevated": bgElevated,
    "--color-bg-hover": bgHover,

    // ─── Borders ─────────────────────────────────────────
    "--color-border-default": borderDefault,
    "--color-border-muted": borderMuted,
    "--color-border-focus": borderFocus,
    "--color-border-active": rgba(accent, 0.35),

    // ─── Text ────────────────────────────────────────────
    "--color-text-primary": textPrimary,
    "--color-text-secondary": textSecondary,
    "--color-text-muted": textMuted,
    "--color-text-link": accent,
    "--color-text-dirty": mix(accent, text, 0.3),

    // ─── Accent ──────────────────────────────────────────
    "--color-accent": accent,
    "--color-accent-muted": accentMuted,
    "--color-accent-emphasis": accentEmphasis,

    // ─── Warm (decorative, tracks accent) ────────────────
    "--color-warm": warm,
    "--color-warm-pale": warmPale,
    "--color-warm-deep": warmDeep,

    // ─── Surfaces ────────────────────────────────────────
    "--color-surface-scrim": scrim,
    "--color-surface-scrim-light": scrimLight,

    // ─── Graph (zone map) ────────────────────────────────
    "--color-graph-bg": graphBg,
    "--color-graph-grid": graphGrid,
    "--color-graph-node": graphNode,
    "--color-graph-edge": graphEdge,
    "--color-graph-edge-up": graphEdgeUp,

    // ─── Derived rgba tokens (the :root block) ───────────
    "--glow-accent": `0 0 32px ${rgba(accent, 0.28)}`,
    "--glow-accent-strong": `0 0 48px ${rgba(text, 0.32)}`,
    "--glow-warm": `0 0 32px ${rgba(warm, 0.32)}`,
    "--glow-warm-strong": `0 0 48px ${rgba(warmPale, 0.42)}`,
    "--glow-violet": `0 0 28px ${rgba(accent, 0.24)}`,
    "--glow-blue": `0 0 24px ${rgba(mix(accent, text, 0.4), 0.22)}`,

    "--border-accent-ring": rgba(accent, 0.45),
    "--border-accent-subtle": rgba(accent, 0.35),
    "--border-glow": rgba(text, 0.25),
    "--border-glow-strong": rgba(text, 0.48),

    "--bg-accent-subtle": rgba(accent, 0.14),
    "--bg-accent-hover": rgba(accent, 0.2),

    "--bg-active": `linear-gradient(135deg, ${rgba(accent, 0.16)}, ${rgba(mix(accent, text, 0.4), 0.12)})`,
    "--bg-active-strong": `linear-gradient(135deg, ${rgba(accent, 0.18)}, ${rgba(mix(accent, text, 0.4), 0.14)})`,
    "--bg-panel": `linear-gradient(160deg, ${rgba(mix(surface, text, 0.05), 0.95)}, ${rgba(bgPrimary, 0.92)})`,
    "--bg-panel-light": `linear-gradient(160deg, ${rgba(mix(surface, text, 0.08), 0.9)}, ${rgba(mix(bgPrimary, surface, 0.4), 0.92)})`,
    "--bg-glow-top": `linear-gradient(180deg, ${rgba(accent, 0.18)}, transparent)`,
    "--graph-minimap-mask": rgba(graphBg, 0.8),
  };
}

/** Apply a theme by writing every derived variable onto :root. */
export function applyTheme(theme: ThemePalette): void {
  const vars = themeToVars(theme);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
}

/** Reset all theme variables (falls back to the @theme block in index.css). */
export function clearTheme(): void {
  const root = document.documentElement;
  for (const k of Object.keys(themeToVars(DEFAULT_THEME))) {
    root.style.removeProperty(k);
  }
}

// ─── Persistence ────────────────────────────────────────────────────

const STORAGE_KEY = "arcanum.theme.v1";

export function loadStoredTheme(): ThemePalette | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ThemePalette>;
    if (
      typeof parsed.background === "string" &&
      typeof parsed.surface === "string" &&
      typeof parsed.text === "string" &&
      typeof parsed.accent === "string"
    ) {
      return {
        name: typeof parsed.name === "string" ? parsed.name : "Custom",
        background: parsed.background,
        surface: parsed.surface,
        text: parsed.text,
        accent: parsed.accent,
      };
    }
  } catch (err) {
    console.error("Failed to read stored theme:", err);
  }
  return null;
}

export function saveStoredTheme(theme: ThemePalette | null): void {
  try {
    if (theme === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
    }
  } catch (err) {
    console.error("Failed to write stored theme:", err);
  }
}

/** Validate a hex color string. */
export function isValidHex(s: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(s.trim()) || /^#?[0-9a-fA-F]{3}$/.test(s.trim());
}

/** Normalize to a #rrggbb 7-char string. */
export function normalizeHex(s: string): string {
  const t = s.trim().replace(/^#/, "");
  const full = t.length === 3 ? t.split("").map((c) => c + c).join("") : t;
  return "#" + full.toLowerCase();
}

/** Parse a free-form palette paste (whitespace, commas, newlines) into 4 hexes. */
export function parsePalettePaste(input: string): string[] | null {
  const tokens = input.match(/#?[0-9a-fA-F]{6}/g);
  if (!tokens || tokens.length < 4) return null;
  return tokens.slice(0, 4).map(normalizeHex);
}
