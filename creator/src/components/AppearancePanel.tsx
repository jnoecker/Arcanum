import { useEffect, useMemo, useState } from "react";
import { useThemeStore } from "@/stores/themeStore";
import {
  DEFAULT_THEME,
  PRESET_THEMES,
  isValidHex,
  luminance,
  normalizeHex,
  parsePalettePaste,
  type ThemePalette,
} from "@/lib/theme";

type Slot = "background" | "surface" | "text" | "accent";

const SLOT_META: { key: Slot; label: string; help: string }[] = [
  { key: "background", label: "Background", help: "Page and abyss — should be the darkest swatch." },
  { key: "surface", label: "Surface", help: "Panels, sections, hover states, borders." },
  { key: "text", label: "Text", help: "Primary text color — should be the lightest swatch." },
  { key: "accent", label: "Accent", help: "Links, focus rings, glows, active highlights." },
];

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
      <div className="flex items-center justify-between">
        <span className="font-display text-sm text-text-primary">{preset.name}</span>
        {active && <span className="text-3xs uppercase tracking-ui text-accent">Active</span>}
      </div>
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
          placeholder="#22293c"
          className="ornate-input flex-1 font-mono text-xs"
          spellCheck={false}
        />
      </div>
      <p className="text-2xs text-text-muted">{slot.help}</p>
    </div>
  );
}

function PreviewCard({ palette }: { palette: ThemePalette }) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        background: `linear-gradient(160deg, ${palette.surface}, ${palette.background})`,
        borderColor: palette.surface,
        color: palette.text,
      }}
    >
      <p
        className="text-3xs uppercase"
        style={{ letterSpacing: "0.32em", color: palette.accent, opacity: 0.85 }}
      >
        Preview
      </p>
      <h3 className="mt-2 font-display text-2xl" style={{ color: palette.text }}>
        Aurum dusk over the abyss
      </h3>
      <p className="mt-2 text-sm leading-6" style={{ color: palette.text, opacity: 0.7 }}>
        Body text uses the text color at reduced opacity. Accent appears in the link below.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-full px-4 py-1.5 font-display text-xs"
          style={{
            background: palette.accent,
            color: palette.background,
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
            border: `1px solid ${palette.accent}80`,
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
  const [pasteError, setPasteError] = useState<string | null>(null);

  // Live preview as the draft changes.
  useEffect(() => {
    previewTheme(draft);
  }, [draft, previewTheme]);

  // Cancel preview if the panel unmounts without saving.
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

  const luminanceWarning = useMemo(() => {
    if (luminance(draft.background) > 0.4) {
      return "Background is quite light — Arcanum is designed for dark themes and panels may look washed out.";
    }
    if (luminance(draft.text) < 0.5) {
      return "Text color is dark — it may be hard to read against the background.";
    }
    return null;
  }, [draft]);

  const updateSlot = (slot: Slot, hex: string) => {
    setDraft((d) => ({ ...d, name: "Custom", [slot]: hex }));
  };

  const applyPreset = (preset: ThemePalette) => {
    setDraft({ ...preset });
  };

  const handlePaste = () => {
    setPasteError(null);
    const parsed = parsePalettePaste(pasteValue);
    if (!parsed || parsed.length < 4) {
      setPasteError("Need 4 hex colors. Paste them in any order — sorted by luminance.");
      return;
    }
    // Sort by luminance: darkest → background, lightest → text. Of the middle
    // two, the more saturated one is the accent.
    const sorted = [...parsed].sort((a, b) => luminance(a) - luminance(b));
    const background = sorted[0]!;
    const text = sorted[3]!;
    const mid1 = sorted[1]!;
    const mid2 = sorted[2]!;
    // Pick the more chromatic of the two mids as accent.
    const chroma = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return Math.max(r, g, b) - Math.min(r, g, b);
    };
    const [accent, surface] = chroma(mid2) > chroma(mid1) ? [mid2, mid1] : [mid1, mid2];
    setDraft({ name: "Custom (pasted)", background, surface, text, accent });
    setPasteValue("");
  };

  const handleSave = () => {
    setTheme(draft);
  };

  const handleReset = () => {
    setTheme(null);
    setDraft({ ...DEFAULT_THEME });
  };

  const handleRevert = () => {
    setDraft({ ...(persisted ?? DEFAULT_THEME) });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-6">
        <header>
        <p className="text-3xs uppercase tracking-wide-ui text-text-muted">Operations</p>
        <h2 className="mt-2 font-display text-3xl text-text-primary">Appearance</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
          Pick a 4-color palette to retheme the entire app. Background, Surface, Text, and Accent
          drive every UI surface — semantic colors (status, classes, lore templates) stay fixed.
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
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="font-display text-lg text-text-primary">Custom palette</h3>
          <span className="text-3xs uppercase tracking-ui text-text-muted">{draft.name}</span>
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
          <label className="block text-3xs uppercase tracking-ui text-text-muted">
            Paste a palette
          </label>
          <p className="mt-1 text-2xs text-text-muted">
            Copy 4 hex codes from coolors.co, lospec, or anywhere — order doesn't matter.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handlePaste();
              }}
              placeholder="#22293c #313a56 #dbe3f8 #a897d2"
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
          {pasteError && (
            <p className="mt-2 text-2xs text-status-error">{pasteError}</p>
          )}
        </div>

        {luminanceWarning && (
          <p className="mt-4 rounded-md border border-status-warning/30 bg-status-warning/10 p-2 text-2xs text-status-warning">
            {luminanceWarning}
          </p>
        )}
      </section>

      <section className="panel-surface rounded-3xl p-5 shadow-section">
        <h3 className="mb-3 font-display text-lg text-text-primary">Live preview</h3>
        <PreviewCard palette={draft} />
        <p className="mt-3 text-2xs text-text-muted">
          The whole app is also previewing your draft right now — save to keep it, or revert.
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
