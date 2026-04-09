// Theme system
// 4-color theme palettes derive the full set of CSS custom properties used
// throughout the app. The user picks (or pastes) Background, Surface, Text,
// and Accent. Everything else is derived from those four anchors.
//
// Status colors, class identity colors, lore template colors, diff colors,
// and chart colors are intentionally NOT themed. They are semantic.

export interface ThemePalette {
  /** Name shown in the UI. */
  name: string;
  /** Background anchor. Drives the page and large chrome surfaces. */
  background: string;
  /** Mid surface. Drives panels, sections, hover states, and borders. */
  surface: string;
  /** Primary text anchor. */
  text: string;
  /** Saturated pop. Drives accent, links, glows, and active states. */
  accent: string;
}

export const DEFAULT_THEME: ThemePalette = {
  name: "Arcanum (default)",
  background: "#001524",
  surface: "#15616d",
  text: "#ffecd1",
  accent: "#ff7d00",
};

/** Built-in palettes the user can apply with one click. */
export const PRESET_THEMES: ThemePalette[] = [
  DEFAULT_THEME,
  {
    name: "Parchment (light)",
    background: "#f4ede0",
    surface: "#e6dcc6",
    text: "#2a2418",
    accent: "#8a5a2b",
  },
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

// Color math

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

/** Space-separated R G B tuple suitable for `rgb(var(--xxx-rgb) / alpha)` syntax. */
export function rgbTuple(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`;
}

/** Linearly mix two hex colors. t=0 -> a, t=1 -> b. */
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

/** WCAG contrast ratio between two hex colors. */
export function contrastRatio(a: string, b: string): number {
  const lighter = Math.max(luminance(a), luminance(b));
  const darker = Math.min(luminance(a), luminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

// Derivation

/** Build the full CSS-variable map from a 4-color palette. */
export function themeToVars(theme: ThemePalette): Record<string, string> {
  const bg = theme.background;
  const surface = theme.surface;
  const text = theme.text;
  const accent = theme.accent;

  // Determine whether the palette is light-on-dark or dark-on-light from the
  // relationship between the background and text anchors.
  const bgLum = luminance(bg);
  const textLum = luminance(text);
  const isLight = bgLum >= textLum;

  // Background ramp.
  const abyss = isLight ? mix(bg, text, 0.10) : mix(bg, "#000000", 0.18);
  const bgPrimary = bg;
  const bgSecondary = isLight ? mix(bg, surface, 0.62) : mix(bg, surface, 0.4);
  const bgTertiary = surface;
  const bgElevated = isLight ? mix(surface, "#ffffff", 0.14) : surface;
  const bgHover = isLight ? mix(surface, text, 0.10) : mix(surface, text, 0.08);

  // Borders.
  const borderMuted = isLight ? mix(surface, text, 0.10) : mix(surface, text, 0.05);
  const borderDefault = isLight ? mix(surface, text, 0.22) : mix(surface, text, 0.18);
  const borderFocus = accent;

  // Text ramp.
  const textPrimary = text;
  const textSecondary = isLight ? mix(text, bg, 0.14) : mix(text, bg, 0.22);
  const textMuted = isLight ? mix(text, bg, 0.32) : mix(text, bg, 0.42);

  // Accent variants.
  const accentMuted = mix(accent, bg, isLight ? 0.18 : 0.22);
  const accentEmphasis = text;

  // Warm accent follows the single accent anchor.
  const warm = accent;
  const warmPale = mix(accent, text, 0.38);
  const warmDeep = mix(accent, bg, 0.42);

  // Surface scrims.
  const scrim = isLight ? rgba(mix(surface, text, 0.08), 0.84) : rgba(bg, 0.72);
  const scrimLight = isLight ? rgba(mix(surface, bg, 0.40), 0.72) : rgba(bg, 0.46);

  // Graph backgrounds.
  const graphBg = isLight ? mix(bg, text, 0.06) : mix(bg, "#000000", 0.32);
  const graphGrid = isLight ? mix(bg, text, 0.18) : mix(bg, surface, 0.5);
  const graphNode = surface;
  const graphEdge = mix(surface, text, isLight ? 0.44 : 0.32);
  const graphEdgeUp = accent;

  // Choose whichever anchor contrasts more strongly on accent-filled surfaces.
  const textOnAccent = contrastRatio(accent, text) >= contrastRatio(accent, bg)
    ? text
    : bg;

  // Chrome tokens. Light themes lean on inked overlays and real shadows
  // instead of whitening everything into haze.
  const strokeColor = text;
  const fillColor = isLight ? mix(surface, text, 0.16) : mix(bg, "#000000", 0.72);
  const highlightColor = isLight ? text : "#ffffff";
  const shadowColor = isLight ? text : "#000000";
  const overlayColor = isLight ? text : abyss;

  const panelTop = isLight ? mix(surface, "#ffffff", 0.14) : surface;
  const panelBottom = isLight ? mix(bg, text, 0.04) : bg;
  const panelLightTop = isLight ? mix(surface, "#ffffff", 0.24) : surface;
  const panelLightBottom = isLight ? mix(bg, text, 0.02) : bg;

  const activeStart = isLight ? 0.18 : 0.16;
  const activeEnd = isLight ? 0.09 : 0.10;
  const activeStrongStart = isLight ? 0.26 : 0.22;
  const activeStrongEnd = isLight ? 0.15 : 0.14;
  const glowTopAlpha = isLight ? 0.12 : 0.18;
  const bodyGlowPrimary = isLight ? 0.10 : 0.18;
  const bodyGlowSecondary = isLight ? 0.06 : 0.10;

  return {
    "--theme-mode": isLight ? "light" : "dark",

    "--bg-rgb": rgbTuple(bg),
    "--surface-rgb": rgbTuple(surface),
    "--text-rgb": rgbTuple(text),
    "--accent-rgb": rgbTuple(accent),
    "--abyss-rgb": rgbTuple(abyss),
    "--stroke-rgb": rgbTuple(strokeColor),
    "--fill-rgb": rgbTuple(fillColor),
    "--highlight-rgb": rgbTuple(highlightColor),
    "--shadow-rgb": rgbTuple(shadowColor),
    "--overlay-rgb": rgbTuple(overlayColor),

    "--color-bg-abyss": abyss,
    "--color-bg-primary": bgPrimary,
    "--color-bg-secondary": bgSecondary,
    "--color-bg-tertiary": bgTertiary,
    "--color-bg-elevated": bgElevated,
    "--color-bg-hover": bgHover,

    "--color-border-default": borderDefault,
    "--color-border-muted": borderMuted,
    "--color-border-focus": borderFocus,
    "--color-border-active": rgba(accent, 0.35),

    "--color-text-primary": textPrimary,
    "--color-text-secondary": textSecondary,
    "--color-text-muted": textMuted,
    "--color-text-link": accent,
    "--color-text-dirty": mix(accent, text, 0.3),
    "--color-text-on-accent": textOnAccent,

    "--color-accent": accent,
    "--color-accent-muted": accentMuted,
    "--color-accent-emphasis": accentEmphasis,

    "--color-warm": warm,
    "--color-warm-pale": warmPale,
    "--color-warm-deep": warmDeep,

    "--color-surface-scrim": scrim,
    "--color-surface-scrim-light": scrimLight,
    "--color-surface-card": rgba(mix(surface, text, 0.05), 0.6),

    "--chrome-stroke": "rgb(var(--stroke-rgb) / 0.10)",
    "--chrome-stroke-strong": "rgb(var(--stroke-rgb) / 0.16)",
    "--chrome-stroke-emphasis": "rgb(var(--stroke-rgb) / 0.22)",
    "--chrome-fill": "rgb(var(--fill-rgb) / 0.16)",
    "--chrome-fill-soft": "rgb(var(--fill-rgb) / 0.08)",
    "--chrome-fill-strong": "rgb(var(--fill-rgb) / 0.32)",
    "--chrome-highlight": "rgb(var(--highlight-rgb) / 0.06)",
    "--chrome-highlight-strong": "rgb(var(--highlight-rgb) / 0.12)",

    "--color-graph-bg": graphBg,
    "--color-graph-grid": graphGrid,
    "--color-graph-node": graphNode,
    "--color-graph-edge": graphEdge,
    "--color-graph-edge-up": graphEdgeUp,

    "--glow-accent": "0 0 32px rgb(var(--accent-rgb) / 0.28)",
    "--glow-accent-strong": isLight
      ? "0 0 40px rgb(var(--accent-rgb) / 0.18)"
      : "0 0 48px rgb(var(--text-rgb) / 0.32)",
    "--glow-warm": "0 0 32px rgb(var(--accent-rgb) / 0.32)",
    "--glow-warm-strong": `0 0 48px ${rgba(warmPale, 0.42)}`,
    "--glow-violet": "0 0 28px rgb(var(--accent-rgb) / 0.24)",
    "--glow-blue": "0 0 24px rgb(var(--accent-rgb) / 0.22)",

    "--border-accent-ring": "rgb(var(--accent-rgb) / 0.45)",
    "--border-accent-subtle": "rgb(var(--accent-rgb) / 0.35)",
    "--border-glow": isLight
      ? "rgb(var(--accent-rgb) / 0.22)"
      : "rgb(var(--text-rgb) / 0.25)",
    "--border-glow-strong": isLight
      ? "rgb(var(--accent-rgb) / 0.36)"
      : "rgb(var(--text-rgb) / 0.48)",

    "--bg-accent-subtle": "rgb(var(--accent-rgb) / 0.14)",
    "--bg-accent-hover": "rgb(var(--accent-rgb) / 0.20)",

    "--bg-active": `linear-gradient(135deg, rgb(var(--accent-rgb) / ${activeStart}), rgb(var(--accent-rgb) / ${activeEnd}))`,
    "--bg-active-strong": `linear-gradient(135deg, rgb(var(--accent-rgb) / ${activeStrongStart}), rgb(var(--accent-rgb) / ${activeStrongEnd}))`,
    "--bg-panel": `linear-gradient(160deg, ${rgba(panelTop, 0.96)}, ${rgba(panelBottom, 0.92)})`,
    "--bg-panel-light": `linear-gradient(160deg, ${rgba(panelLightTop, 0.88)}, ${rgba(panelLightBottom, 0.88)})`,
    "--bg-glow-top": `linear-gradient(180deg, rgb(var(--accent-rgb) / ${glowTopAlpha}), transparent)`,
    "--graph-minimap-mask": rgba(graphBg, 0.8),

    "--body-bg": `radial-gradient(circle at 14% 12%, rgb(var(--accent-rgb) / ${bodyGlowPrimary}), transparent 36%), radial-gradient(circle at 84% 14%, rgb(var(--accent-rgb) / ${bodyGlowSecondary}), transparent 34%), linear-gradient(180deg, ${bgPrimary} 0%, ${abyss} 100%)`,
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

// Persistence

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

/** Parse a free-form palette paste (whitespace, commas, newlines) into 4+ hexes. */
export function parsePalettePaste(input: string): string[] | null {
  const tokens = input.match(/#?[0-9a-fA-F]{6}/g);
  if (!tokens || tokens.length < 4) return null;
  return [...new Set(tokens.map(normalizeHex))];
}
