import { useState } from "react";
import type { AppConfig, ClassDefinitionConfig } from "@/types/config";
import {
  TextInput,
  NumberInput,
  SelectInput,
  CommitTextarea,
} from "@/components/ui/FormWidgets";
import { SectionCard } from "../panels/factions/SectionCard";
import { EnhanceDescriptionButton } from "@/components/editors/EditorShared";
import { getBackstoryEnhancePrompt } from "@/lib/lorePrompts";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { composePrompt, type ArtStyle } from "@/lib/arcanumPrompts";
import { useAssetStore } from "@/stores/assetStore";
import { chartTokens } from "@/lib/cssTokens";

const OUTFIT_DESC_SYSTEM_PROMPT = `You are an expert AI image prompt engineer writing outfit descriptions for fantasy RPG character class sprites.

Given a class's name, lore, and role, write a concise but vivid prompt fragment describing the class's OUTFIT, WEAPONS, AND ACCESSORIES ONLY — not the body (that comes from the race).

Rules:
- 1-2 sentences of dense visual detail optimized for AI image generation
- Focus on: armor type, materials, weapons held, magical accessories, signature visual elements
- Describe the class fantasy silhouette — what makes this class instantly recognizable
- Include specific details: weapon types, armor weight, magical effects on gear
- Do NOT describe the body, face, skin, or hair — the race system handles those
- Output ONLY the description text — no quotes, no explanation`;

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

interface ClassEditorProps {
  id: string;
  cls: ClassDefinitionConfig;
  config: AppConfig;
  onPatch: (p: Partial<ClassDefinitionConfig>) => void;
  onRename: (newId: string) => void;
}

export function ClassEditor({
  id,
  cls,
  config,
  onPatch,
  onRename,
}: ClassEditorProps) {
  const statOptions = Object.entries(config.stats.definitions).map(
    ([sid, def]) => ({ value: sid, label: def.displayName }),
  );
  const raceOptions = Object.keys(config.races).map((rid) => ({
    value: rid,
    label: config.races[rid]!.displayName || rid,
  }));

  const buildContext = () => {
    const parts = [`Class: ${cls.displayName}`];
    if (cls.description) parts.push(`Tagline: ${cls.description}`);
    if (cls.backstory) parts.push(`Backstory: ${cls.backstory}`);
    if (cls.primaryStat) parts.push(`Primary stat: ${cls.primaryStat}`);
    parts.push(`HP/level: ${cls.hpPerLevel}, Mana/level: ${cls.manaPerLevel}`);
    if (cls.threatMultiplier != null && cls.threatMultiplier !== 1.0) {
      parts.push(`Threat multiplier: ${cls.threatMultiplier}`);
    }
    return parts.join("\n");
  };

  return (
    <div className="flex flex-col gap-4">
      <DetailHeader id={id} cls={cls} onRename={onRename} onPatch={onPatch} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <IdentityCard cls={cls} onPatch={onPatch} />
        <LoreCard cls={cls} buildContext={buildContext} onPatch={onPatch} />
        <ProgressionCard
          cls={cls}
          maxLevel={config.progression.maxLevel}
          baseHp={config.progression.rewards.baseHp}
          baseMana={config.progression.rewards.baseMana}
          onPatch={onPatch}
        />
        <RoleIdentityCard
          cls={cls}
          statOptions={statOptions}
          onPatch={onPatch}
        />
        <ArtCard
          id={id}
          cls={cls}
          raceOptions={raceOptions}
          buildContext={buildContext}
          onPatch={onPatch}
        />
        <NotesCard cls={cls} />
      </div>
    </div>
  );
}

// ─── Header (kicker breadcrumb + title + tagline + actions) ─────────

function DetailHeader({
  id,
  cls,
  onRename,
  onPatch,
}: {
  id: string;
  cls: ClassDefinitionConfig;
  onRename: (v: string) => void;
  onPatch: (p: Partial<ClassDefinitionConfig>) => void;
}) {
  return (
    <header className="panel-surface rounded-2xl p-5 shadow-section">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xs uppercase tracking-[0.22em] text-text-muted">
            Classes <span className="text-text-muted/40">›</span>{" "}
            <span className="text-text-secondary">{id}</span>
          </p>
          <h1 className="mt-1 truncate font-display text-3xl font-semibold text-text-primary">
            {cls.displayName || "Untitled Class"}
          </h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-text-secondary">
            {cls.description?.trim() ||
              "Tune progression, identity, and presentation for this class."}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <SlugRenamer id={id} onRename={onRename} />
          <SelectableToggle
            checked={cls.selectable ?? true}
            onChange={(v) => onPatch({ selectable: v })}
          />
        </div>
      </div>
    </header>
  );
}

function SlugRenamer({
  id,
  onRename,
}: {
  id: string;
  onRename: (v: string) => void;
}) {
  const [draft, setDraft] = useState(id);
  const [focused, setFocused] = useState(false);

  if (!focused && draft !== id) setDraft(id);

  const commit = () => {
    if (draft.trim() && draft !== id) onRename(draft);
    else setDraft(id);
  };

  return (
    <input
      className="ornate-input min-h-9 w-44 px-2.5 py-1.5 font-mono text-xs text-text-primary"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(id);
          (e.target as HTMLInputElement).blur();
        }
      }}
      title="Internal class id (slug)"
      aria-label="Internal class id"
      placeholder="WARRIOR"
    />
  );
}

function SelectableToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      title={
        checked
          ? "Selectable at character creation"
          : "Hidden from character creation"
      }
      className={cx(
        "focus-ring inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition",
        checked
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] text-text-muted hover:border-accent/30",
      )}
    >
      <span
        className={cx(
          "relative inline-flex h-4 w-7 items-center rounded-full transition-colors",
          checked ? "bg-accent/80" : "bg-[var(--chrome-fill-strong)]",
        )}
      >
        <span
          className={cx(
            "inline-block h-3 w-3 rounded-full bg-bg-primary shadow-md transition-transform",
            checked ? "translate-x-[0.875rem]" : "translate-x-0.5",
          )}
        />
      </span>
      <span className="font-display text-2xs uppercase tracking-[0.18em]">
        {checked ? "Selectable" : "Hidden"}
      </span>
    </button>
  );
}

// ─── Identity ───────────────────────────────────────────────────────

function IdentityCard({
  cls,
  onPatch,
}: {
  cls: ClassDefinitionConfig;
  onPatch: (p: Partial<ClassDefinitionConfig>) => void;
}) {
  return (
    <SectionCard title="Identity">
      <div className="grid grid-cols-1 gap-3">
        <FieldLabel label="Display Name" required>
          <TextInput
            value={cls.displayName}
            onCommit={(v) => onPatch({ displayName: v })}
            placeholder="Warrior"
            dense
          />
        </FieldLabel>

        <FieldLabel
          label="Tagline"
          hint="Short tagline shown during character creation."
        >
          <TextInput
            value={cls.description ?? ""}
            onCommit={(v) => onPatch({ description: v || undefined })}
            placeholder="Master of arcane forces"
            dense
          />
        </FieldLabel>
      </div>
    </SectionCard>
  );
}

// ─── Lore & Theme ───────────────────────────────────────────────────

function LoreCard({
  cls,
  buildContext,
  onPatch,
}: {
  cls: ClassDefinitionConfig;
  buildContext: () => string;
  onPatch: (p: Partial<ClassDefinitionConfig>) => void;
}) {
  return (
    <SectionCard title="Lore & Theme">
      <div className="flex flex-col gap-2">
        <CommitTextarea
          label="Backstory"
          value={cls.backstory ?? ""}
          onCommit={(v) => onPatch({ backstory: v || undefined })}
          placeholder="Lore, training traditions, role in the world…"
          rows={5}
        />
        <div>
          <EnhanceDescriptionButton
            entitySummary={buildContext()}
            currentDescription={cls.backstory}
            onAccept={(text) => onPatch({ backstory: text })}
            systemPrompt={getBackstoryEnhancePrompt()}
            label="Enhance backstory"
          />
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Progression ────────────────────────────────────────────────────

function ProgressionCard({
  cls,
  maxLevel,
  baseHp,
  baseMana,
  onPatch,
}: {
  cls: ClassDefinitionConfig;
  maxLevel: number;
  baseHp: number;
  baseMana: number;
  onPatch: (p: Partial<ClassDefinitionConfig>) => void;
}) {
  return (
    <SectionCard title="Progression">
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel
          label="HP / Level"
          hint="Class-specific HP gained per level."
        >
          <NumberInput
            value={cls.hpPerLevel}
            onCommit={(v) => onPatch({ hpPerLevel: v ?? 6 })}
            min={0}
            dense
          />
        </FieldLabel>
        <FieldLabel
          label="Mana / Level"
          hint="High for casters, low for melee."
        >
          <NumberInput
            value={cls.manaPerLevel}
            onCommit={(v) => onPatch({ manaPerLevel: v ?? 8 })}
            min={0}
            dense
          />
        </FieldLabel>
      </div>

      <div className="mt-3">
        <HpManaCurve
          hpPerLevel={cls.hpPerLevel}
          manaPerLevel={cls.manaPerLevel}
          maxLevel={maxLevel}
          baseHp={baseHp}
          baseMana={baseMana}
        />
      </div>
    </SectionCard>
  );
}

// ─── Role Identity ──────────────────────────────────────────────────

function RoleIdentityCard({
  cls,
  statOptions,
  onPatch,
}: {
  cls: ClassDefinitionConfig;
  statOptions: { value: string; label: string }[];
  onPatch: (p: Partial<ClassDefinitionConfig>) => void;
}) {
  return (
    <SectionCard title="Role Identity">
      <div className="grid grid-cols-1 gap-3">
        <FieldLabel
          label="Primary Stat"
          hint="Influences UI hints and may scale class abilities."
        >
          <SelectInput
            value={cls.primaryStat ?? ""}
            options={statOptions}
            onCommit={(v) => onPatch({ primaryStat: v || undefined })}
            allowEmpty
            placeholder="— none —"
            dense
          />
        </FieldLabel>

        <FieldLabel
          label="Threat Multiplier"
          hint=">1.0 for tanks (more aggro), <1.0 for healers/DPS."
        >
          <NumberInput
            value={cls.threatMultiplier ?? 1.0}
            onCommit={(v) => onPatch({ threatMultiplier: v ?? 1.0 })}
            min={0}
            step={0.1}
            dense
          />
        </FieldLabel>

        <FieldLabel
          label="Start Room Override"
          hint="Leave blank to use the world default."
        >
          <TextInput
            value={cls.startRoom ?? ""}
            onCommit={(v) => onPatch({ startRoom: v || undefined })}
            placeholder="zone:room_id"
            dense
          />
        </FieldLabel>
      </div>
    </SectionCard>
  );
}

// ─── Art & Progression (portrait + outfit + showcase race) ──────────

function ArtCard({
  id,
  cls,
  raceOptions,
  buildContext,
  onPatch,
}: {
  id: string;
  cls: ClassDefinitionConfig;
  raceOptions: { value: string; label: string }[];
  buildContext: () => string;
  onPatch: (p: Partial<ClassDefinitionConfig>) => void;
}) {
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const imagePath =
    cls.image && assetsDir ? `${assetsDir}\\images\\${cls.image}` : undefined;

  return (
    <SectionCard
      title="Art & Portrait"
      className="lg:col-span-2"
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <EntityArtGenerator
            getPrompt={(style: ArtStyle) =>
              composePrompt(
                "class_portrait",
                style,
                `Class: ${cls.displayName}`,
              )
            }
            entityContext={buildContext()}
            currentImage={imagePath}
            onAccept={(filePath) => {
              const fileName = filePath.split(/[\\/]/).pop() ?? "";
              onPatch({ image: fileName });
            }}
            assetType="class_portrait"
            context={{ zone: "", entity_type: "class", entity_id: id }}
            surface="worldbuilding"
          />
        </div>

        <div className="flex flex-col gap-3">
          <FieldLabel
            label="Outfit Description"
            hint="Used by sprite/portrait prompts. Body description comes from the race."
          >
            <CommitTextarea
              label=""
              value={cls.outfitDescription ?? ""}
              onCommit={(v) => onPatch({ outfitDescription: v || undefined })}
              placeholder="Heavy plate armor with tower shield…"
              rows={4}
            />
          </FieldLabel>
          <div>
            <EnhanceDescriptionButton
              entitySummary={`Class: ${cls.displayName}\n${
                cls.description ? `Description: ${cls.description}` : ""
              }${cls.backstory ? `\nBackstory: ${cls.backstory}` : ""}${
                cls.primaryStat ? `\nPrimary stat: ${cls.primaryStat}` : ""
              }`}
              currentDescription={cls.outfitDescription}
              onAccept={(v) => onPatch({ outfitDescription: v })}
              systemPrompt={OUTFIT_DESC_SYSTEM_PROMPT}
              label="AI Generate Outfit"
            />
          </div>

          <FieldLabel
            label="Showcase Race"
            hint="Race paired with this class for portrait generation."
          >
            <SelectInput
              value={cls.showcaseRace ?? ""}
              options={raceOptions}
              onCommit={(v) => onPatch({ showcaseRace: v || undefined })}
              allowEmpty
              placeholder="— default —"
              dense
            />
          </FieldLabel>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Notes ──────────────────────────────────────────────────────────

function NotesCard({ cls }: { cls: ClassDefinitionConfig }) {
  return (
    <SectionCard title="Notes" className="lg:col-span-2">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] p-3">
          <p className="font-display text-2xs uppercase tracking-[0.18em] text-text-muted">
            Tagline preview
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
            {cls.description?.trim() ||
              "No tagline yet — players see this on the class card during character creation."}
          </p>
        </div>

        <ChecklistTip
          items={[
            cls.displayName.trim()
              ? "Display name set"
              : "Add a display name",
            cls.primaryStat ? "Primary stat assigned" : "Pick a primary stat",
            cls.image ? "Portrait artwork attached" : "Generate a portrait",
            cls.outfitDescription
              ? "Outfit description written"
              : "Describe the class outfit",
          ]}
        />
      </div>

      <p className="mt-3 text-2xs italic text-text-muted/70">
        Internal class ids should be uppercase with underscores (e.g.{" "}
        <code className="font-mono text-text-muted">SHADOW_DANCER</code>). All
        edits autosave with the rest of the project config.
      </p>
    </SectionCard>
  );
}

function ChecklistTip({ items }: { items: string[] }) {
  return (
    <ul className="rounded-xl border border-dashed border-[var(--chrome-stroke-strong)] bg-[var(--chrome-fill-soft)] p-3 text-2xs text-text-muted/80">
      <p className="mb-1.5 font-display text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted">
        Polish checklist
      </p>
      {items.map((item, i) => (
        <li key={i} className="flex items-baseline gap-1.5 leading-snug">
          <span className="text-text-muted/40">·</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Shared primitives ──────────────────────────────────────────────

function FieldLabel({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
        {label} {required && <span className="text-accent">*</span>}
      </span>
      {children}
      {hint && (
        <p className="text-2xs text-text-muted/70 leading-snug">{hint}</p>
      )}
    </div>
  );
}

// ─── HP / Mana growth chart (preserved from the old detail) ─────────

function HpManaCurve({
  hpPerLevel,
  manaPerLevel,
  maxLevel,
  baseHp,
  baseMana,
}: {
  hpPerLevel: number;
  manaPerLevel: number;
  maxLevel: number;
  baseHp: number;
  baseMana: number;
}) {
  const chart = chartTokens();
  const levels = Math.max(maxLevel, 2);

  const hpAt = (lvl: number) => baseHp + (lvl - 1) * hpPerLevel;
  const manaAt = (lvl: number) => baseMana + (lvl - 1) * manaPerLevel;

  const maxVal = Math.max(hpAt(levels), manaAt(levels), 1);

  const w = 320;
  const h = 120;
  const pad = { top: 8, right: 8, bottom: 20, left: 36 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const x = (lvl: number) => pad.left + ((lvl - 1) / (levels - 1)) * plotW;
  const y = (val: number) => pad.top + plotH - (val / maxVal) * plotH;

  const buildPath = (fn: (lvl: number) => number) => {
    const step = Math.max(1, Math.floor(levels / 50));
    const points: string[] = [];
    for (let lvl = 1; lvl <= levels; lvl += step) {
      points.push(`${x(lvl).toFixed(1)},${y(fn(lvl)).toFixed(1)}`);
    }
    if ((levels - 1) % step !== 0) {
      points.push(`${x(levels).toFixed(1)},${y(fn(levels)).toFixed(1)}`);
    }
    return `M${points.join("L")}`;
  };

  const tickCount = 4;
  const yTicks = [
    ...new Set(
      Array.from({ length: tickCount + 1 }, (_, i) =>
        Math.round((maxVal / tickCount) * i),
      ),
    ),
  ];

  return (
    <div className="rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] p-3">
      <p className="mb-1.5 font-display text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted">
        HP / Mana growth (Lv 1–{levels})
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxWidth: w }}>
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              y1={y(tick)}
              x2={w - pad.right}
              y2={y(tick)}
              stroke="currentColor"
              className="text-border-muted"
              strokeWidth={0.5}
            />
            <text
              x={pad.left - 4}
              y={y(tick) + 3}
              textAnchor="end"
              className="fill-text-muted"
              fontSize={8}
            >
              {tick}
            </text>
          </g>
        ))}
        <text
          x={pad.left}
          y={h - 2}
          textAnchor="start"
          className="fill-text-muted"
          fontSize={8}
        >
          Lv1
        </text>
        <text
          x={w - pad.right}
          y={h - 2}
          textAnchor="end"
          className="fill-text-muted"
          fontSize={8}
        >
          Lv{levels}
        </text>
        <path
          d={buildPath(hpAt)}
          fill="none"
          stroke={chart.hp}
          strokeWidth={1.5}
        />
        <path
          d={buildPath(manaAt)}
          fill="none"
          stroke={chart.mana}
          strokeWidth={1.5}
        />
        <line
          x1={pad.left}
          y1={pad.top - 2}
          x2={pad.left + 14}
          y2={pad.top - 2}
          stroke={chart.hp}
          strokeWidth={1.5}
        />
        <text
          x={pad.left + 17}
          y={pad.top + 1}
          className="fill-text-secondary"
          fontSize={8}
        >
          HP ({hpAt(levels)})
        </text>
        <line
          x1={pad.left + 80}
          y1={pad.top - 2}
          x2={pad.left + 94}
          y2={pad.top - 2}
          stroke={chart.mana}
          strokeWidth={1.5}
        />
        <text
          x={pad.left + 97}
          y={pad.top + 1}
          className="fill-text-secondary"
          fontSize={8}
        >
          Mana ({manaAt(levels)})
        </text>
      </svg>
    </div>
  );
}
