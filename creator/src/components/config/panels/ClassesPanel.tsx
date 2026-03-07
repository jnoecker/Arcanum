import { useState, useCallback, useMemo } from "react";
import type { ConfigPanelProps } from "./types";
import type { ClassDefinitionConfig } from "@/types/config";
import {
  Section,
  FieldRow,
  NumberInput,
  TextInput,
  SelectInput,
  CheckboxInput,
  IconButton,
} from "@/components/ui/FormWidgets";

export function ClassesPanel({ config, onChange }: ConfigPanelProps) {
  const classes = config.classes;
  const classIds = Object.keys(classes);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newId, setNewId] = useState("");
  const [search, setSearch] = useState("");

  const statOptions = useMemo(
    () =>
      Object.entries(config.stats.definitions).map(([id, def]) => ({
        value: id,
        label: def.displayName,
      })),
    [config.stats.definitions],
  );

  const filteredIds = useMemo(() => {
    const ids = Object.keys(classes);
    if (!search.trim()) return ids;
    const q = search.toLowerCase();
    return ids.filter(
      (id) =>
        id.toLowerCase().includes(q) ||
        classes[id]!.displayName.toLowerCase().includes(q),
    );
  }, [classes, search]);

  const patchClass = (id: string, p: Partial<ClassDefinitionConfig>) =>
    onChange({
      classes: { ...classes, [id]: { ...classes[id]!, ...p } },
    });

  const deleteClass = (id: string) => {
    const next = { ...classes };
    delete next[id];
    onChange({ classes: next });
    if (expanded === id) setExpanded(null);
  };

  const addClass = useCallback(() => {
    const id = newId.trim().toUpperCase().replace(/\s+/g, "_");
    if (!id || classes[id]) return;
    onChange({
      classes: {
        ...classes,
        [id]: {
          displayName: newId.trim(),
          hpPerLevel: 6,
          manaPerLevel: 8,
          selectable: true,
        },
      },
    });
    setNewId("");
    setExpanded(id);
  }, [newId, classes, onChange]);

  const maxLevel = config.progression.maxLevel;

  return (
    <Section
      title={`Classes (${classIds.length})`}
      actions={
        <div className="flex items-center gap-1">
          <input
            className="w-28 rounded border border-border-default bg-bg-primary px-1.5 py-0.5 text-xs text-text-primary outline-none focus:border-accent/50"
            placeholder="New class"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addClass();
            }}
          />
          <IconButton onClick={addClass} title="Add class">
            +
          </IconButton>
        </div>
      }
    >
      {classIds.length > 3 && (
        <input
          className="mb-2 w-full rounded border border-border-default bg-bg-primary px-1.5 py-0.5 text-xs text-text-primary outline-none focus:border-accent/50"
          placeholder="Search classes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      {filteredIds.length === 0 ? (
        <p className="text-xs text-text-muted">
          {classIds.length === 0 ? "No classes defined" : "No matches"}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {filteredIds.map((id) => {
            const cls = classes[id]!;
            const isOpen = expanded === id;
            return (
              <div
                key={id}
                className="rounded border border-border-muted bg-bg-primary"
              >
                <div
                  className="flex cursor-pointer items-center justify-between px-2 py-1.5"
                  onClick={() => setExpanded(isOpen ? null : id)}
                >
                  <span className="text-xs text-text-primary">
                    <span className="font-semibold">{cls.displayName}</span>
                    <span className="ml-2 text-text-muted">{id}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-text-muted">
                      HP+{cls.hpPerLevel} / MP+{cls.manaPerLevel}
                    </span>
                    <span onClick={(ev) => ev.stopPropagation()}>
                      <IconButton
                        onClick={() => deleteClass(id)}
                        title="Delete"
                        danger
                      >
                        x
                      </IconButton>
                    </span>
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t border-border-muted px-2 py-2">
                    <div className="flex flex-col gap-1.5">
                      <FieldRow label="Display Name">
                        <TextInput
                          value={cls.displayName}
                          onCommit={(v) =>
                            patchClass(id, { displayName: v })
                          }
                        />
                      </FieldRow>
                      <FieldRow label="Description">
                        <TextInput
                          value={cls.description ?? ""}
                          onCommit={(v) =>
                            patchClass(id, {
                              description: v || undefined,
                            })
                          }
                          placeholder="optional"
                        />
                      </FieldRow>
                      <FieldRow label="HP / Level">
                        <NumberInput
                          value={cls.hpPerLevel}
                          onCommit={(v) =>
                            patchClass(id, { hpPerLevel: v ?? 6 })
                          }
                          min={0}
                        />
                      </FieldRow>
                      <FieldRow label="Mana / Level">
                        <NumberInput
                          value={cls.manaPerLevel}
                          onCommit={(v) =>
                            patchClass(id, { manaPerLevel: v ?? 8 })
                          }
                          min={0}
                        />
                      </FieldRow>
                      <FieldRow label="Primary Stat">
                        <SelectInput
                          value={cls.primaryStat ?? ""}
                          onCommit={(v) =>
                            patchClass(id, {
                              primaryStat: v || undefined,
                            })
                          }
                          options={statOptions}
                          allowEmpty
                          placeholder="-- none --"
                        />
                      </FieldRow>
                      <FieldRow label="Start Room">
                        <TextInput
                          value={cls.startRoom ?? ""}
                          onCommit={(v) =>
                            patchClass(id, {
                              startRoom: v || undefined,
                            })
                          }
                          placeholder="zone:room_id"
                        />
                      </FieldRow>
                      <CheckboxInput
                        checked={cls.selectable ?? true}
                        onCommit={(v) =>
                          patchClass(id, { selectable: v })
                        }
                        label="Selectable at character creation"
                      />

                      {/* HP / Mana curve graph */}
                      <HpManaCurve
                        hpPerLevel={cls.hpPerLevel}
                        manaPerLevel={cls.manaPerLevel}
                        maxLevel={maxLevel}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

/**
 * Simple SVG line chart showing HP and Mana growth from level 1 to maxLevel.
 * Formula: basePool + (level - 1) * perLevel
 * Uses base HP=10, base Mana=10 as typical starting values.
 */
function HpManaCurve({
  hpPerLevel,
  manaPerLevel,
  maxLevel,
}: {
  hpPerLevel: number;
  manaPerLevel: number;
  maxLevel: number;
}) {
  const baseHp = 10;
  const baseMana = 10;
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

  // Y-axis ticks (deduplicate to avoid duplicate keys when maxVal is small)
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
      <h5 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        HP / Mana Growth (Levels 1-{levels})
      </h5>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full"
        style={{ maxWidth: w }}
      >
        {/* Grid lines + Y labels */}
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
        {/* X-axis labels */}
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
        {/* HP line */}
        <path
          d={buildPath(hpAt)}
          fill="none"
          stroke="#ef4444"
          strokeWidth={1.5}
        />
        {/* Mana line */}
        <path
          d={buildPath(manaAt)}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={1.5}
        />
        {/* Legend */}
        <line x1={pad.left} y1={pad.top - 2} x2={pad.left + 14} y2={pad.top - 2} stroke="#ef4444" strokeWidth={1.5} />
        <text x={pad.left + 17} y={pad.top + 1} className="fill-text-secondary" fontSize={8}>
          HP ({hpAt(levels)})
        </text>
        <line x1={pad.left + 80} y1={pad.top - 2} x2={pad.left + 94} y2={pad.top - 2} stroke="#3b82f6" strokeWidth={1.5} />
        <text x={pad.left + 97} y={pad.top + 1} className="fill-text-secondary" fontSize={8}>
          Mana ({manaAt(levels)})
        </text>
      </svg>
    </div>
  );
}
