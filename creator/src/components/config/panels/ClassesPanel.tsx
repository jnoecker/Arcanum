import { useMemo, useCallback } from "react";
import type { ConfigPanelProps } from "./types";
import type { ClassDefinitionConfig } from "@/types/config";
import {
  FieldRow,
  NumberInput,
  TextInput,
  SelectInput,
  CheckboxInput,
} from "@/components/ui/FormWidgets";
import { RegistryPanel } from "./RegistryPanel";
import { renameClassInConfig } from "@/lib/refactorId";

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
      defaultItem={(raw) => ({
        displayName: raw,
        hpPerLevel: 6,
        manaPerLevel: 8,
        selectable: true,
      })}
      renderSummary={(_id, cls) =>
        `HP+${cls.hpPerLevel} / MP+${cls.manaPerLevel}`
      }
      renderDetail={(_id, cls, patch) => (
        <>
          <FieldRow label="Display Name">
            <TextInput
              value={cls.displayName}
              onCommit={(v) => patch({ displayName: v })}
            />
          </FieldRow>
          <FieldRow label="Description">
            <TextInput
              value={cls.description ?? ""}
              onCommit={(v) => patch({ description: v || undefined })}
              placeholder="optional"
            />
          </FieldRow>
          <FieldRow label="HP / Level">
            <NumberInput
              value={cls.hpPerLevel}
              onCommit={(v) => patch({ hpPerLevel: v ?? 6 })}
              min={0}
            />
          </FieldRow>
          <FieldRow label="Mana / Level">
            <NumberInput
              value={cls.manaPerLevel}
              onCommit={(v) => patch({ manaPerLevel: v ?? 8 })}
              min={0}
            />
          </FieldRow>
          <FieldRow label="Primary Stat">
            <SelectInput
              value={cls.primaryStat ?? ""}
              onCommit={(v) => patch({ primaryStat: v || undefined })}
              options={statOptions}
              allowEmpty
              placeholder="-- none --"
            />
          </FieldRow>
          <FieldRow label="Start Room">
            <TextInput
              value={cls.startRoom ?? ""}
              onCommit={(v) => patch({ startRoom: v || undefined })}
              placeholder="zone:room_id"
            />
          </FieldRow>
          <FieldRow label="Threat Mult.">
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
            baseHp={config.progression.rewards.baseHp}
            baseMana={config.progression.rewards.baseMana}
          />
        </>
      )}
    />
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
      <h5 className="mb-1 text-[10px] font-display uppercase tracking-widest text-text-muted">
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
          stroke="#c05060"
          strokeWidth={1.5}
        />
        <path
          d={buildPath(manaAt)}
          fill="none"
          stroke="#4e7fd4"
          strokeWidth={1.5}
        />
        <line x1={pad.left} y1={pad.top - 2} x2={pad.left + 14} y2={pad.top - 2} stroke="#c05060" strokeWidth={1.5} />
        <text x={pad.left + 17} y={pad.top + 1} className="fill-text-secondary" fontSize={8}>
          HP ({hpAt(levels)})
        </text>
        <line x1={pad.left + 80} y1={pad.top - 2} x2={pad.left + 94} y2={pad.top - 2} stroke="#4e7fd4" strokeWidth={1.5} />
        <text x={pad.left + 97} y={pad.top + 1} className="fill-text-secondary" fontSize={8}>
          Mana ({manaAt(levels)})
        </text>
      </svg>
    </div>
  );
}
