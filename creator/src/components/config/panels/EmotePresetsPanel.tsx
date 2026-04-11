import { useCallback } from "react";
import type { ConfigPanelProps } from "./types";
import type { EmotePreset } from "@/types/config";
import {
  TextInput,
  CompactField,
  FieldGrid,
  IconButton,
} from "@/components/ui/FormWidgets";

// Roleplay-classic quick picks — one click inserts them into the emoji field.
const QUICK_EMOJI = [
  "\u{1F44B}", // 👋 wave
  "\u{1F642}", // 🙂 smile
  "\u{1F602}", // 😂 laugh
  "\u{1F64F}", // 🙏 bow
  "\u{1F44F}", // 👏 applaud
  "\u{1F64C}", // 🙌 cheer
  "\u{1F3B5}", // 🎵 sing
  "\u{1F91D}", // 🤝 handshake
  "\u{1F451}", // 👑 regal
  "\u{1F914}", // 🤔 think
  "\u{1F62D}", // 😭 sob
  "\u{1F483}", // 💃 dance
] as const;

// ─── Panel ──────────────────────────────────────────────────────────

export function EmotePresetsPanel({ config, onChange }: ConfigPanelProps) {
  const presets = config.emotePresets.presets;

  const update = useCallback(
    (next: EmotePreset[]) => onChange({ emotePresets: { presets: next } }),
    [onChange],
  );

  const patchPreset = useCallback(
    (index: number, patch: Partial<EmotePreset>) => {
      update(presets.map((p, i) => (i === index ? { ...p, ...patch } : p)));
    },
    [presets, update],
  );

  const addPreset = useCallback(
    () => update([...presets, { label: "", emoji: "", action: "" }]),
    [presets, update],
  );

  const removePreset = useCallback(
    (index: number) => update(presets.filter((_, i) => i !== index)),
    [presets, update],
  );

  const movePreset = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= presets.length) return;
      const next = [...presets];
      const [item] = next.splice(from, 1);
      if (!item) return;
      next.splice(to, 0, item);
      update(next);
    },
    [presets, update],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="panel-surface relative overflow-hidden rounded-3xl p-6 shadow-section">
        <div className="relative z-10 flex flex-col gap-5">
          <div className="max-w-2xl">
            <p className="border-l-2 border-accent/30 pl-2 text-2xs uppercase tracking-wide-ui text-text-muted">
              Chat quick-actions
            </p>
            <h2 className="mt-2 font-display font-semibold text-xl text-text-primary">
              Emote Presets
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Roleplay gestures surfaced as buttons in the player's chat panel.
              Each preset broadcasts a short room message
              (e.g. <em>Lira waves.</em>) when clicked — one click for the
              classics, so social MUDs feel alive without typing. The order
              here is the order players see in the client.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 border-t border-border-muted/50 pt-4">
            <div className="flex items-center gap-3 rounded-2xl border border-accent/25 bg-accent/[0.06] px-4 py-2">
              <span
                className="text-xl leading-none"
                aria-hidden="true"
              >
                &#x1F44B;
              </span>
              <div>
                <p className="font-display text-xs font-semibold uppercase tracking-wider text-accent">
                  Name prepended automatically
                </p>
                <p className="text-2xs text-text-muted/80">
                  An action of <code className="font-mono">waves.</code>{" "}
                  broadcasts as <em>Lira waves.</em>
                </p>
              </div>
            </div>

            <div className="ml-auto text-right">
              <p className="font-display text-2xl font-semibold leading-none text-text-primary">
                {presets.length}
              </p>
              <p className="mt-1 text-2xs uppercase tracking-wider text-text-muted">
                {presets.length === 1 ? "preset" : "presets"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {presets.map((preset, i) => (
          <EmoteCard
            key={i}
            preset={preset}
            index={i}
            total={presets.length}
            onPatch={(p) => patchPreset(i, p)}
            onMoveUp={() => movePreset(i, i - 1)}
            onMoveDown={() => movePreset(i, i + 1)}
            onRemove={() => removePreset(i)}
          />
        ))}
        <AddEmoteCard onClick={addPreset} />
      </div>
    </div>
  );
}

// ─── Card ───────────────────────────────────────────────────────────

function EmoteCard({
  preset,
  index,
  total,
  onPatch,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  preset: EmotePreset;
  index: number;
  total: number;
  onPatch: (p: Partial<EmotePreset>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const labelText = preset.label.trim() || "Label";
  const actionText = preset.action.trim() || "…";

  return (
    <div className="group/card relative flex flex-col gap-3 rounded-2xl border border-border-default bg-bg-primary/40 p-4 transition-colors hover:border-accent/40 hover:bg-bg-primary/60">
      {/* Header — index + hover rail */}
      <div className="flex items-center justify-between">
        <span className="font-display text-3xs uppercase tracking-widest text-text-muted">
          #{index + 1}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100">
          {index > 0 && (
            <IconButton onClick={onMoveUp} title="Move up" size="sm">
              &#x2191;
            </IconButton>
          )}
          {index < total - 1 && (
            <IconButton onClick={onMoveDown} title="Move down" size="sm">
              &#x2193;
            </IconButton>
          )}
          <IconButton
            onClick={onRemove}
            title="Remove preset"
            danger
            size="sm"
          >
            &#x2715;
          </IconButton>
        </div>
      </div>

      {/* Live preview */}
      <div className="flex flex-col gap-1.5 rounded-xl border border-border-muted/60 bg-bg-abyss/40 px-3 py-2.5">
        <span className="text-[9px] uppercase tracking-widest text-text-muted/70">
          In-game preview
        </span>
        <div className="flex items-center">
          <div className="flex items-center gap-1.5 rounded border border-border-default bg-bg-primary/70 px-2 py-1 text-xs text-text-secondary">
            {preset.emoji ? (
              <span className="text-sm leading-none" aria-hidden="true">
                {preset.emoji}
              </span>
            ) : (
              <span
                className="text-sm leading-none text-text-muted/50"
                aria-hidden="true"
              >
                &#x25CB;
              </span>
            )}
            <span className="truncate">{labelText}</span>
          </div>
        </div>
        <p className="pl-0.5 text-2xs italic text-text-muted">
          <span className="text-text-secondary">Lira</span> {actionText}
        </p>
      </div>

      {/* Fields */}
      <FieldGrid cols={2}>
        <CompactField label="Label">
          <TextInput
            value={preset.label}
            onCommit={(v) => onPatch({ label: v })}
            placeholder="Wave"
            dense
          />
        </CompactField>
        <CompactField label="Emoji">
          <TextInput
            value={preset.emoji}
            onCommit={(v) => onPatch({ emoji: v })}
            placeholder="\u{1F44B}"
            dense
          />
        </CompactField>
        <CompactField
          label="Action"
          hint="Broadcast text. Player name is prepended automatically."
          span
        >
          <TextInput
            value={preset.action}
            onCommit={(v) => onPatch({ action: v })}
            placeholder="waves."
            dense
          />
        </CompactField>
      </FieldGrid>

      {/* Quick-pick emoji chips */}
      <div className="flex flex-col gap-1">
        <span className="text-[9px] uppercase tracking-widest text-text-muted/70">
          Quick picks
        </span>
        <div className="flex flex-wrap gap-1">
          {QUICK_EMOJI.map((e) => {
            const active = preset.emoji === e;
            return (
              <button
                key={e}
                type="button"
                onClick={() => onPatch({ emoji: e })}
                className={`focus-ring flex h-7 w-7 items-center justify-center rounded border text-base leading-none transition-colors ${
                  active
                    ? "border-accent/60 bg-accent/15"
                    : "border-border-default bg-bg-primary/50 hover:border-accent/40 hover:bg-accent/5"
                }`}
                title={`Use ${e}`}
                aria-label={`Use ${e}`}
                aria-pressed={active}
              >
                {e}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AddEmoteCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group focus-ring flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-border-muted/60 bg-bg-primary/20 p-6 text-text-muted transition-colors hover:border-accent/40 hover:bg-bg-primary/40 hover:text-accent"
      aria-label="Add emote preset"
    >
      <div className="flex flex-col items-center gap-2">
        <span className="font-display text-2xl leading-none">+</span>
        <span className="text-2xs uppercase tracking-widest">Add Emote</span>
      </div>
    </button>
  );
}
