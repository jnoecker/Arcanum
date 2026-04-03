import { useMemo, useState, useCallback } from "react";
import { useLoreStore, selectArticles } from "@/stores/loreStore";
import type { Article, ArticleRelation } from "@/types/lore";
import { DefinitionWorkbench } from "@/components/config/DefinitionWorkbench";
import { Section, FieldRow, TextInput } from "@/components/ui/FormWidgets";
import { LoreEditor } from "./LoreEditor";
import { FACTION_GENERATE_PROMPT } from "@/lib/lorePrompts";

// ─── String list editor ─────────────────────────────────────────────

function TagList({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
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
      {items.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {items.map((t, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 rounded-full border border-border-muted bg-bg-tertiary px-2 py-0.5 text-2xs text-text-secondary"
            >
              {t}
              <button
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="ml-0.5 text-text-muted hover:text-status-danger"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <input
          className="flex-1 rounded border border-border-default bg-bg-primary px-2 py-0.5 text-xs text-text-primary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={placeholder ?? "Add..."}
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          className="rounded border border-border-default px-2 py-0.5 text-xs text-text-secondary hover:bg-bg-tertiary disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ─── Faction multi-select (allies/rivals) ──────────────────────────

function FactionSelect({
  label,
  selected,
  options,
  onChange,
}: {
  label: string;
  selected: string[];
  options: string[];
  onChange: (ids: string[]) => void;
}) {
  const available = options.filter((id) => !selected.includes(id));

  return (
    <div className="mt-1">
      <label className="text-xs text-text-muted">{label}</label>
      {selected.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {selected.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-0.5 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-2xs text-accent"
            >
              {id}
              <button
                onClick={() => onChange(selected.filter((s) => s !== id))}
                className="ml-0.5 hover:text-status-danger"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      {available.length > 0 && (
        <select
          className="mt-1 rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-secondary outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
          value=""
          onChange={(e) => {
            if (e.target.value) onChange([...selected, e.target.value]);
          }}
        >
          <option value="">Add {label.toLowerCase()}...</option>
          {available.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      )}
    </div>
  );
}

// ─── Helpers: read faction-shaped data from Article ─────────────────

interface FactionView {
  displayName: string;
  description: string;
  motto?: string;
  territory?: string;
  leader?: string;
  values: string[];
  allies: string[];
  rivals: string[];
  image?: string;
}

function articleToFaction(a: Article): FactionView {
  const f = a.fields;
  const allies = (a.relations ?? []).filter((r) => r.type === "ally").map((r) => r.targetId);
  const rivals = (a.relations ?? []).filter((r) => r.type === "rival").map((r) => r.targetId);
  return {
    displayName: a.title,
    description: a.content,
    motto: typeof f.motto === "string" ? f.motto : undefined,
    territory: typeof f.territory === "string" ? f.territory : undefined,
    leader: typeof f.leader === "string" ? f.leader : undefined,
    values: Array.isArray(f.values) ? f.values : [],
    allies,
    rivals,
    image: a.image,
  };
}

function factionToArticlePatch(fv: FactionView, existingRelations: ArticleRelation[]): Partial<Article> {
  // Preserve non-ally/rival relations
  const otherRelations = existingRelations.filter((r) => r.type !== "ally" && r.type !== "rival");
  const allyRelations: ArticleRelation[] = fv.allies.map((id) => ({ targetId: id, type: "ally" }));
  const rivalRelations: ArticleRelation[] = fv.rivals.map((id) => ({ targetId: id, type: "rival" }));
  const relations = [...otherRelations, ...allyRelations, ...rivalRelations];
  return {
    title: fv.displayName,
    content: fv.description,
    fields: {
      motto: fv.motto,
      territory: fv.territory,
      leader: fv.leader,
      values: fv.values,
    },
    image: fv.image,
    relations: relations.length > 0 ? relations : undefined,
  };
}

// ─── Faction detail ────────────────────────────────────────────────

function FactionDetail({
  faction,
  patch,
  allFactionIds,
  factionId,
  worldContext,
}: {
  faction: FactionView;
  patch: (p: Partial<FactionView>) => void;
  allFactionIds: string[];
  factionId: string;
  worldContext: string;
}) {
  const otherFactions = allFactionIds.filter((id) => id !== factionId);

  return (
    <div className="flex flex-col gap-4">
      <Section title="Identity">
        <div className="flex flex-col gap-1.5">
          <FieldRow label="Display name">
            <TextInput
              value={faction.displayName}
              onCommit={(v) => patch({ displayName: v })}
            />
          </FieldRow>
          <FieldRow label="Motto">
            <TextInput
              value={faction.motto ?? ""}
              onCommit={(v) => patch({ motto: v || undefined })}
              placeholder="A rallying cry or creed"
            />
          </FieldRow>
          <FieldRow label="Leader">
            <TextInput
              value={faction.leader ?? ""}
              onCommit={(v) => patch({ leader: v || undefined })}
              placeholder="Current leader or ruling body"
            />
          </FieldRow>
          <FieldRow label="Territory">
            <TextInput
              value={faction.territory ?? ""}
              onCommit={(v) => patch({ territory: v || undefined })}
              placeholder="Regions or strongholds"
            />
          </FieldRow>
        </div>
      </Section>

      <Section title="Description">
        <LoreEditor
          value={faction.description}
          onCommit={(v) => patch({ description: v || "" })}
          placeholder="History, purpose, culture, and role in the world..."
          generateSystemPrompt={FACTION_GENERATE_PROMPT}
          generateUserPrompt={`Write a description for the faction "${faction.displayName}".${faction.motto ? ` Their motto is: "${faction.motto}"` : ""}${faction.territory ? ` They control: ${faction.territory}` : ""}`}
          context={worldContext}
        />
      </Section>

      <Section title="Values">
        <TagList
          items={faction.values}
          onChange={(values) => patch({ values })}
          placeholder="Add a core value..."
        />
      </Section>

      {otherFactions.length > 0 && (
        <Section title="Relationships">
          <FactionSelect
            label="Allies"
            selected={faction.allies}
            options={otherFactions}
            onChange={(allies) => patch({ allies })}
          />
          <FactionSelect
            label="Rivals"
            selected={faction.rivals}
            options={otherFactions}
            onChange={(rivals) => patch({ rivals })}
          />
        </Section>
      )}
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────

export function FactionsPanel() {
  const articles = useLoreStore(selectArticles);
  const replaceArticlesByTemplate = useLoreStore((s) => s.replaceArticlesByTemplate);

  // Filter organization articles and project them as FactionView records
  const orgArticles = useMemo(
    () => Object.fromEntries(
      Object.entries(articles).filter(([, a]) => a.template === "organization"),
    ),
    [articles],
  );

  const factionViews = useMemo(
    () => Object.fromEntries(
      Object.entries(orgArticles).map(([id, a]) => [id, articleToFaction(a)]),
    ),
    [orgArticles],
  );

  const allFactionIds = useMemo(() => Object.keys(factionViews), [factionViews]);

  const worldContext = useMemo(() => {
    const ws = Object.values(articles).find((a) => a.template === "world_setting");
    if (!ws) return "A fantasy MUD world";
    const parts: string[] = [];
    const name = typeof ws.fields.name === "string" ? ws.fields.name : "";
    if (name) parts.push(`World: ${name}`);
    const tagline = typeof ws.fields.tagline === "string" ? ws.fields.tagline : "";
    if (tagline) parts.push(tagline);
    const themes = Array.isArray(ws.fields.themes) ? ws.fields.themes : [];
    if (themes.length) parts.push(`Themes: ${themes.join(", ")}`);
    return parts.join("\n") || "A fantasy MUD world";
  }, [articles]);

  const handleItemsChange = useCallback(
    (newViews: Record<string, FactionView>) => {
      // Convert FactionViews back to Articles
      const newArticles: Record<string, Article> = {};
      const now = new Date().toISOString();
      for (const [id, fv] of Object.entries(newViews)) {
        const existing = orgArticles[id];
        if (existing) {
          // Update existing article
          const patch = factionToArticlePatch(fv, existing.relations ?? []);
          newArticles[id] = { ...existing, ...patch, updatedAt: now };
        } else {
          // New article
          newArticles[id] = {
            id,
            template: "organization",
            title: fv.displayName,
            content: fv.description,
            fields: {
              motto: fv.motto,
              territory: fv.territory,
              leader: fv.leader,
              values: fv.values,
            },
            image: fv.image,
            createdAt: now,
            updatedAt: now,
          };
        }
      }
      replaceArticlesByTemplate("organization", newArticles);
    },
    [orgArticles, replaceArticlesByTemplate],
  );

  return (
    <DefinitionWorkbench<FactionView>
      title="Faction designer"
      countLabel="Factions"
      description="Define the political, cultural, and organisational forces of your world."
      addPlaceholder="New faction id"
      searchPlaceholder="Search factions"
      emptyMessage="Create a faction to populate your world."
      items={factionViews}
      defaultItem={(raw) => ({
        displayName: raw
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        description: "",
        values: [],
        allies: [],
        rivals: [],
      })}
      getDisplayName={(f) => f.displayName}
      renderSummary={(f) => f.motto ?? f.territory ?? ""}
      renderBadges={(f) => {
        const badges: string[] = [];
        if (f.allies.length) badges.push(`${f.allies.length} allies`);
        if (f.rivals.length) badges.push(`${f.rivals.length} rivals`);
        return badges;
      }}
      renderDetail={(faction, patch) => {
        const factionId = Object.entries(factionViews).find(([, f]) => f === faction)?.[0] ?? "";
        return (
          <FactionDetail
            faction={faction}
            patch={patch}
            allFactionIds={allFactionIds}
            factionId={factionId}
            worldContext={worldContext}
          />
        );
      }}
      onItemsChange={handleItemsChange}
    />
  );
}
