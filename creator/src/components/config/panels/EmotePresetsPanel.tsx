import type { ConfigPanelProps } from "./types";
import type { EmotePreset } from "@/types/config";
import {
  Section,
  FieldRow,
  TextInput,
  ActionButton,
  IconButton,
} from "@/components/ui/FormWidgets";

export function EmotePresetsPanel({ config, onChange }: ConfigPanelProps) {
  const presets = config.emotePresets.presets;

  const update = (newPresets: EmotePreset[]) =>
    onChange({ emotePresets: { presets: newPresets } });

  const patchPreset = (index: number, patch: Partial<EmotePreset>) => {
    const next = presets.map((p, i) => (i === index ? { ...p, ...patch } : p));
    update(next);
  };

  const addPreset = () =>
    update([...presets, { label: "", emoji: "", action: "" }]);

  const removePreset = (index: number) =>
    update(presets.filter((_, i) => i !== index));

  const movePreset = (from: number, to: number) => {
    if (to < 0 || to >= presets.length) return;
    const next = [...presets];
    const [item] = next.splice(from, 1);
    if (!item) return;
    next.splice(to, 0, item);
    update(next);
  };

  return (
    <Section
      title="Emote Presets"
      description="Quick-action emotes surfaced as buttons in the player's chat panel. Each preset broadcasts a short room message (e.g. 'Lira waves.') when clicked — perfect for social MUDs that want roleplay gestures a click away. The order here determines display order in the client."
    >
      <div className="flex flex-col gap-1.5">
        {presets.length === 0 && (
          <p className="text-2xs text-text-muted">
            No emote presets yet. Add one to give players a quick-action button.
          </p>
        )}

        {presets.map((preset, i) => (
          <div
            key={i}
            className="flex flex-col gap-1.5 border-b border-border-muted/30 pb-2 pt-2 first:pt-0 last:border-0 last:pb-0"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-2xs uppercase tracking-widest text-text-muted">
                #{i + 1}
                {preset.label ? (
                  <span className="ml-2 text-text-secondary normal-case tracking-normal">
                    {preset.label}
                  </span>
                ) : null}
              </span>
              <div className="flex items-center gap-0.5">
                {i > 0 && (
                  <IconButton
                    onClick={() => movePreset(i, i - 1)}
                    title="Move up"
                    size="sm"
                  >
                    &#x2191;
                  </IconButton>
                )}
                {i < presets.length - 1 && (
                  <IconButton
                    onClick={() => movePreset(i, i + 1)}
                    title="Move down"
                    size="sm"
                  >
                    &#x2193;
                  </IconButton>
                )}
                <IconButton
                  onClick={() => removePreset(i)}
                  title="Remove preset"
                  danger
                  size="sm"
                >
                  &#x2715;
                </IconButton>
              </div>
            </div>

            <FieldRow
              label="Label"
              hint="Button text shown to the player in the chat panel. Keep it short: a single word or two."
            >
              <TextInput
                value={preset.label}
                onCommit={(v) => patchPreset(i, { label: v })}
                placeholder="Wave"
              />
            </FieldRow>
            <FieldRow
              label="Emoji"
              hint="Optional emoji rendered on the button next to the label. Any single unicode glyph works."
            >
              <TextInput
                value={preset.emoji}
                onCommit={(v) => patchPreset(i, { emoji: v })}
                placeholder="👋"
              />
            </FieldRow>
            <FieldRow
              label="Action"
              hint="Room broadcast text. The player's name is prepended automatically, so 'waves.' becomes 'Lira waves.'"
            >
              <TextInput
                value={preset.action}
                onCommit={(v) => patchPreset(i, { action: v })}
                placeholder="waves."
              />
            </FieldRow>
          </div>
        ))}

        <div className="pt-1">
          <ActionButton variant="secondary" size="sm" onClick={addPreset}>
            + Add Emote Preset
          </ActionButton>
        </div>
      </div>
    </Section>
  );
}
