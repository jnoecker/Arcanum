import { useState, useCallback, useMemo } from "react";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import type { Article } from "@/types/lore";
import { Section, FieldRow, TextInput } from "@/components/ui/FormWidgets";
import { LoreTextArea } from "./LoreTextArea";
import { LoreEditor } from "./LoreEditor";
import { getWorldSettingGeneratePrompt } from "@/lib/lorePrompts";

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
          className="flex-1 rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
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

// ─── Helpers ────────────────────────────────────────────────────────

function getField(article: Article, key: string): string {
  const v = article.fields[key];
  return typeof v === "string" ? v : "";
}

function getFieldTags(article: Article, key: string): string[] {
  const v = article.fields[key];
  return Array.isArray(v) ? v : [];
}

// ─── Main panel ────────────────────────────────────────────────────

export function WorldSettingPanel() {
  const articles = useLoreStore(selectArticles);
  const updateArticle = useLoreStore((s) => s.updateArticle);
  const createArticle = useLoreStore((s) => s.createArticle);

  // Find or create the world_setting article
  const article = useMemo(
    () => Object.values(articles).find((a) => a.template === "world_setting"),
    [articles],
  );

  const ensureArticle = useCallback((): Article => {
    if (article) return article;
    const now = new Date().toISOString();
    const newArticle: Article = {
      id: "world_setting",
      template: "world_setting",
      title: "World Setting",
      fields: {},
      content: "",
      createdAt: now,
      updatedAt: now,
    };
    createArticle(newArticle);
    return newArticle;
  }, [article, createArticle]);

  const patchField = useCallback(
    (key: string, value: unknown) => {
      const a = ensureArticle();
      updateArticle(a.id, { fields: { ...a.fields, [key]: value } });
    },
    [ensureArticle, updateArticle],
  );

  const patchContent = useCallback(
    (content: string) => {
      const a = ensureArticle();
      updateArticle(a.id, { content });
    },
    [ensureArticle, updateArticle],
  );

  const fields = article?.fields ?? {};
  const content = article?.content ?? "";

  // Build world context string for LLM generation
  const worldContext = useMemo(() => {
    const parts: string[] = [];
    const name = typeof fields.name === "string" ? fields.name : "";
    const tagline = typeof fields.tagline === "string" ? fields.tagline : "";
    const tone = typeof fields.tone === "string" ? fields.tone : "";
    const era = typeof fields.era === "string" ? fields.era : "";
    const themes = Array.isArray(fields.themes) ? fields.themes : [];
    if (name) parts.push(`World name: ${name}`);
    if (tagline) parts.push(`Tagline: ${tagline}`);
    if (tone) parts.push(`Tone: ${tone}`);
    if (era) parts.push(`Current era: ${era}`);
    if (themes.length) parts.push(`Themes: ${themes.join(", ")}`);
    if (content) parts.push(`Overview: ${content}`);
    return parts.join("\n") || "A fantasy MUD game world";
  }, [fields, content]);

  return (
    <div className="flex flex-col gap-6">
      <Section title="Identity">
        <div className="flex flex-col gap-2">
          <FieldRow label="World name">
            <TextInput
              value={getField(article ?? { fields: {} } as Article, "name")}
              onCommit={(v) => patchField("name", v || undefined)}
              placeholder="The name of your world"
            />
          </FieldRow>
          <FieldRow label="Tagline">
            <TextInput
              value={getField(article ?? { fields: {} } as Article, "tagline")}
              onCommit={(v) => patchField("tagline", v || undefined)}
              placeholder="A one-line hook for your setting"
            />
          </FieldRow>
          <FieldRow label="Tone">
            <TextInput
              value={getField(article ?? { fields: {} } as Article, "tone")}
              onCommit={(v) => patchField("tone", v || undefined)}
              placeholder="e.g. whimsical, grimdark, heroic, cozy, surreal"
            />
          </FieldRow>
          <FieldRow label="Current era">
            <TextInput
              value={getField(article ?? { fields: {} } as Article, "era")}
              onCommit={(v) => patchField("era", v || undefined)}
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
          items={getFieldTags(article ?? { fields: {} } as Article, "themes")}
          onChange={(themes) => patchField("themes", themes)}
        />
      </Section>

      <Section title="Visual Style">
        <LoreTextArea
          label="Art direction for generated images"
          value={getField(article ?? { fields: {} } as Article, "visualStyle")}
          onCommit={(v) => patchField("visualStyle", v || undefined)}
          placeholder="Describe the image-generation style for this world — e.g. dreamy watercolor storybook, gritty dark fantasy oil painting, painterly high fantasy with desaturated earth tones..."
          rows={5}
        />
      </Section>

      <Section title="Overview">
        <LoreEditor
          value={content}
          onCommit={(v) => patchContent(v || "")}
          placeholder="Describe your world at a high level — its defining features, cultures, and conflicts..."
          generateSystemPrompt={getWorldSettingGeneratePrompt()}
          generateUserPrompt="Write a vivid world overview for this fantasy MUD setting."
          context={worldContext}
        />
      </Section>

      <Section title="History">
        <LoreTextArea
          label="Creation and history"
          value={getField(article ?? { fields: {} } as Article, "history")}
          onCommit={(v) => patchField("history", v || undefined)}
          placeholder="The creation myth, major ages, wars, and turning points..."
          rows={8}
          generateSystemPrompt={getWorldSettingGeneratePrompt()}
          generateUserPrompt="Write a rich creation myth and historical timeline for this world."
          context={worldContext}
        />
      </Section>

      <Section title="Geography">
        <LoreTextArea
          label="Geography and regions"
          value={getField(article ?? { fields: {} } as Article, "geography")}
          onCommit={(v) => patchField("geography", v || undefined)}
          placeholder="Continents, biomes, major landmarks, and how geography shapes civilisation..."
          rows={6}
          generateSystemPrompt={getWorldSettingGeneratePrompt()}
          generateUserPrompt="Describe the broad geography and major regions of this world."
          context={worldContext}
        />
      </Section>

      <Section title="Magic system">
        <LoreTextArea
          label="Magic and the supernatural"
          value={getField(article ?? { fields: {} } as Article, "magic")}
          onCommit={(v) => patchField("magic", v || undefined)}
          placeholder="How magic works, its sources, limits, and cultural significance..."
          rows={6}
          generateSystemPrompt={getWorldSettingGeneratePrompt()}
          generateUserPrompt="Design a magic system for this world — its sources, rules, and cultural role."
          context={worldContext}
        />
      </Section>

      <Section title="Technology and civilisation">
        <LoreTextArea
          label="Technology level"
          value={getField(article ?? { fields: {} } as Article, "technology")}
          onCommit={(v) => patchField("technology", v || undefined)}
          placeholder="What level of technology exists? How does it interact with magic?..."
          rows={6}
          generateSystemPrompt={getWorldSettingGeneratePrompt()}
          generateUserPrompt="Describe the technology level and civilisational development of this world."
          context={worldContext}
        />
      </Section>
    </div>
  );
}
