import type { ConfigPanelProps } from "./types";
import type { EmotePreset } from "@/types/config";
import { Section, FieldRow, TextInput } from "@/components/ui/FormWidgets";

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
    next.splice(to, 0, item!);
    update(next);
  };

  return (
    <Section
      title="Emote Presets"
      description="Quick-action emotes shown to players in the chat panel. Each preset has a label, emoji, and the action text broadcast to the room (e.g. 'waves.'). Order here matches display order in the client."
    >
      <div className="flex flex-col gap-3">
        {presets.map((preset, i) => (
          <div
            key={i}
            className="rounded-xl border border-white/8 bg-black/12 p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary">
                #{i + 1}{preset.label ? ` — ${preset.label}` : ""}
              </span>
              <div className="flex items-center gap-1">
                {i > 0 && (
                  <button
                    onClick={() => movePreset(i, i - 1)}
                    title="Move up"
                    className="h-6 w-6 rounded text-xs text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
                  >
                    ↑
                  </button>
                )}
                {i < presets.length - 1 && (
                  <button
                    onClick={() => movePreset(i, i + 1)}
                    title="Move down"
                    className="h-6 w-6 rounded text-xs text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
                  >
                    ↓
                  </button>
                )}
                <button
                  onClick={() => removePreset(i)}
                  title="Remove"
                  className="h-6 w-6 rounded text-xs text-text-muted transition-colors hover:bg-status-danger/10 hover:text-status-danger"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldRow label="Label" hint="Button text shown to the player.">
                <TextInput
                  value={preset.label}
                  onCommit={(v) => patchPreset(i, { label: v })}
                  placeholder="Wave"
                />
              </FieldRow>
              <FieldRow label="Emoji" hint="Emoji shown on the button.">
                <TextInput
                  value={preset.emoji}
                  onCommit={(v) => patchPreset(i, { emoji: v })}
                  placeholder="👋"
                />
              </FieldRow>
              <FieldRow label="Action" hint="Room broadcast text (e.g. 'waves.'). The player's name is prepended automatically.">
                <TextInput
                  value={preset.action}
                  onCommit={(v) => patchPreset(i, { action: v })}
                  placeholder="waves."
                />
              </FieldRow>
            </div>
          </div>
        ))}

        <button
          onClick={addPreset}
          className="self-start rounded-full border border-[rgba(184,216,232,0.28)] bg-gradient-active-strong px-4 py-2 text-xs font-medium text-text-primary transition hover:shadow-[0_10px_20px_rgba(137,155,214,0.2)]"
        >
          + Add Emote Preset
        </button>
      </div>
    </Section>
  );
}
