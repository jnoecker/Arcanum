import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import type { Article } from "@/types/lore";
import { FieldRow, TextInput } from "@/components/ui/FormWidgets";
import { LoreTextArea } from "./LoreTextArea";
import { LoreEditor } from "./LoreEditor";
import { TagListEditor } from "./TagListEditor";
import { getWorldSettingGeneratePrompt } from "@/lib/lorePrompts";
import { buildRagContext } from "@/lib/rag/loreContext";

// ─── Helpers ────────────────────────────────────────────────────────

function getField(article: Article, key: string): string {
  const v = article.fields[key];
  return typeof v === "string" ? v : "";
}

function getFieldTags(article: Article, key: string): string[] {
  const v = article.fields[key];
  return Array.isArray(v) ? v : [];
}

// ─── Card ───────────────────────────────────────────────────────────

function WorldCard({
  index,
  title,
  description,
  defaultExpanded = true,
  children,
}: {
  index: number;
  title: string;
  description?: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const headingId = `world-card-heading-${index}`;
  const bodyId = `world-card-body-${index}`;

  return (
    <section
      aria-labelledby={headingId}
      className="relative flex h-fit flex-col overflow-hidden rounded-2xl border border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] shadow-[0_1px_0_rgb(var(--highlight-rgb)/0.04)_inset,0_8px_24px_-12px_rgb(0_0_0/0.35)] backdrop-blur-sm [transition:border-color_200ms_var(--ease-unfurl),background-color_200ms_var(--ease-unfurl)] hover:border-[var(--chrome-stroke-emphasis)]"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={bodyId}
        className="focus-ring group flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          aria-hidden="true"
          className="ornate-card-badge inline-flex h-7 min-w-[1.75rem] shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 px-1.5 font-display text-2xs font-semibold tracking-wider text-accent shadow-[0_0_0_3px_rgb(var(--bg-rgb))_inset,0_0_8px_rgb(var(--accent-rgb)/0.15)]"
        >
          {index}
        </span>
        <h3
          id={headingId}
          className="font-display text-sm font-semibold tracking-wide text-text-primary [transition:color_200ms_var(--ease-unfurl)]"
        >
          {title}
        </h3>
        <span
          aria-hidden="true"
          className={`ml-auto inline-block text-[11px] text-text-muted [transition:transform_220ms_var(--ease-unfurl)] ${
            expanded ? "rotate-180" : ""
          }`}
        >
          &#x25BC;
        </span>
      </button>
      {expanded && (
        <div id={bodyId} className="flex flex-col gap-2 px-4 pb-4">
          {description && (
            <p className="-mt-1 mb-1 text-2xs leading-relaxed text-text-muted/80">
              {description}
            </p>
          )}
          {children}
        </div>
      )}
    </section>
  );
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
  const stub = (article ?? ({ fields: {} } as Article)) as Article;

  // Always-present header summarising the structured world-setting fields.
  // RAG retrieval picks up everything else from the corpus, but the
  // top-of-funnel facts (name, tone, era, themes) live in fields, not in
  // article bodies — so we synthesize them as a fallback / header here.
  const worldHeader = useMemo(() => {
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

  /** Build a per-field RAG context callback. Each World Setting field
   *  (Overview, History, Geography, Magic, Tech) retrieves around its
   *  own concept; the structured world header always rides along. */
  const makeFieldContext = useCallback(
    (topic: string) =>
      async (_action: string, text: string): Promise<string> => {
        const query = `${topic}: ${text.slice(0, 600)}`.trim();
        const { context } = await buildRagContext({
          query,
          fallback: () => worldHeader,
        });
        return context ? `${worldHeader}\n\n${context}` : worldHeader;
      },
    [worldHeader],
  );

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      {/* ── Left column ────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-4">
        <WorldCard index={1} title="Identity">
          <div className="flex flex-col gap-1">
            <FieldRow label="World name">
              <TextInput
                value={getField(stub, "name")}
                onCommit={(v) => patchField("name", v || undefined)}
                placeholder="The name of your world"
              />
            </FieldRow>
            <FieldRow label="Tagline">
              <TextInput
                value={getField(stub, "tagline")}
                onCommit={(v) => patchField("tagline", v || undefined)}
                placeholder="A one-line hook for your setting"
              />
            </FieldRow>
            <FieldRow label="Tone">
              <TextInput
                value={getField(stub, "tone")}
                onCommit={(v) => patchField("tone", v || undefined)}
                placeholder="e.g. whimsical, grimdark, heroic, cozy, surreal"
              />
            </FieldRow>
            <FieldRow label="Current era">
              <TextInput
                value={getField(stub, "era")}
                onCommit={(v) => patchField("era", v || undefined)}
                placeholder="e.g. The Age of Fractures"
              />
            </FieldRow>
          </div>
        </WorldCard>

        <WorldCard
          index={2}
          title="Themes"
          description="Narrative tone and recurring motifs that shape your world's stories."
        >
          <TagListEditor
            items={getFieldTags(stub, "themes")}
            onChange={(themes) => patchField("themes", themes)}
            placeholder="Add a theme..."
          />
        </WorldCard>

        <WorldCard index={3} title="Visual Style">
          <LoreTextArea
            label="Art direction for generated images"
            value={getField(stub, "visualStyle")}
            onCommit={(v) => patchField("visualStyle", v || undefined)}
            placeholder="Describe the image-generation style for this world — e.g. dreamy watercolor storybook, gritty dark fantasy oil painting, painterly high fantasy with desaturated earth tones..."
            rows={5}
          />
        </WorldCard>

        <WorldCard index={4} title="Overview">
          <LoreEditor
            value={content}
            onCommit={(v) => patchContent(v || "")}
            placeholder="Describe your world at a high level — its defining features, cultures, and conflicts..."
            generateSystemPrompt={getWorldSettingGeneratePrompt()}
            generateUserPrompt="Write a vivid world overview for this fantasy MUD setting."
            getActionContext={makeFieldContext("World overview — defining features, cultures, conflicts")}
          />
        </WorldCard>
      </div>

      {/* ── Right column ───────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-4">
        <WorldCard index={5} title="History">
          <LoreTextArea
            label="Creation and history"
            value={getField(stub, "history")}
            onCommit={(v) => patchField("history", v || undefined)}
            placeholder="The creation myth, major ages, wars, and turning points..."
            rows={8}
            generateSystemPrompt={getWorldSettingGeneratePrompt()}
            generateUserPrompt="Write a rich creation myth and historical timeline for this world."
            getActionContext={makeFieldContext("World history — creation myth, ages, wars, turning points")}
          />
        </WorldCard>

        <WorldCard index={6} title="Geography">
          <LoreTextArea
            label="Geography and regions"
            value={getField(stub, "geography")}
            onCommit={(v) => patchField("geography", v || undefined)}
            placeholder="Continents, biomes, major landmarks, and how geography shapes civilisation..."
            rows={6}
            generateSystemPrompt={getWorldSettingGeneratePrompt()}
            generateUserPrompt="Describe the broad geography and major regions of this world."
            getActionContext={makeFieldContext("World geography — continents, biomes, landmarks, regions")}
          />
        </WorldCard>

        <WorldCard index={7} title="Magic System">
          <LoreTextArea
            label="Magic and the supernatural"
            value={getField(stub, "magic")}
            onCommit={(v) => patchField("magic", v || undefined)}
            placeholder="How magic works, its sources, limits, and cultural significance..."
            rows={6}
            generateSystemPrompt={getWorldSettingGeneratePrompt()}
            generateUserPrompt="Design a magic system for this world — its sources, rules, and cultural role."
            getActionContext={makeFieldContext("Magic system — sources, rules, limits, cultural role")}
          />
        </WorldCard>

        <WorldCard index={8} title="Technology and civilisation">
          <LoreTextArea
            label="Technology level"
            value={getField(stub, "technology")}
            onCommit={(v) => patchField("technology", v || undefined)}
            placeholder="What level of technology exists? How does it interact with magic?..."
            rows={6}
            generateSystemPrompt={getWorldSettingGeneratePrompt()}
            generateUserPrompt="Describe the technology level and civilisational development of this world."
            getActionContext={makeFieldContext("Technology and civilisation — tech level, governance, economy, culture")}
          />
        </WorldCard>
      </div>
    </div>
  );
}
