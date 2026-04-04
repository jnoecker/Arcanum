import { useMemo, useCallback } from "react";
import type { ConfigPanelProps } from "./types";
import type { AppConfig, ClassDefinitionConfig } from "@/types/config";
import { EnhanceDescriptionButton } from "@/components/editors/EditorShared";
import { BACKSTORY_ENHANCE_PROMPT } from "@/lib/lorePrompts";
import { chartTokens } from "@/lib/cssTokens";
import {
  FieldRow,
  NumberInput,
  TextInput,
  SelectInput,
  CheckboxInput,
  CommitTextarea,
} from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";

const OUTFIT_DESC_SYSTEM_PROMPT = `You are an expert AI image prompt engineer writing outfit descriptions for fantasy RPG character class sprites.

Given a class's name, lore, and role, write a concise but vivid prompt fragment describing the class's OUTFIT, WEAPONS, AND ACCESSORIES ONLY — not the body (that comes from the race).

Rules:
- 1-2 sentences of dense visual detail optimized for AI image generation
- Focus on: armor type, materials, weapons held, magical accessories, signature visual elements
- Describe the class fantasy silhouette — what makes this class instantly recognizable
- Include specific details: weapon types, armor weight, magical effects on gear
- Do NOT describe the body, face, skin, or hair — the race system handles those
- Output ONLY the description text — no quotes, no explanation`;
import { renameClassInConfig } from "@/lib/refactorId";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { composePrompt, type ArtStyle } from "@/lib/arcanumPrompts";
import { useAssetStore } from "@/stores/assetStore";

export function defaultClassDefinition(raw: string): ClassDefinitionConfig {
  return {
    displayName: raw,
    hpPerLevel: 6,
    manaPerLevel: 8,
    selectable: true,
  };
}

export function summarizeClass(cls: ClassDefinitionConfig): string {
  const parts = [`HP+${cls.hpPerLevel} / MP+${cls.manaPerLevel}`];
  if (cls.primaryStat) parts.push(cls.primaryStat);
  if (cls.image) parts.push("art");
  return parts.join(" | ");
}

export function renameClassDefinition(config: AppConfig, oldId: string, newId: string) {
  return renameClassInConfig(config, oldId, newId);
}

export function ClassesPanel({ config, onChange }: ConfigPanelProps) {
  const statOptions = useMemo(
    () =>
      Object.entries(config.stats.definitions).map(([id, def]) => ({
        value: id,
        label: def.displayName,
      })),
    [config.stats.definitions],
  );

  const maxLevel = config.progression.maxLevel;

  const handleRenameClass = useCallback(
    (oldId: string, newId: string) => {
      const updated = renameClassInConfig(config, oldId, newId);
      onChange({ classes: updated.classes, abilities: updated.abilities });
    },
    [config, onChange],
  );

  return (
    <RegistryPanel<ClassDefinitionConfig>
      title="Classes"
      items={config.classes}
      onItemsChange={(classes) => onChange({ classes })}
      onRenameId={handleRenameClass}
      placeholder="New class"
      idTransform={(raw) => raw.trim().toUpperCase().replace(/\s+/g, "_")}
      getDisplayName={(cls) => cls.displayName}
      defaultItem={defaultClassDefinition}
      renderSummary={(_id, cls) => summarizeClass(cls)}
      renderDetail={(id, cls, patch) => (
        <ClassDetail
          id={id}
          cls={cls}
          patch={patch}
          statOptions={statOptions}
          raceOptions={Object.keys(config.races).map((k) => ({ value: k, label: k }))}
          maxLevel={maxLevel}
          baseHp={config.progression.rewards.baseHp}
          baseMana={config.progression.rewards.baseMana}
        />
      )}
    />
  );
}

export function ClassDetail({
  id,
  cls,
  patch,
  statOptions,
  raceOptions,
  maxLevel,
  baseHp,
  baseMana,
}: {
  id: string;
  cls: ClassDefinitionConfig;
  patch: (p: Partial<ClassDefinitionConfig>) => void;
  statOptions: { value: string; label: string }[];
  raceOptions: { value: string; label: string }[];
  maxLevel: number;
  baseHp: number;
  baseMana: number;
}) {
  const assetsDir = useAssetStore((s) => s.assetsDir);

  const imagePath = cls.image && assetsDir
    ? `${assetsDir}\\images\\${cls.image}`
    : undefined;

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
    <>
      <FieldRow label="Display Name">
        <TextInput
          value={cls.displayName}
          onCommit={(v) => patch({ displayName: v })}
        />
      </FieldRow>
      <FieldRow label="Description" hint="Short tagline shown during character creation (e.g. 'Master of arcane forces').">
        <TextInput
          value={cls.description ?? ""}
          onCommit={(v) => patch({ description: v || undefined })}
          placeholder="Short tagline"
        />
      </FieldRow>

      {/* Backstory */}
      <CommitTextarea
        label="Backstory"
        value={cls.backstory ?? ""}
        onCommit={(v) => patch({ backstory: v || undefined })}
        placeholder="Lore, training traditions, role in the world..."
      />
      <EnhanceDescriptionButton
        entitySummary={buildContext()}
        currentDescription={cls.backstory}
        onAccept={(text) => patch({ backstory: text })}
        systemPrompt={BACKSTORY_ENHANCE_PROMPT}
        label="Enhance backstory"
      />

      <FieldRow label="HP / Level" hint="Class-specific HP gained per level, stacked with the global HP/level in Progression.">
        <NumberInput
          value={cls.hpPerLevel}
          onCommit={(v) => patch({ hpPerLevel: v ?? 6 })}
          min={0}
        />
      </FieldRow>
      <FieldRow label="Mana / Level" hint="Class-specific mana gained per level. Set high for casters, low for melee.">
        <NumberInput
          value={cls.manaPerLevel}
          onCommit={(v) => patch({ manaPerLevel: v ?? 8 })}
          min={0}
        />
      </FieldRow>
      <FieldRow label="Primary Stat" hint="The stat this class benefits from most. Used for UI hints and may influence ability scaling.">
        <SelectInput
          value={cls.primaryStat ?? ""}
          onCommit={(v) => patch({ primaryStat: v || undefined })}
          options={statOptions}
          allowEmpty
          placeholder="-- none --"
        />
      </FieldRow>
      <FieldRow label="Start Room" hint="Override the default start room for this class. Leave blank to use the world default.">
        <TextInput
          value={cls.startRoom ?? ""}
          onCommit={(v) => patch({ startRoom: v || undefined })}
          placeholder="zone:room_id"
        />
      </FieldRow>
      <FieldRow label="Threat Mult." hint="Scales aggro generation. >1.0 for tanks (draw more aggro), <1.0 for healers/DPS (draw less).">
        <NumberInput
          value={cls.threatMultiplier ?? 1.0}
          onCommit={(v) => patch({ threatMultiplier: v ?? 1.0 })}
          min={0}
          step={0.1}
        />
      </FieldRow>
      <CheckboxInput
        checked={cls.selectable ?? true}
        onCommit={(v) => patch({ selectable: v })}
        label="Selectable at character creation"
      />

      <HpManaCurve
        hpPerLevel={cls.hpPerLevel}
        manaPerLevel={cls.manaPerLevel}
        maxLevel={maxLevel}
        baseHp={baseHp}
        baseMana={baseMana}
      />

      {/* Sprite / Portrait Descriptions */}
      <div className="mt-1 border-t border-border-muted pt-1.5">
        <h5 className="mb-1 text-2xs font-display uppercase tracking-widest text-text-muted">
          Sprite &amp; Portrait Generation
        </h5>
        <CommitTextarea
          label="Outfit Description"
          value={cls.outfitDescription ?? ""}
          onCommit={(v) => patch({ outfitDescription: v || undefined })}
          placeholder="Class outfit, weapons, and accessories for sprite/portrait prompts (e.g. 'heavy plate armor with tower shield...')"
        />
        <EnhanceDescriptionButton
          entitySummary={`Class: ${cls.displayName}\n${cls.description ? `Description: ${cls.description}` : ""}${cls.backstory ? `\nBackstory: ${cls.backstory}` : ""}${cls.primaryStat ? `\nPrimary stat: ${cls.primaryStat}` : ""}`}
          currentDescription={cls.outfitDescription}
          onAccept={(v) => patch({ outfitDescription: v })}
          systemPrompt={OUTFIT_DESC_SYSTEM_PROMPT}
          label="AI Generate Outfit Description"
        />
        <FieldRow label="Showcase Race" hint="Race paired with this class for class portrait generation. Leave blank to use the default.">
          <SelectInput
            value={cls.showcaseRace ?? ""}
            onCommit={(v) => patch({ showcaseRace: v || undefined })}
            options={raceOptions}
            allowEmpty
            placeholder="-- default --"
          />
        </FieldRow>
      </div>

      {/* Concept Art */}
      <div className="mt-1 border-t border-border-muted pt-1.5">
        <h5 className="mb-1 text-2xs font-display uppercase tracking-widest text-text-muted">
          Concept Art
        </h5>
        <EntityArtGenerator
          getPrompt={(style: ArtStyle) =>
            composePrompt("class_portrait", style, `Class: ${cls.displayName}`)
          }
          entityContext={buildContext()}
          currentImage={imagePath}
          onAccept={(filePath) => {
            const fileName = filePath.split(/[\\/]/).pop() ?? "";
            patch({ image: fileName });
          }}
          assetType="class_portrait"
          context={{ zone: "", entity_type: "class", entity_id: id }}
        />
      </div>
    </>
  );
}

/**
 * Simple SVG line chart showing HP and Mana growth from level 1 to maxLevel.
 * Formula: basePool + (level - 1) * perLevel
 */
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

  const x = (lvl: number) =>
    pad.left + ((lvl - 1) / (levels - 1)) * plotW;
  const y = (val: number) =>
    pad.top + plotH - (val / maxVal) * plotH;

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
    <div className="mt-1 border-t border-border-muted pt-1.5">
      <h5 className="mb-1 text-2xs font-display uppercase tracking-widest text-text-muted">
        HP / Mana Growth (Levels 1-{levels})
      </h5>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full"
        style={{ maxWidth: w }}
      >
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
        <line x1={pad.left} y1={pad.top - 2} x2={pad.left + 14} y2={pad.top - 2} stroke={chart.hp} strokeWidth={1.5} />
        <text x={pad.left + 17} y={pad.top + 1} className="fill-text-secondary" fontSize={8}>
          HP ({hpAt(levels)})
        </text>
        <line x1={pad.left + 80} y1={pad.top - 2} x2={pad.left + 94} y2={pad.top - 2} stroke={chart.mana} strokeWidth={1.5} />
        <text x={pad.left + 97} y={pad.top + 1} className="fill-text-secondary" fontSize={8}>
          Mana ({manaAt(levels)})
        </text>
      </svg>
    </div>
  );
}
