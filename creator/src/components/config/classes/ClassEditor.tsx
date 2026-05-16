import { useState } from "react";
import type { AppConfig, ClassDefinitionConfig } from "@/types/config";
import {
  TextInput,
  NumberInput,
  SelectInput,
  CommitTextarea,
} from "@/components/ui/FormWidgets";
import { SectionCard } from "@/components/ui/SectionCard";
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
    parts.push(`HP scaling rate: ${cls.hpScalingRate}, Mana scaling rate: ${cls.manaScalingRate}`);
    if (cls.threatMultiplier != null && cls.threatMultiplier !== 1.0) {
      parts.push(`Threat multiplier: ${cls.threatMultiplier}`);
    }
    return parts.join("\n");
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <IdentityCard
        id={id}
        cls={cls}
        raceOptions={raceOptions}
        onPatch={onPatch}
        onRename={onRename}
      />
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
        buildContext={buildContext}
        onPatch={onPatch}
      />
    </div>
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
  id,
  cls,
  raceOptions,
  onPatch,
  onRename,
}: {
  id: string;
  cls: ClassDefinitionConfig;
  raceOptions: { value: string; label: string }[];
  onPatch: (p: Partial<ClassDefinitionConfig>) => void;
  onRename: (v: string) => void;
}) {
  return (
    <SectionCard
      title="Identity"
      actions={
        <SelectableToggle
          checked={cls.selectable ?? true}
          onChange={(v) => onPatch({ selectable: v })}
        />
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldLabel label="Slug" required>
          <SlugRenamer id={id} onRename={onRename} />
        </FieldLabel>
        <FieldLabel label="Display Name" required>
          <TextInput
            value={cls.displayName}
            onCommit={(v) => onPatch({ displayName: v })}
            placeholder="Warrior"
            dense
          />
        </FieldLabel>
      </div>
      <div className="mt-3">
        <FieldLabel label="Tagline">
          <TextInput
            value={cls.description ?? ""}
            onCommit={(v) => onPatch({ description: v || undefined })}
            placeholder="Master of arcane forces"
            dense
          />
        </FieldLabel>
      </div>
      <div className="mt-3">
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
      <CommitTextarea
        label=""
        value={cls.backstory ?? ""}
        onCommit={(v) => onPatch({ backstory: v || undefined })}
        placeholder="Lore, training traditions, role in the world…"
        rows={5}
      />
      <div className="mt-1.5 flex justify-end">
        <EnhanceDescriptionButton
          entitySummary={buildContext()}
          currentDescription={cls.backstory}
          onAccept={(text) => onPatch({ backstory: text })}
          systemPrompt={getBackstoryEnhancePrompt()}
          label="Enhance"
        />
      </div>

      <div className="mt-4 flex flex-col gap-1">
        <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
          Outfit Description
        </span>
        <p className="text-2xs leading-snug text-text-muted/70">
          Used by sprite/portrait prompts. Body description comes from the race.
        </p>
        <CommitTextarea
          label=""
          value={cls.outfitDescription ?? ""}
          onCommit={(v) => onPatch({ outfitDescription: v || undefined })}
          placeholder="Heavy plate armor with tower shield…"
          rows={4}
        />
        <div className="mt-1.5 flex justify-end">
          <EnhanceDescriptionButton
            entitySummary={`Class: ${cls.displayName}\n${
              cls.description ? `Description: ${cls.description}` : ""
            }${cls.backstory ? `\nBackstory: ${cls.backstory}` : ""}${
              cls.primaryStat ? `\nPrimary stat: ${cls.primaryStat}` : ""
            }`}
            currentDescription={cls.outfitDescription}
            onAccept={(v) => onPatch({ outfitDescription: v })}
            systemPrompt={OUTFIT_DESC_SYSTEM_PROMPT}
            label="AI generate"
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
      <HpManaCurve
        hpScalingRate={cls.hpScalingRate}
        manaScalingRate={cls.manaScalingRate}
        maxLevel={maxLevel}
        baseHp={baseHp}
        baseMana={baseMana}
      />

      <div className="mt-3 grid grid-cols-2 gap-3">
        <FieldLabel
          label="HP Scaling Rate"
          hint="Per-level multiplicative growth (1.1 = ~10%/level)."
        >
          <NumberInput
            value={cls.hpScalingRate}
            onCommit={(v) => onPatch({ hpScalingRate: v ?? 1.1 })}
            min={1.0}
            max={2.0}
            step={0.005}
            dense
          />
        </FieldLabel>
        <FieldLabel
          label="Mana Scaling Rate"
          hint="Higher for casters, lower for melee."
        >
          <NumberInput
            value={cls.manaScalingRate}
            onCommit={(v) => onPatch({ manaScalingRate: v ?? 1.1 })}
            min={1.0}
            max={2.0}
            step={0.005}
            dense
          />
        </FieldLabel>
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
      </div>
    </SectionCard>
  );
}

// ─── Art ────────────────────────────────────────────────────────────

function ArtCard({
  id,
  cls,
  buildContext,
  onPatch,
}: {
  id: string;
  cls: ClassDefinitionConfig;
  buildContext: () => string;
  onPatch: (p: Partial<ClassDefinitionConfig>) => void;
}) {
  const assetsDir = useAssetStore((s) => s.assetsDir);
  const imagePath =
    cls.image && assetsDir ? `${assetsDir}\\images\\${cls.image}` : undefined;

  return (
    <SectionCard title="Portrait" className="lg:col-span-2">
      <EntityArtGenerator
        getPrompt={(style: ArtStyle) =>
          composePrompt("class_portrait", style, `Class: ${cls.displayName}`)
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
    </SectionCard>
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
  hpScalingRate,
  manaScalingRate,
  maxLevel,
  baseHp,
  baseMana,
}: {
  hpScalingRate: number;
  manaScalingRate: number;
  maxLevel: number;
  baseHp: number;
  baseMana: number;
}) {
  const chart = chartTokens();
  const levels = Math.max(maxLevel, 2);

  const hpAt = (lvl: number) => Math.floor(baseHp * Math.pow(hpScalingRate, lvl - 1));
  const manaAt = (lvl: number) => Math.floor(baseMana * Math.pow(manaScalingRate, lvl - 1));

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
