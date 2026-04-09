import { useEffect, useMemo, useState } from "react";
import { useThemeStore } from "@/stores/themeStore";
import {
  DEFAULT_THEME,
  PRESET_THEMES,
  contrastRatio,
  isValidHex,
  luminance,
  normalizeHex,
  parsePalettePaste,
  type ThemePalette,
} from "@/lib/theme";

type Slot = "background" | "surface" | "text" | "accent";
type PasteMode = "dark" | "light";

const SLOT_META: { key: Slot; label: string; help: string }[] = [
  {
    key: "background",
    label: "Background",
    help: "Page background and outer chrome. Use the lightest swatch for light themes or the darkest for dark themes.",
  },
  {
    key: "surface",
    label: "Surface",
    help: "Panels, sections, and inputs. Keep it clearly distinct from the page background.",
  },
  {
    key: "text",
    label: "Text",
    help: "Primary text color. It needs strong contrast against both background and surface.",
  },
  {
    key: "accent",
    label: "Accent",
    help: "Links, focus rings, selected states, and decorative glow.",
  },
];

function paletteMode(theme: Pick<ThemePalette, "background" | "text">): PasteMode {
  return luminance(theme.background) >= luminance(theme.text) ? "light" : "dark";
}

function chroma(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function buildPaletteFromPaste(colors: string[], mode: PasteMode): ThemePalette {
  const unique = [...new Set(colors)];
  const sorted = [...unique].sort((a, b) => luminance(a) - luminance(b));
  const darkest = sorted[0]!;
  const lightest = sorted[sorted.length - 1]!;
  const background = mode === "light" ? lightest : darkest;
  const text = mode === "light" ? darkest : lightest;
  const candidates = unique.filter((color) => color !== background && color !== text);

  const fallbackAccent = mode === "light"
    ? sorted[Math.max(0, sorted.length - 2)] ?? background
    : sorted[1] ?? text;
  const accent = candidates.length > 0
    ? candidates.reduce((best, color) => {
        const bestChroma = chroma(best);
        const colorChroma = chroma(color);
        if (colorChroma !== bestChroma) {
          return colorChroma > bestChroma ? color : best;
        }
        return contrastRatio(color, background) > contrastRatio(best, background) ? color : best;
      }, candidates[0]!)
    : fallbackAccent;

  const surfaceCandidates = candidates.filter((color) => color !== accent);
  const backgroundLum = luminance(background);
  const textLum = luminance(text);
  const targetLum = backgroundLum + (textLum - backgroundLum) * (mode === "light" ? 0.2 : 0.28);
  const fallbackSurface = mode === "light"
    ? sorted[Math.max(0, sorted.length - 2)] ?? accent
    : sorted[Math.min(1, sorted.length - 1)] ?? accent;
  const surface = surfaceCandidates.length > 0
    ? surfaceCandidates.reduce((best, color) => {
        const bestScore = Math.abs(luminance(best) - targetLum) + chroma(best) / 2550;
        const colorScore = Math.abs(luminance(color) - targetLum) + chroma(color) / 2550;
        return colorScore < bestScore ? color : best;
      }, surfaceCandidates[0]!)
    : fallbackSurface;

  return mode === "light"
    ? { name: "Custom (pasted)", background, surface, text, accent }
    : { name: "Custom (pasted)", background, surface, text, accent };
}

function textOnAccent(palette: Pick<ThemePalette, "background" | "text" | "accent">): string {
  return contrastRatio(palette.accent, palette.text) >= contrastRatio(palette.accent, palette.background)
    ? palette.text
    : palette.background;
}

function PresetCard({
  preset,
  active,
  onSelect,
}: {
  preset: ThemePalette;
  active: boolean;
  onSelect: () => void;
}) {
  const swatches: Slot[] = ["background", "surface", "text", "accent"];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group flex flex-col gap-2 rounded-xl border p-3 text-left transition focus-ring ${
        active
          ? "border-accent/60 bg-accent/10"
          : "border-border-muted bg-bg-secondary/50 hover:border-accent/40 hover:bg-bg-hover/40"
      }`}
    >
      <div className="flex h-12 overflow-hidden rounded-md border border-border-muted">
        {swatches.map((slot) => (
          <div
            key={slot}
            className="flex-1"
            style={{ background: preset[slot] }}
            aria-hidden
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-sm text-text-primary">{preset.name}</span>
        <span className="text-3xs uppercase tracking-ui text-text-muted">
          {paletteMode(preset)}
        </span>
      </div>
      {active && <span className="text-3xs uppercase tracking-ui text-accent">Active</span>}
    </button>
  );
}

function SlotEditor({
  slot,
  value,
  onChange,
}: {
  slot: { key: Slot; label: string; help: string };
  value: string;
  onChange: (hex: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  const commit = (raw: string) => {
    if (isValidHex(raw)) onChange(normalizeHex(raw));
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border-muted bg-bg-secondary/40 p-3">
      <div className="flex items-center justify-between">
        <label className="font-display text-sm text-text-primary">{slot.label}</label>
        <span className="text-3xs uppercase tracking-ui text-text-muted">
          L {(luminance(value) * 100).toFixed(0)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded-md border border-border-muted bg-bg-primary"
          aria-label={`${slot.label} color picker`}
        />
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => commit(text)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit(text);
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="#001524"
          className="ornate-input flex-1 font-mono text-xs"
          spellCheck={false}
        />
      </div>
      <p className="text-2xs text-text-muted">{slot.help}</p>
    </div>
  );
}

function PreviewCard({ palette }: { palette: ThemePalette }) {
  const mode = paletteMode(palette);
  const onAccent = textOnAccent(palette);

  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        background: `linear-gradient(160deg, ${palette.surface}, ${palette.background})`,
        borderColor: palette.surface,
        color: palette.text,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className="text-3xs uppercase"
          style={{ letterSpacing: "0.32em", color: palette.accent, opacity: 0.85 }}
        >
          Preview
        </p>
        <span className="text-3xs uppercase tracking-ui" style={{ color: palette.text, opacity: 0.65 }}>
          {mode} theme
        </span>
      </div>
      <h3 className="mt-2 font-display text-2xl" style={{ color: palette.text }}>
        Ember tide across the deep
      </h3>
      <p className="mt-2 text-sm leading-6" style={{ color: palette.text, opacity: 0.78 }}>
        This preview shows how the page, panel, text, and accent anchors work together before you save.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-full px-4 py-1.5 font-display text-xs"
          style={{
            background: palette.accent,
            color: onAccent,
            border: `1px solid ${palette.accent}`,
          }}
        >
          Primary action
        </button>
        <button
          type="button"
          className="rounded-full px-4 py-1.5 text-xs"
          style={{
            background: "transparent",
            color: palette.accent,
            border: `1px solid ${palette.accent}66`,
          }}
        >
          Secondary
        </button>
        <a className="text-xs underline" style={{ color: palette.accent }}>
          Linked text
        </a>
      </div>
    </div>
  );
}

export function AppearancePanel() {
  const persisted = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const previewTheme = useThemeStore((s) => s.previewTheme);
  const cancelPreview = useThemeStore((s) => s.cancelPreview);

  const initial: ThemePalette = persisted ?? DEFAULT_THEME;
  const [draft, setDraft] = useState<ThemePalette>(initial);
  const [pasteValue, setPasteValue] = useState("");
  const [pasteMode, setPasteMode] = useState<PasteMode>(paletteMode(initial));
  const [pasteError, setPasteError] = useState<string | null>(null);

  useEffect(() => {
    previewTheme(draft);
  }, [draft, previewTheme]);

  useEffect(() => {
    return () => {
      cancelPreview();
    };
  }, [cancelPreview]);

  const dirty = useMemo(() => {
    const baseline = persisted ?? DEFAULT_THEME;
    return (
      draft.background !== baseline.background ||
      draft.surface !== baseline.surface ||
      draft.text !== baseline.text ||
      draft.accent !== baseline.accent ||
      draft.name !== baseline.name
    );
  }, [draft, persisted]);

  const mode = useMemo(() => paletteMode(draft), [draft]);

  const contrastWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (contrastRatio(draft.background, draft.text) < 7) {
      warnings.push("Background and text are too close. Large app surfaces will be tiring to read.");
    }
    if (contrastRatio(draft.surface, draft.text) < 4.5) {
      warnings.push("Panel text contrast is low. Editors and form rows may become hard to scan.");
    }
    if (contrastRatio(draft.accent, textOnAccent(draft)) < 4.5) {
      warnings.push("Accent-filled buttons may not have enough contrast for their label text.");
    }
    if (Math.abs(luminance(draft.background) - luminance(draft.surface)) < 0.06) {
      warnings.push("Background and surface are very close. The app may feel flat or washed out.");
    }
    return warnings;
  }, [draft]);

  const updateSlot = (slot: Slot, hex: string) => {
    setDraft((d) => ({ ...d, name: "Custom", [slot]: hex }));
  };

  const applyPreset = (preset: ThemePalette) => {
    setDraft({ ...preset });
    setPasteMode(paletteMode(preset));
  };

  const handlePaste = () => {
    setPasteError(null);
    const parsed = parsePalettePaste(pasteValue);
    if (!parsed || parsed.length < 4) {
      setPasteError("Need 4 hex colors. Paste them in any order.");
      return;
    }
    setDraft(buildPaletteFromPaste(parsed, pasteMode));
    setPasteValue("");
  };

  const handleSave = () => {
    setTheme(draft);
  };

  const handleReset = () => {
    setTheme(null);
    setDraft({ ...DEFAULT_THEME });
    setPasteMode(paletteMode(DEFAULT_THEME));
  };

  const handleRevert = () => {
    const baseline = persisted ?? DEFAULT_THEME;
    setDraft({ ...baseline });
    setPasteMode(paletteMode(baseline));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-6">
        <header>
          <p className="text-3xs uppercase tracking-wide-ui text-text-muted">Operations</p>
          <h2 className="mt-2 font-display text-3xl text-text-primary">Appearance</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
            Pick a 4-color anchor palette to retheme the entire app. Background, Surface, Text, and
            Accent drive every UI surface while semantic colors stay fixed.
          </p>
        </header>

        <section className="panel-surface rounded-3xl p-5 shadow-section">
          <h3 className="mb-3 font-display text-lg text-text-primary">Presets</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
            {PRESET_THEMES.map((p) => (
              <PresetCard
                key={p.name}
                preset={p}
                active={
                  draft.background === p.background &&
                  draft.surface === p.surface &&
                  draft.text === p.text &&
                  draft.accent === p.accent
                }
                onSelect={() => applyPreset(p)}
              />
            ))}
          </div>
        </section>

        <section className="panel-surface rounded-3xl p-5 shadow-section">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="font-display text-lg text-text-primary">Custom palette</h3>
            <div className="flex items-center gap-3">
              <span className="text-3xs uppercase tracking-ui text-text-muted">{draft.name}</span>
              <span className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-3 py-1 text-3xs uppercase tracking-ui text-text-secondary">
                {mode}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SLOT_META.map((slot) => (
              <SlotEditor
                key={slot.key}
                slot={slot}
                value={draft[slot.key]}
                onChange={(hex) => updateSlot(slot.key, hex)}
              />
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-border-muted bg-bg-secondary/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <label className="block text-3xs uppercase tracking-ui text-text-muted">
                  Paste a palette
                </label>
                <p className="mt-1 text-2xs text-text-muted">
                  Copy 4 or more hex codes from Coolors, Lospec, or anywhere. The mode controls whether the darkest or lightest color becomes the page background.
                </p>
              </div>
              <div className="segmented-control">
                {(["dark", "light"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    data-active={pasteMode === option}
                    onClick={() => setPasteMode(option)}
                    className="segmented-button px-3 py-1.5 text-2xs uppercase tracking-ui"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={pasteValue}
                onChange={(e) => setPasteValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handlePaste();
                }}
                placeholder="#001524 #15616d #ffecd1 #ff7d00 #78290f"
                className="ornate-input flex-1 font-mono text-xs"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={handlePaste}
                disabled={!pasteValue.trim()}
                className="shell-pill rounded-full px-4 py-1.5 text-xs disabled:opacity-40"
              >
                Apply
              </button>
            </div>
            {pasteError && <p className="mt-2 text-2xs text-status-error">{pasteError}</p>}
          </div>

          {contrastWarnings.length > 0 && (
            <div className="mt-4 rounded-xl border border-status-warning/30 bg-status-warning/10 p-3">
              <p className="text-2xs uppercase tracking-ui text-status-warning">Readability check</p>
              <div className="mt-2 flex flex-col gap-1.5">
                {contrastWarnings.map((warning) => (
                  <p key={warning} className="text-2xs text-status-warning">
                    {warning}
                  </p>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="panel-surface rounded-3xl p-5 shadow-section">
          <h3 className="mb-3 font-display text-lg text-text-primary">Live preview</h3>
          <PreviewCard palette={draft} />
          <p className="mt-3 text-2xs text-text-muted">
            The whole app is previewing your draft right now. Save to keep it or revert to the stored palette.
          </p>
        </section>

        <div className="sticky bottom-4 flex items-center justify-end gap-2 rounded-2xl border border-border-muted bg-bg-secondary/80 p-3 backdrop-blur">
          <button
            type="button"
            onClick={handleReset}
            className="shell-pill rounded-full px-4 py-1.5 text-xs"
          >
            Reset to default
          </button>
          <button
            type="button"
            onClick={handleRevert}
            disabled={!dirty}
            className="shell-pill rounded-full px-4 py-1.5 text-xs disabled:opacity-40"
          >
            Revert
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty}
            className="shell-pill-primary rounded-full px-4 py-1.5 text-xs disabled:opacity-40"
          >
            Save theme
          </button>
        </div>
      </div>
    </div>
  );
}
