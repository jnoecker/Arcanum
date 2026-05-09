import { useMemo } from "react";
import type { AppConfig } from "@/types/config";
import { NumberInput } from "@/components/ui/FormWidgets";
import { SectionCard } from "../panels/factions/SectionCard";

interface SkillCurveCardProps {
  crafting: AppConfig["crafting"];
  onPatch: (p: Partial<AppConfig["crafting"]>) => void;
}

export function SkillCurveCard({ crafting, onPatch }: SkillCurveCardProps) {
  return (
    <SectionCard
      title="Skill Curve"
      description="Define how crafting skills scale with character level."
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StackedField
            label="Max Skill Level"
            hint="Cap for all crafting skills."
          >
            <NumberInput
              value={crafting.maxSkillLevel}
              onCommit={(v) => onPatch({ maxSkillLevel: v ?? 100 })}
              min={1}
              dense
            />
          </StackedField>
          <StackedField
            label="Base XP / Level"
            hint="Higher values mean more XP per level."
          >
            <NumberInput
              value={crafting.baseXpPerLevel}
              onCommit={(v) => onPatch({ baseXpPerLevel: v ?? 50 })}
              min={1}
              dense
            />
          </StackedField>
          <StackedField
            label="XP Exponent"
            hint="Curve steepness. 1.0 = linear, 2.0+ = steeper."
          >
            <NumberInput
              value={crafting.xpExponent}
              onCommit={(v) => onPatch({ xpExponent: v ?? 1.5 })}
              min={1}
              step={0.1}
              dense
            />
          </StackedField>
        </div>
        <CurvePreview
          maxLevel={crafting.maxSkillLevel}
          base={crafting.baseXpPerLevel}
          exponent={crafting.xpExponent}
        />
      </div>
    </SectionCard>
  );
}

function StackedField({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-2xs uppercase tracking-wider text-text-muted">
        {label}
      </span>
      {children}
      <span className="text-2xs leading-snug text-text-muted/70">{hint}</span>
    </div>
  );
}

interface CurvePreviewProps {
  maxLevel: number;
  base: number;
  exponent: number;
}

function CurvePreview({ maxLevel, base, exponent }: CurvePreviewProps) {
  const points = useMemo(() => {
    const lvls = Math.max(1, Math.min(maxLevel || 10, 100));
    const samples = 20;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < samples; i += 1) {
      const lv = 1 + ((lvls - 1) * i) / (samples - 1);
      xs.push(lv);
      ys.push(base * Math.pow(lv, exponent));
    }
    const maxY = Math.max(...ys, 1);
    const w = 220;
    const h = 130;
    const padX = 18;
    const padY = 14;
    const pts = xs.map((lv, i) => {
      const x = padX + ((lv - 1) / (lvls - 1 || 1)) * (w - padX * 2);
      const y = h - padY - ((ys[i] ?? 0) / maxY) * (h - padY * 2);
      return [x, y];
    });
    const pathD =
      pts.length === 0
        ? ""
        : `M ${pts[0]![0]} ${pts[0]![1]} ` +
          pts
            .slice(1)
            .map(([x, y]) => `L ${x} ${y}`)
            .join(" ");
    const fillD =
      pts.length === 0
        ? ""
        : pathD + ` L ${pts[pts.length - 1]![0]} ${h - padY} L ${pts[0]![0]} ${h - padY} Z`;
    return { pts, pathD, fillD, w, h, padX, padY, lvls };
  }, [maxLevel, base, exponent]);

  return (
    <div className="relative w-full rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] p-2">
      <p className="px-1 font-display text-2xs font-semibold uppercase tracking-wider text-text-muted">
        XP Required per Level
      </p>
      <svg
        width="100%"
        viewBox={`0 0 ${points.w} ${points.h}`}
        className="block h-32 w-full"
        role="img"
        aria-label="XP curve preview"
      >
        <defs>
          <linearGradient id="craft-xp-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--accent-rgb))" stopOpacity="0.4" />
            <stop offset="100%" stopColor="rgb(var(--accent-rgb))" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75].map((p) => {
          const y = points.padY + (points.h - points.padY * 2) * p;
          return (
            <line
              key={p}
              x1={points.padX}
              x2={points.w - points.padX}
              y1={y}
              y2={y}
              stroke="rgb(var(--accent-rgb))"
              strokeOpacity="0.08"
              strokeDasharray="2 4"
            />
          );
        })}
        <path d={points.fillD} fill="url(#craft-xp-fill)" />
        <path
          d={points.pathD}
          fill="none"
          stroke="rgb(var(--accent-rgb))"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.pts.map(([x, y], i) =>
          i % 4 === 0 || i === points.pts.length - 1 ? (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={1.6}
              fill="rgb(var(--accent-rgb))"
            />
          ) : null,
        )}
        <text
          x={points.padX}
          y={points.padY - 4}
          fill="var(--color-text-muted)"
          fontSize="9"
          fontFamily="'JetBrains Mono', monospace"
        >
          XP
        </text>
        <text
          x={points.padX}
          y={points.h - 2}
          fill="var(--color-text-muted)"
          fontSize="9"
          fontFamily="'JetBrains Mono', monospace"
        >
          1
        </text>
        <text
          x={points.w - points.padX}
          y={points.h - 2}
          textAnchor="end"
          fill="var(--color-text-muted)"
          fontSize="9"
          fontFamily="'JetBrains Mono', monospace"
        >
          {points.lvls}
        </text>
        <text
          x={(points.w) / 2}
          y={points.h - 2}
          textAnchor="middle"
          fill="var(--color-text-muted)"
          fontSize="9"
          fontFamily="'JetBrains Mono', monospace"
        >
          Level
        </text>
      </svg>
    </div>
  );
}
