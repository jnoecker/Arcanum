import { useState, useCallback, useMemo } from "react";
import type { WorldLore, WorldSetting } from "@/types/lore";
import { Section, FieldRow, TextInput } from "@/components/ui/FormWidgets";
import { LoreTextArea } from "./LoreTextArea";
import { WORLD_SETTING_GENERATE_PROMPT } from "@/lib/lorePrompts";

// ─── String list editor (themes) ───────────────────────────────────

function ThemesList({
  items,
  onChange,
}: {
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setDraft("");
  };

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap gap-1.5">
        {items.map((t, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-full border border-border-muted bg-bg-tertiary px-2.5 py-0.5 text-xs text-text-secondary"
          >
            {t}
            <button
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="ml-0.5 text-text-muted hover:text-status-danger"
              title="Remove"
            >
              &times;
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          className="flex-1 rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent/50"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add a theme..."
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          className="rounded border border-border-default px-2 py-1 text-xs text-text-secondary transition hover:bg-bg-tertiary disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────

export function WorldSettingPanel({
  lore,
  onChange,
}: {
  lore: WorldLore;
  onChange: (patch: Partial<WorldLore>) => void;
}) {
  const setting = lore.setting;

  const patchSetting = useCallback(
    (patch: Partial<WorldSetting>) => {
      onChange({ setting: { ...setting, ...patch } });
    },
    [setting, onChange],
  );

  // Build world context string for LLM generation
  const worldContext = useMemo(() => {
    const parts: string[] = [];
    if (setting.name) parts.push(`World name: ${setting.name}`);
    if (setting.tagline) parts.push(`Tagline: ${setting.tagline}`);
    if (setting.era) parts.push(`Current era: ${setting.era}`);
    if (setting.themes?.length) parts.push(`Themes: ${setting.themes.join(", ")}`);
    if (setting.overview) parts.push(`Overview: ${setting.overview}`);
    return parts.join("\n") || "A fantasy MUD game world";
  }, [setting]);

  return (
    <div className="flex flex-col gap-6">
      <Section title="Identity">
        <div className="flex flex-col gap-2">
          <FieldRow label="World name">
            <TextInput
              value={setting.name ?? ""}
              onCommit={(v) => patchSetting({ name: v || undefined })}
              placeholder="The name of your world"
            />
          </FieldRow>
          <FieldRow label="Tagline">
            <TextInput
              value={setting.tagline ?? ""}
              onCommit={(v) => patchSetting({ tagline: v || undefined })}
              placeholder="A one-line hook for your setting"
            />
          </FieldRow>
          <FieldRow label="Current era">
            <TextInput
              value={setting.era ?? ""}
              onCommit={(v) => patchSetting({ era: v || undefined })}
              placeholder="e.g. The Age of Fractures"
            />
          </FieldRow>
        </div>
      </Section>

      <Section title="Themes">
        <p className="mb-2 text-xs text-text-muted">
          Narrative tone and recurring motifs that shape your world's stories.
        </p>
        <ThemesList
          items={setting.themes ?? []}
          onChange={(themes) => patchSetting({ themes })}
        />
      </Section>

      <Section title="Overview">
        <LoreTextArea
          label="World overview"
          value={setting.overview ?? ""}
          onCommit={(v) => patchSetting({ overview: v || undefined })}
          placeholder="Describe your world at a high level — its defining features, cultures, and conflicts..."
          rows={8}
          generateSystemPrompt={WORLD_SETTING_GENERATE_PROMPT}
          generateUserPrompt="Write a vivid world overview for this fantasy MUD setting."
          context={worldContext}
        />
      </Section>

      <Section title="History">
        <LoreTextArea
          label="Creation and history"
          value={setting.history ?? ""}
          onCommit={(v) => patchSetting({ history: v || undefined })}
          placeholder="The creation myth, major ages, wars, and turning points..."
          rows={8}
          generateSystemPrompt={WORLD_SETTING_GENERATE_PROMPT}
          generateUserPrompt="Write a rich creation myth and historical timeline for this world."
          context={worldContext}
        />
      </Section>

      <Section title="Geography">
        <LoreTextArea
          label="Geography and regions"
          value={setting.geography ?? ""}
          onCommit={(v) => patchSetting({ geography: v || undefined })}
          placeholder="Continents, biomes, major landmarks, and how geography shapes civilisation..."
          rows={6}
          generateSystemPrompt={WORLD_SETTING_GENERATE_PROMPT}
          generateUserPrompt="Describe the broad geography and major regions of this world."
          context={worldContext}
        />
      </Section>

      <Section title="Magic system">
        <LoreTextArea
          label="Magic and the supernatural"
          value={setting.magic ?? ""}
          onCommit={(v) => patchSetting({ magic: v || undefined })}
          placeholder="How magic works, its sources, limits, and cultural significance..."
          rows={6}
          generateSystemPrompt={WORLD_SETTING_GENERATE_PROMPT}
          generateUserPrompt="Design a magic system for this world — its sources, rules, and cultural role."
          context={worldContext}
        />
      </Section>

      <Section title="Technology and civilisation">
        <LoreTextArea
          label="Technology level"
          value={setting.technology ?? ""}
          onCommit={(v) => patchSetting({ technology: v || undefined })}
          placeholder="What level of technology exists? How does it interact with magic?..."
          rows={6}
          generateSystemPrompt={WORLD_SETTING_GENERATE_PROMPT}
          generateUserPrompt="Describe the technology level and civilisational development of this world."
          context={worldContext}
        />
      </Section>
    </div>
  );
}
