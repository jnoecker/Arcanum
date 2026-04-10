import { useCallback, useEffect, useMemo, useState } from "react";
import { useLoreStore } from "@/stores/loreStore";
import type { ArtStyle } from "@/types/lore";
import { Section, ActionButton, Spinner } from "@/components/ui/FormWidgets";
import { ART_STYLE_PRESETS, artStyleFromPreset } from "@/lib/artStylePresets";
import { generateArtStyle, refineArtStyle } from "@/lib/artStyleGeneration";
import { useFocusTrap } from "@/lib/useFocusTrap";

// ─── Helpers ───────────────────────────────────────────────────────

function newStyleId(): string {
  return `style_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function newEmptyStyle(): ArtStyle {
  const now = new Date().toISOString();
  return {
    id: newStyleId(),
    name: "Untitled style",
    description: "",
    basePrompt: "",
    surfaces: { worldbuilding: "", lore: "" },
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Sub: styled textarea ──────────────────────────────────────────

function StyleTextarea({
  value,
  onCommit,
  placeholder,
  rows = 6,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft !== value) onCommit(draft); }}
      rows={rows}
      placeholder={placeholder}
      className="w-full resize-y rounded border border-border-default bg-bg-primary px-2.5 py-2 text-xs leading-5 text-text-primary outline-none transition focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
    />
  );
}

function StyleTextInput({
  value,
  onCommit,
  placeholder,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft !== value) onCommit(draft); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      placeholder={placeholder}
      className="w-full rounded border border-border-default bg-bg-primary px-2.5 py-1.5 text-sm text-text-primary outline-none transition focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
    />
  );
}

// ─── Create menu ───────────────────────────────────────────────────

function CreateMenu({
  onEmpty,
  onPreset,
  onAi,
  disabled,
}: {
  onEmpty: () => void;
  onPreset: (key: string) => void;
  onAi: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <ActionButton
        variant="primary"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-expanded={open}
      >
        + New style
      </ActionButton>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-60 overflow-hidden rounded-lg border border-border-default bg-bg-secondary shadow-panel">
            <button
              onClick={() => { onAi(); setOpen(false); }}
              className="block w-full border-b border-border-muted px-3 py-2 text-left text-xs text-text-primary transition hover:bg-bg-hover"
            >
              <span className="font-medium text-accent">✦ Generate with AI</span>
              <span className="mt-0.5 block text-2xs text-text-muted">From a theme prompt</span>
            </button>
            {ART_STYLE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                onClick={() => { onPreset(preset.key); setOpen(false); }}
                className="block w-full border-b border-border-muted px-3 py-2 text-left text-xs text-text-primary transition hover:bg-bg-hover"
              >
                <span className="font-medium">{preset.name}</span>
                <span className="mt-0.5 block text-2xs text-text-muted">{preset.description}</span>
              </button>
            ))}
            <button
              onClick={() => { onEmpty(); setOpen(false); }}
              className="block w-full px-3 py-2 text-left text-xs text-text-secondary transition hover:bg-bg-hover"
            >
              <span className="font-medium">Empty style</span>
              <span className="mt-0.5 block text-2xs text-text-muted">Start from scratch</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── AI generate dialog ────────────────────────────────────────────

function AiGenerateDialog({
  onGenerate,
  onClose,
}: {
  onGenerate: (themePrompt: string) => Promise<void>;
  onClose: () => void;
}) {
  const [theme, setTheme] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(busy ? undefined : onClose);

  const submit = async () => {
    if (!theme.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onGenerate(theme.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="dialog-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-gen-title"
        className="dialog-shell flex w-full max-w-xl flex-col"
      >
        <div className="dialog-header">
          <div className="min-w-0 flex-1">
            <h3 id="ai-gen-title" className="font-display text-base text-text-primary">Generate art style</h3>
            <p className="mt-0.5 text-2xs text-text-muted">
              Describe a theme in a sentence. The AI will fill in the base prompt and both surface overrides.
            </p>
          </div>
        </div>
        <div className="dialog-body flex flex-col gap-3">
          <textarea
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="e.g. surreal gentle magic, cyberpunk noir, sun-bleached watercolor storybook, obsidian bloom fantasy"
            rows={3}
            autoFocus
            className="w-full resize-y rounded border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
          />
          {error && <p role="alert" className="text-2xs text-status-error">{error}</p>}
          <p className="text-2xs text-text-muted/80">
            Tip: the world's tone (if set in World Setting) is included as context so the style stays on-theme.
          </p>
        </div>
        <div className="dialog-footer">
          <ActionButton variant="ghost" size="sm" onClick={onClose} disabled={busy}>Cancel</ActionButton>
          <ActionButton variant="primary" size="sm" onClick={submit} disabled={!theme.trim() || busy}>
            {busy ? <span className="flex items-center gap-1.5"><Spinner /> Generating</span> : "Generate"}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

// ─── Refine dialog (per-style AI rewrite) ──────────────────────────

function RefineDialog({
  style,
  onRefine,
  onClose,
}: {
  style: ArtStyle;
  onRefine: (instruction: string) => Promise<void>;
  onClose: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(busy ? undefined : onClose);

  const submit = async () => {
    if (!instruction.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onRefine(instruction.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="dialog-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="refine-title"
        className="dialog-shell flex w-full max-w-xl flex-col"
      >
        <div className="dialog-header">
          <div className="min-w-0 flex-1">
            <h3 id="refine-title" className="font-display text-base text-text-primary">Refine "{style.name}"</h3>
            <p className="mt-0.5 text-2xs text-text-muted">
              Describe how you want the style changed. The AI will rewrite the relevant fields.
            </p>
          </div>
        </div>
        <div className="dialog-body flex flex-col gap-3">
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. make it darker and more ominous, or push the palette toward warm autumn tones, or add more pixel-art specifics to the worldbuilding surface"
            rows={4}
            autoFocus
            className="w-full resize-y rounded border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
          />
          {error && <p role="alert" className="text-2xs text-status-error">{error}</p>}
        </div>
        <div className="dialog-footer">
          <ActionButton variant="ghost" size="sm" onClick={onClose} disabled={busy}>Cancel</ActionButton>
          <ActionButton variant="primary" size="sm" onClick={submit} disabled={!instruction.trim() || busy}>
            {busy ? <span className="flex items-center gap-1.5"><Spinner /> Refining</span> : "Refine"}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────

export function ArtStylePanel() {
  const lore = useLoreStore((s) => s.lore);
  const createArtStyle = useLoreStore((s) => s.createArtStyle);
  const updateArtStyle = useLoreStore((s) => s.updateArtStyle);
  const deleteArtStyle = useLoreStore((s) => s.deleteArtStyle);
  const setActiveArtStyle = useLoreStore((s) => s.setActiveArtStyle);

  const styles = useMemo(() => lore?.artStyles ?? [], [lore?.artStyles]);
  const activeId = lore?.activeArtStyleId;

  const [selectedId, setSelectedId] = useState<string | null>(activeId ?? styles[0]?.id ?? null);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [showRefineDialog, setShowRefineDialog] = useState(false);

  // Keep selection valid as the list mutates
  useEffect(() => {
    if (selectedId && styles.some((s) => s.id === selectedId)) return;
    setSelectedId(activeId ?? styles[0]?.id ?? null);
  }, [styles, activeId, selectedId]);

  // ─── Auto-import legacy world_setting.visualStyle on first open ──
  useEffect(() => {
    if (!lore || (lore.artStyles && lore.artStyles.length > 0)) return;
    const ws = Object.values(lore.articles).find((a) => a.template === "world_setting");
    const legacy = ws && typeof ws.fields.visualStyle === "string" ? ws.fields.visualStyle.trim() : "";
    if (!legacy) return;
    const now = new Date().toISOString();
    createArtStyle({
      id: `style_imported_${Date.now().toString(36)}`,
      name: "Imported style",
      description: "Automatically imported from the legacy World Setting visual-style field",
      basePrompt: legacy,
      surfaces: {},
      createdAt: now,
      updatedAt: now,
    });
  }, [lore, createArtStyle]);

  const selected = styles.find((s) => s.id === selectedId) ?? null;

  const handleCreateEmpty = useCallback(() => {
    const style = newEmptyStyle();
    createArtStyle(style);
    setSelectedId(style.id);
  }, [createArtStyle]);

  const handleCreatePreset = useCallback((presetKey: string) => {
    const preset = ART_STYLE_PRESETS.find((p) => p.key === presetKey);
    if (!preset) return;
    const style = artStyleFromPreset(preset);
    createArtStyle(style);
    setSelectedId(style.id);
  }, [createArtStyle]);

  const handleAiGenerate = useCallback(async (themePrompt: string) => {
    const style = await generateArtStyle(themePrompt);
    createArtStyle(style);
    setSelectedId(style.id);
  }, [createArtStyle]);

  const handleRefine = useCallback(async (instruction: string) => {
    if (!selected) return;
    const patch = await refineArtStyle(selected, instruction);
    updateArtStyle(selected.id, patch);
  }, [selected, updateArtStyle]);

  const handleDelete = useCallback((id: string) => {
    const style = styles.find((s) => s.id === id);
    if (!style) return;
    if (!window.confirm(`Delete art style "${style.name}"?`)) return;
    deleteArtStyle(id);
  }, [styles, deleteArtStyle]);

  const handleDuplicate = useCallback((id: string) => {
    const source = styles.find((s) => s.id === id);
    if (!source) return;
    const copy: ArtStyle = {
      ...source,
      id: newStyleId(),
      name: `${source.name} (copy)`,
      surfaces: source.surfaces ? { ...source.surfaces } : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    createArtStyle(copy);
    setSelectedId(copy.id);
  }, [styles, createArtStyle]);

  // ─── Empty state ──
  if (styles.length === 0) {
    return (
      <>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border-muted bg-bg-primary/40 px-8 py-16 text-center">
            <div className="font-display text-lg text-text-primary">No art styles yet</div>
            <p className="max-w-md text-xs leading-6 text-text-muted">
              An art style describes how AI should render images for your world. Create one and it will be
              layered into every image generation prompt — both worldbuilding art (sprites, rooms, icons) and
              lore art (character portraits, article heroes), with optional surface-specific overrides.
            </p>
            <div className="flex gap-2">
              <ActionButton variant="primary" size="sm" onClick={() => setShowAiDialog(true)}>
                ✦ Generate with AI
              </ActionButton>
              <CreateMenu
                onEmpty={handleCreateEmpty}
                onPreset={handleCreatePreset}
                onAi={() => setShowAiDialog(true)}
              />
            </div>
          </div>
        </div>
        {showAiDialog && (
          <AiGenerateDialog onGenerate={handleAiGenerate} onClose={() => setShowAiDialog(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Header with create menu */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg text-text-primary">Art Style</h2>
            <p className="mt-0.5 text-2xs text-text-muted">
              Define how AI renders your world. The active style is layered into every image generation prompt.
            </p>
          </div>
          <CreateMenu
            onEmpty={handleCreateEmpty}
            onPreset={handleCreatePreset}
            onAi={() => setShowAiDialog(true)}
          />
        </div>

        {/* List + detail layout */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,240px)_1fr]">
          {/* ─── Style list ─── */}
          <div className="flex flex-col gap-1.5">
            {styles.map((style) => {
              const isSelected = selectedId === style.id;
              const isActive = activeId === style.id;
              return (
                <button
                  key={style.id}
                  onClick={() => setSelectedId(style.id)}
                  className={
                    "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left text-xs transition " +
                    (isSelected
                      ? "border-accent/60 bg-bg-tertiary text-text-primary shadow-[inset_0_0_0_1px_rgba(226,188,106,0.15)]"
                      : "border-border-muted bg-bg-primary/60 text-text-secondary hover:border-border-default hover:bg-bg-primary")
                  }
                >
                  <div className="flex w-full items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-medium">{style.name}</span>
                    {isActive && (
                      <span className="shrink-0 rounded-full bg-accent/20 px-1.5 py-0.5 text-3xs font-medium uppercase tracking-wide-ui text-accent">
                        Active
                      </span>
                    )}
                  </div>
                  {style.description && (
                    <span className="w-full truncate text-2xs text-text-muted">{style.description}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ─── Detail editor ─── */}
          {selected ? (
            <div className="flex min-w-0 flex-col gap-4">
              {/* Activate / refine / delete actions */}
              <div className="flex flex-wrap items-center gap-2">
                {activeId === selected.id ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-2xs font-medium text-accent">
                    ● Active style
                  </span>
                ) : (
                  <ActionButton variant="primary" size="sm" onClick={() => setActiveArtStyle(selected.id)}>
                    Set as active
                  </ActionButton>
                )}
                <ActionButton variant="ghost" size="sm" onClick={() => setShowRefineDialog(true)}>
                  ✦ Refine with AI
                </ActionButton>
                <ActionButton variant="ghost" size="sm" onClick={() => handleDuplicate(selected.id)}>
                  Duplicate
                </ActionButton>
                <div className="ml-auto">
                  <ActionButton variant="danger" size="sm" onClick={() => handleDelete(selected.id)}>
                    Delete
                  </ActionButton>
                </div>
              </div>

              {/* Identity */}
              <Section title="Identity">
                <div className="flex flex-col gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-2xs uppercase tracking-wide-ui text-text-muted">Name</span>
                    <StyleTextInput
                      value={selected.name}
                      onCommit={(v) => updateArtStyle(selected.id, { name: v || "Untitled style" })}
                      placeholder="e.g. Surreal Gentle Magic"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-2xs uppercase tracking-wide-ui text-text-muted">Description</span>
                    <StyleTextInput
                      value={selected.description ?? ""}
                      onCommit={(v) => updateArtStyle(selected.id, { description: v || undefined })}
                      placeholder="One-line summary"
                    />
                  </label>
                </div>
              </Section>

              {/* Base prompt */}
              <Section title="Base prompt">
                <p className="mb-2 text-2xs text-text-muted">
                  The core visual language. Appended to every image generation prompt. Include palette, lighting,
                  shape language, and forbidden elements. Keep it surface-neutral — per-surface rules go below.
                </p>
                <StyleTextarea
                  value={selected.basePrompt}
                  onCommit={(v) => updateArtStyle(selected.id, { basePrompt: v })}
                  placeholder="Describe the style's visual language in concrete, actionable terms..."
                  rows={10}
                />
              </Section>

              {/* Surface overrides */}
              <Section title="Surface overrides">
                <p className="mb-3 text-2xs text-text-muted">
                  Extra directives layered on top of the base prompt for specific kinds of art. Leave blank to
                  use the base prompt as-is.
                </p>
                <div className="flex flex-col gap-4">
                  <label className="flex flex-col gap-1">
                    <span className="flex items-center gap-2 text-2xs font-medium uppercase tracking-wide-ui text-text-secondary">
                      <span className="h-1.5 w-1.5 rounded-full bg-warm" />
                      Worldbuilding
                    </span>
                    <span className="text-2xs text-text-muted">
                      Sprites, item icons, ability icons, room backgrounds, entity portraits, pets, UI assets.
                    </span>
                    <StyleTextarea
                      value={selected.surfaces?.worldbuilding ?? ""}
                      onCommit={(v) =>
                        updateArtStyle(selected.id, {
                          surfaces: { ...selected.surfaces, worldbuilding: v || undefined },
                        })
                      }
                      placeholder="e.g. pixel-art silhouettes on pale lavender background, readable at 64px..."
                      rows={5}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="flex items-center gap-2 text-2xs font-medium uppercase tracking-wide-ui text-text-secondary">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      Lore
                    </span>
                    <span className="text-2xs text-text-muted">
                      Character portraits, lore article hero images, encyclopedia-style illustrations.
                    </span>
                    <StyleTextarea
                      value={selected.surfaces?.lore ?? ""}
                      onCommit={(v) =>
                        updateArtStyle(selected.id, {
                          surfaces: { ...selected.surfaces, lore: v || undefined },
                        })
                      }
                      placeholder="e.g. high-fantasy oil portraits, faithful anatomy, ornate framing..."
                      rows={5}
                    />
                  </label>
                </div>
              </Section>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-border-muted bg-bg-primary/40 px-6 py-16 text-sm text-text-muted">
              Select a style to edit
            </div>
          )}
        </div>
      </div>

      {showAiDialog && (
        <AiGenerateDialog onGenerate={handleAiGenerate} onClose={() => setShowAiDialog(false)} />
      )}
      {showRefineDialog && selected && (
        <RefineDialog
          style={selected}
          onRefine={handleRefine}
          onClose={() => setShowRefineDialog(false)}
        />
      )}
    </>
  );
}
