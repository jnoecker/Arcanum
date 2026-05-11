import type {
  Article,
  ArticleRelation,
  CalendarSystem,
  LoreMap,
  RichTextSection,
  TimelineEvent,
  WorldLore,
} from "@/types/lore";
import type {
  AbilityDefinitionConfig,
  AppConfig,
  ClassDefinitionConfig,
  RaceDefinitionConfig,
} from "@/types/config";
import type { ItemFile, MobFile, WorldFile } from "@/types/world";
import { getEffectiveSections } from "@/lib/loreSections";
import type { RagChunk } from "./types";

export interface ChunkerZone {
  zoneId: string;
  data: WorldFile;
}

export interface ChunkerInput {
  lore: WorldLore | null;
  config: AppConfig | null;
  zones: ChunkerZone[];
}

/** Heading + body slice extracted from a rich-text TipTap doc. */
interface SectionSlice {
  heading: string | null;
  body: string;
}

/** Walk a TipTap JSON node and emit slices keyed by H2 headings. */
function splitTipTapByH2(content: string): SectionSlice[] {
  if (!content) return [];
  let doc: unknown;
  if (content.startsWith("{")) {
    try {
      doc = JSON.parse(content);
    } catch {
      return [{ heading: null, body: content }];
    }
  } else {
    return splitMarkdownByH2(content);
  }

  const top = doc as { content?: unknown[] };
  if (!Array.isArray(top.content)) return [];

  const slices: SectionSlice[] = [];
  let current: SectionSlice = { heading: null, body: "" };

  for (const node of top.content) {
    if (!node || typeof node !== "object") continue;
    const n = node as Record<string, unknown>;
    const type = n.type as string | undefined;
    if (type === "heading") {
      const level = Number((n.attrs as Record<string, unknown> | undefined)?.level ?? 1);
      const text = nodeToPlainText(n);
      if (level <= 2) {
        if (current.body.trim() || current.heading) slices.push(current);
        current = { heading: text || null, body: "" };
        continue;
      }
      current.body += text ? `${text}\n` : "";
      continue;
    }
    const text = nodeToPlainText(n);
    if (text) current.body += `${text}\n`;
  }
  if (current.body.trim() || current.heading) slices.push(current);
  return slices;
}

function nodeToPlainText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  if (n.type === "text" && typeof n.text === "string") return n.text;
  if (n.type === "mention") {
    const label = (n.attrs as Record<string, unknown> | undefined)?.label;
    return typeof label === "string" ? label : "";
  }
  const parts: string[] = [];
  if (Array.isArray(n.content)) {
    for (const child of n.content) parts.push(nodeToPlainText(child));
  }
  const joined = parts.join("");
  if (n.type === "listItem") return `- ${joined}`;
  if (n.type === "paragraph" || n.type === "heading") return joined;
  return joined;
}

function splitMarkdownByH2(content: string): SectionSlice[] {
  const lines = content.split(/\r?\n/);
  const slices: SectionSlice[] = [];
  let current: SectionSlice = { heading: null, body: "" };
  for (const line of lines) {
    const m = line.match(/^##\s+(.+)$/);
    if (m) {
      if (current.body.trim() || current.heading) slices.push(current);
      current = { heading: m[1]!.trim(), body: "" };
    } else {
      current.body += `${line}\n`;
    }
  }
  if (current.body.trim() || current.heading) slices.push(current);
  return slices;
}

function articleSectionBody(section: { type: string }): string {
  if (section.type === "richtext") {
    const rich = section as RichTextSection;
    return rich.body ?? "";
  }
  return "";
}

function articleSliceSet(article: Article): SectionSlice[] {
  const sections = getEffectiveSections(article);
  const slices: SectionSlice[] = [];
  let producedAny = false;
  for (const s of sections) {
    if (s.private) continue;
    if (s.type !== "richtext") continue;
    const body = articleSectionBody(s);
    if (!body || !body.trim()) continue;
    producedAny = true;
    const sub = splitTipTapByH2(body).filter((sl) => sl.body.trim().length > 0 || sl.heading);
    if (sub.length === 0) {
      slices.push({ heading: s.title ?? null, body });
      continue;
    }
    sub.forEach((sl, i) => {
      const heading = sl.heading ?? (i === 0 ? s.title ?? null : null);
      slices.push({ heading, body: sl.body });
    });
  }
  if (!producedAny && article.content && article.content.trim()) {
    const sub = splitTipTapByH2(article.content).filter(
      (sl) => sl.body.trim().length > 0 || sl.heading,
    );
    if (sub.length === 0) slices.push({ heading: null, body: article.content });
    else slices.push(...sub);
  }
  return slices;
}

function chunkArticles(lore: WorldLore | null): RagChunk[] {
  if (!lore) return [];
  const out: RagChunk[] = [];
  for (const [articleId, article] of Object.entries(lore.articles)) {
    const slices = articleSliceSet(article);
    const baseMeta: Record<string, unknown> = {
      templateId: article.template,
      tags: article.tags ?? [],
      fields: article.fields ?? {},
    };
    if (article.draft) baseMeta.draft = true;

    if (slices.length === 0) continue;

    slices.forEach((slice, idx) => {
      const body = slice.body.trim();
      if (!body && !slice.heading) return;
      out.push({
        id: `article:${articleId}:section:${idx}`,
        kind: "article",
        source_id: articleId,
        section: slice.heading ?? undefined,
        title: article.title,
        body: body || slice.heading || "",
        metadata: baseMeta,
      });
    });
  }
  return out;
}

function chunkEvents(lore: WorldLore | null): RagChunk[] {
  if (!lore?.timelineEvents) return [];
  const out: RagChunk[] = [];
  const erasByCal = new Map<string, Map<string, string>>();
  for (const cal of (lore.calendarSystems ?? []) as CalendarSystem[]) {
    const eras = new Map<string, string>();
    for (const era of cal.eras) eras.set(era.id, era.name);
    erasByCal.set(cal.id, eras);
  }

  for (const event of lore.timelineEvents as TimelineEvent[]) {
    const eraName = erasByCal.get(event.calendarId)?.get(event.eraId) ?? event.eraId;
    const description = event.description?.trim() ?? "";
    const date = `Year ${event.year}`;
    const body = `${date} (${eraName}): ${description || event.title}`;
    out.push({
      id: `event:${event.id}`,
      kind: "event",
      source_id: event.id,
      title: event.title,
      body,
      metadata: {
        date,
        year: event.year,
        era: eraName,
        eraId: event.eraId,
        calendarId: event.calendarId,
        importance: event.importance,
        articleId: event.articleId,
      },
    });
  }
  return out;
}

function chunkPins(lore: WorldLore | null): RagChunk[] {
  if (!lore?.maps) return [];
  const articleTitleById = new Map<string, string>();
  for (const [id, a] of Object.entries(lore.articles)) articleTitleById.set(id, a.title);

  const out: RagChunk[] = [];
  for (const map of lore.maps as LoreMap[]) {
    map.pins.forEach((pin, idx) => {
      const label = pin.label?.trim();
      const linkedTitle = pin.articleId ? articleTitleById.get(pin.articleId) : undefined;
      const display = label || linkedTitle;
      if (!display) return;
      const body = linkedTitle && label && linkedTitle !== label
        ? `${label} on ${map.title}: linked to ${linkedTitle}`
        : `${display} on ${map.title}`;
      out.push({
        id: `pin:${map.id}:${idx}`,
        kind: "pin",
        source_id: pin.id,
        title: display,
        body,
        metadata: {
          mapId: map.id,
          mapName: map.title,
          articleRef: pin.articleId,
          position: pin.position,
        },
      });
    });
  }
  return out;
}

const TRIVIAL_RELATION_TYPES = new Set(["mentions", "mention"]);

function humanizeRelationType(type: string): string {
  return type.replace(/[_-]+/g, " ").trim();
}

function chunkRelationships(lore: WorldLore | null): RagChunk[] {
  if (!lore) return [];
  const out: RagChunk[] = [];
  const titleById = new Map<string, string>();
  for (const [id, a] of Object.entries(lore.articles)) titleById.set(id, a.title);

  const seen = new Set<string>();
  for (const [fromId, article] of Object.entries(lore.articles)) {
    const relations = (article.relations ?? []) as ArticleRelation[];
    for (const rel of relations) {
      const type = (rel.type ?? "").toLowerCase();
      if (!type || TRIVIAL_RELATION_TYPES.has(type)) continue;
      const id = `rel:${fromId}:${rel.targetId}:${type}`;
      if (seen.has(id)) continue;
      seen.add(id);

      const fromTitle = titleById.get(fromId) ?? fromId;
      const toTitle = titleById.get(rel.targetId) ?? rel.targetId;
      const verb = humanizeRelationType(rel.type);
      const note = rel.label?.trim();
      const body = note
        ? `${fromTitle} ${verb} ${toTitle}: ${note}`
        : `${fromTitle} ${verb} ${toTitle}`;
      out.push({
        id,
        kind: "relationship",
        source_id: fromId,
        title: `${fromTitle} ⇄ ${toTitle}`,
        body,
        metadata: {
          type: rel.type,
          fromId,
          toId: rel.targetId,
          label: rel.label,
        },
      });
    }
  }
  return out;
}

interface EntityBlurbSpec {
  entityKind: "race" | "class" | "ability" | "mob" | "item";
  entityId: string;
  display: string;
  fields: { fieldName: string; value: string | undefined }[];
  extraMeta?: Record<string, unknown>;
}

function entitySpecToChunks(spec: EntityBlurbSpec): RagChunk[] {
  const out: RagChunk[] = [];
  for (const { fieldName, value } of spec.fields) {
    if (!value || !value.trim()) continue;
    out.push({
      id: `entity:${spec.entityKind}:${spec.entityId}:${fieldName}`,
      kind: "entity",
      source_id: spec.entityId,
      section: fieldName,
      title: spec.display,
      body: value.trim(),
      metadata: {
        entityKind: spec.entityKind,
        entityId: spec.entityId,
        fieldName,
        ...(spec.extraMeta ?? {}),
      },
    });
  }
  return out;
}

function chunkEntities(config: AppConfig | null, zones: ChunkerZone[]): RagChunk[] {
  const out: RagChunk[] = [];

  if (config?.races) {
    for (const [id, race] of Object.entries(config.races) as [string, RaceDefinitionConfig][]) {
      out.push(
        ...entitySpecToChunks({
          entityKind: "race",
          entityId: id,
          display: race.displayName || id,
          fields: [
            { fieldName: "backstory", value: race.backstory },
            { fieldName: "bodyDescription", value: race.bodyDescription },
            { fieldName: "description", value: race.description },
          ],
        }),
      );
    }
  }
  if (config?.classes) {
    for (const [id, klass] of Object.entries(config.classes) as [string, ClassDefinitionConfig][]) {
      out.push(
        ...entitySpecToChunks({
          entityKind: "class",
          entityId: id,
          display: klass.displayName || id,
          fields: [
            { fieldName: "description", value: klass.description },
            { fieldName: "backstory", value: klass.backstory },
          ],
        }),
      );
    }
  }
  if (config?.abilities) {
    for (const [id, ability] of Object.entries(config.abilities) as [string, AbilityDefinitionConfig][]) {
      out.push(
        ...entitySpecToChunks({
          entityKind: "ability",
          entityId: id,
          display: ability.displayName || id,
          fields: [{ fieldName: "description", value: ability.description }],
        }),
      );
    }
  }

  for (const { zoneId, data } of zones) {
    for (const [id, mob] of Object.entries(data.mobs ?? {}) as [string, MobFile][]) {
      out.push(
        ...entitySpecToChunks({
          entityKind: "mob",
          entityId: `${zoneId}:${id}`,
          display: mob.name || id,
          fields: [{ fieldName: "description", value: mob.description }],
          extraMeta: { zoneId },
        }),
      );
    }
    for (const [id, item] of Object.entries(data.items ?? {}) as [string, ItemFile][]) {
      out.push(
        ...entitySpecToChunks({
          entityKind: "item",
          entityId: `${zoneId}:${id}`,
          display: item.displayName || id,
          fields: [{ fieldName: "description", value: item.description }],
          extraMeta: { zoneId },
        }),
      );
    }
  }

  return out;
}

/** Pure: input snapshots → flat RagChunk[] ready for the backend. */
export function chunkLore(input: ChunkerInput): RagChunk[] {
  return [
    ...chunkArticles(input.lore),
    ...chunkEvents(input.lore),
    ...chunkPins(input.lore),
    ...chunkRelationships(input.lore),
    ...chunkEntities(input.config, input.zones),
  ];
}
